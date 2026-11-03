import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { AppError } from "../domain/errors.js";
import { openDatabase } from "../infrastructure/database.js";
import { acquireProcessLock } from "../infrastructure/lock.js";
import { databasePath } from "../infrastructure/paths.js";
import { runInTransaction } from "../infrastructure/transaction.js";

export type JobState = "pendente" | "executando" | "concluida" | "falha" | "cancelada" | "incerta";

export interface JobRow {
  id: string;
  kind: string;
  state: JobState;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
  error: string | null;
  checkpoint: unknown;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JobContext {
  dataDir: string;
  now: () => Date;
}

export function enqueueJob(
  context: JobContext,
  input: { kind: string; payload: Record<string, unknown>; idempotencyKey: string | null; maxAttempts?: number },
): JobRow {
  return withJobs(context.dataDir, (db) => {
    if (input.idempotencyKey) {
      const existing = db.prepare("SELECT * FROM jobs WHERE idempotency_key = ?").get(input.idempotencyKey) as
        | Record<string, unknown>
        | undefined;
      if (existing) {
        return mapJob(existing);
      }
    }
    const now = context.now().toISOString();
    const id = `job_${randomUUID()}`;
    db.prepare(
      `INSERT INTO jobs (
        id, kind, state, payload_json, attempts, max_attempts, error, checkpoint_json, idempotency_key,
        created_at, updated_at, started_at, finished_at
      ) VALUES (?, ?, 'pendente', ?, 0, ?, NULL, NULL, ?, ?, ?, NULL, NULL)`,
    ).run(id, input.kind, JSON.stringify(input.payload), input.maxAttempts ?? 3, input.idempotencyKey, now, now);
    return requireJob(db, id);
  });
}

export function claimNext(context: JobContext): JobRow | null {
  return withJobs(context.dataDir, (db) =>
    runInTransaction(db, () => {
      const row = db
        .prepare("SELECT id FROM jobs WHERE state = 'pendente' ORDER BY created_at LIMIT 1")
        .get() as { id: string } | undefined;
      if (!row) {
        return null;
      }
      const now = context.now().toISOString();
      const result = db
        .prepare(
          `UPDATE jobs
           SET state = 'executando', attempts = attempts + 1, started_at = ?, updated_at = ?
           WHERE id = ? AND state = 'pendente'`,
        )
        .run(now, now, row.id);
      if (Number(result.changes) !== 1) {
        return null;
      }
      return requireJob(db, row.id);
    }),
  );
}

export function finishJob(context: JobContext, id: string, checkpoint: unknown, done: boolean, error: string | null): JobRow {
  return withJobs(context.dataDir, (db) => {
    const current = requireJob(db, id);
    if (current.state === "cancelada") {
      return current;
    }
    const now = context.now().toISOString();
    let state: JobState = done ? "concluida" : "pendente";
    if (error) {
      state = current.attempts >= current.maxAttempts ? "falha" : "pendente";
    }
    db.prepare(
      `UPDATE jobs
       SET state = ?, checkpoint_json = ?, error = ?, updated_at = ?, finished_at = ?
       WHERE id = ? AND state = 'executando'`,
    ).run(state, checkpoint === undefined ? null : JSON.stringify(checkpoint), error, now, state === "concluida" || state === "falha" ? now : null, id);
    return requireJob(db, id);
  });
}

export function cancelJob(context: JobContext, id: string): JobRow {
  return withJobs(context.dataDir, (db) => {
    const now = context.now().toISOString();
    const result = db
      .prepare(
        `UPDATE jobs SET state = 'cancelada', updated_at = ?, finished_at = ?
         WHERE id = ? AND state IN ('pendente', 'executando')`,
      )
      .run(now, now, id);
    if (Number(result.changes) !== 1) {
      const current = selectJob(db, id);
      if (!current) {
        throw new AppError(`Tarefa não encontrada: ${id}.`, "not_found");
      }
      throw new AppError(`A tarefa está ${current.state} e não pode ser cancelada.`, "conflict");
    }
    return requireJob(db, id);
  });
}

export function recoverExecuting(context: JobContext): number {
  return withJobs(context.dataDir, (db) => {
    const now = context.now().toISOString();
    const result = db
      .prepare("UPDATE jobs SET state = 'incerta', updated_at = ? WHERE state = 'executando'")
      .run(now);
    return Number(result.changes);
  });
}

export function jobCounts(dataDir: string): Record<JobState, number> {
  return withJobs(dataDir, (db) => {
    const rows = db.prepare("SELECT state, COUNT(*) AS total FROM jobs GROUP BY state").all() as unknown as Array<{
      state: JobState;
      total: number;
    }>;
    const counts: Record<JobState, number> = {
      pendente: 0,
      executando: 0,
      concluida: 0,
      falha: 0,
      cancelada: 0,
      incerta: 0,
    };
    for (const row of rows) {
      counts[row.state] = Number(row.total);
    }
    return counts;
  });
}

export function countJobs(dataDir: string): number {
  return withJobs(dataDir, (db) => {
    const row = db.prepare("SELECT COUNT(*) AS total FROM jobs").get() as { total: number };
    return Number(row.total);
  });
}

function withJobs<T>(dataDir: string, fn: (db: DatabaseSync) => T): T {
  const file = databasePath(dataDir);
  const release = acquireProcessLock(`${file}.lock`);
  try {
    const db = openDatabase(file);
    try {
      return fn(db);
    } finally {
      db.close();
    }
  } finally {
    release();
  }
}

function requireJob(db: DatabaseSync, id: string): JobRow {
  const row = selectJob(db, id);
  if (!row) {
    throw new AppError(`Tarefa não encontrada: ${id}.`, "not_found");
  }
  return row;
}

function selectJob(db: DatabaseSync, id: string): JobRow | null {
  const row = db.prepare("SELECT * FROM jobs WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapJob(row) : null;
}

function mapJob(row: Record<string, unknown>): JobRow {
  return {
    id: String(row.id),
    kind: String(row.kind),
    state: String(row.state) as JobState,
    payload: JSON.parse(String(row.payload_json)) as Record<string, unknown>,
    attempts: Number(row.attempts),
    maxAttempts: Number(row.max_attempts),
    error: row.error === null ? null : String(row.error),
    checkpoint: row.checkpoint_json === null ? null : JSON.parse(String(row.checkpoint_json)),
    idempotencyKey: row.idempotency_key === null ? null : String(row.idempotency_key),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}
