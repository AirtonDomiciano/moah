import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { isActionStatus, isDomain, isRecordType } from "../domain/constants.js";
import { AppError } from "../domain/errors.js";
import type {
  ActionItem,
  ActionQuery,
  ActionView,
  CheckpointQuery,
  Decision,
  NormalizedRecord,
  WorkRecord,
} from "../domain/types.js";
import { asRow, nullableString, requiredNumber, requiredString } from "./rows.js";
import { runInTransaction } from "./transaction.js";

export function insertRecord(db: DatabaseSync, input: NormalizedRecord, createdAt: string): WorkRecord {
  const record = materialize(input, createdAt);
  runInTransaction(db, () => {
    writeRecord(db, record);
  });
  return record;
}

export function writeRecord(db: DatabaseSync, record: WorkRecord): void {
  db.prepare(
    `INSERT INTO records (
      id, type, domain, project, body, origin, agent, occurred_at, created_at, next_step
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    record.id,
    record.type,
    record.domain,
    record.project,
    record.text,
    record.origin,
    record.agent,
    record.occurredAt,
    record.createdAt,
    record.nextStep,
  );
  const insertDecision = db.prepare(
    "INSERT INTO decisions (id, record_id, body, position) VALUES (?, ?, ?, ?)",
  );
  record.decisions.forEach((decision, position) => {
    insertDecision.run(decision.id, record.id, decision.text, position);
  });
  const insertAction = db.prepare(
    `INSERT INTO actions (
      id, record_id, description, owner, due_on, status, completed_at, position
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  record.actions.forEach((action, position) => {
    insertAction.run(
      action.id,
      record.id,
      action.description,
      action.owner,
      action.dueOn,
      action.status,
      action.completedAt,
      position,
    );
  });
  const insertRef = db.prepare(
    "INSERT INTO record_refs (id, record_id, ref, position) VALUES (?, ?, ?, ?)",
  );
  record.refs.forEach((ref, position) => {
    insertRef.run(newId("ref"), record.id, ref, position);
  });
}

export function listRecordsInRange(
  db: DatabaseSync,
  startIso: string,
  endIso: string,
  domain: string | null,
  project: string | null,
): WorkRecord[] {
  const filters = ["occurred_at >= ?", "occurred_at < ?"];
  const params: Array<string | null> = [startIso, endIso];
  if (domain) {
    filters.push("domain = ?");
    params.push(domain);
  }
  if (project) {
    filters.push("project = ?");
    params.push(project);
  }
  const rows = db
    .prepare(`SELECT * FROM records WHERE ${filters.join(" AND ")} ORDER BY occurred_at ASC, created_at ASC, id ASC`)
    .all(...params);
  return hydrate(db, rows);
}

export function listActions(db: DatabaseSync, query: ActionQuery): ActionView[] {
  const filters: string[] = [];
  const params: Array<string | null> = [];
  if (query.status !== "todas") {
    filters.push("actions.status = ?");
    params.push(query.status);
  }
  if (query.domain) {
    filters.push("records.domain = ?");
    params.push(query.domain);
  }
  if (query.project) {
    filters.push("records.project = ?");
    params.push(query.project);
  }
  const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
  const rows = db
    .prepare(
      `SELECT actions.*, records.type AS record_type, records.domain AS record_domain,
              records.project AS record_project, records.origin AS record_origin,
              records.occurred_at AS record_occurred_at
       FROM actions
       JOIN records ON records.id = actions.record_id
       ${where}
       ORDER BY records.occurred_at ASC, actions.position ASC, actions.id ASC`,
    )
    .all(...params);
  return rows.map((value) => {
    const row = asRow(value);
    if (!row) {
      throw new AppError("Resposta inesperada do SQLite.", "persistence");
    }
    return mapActionView(row);
  });
}

export function completeAction(db: DatabaseSync, actionId: string, completedAt: string): ActionView {
  return runInTransaction(db, () => {
    const updated = db
      .prepare("UPDATE actions SET status = 'concluida', completed_at = ? WHERE id = ? AND status = 'pendente'")
      .run(completedAt, actionId);
    if (Number(updated.changes) === 1) {
      const view = findAction(db, actionId);
      if (!view) {
        throw new AppError("A ação foi atualizada, mas não pôde ser lida.", "persistence");
      }
      return view;
    }
    const existing = findAction(db, actionId);
    if (!existing) {
      throw new AppError(`Ação não encontrada: ${actionId}.`, "not_found");
    }
    throw new AppError(`A ação ${actionId} já está concluída.`, "conflict");
  });
}

export function latestCheckpoint(db: DatabaseSync, query: CheckpointQuery): WorkRecord | null {
  const params: Array<string | null> = [query.domain];
  let projectSql = "";
  if (query.project) {
    projectSql = "AND project = ?";
    params.push(query.project);
  }
  const row = db
    .prepare(
      `SELECT * FROM records
       WHERE type = 'checkpoint' AND domain = ? ${projectSql}
       ORDER BY occurred_at DESC, created_at DESC, id DESC
       LIMIT 1`,
    )
    .get(...params);
  const records = hydrate(db, row === undefined ? [] : [row]);
  return records[0] ?? null;
}

export function countRecords(db: DatabaseSync): number {
  const row = asRow(db.prepare("SELECT COUNT(*) AS total FROM records").get());
  return row ? requiredNumber(row, "total") : 0;
}

function materialize(input: NormalizedRecord, createdAt: string): WorkRecord {
  return {
    id: newId("rec"),
    type: input.type,
    domain: input.domain,
    project: input.project,
    text: input.text,
    origin: input.origin,
    agent: input.agent,
    occurredAt: input.occurredAt,
    createdAt,
    nextStep: input.nextStep,
    decisions: input.decisions.map((text) => ({ id: newId("dec"), text })),
    actions: input.actions.map((action) => ({
      id: newId("act"),
      description: action.description,
      owner: action.owner,
      dueOn: action.dueOn,
      status: "pendente",
      completedAt: null,
    })),
    refs: input.refs,
  };
}

function hydrate(db: DatabaseSync, values: unknown[]): WorkRecord[] {
  const rows = values.map((value) => {
    const row = asRow(value);
    if (!row) {
      throw new AppError("Resposta inesperada do SQLite.", "persistence");
    }
    return row;
  });
  if (rows.length === 0) {
    return [];
  }
  const ids = rows.map((row) => requiredString(row, "id"));
  const marks = ids.map(() => "?").join(", ");
  const decisions = groupByRecord(
    db.prepare(`SELECT * FROM decisions WHERE record_id IN (${marks}) ORDER BY position ASC`).all(...ids),
  );
  const actions = groupByRecord(
    db.prepare(`SELECT * FROM actions WHERE record_id IN (${marks}) ORDER BY position ASC`).all(...ids),
  );
  const refs = groupByRecord(
    db.prepare(`SELECT * FROM record_refs WHERE record_id IN (${marks}) ORDER BY position ASC`).all(...ids),
  );
  return rows.map((row) => mapRecord(row, decisions, actions, refs));
}

function groupByRecord(values: unknown[]): Map<string, Record<string, unknown>[]> {
  const grouped = new Map<string, Record<string, unknown>[]>();
  for (const value of values) {
    const row = asRow(value);
    if (!row) {
      throw new AppError("Resposta inesperada do SQLite.", "persistence");
    }
    const recordId = requiredString(row, "record_id");
    const list = grouped.get(recordId) ?? [];
    list.push(row);
    grouped.set(recordId, list);
  }
  return grouped;
}

function mapRecord(
  row: Record<string, unknown>,
  decisions: Map<string, Record<string, unknown>[]>,
  actions: Map<string, Record<string, unknown>[]>,
  refs: Map<string, Record<string, unknown>[]>,
): WorkRecord {
  const id = requiredString(row, "id");
  const type = requiredString(row, "type");
  const domain = requiredString(row, "domain");
  if (!isRecordType(type) || !isDomain(domain)) {
    throw new AppError(`Registro ${id} tem tipo ou domínio inválido no banco.`, "persistence");
  }
  return {
    id,
    type,
    domain,
    project: nullableString(row, "project"),
    text: requiredString(row, "body"),
    origin: requiredString(row, "origin"),
    agent: requiredString(row, "agent"),
    occurredAt: requiredString(row, "occurred_at"),
    createdAt: requiredString(row, "created_at"),
    nextStep: nullableString(row, "next_step"),
    decisions: (decisions.get(id) ?? []).map(mapDecision),
    actions: (actions.get(id) ?? []).map(mapAction),
    refs: (refs.get(id) ?? []).map((ref) => requiredString(ref, "ref")),
  };
}

function mapDecision(row: Record<string, unknown>): Decision {
  return { id: requiredString(row, "id"), text: requiredString(row, "body") };
}

function mapAction(row: Record<string, unknown>): ActionItem {
  const status = requiredString(row, "status");
  if (!isActionStatus(status)) {
    throw new AppError(`Ação ${requiredString(row, "id")} tem estado inválido no banco.`, "persistence");
  }
  return {
    id: requiredString(row, "id"),
    description: requiredString(row, "description"),
    owner: nullableString(row, "owner"),
    dueOn: nullableString(row, "due_on"),
    status,
    completedAt: nullableString(row, "completed_at"),
  };
}

function mapActionView(row: Record<string, unknown>): ActionView {
  const recordType = requiredString(row, "record_type");
  const domain = requiredString(row, "record_domain");
  if (!isRecordType(recordType) || !isDomain(domain)) {
    throw new AppError("Vínculo de ação inválido no banco.", "persistence");
  }
  return {
    action: mapAction(row),
    recordId: requiredString(row, "record_id"),
    recordType,
    domain,
    project: nullableString(row, "record_project"),
    origin: requiredString(row, "record_origin"),
    occurredAt: requiredString(row, "record_occurred_at"),
  };
}

function findAction(db: DatabaseSync, actionId: string): ActionView | null {
  const row = asRow(
    db
      .prepare(
        `SELECT actions.*, records.type AS record_type, records.domain AS record_domain,
                records.project AS record_project, records.origin AS record_origin,
                records.occurred_at AS record_occurred_at
         FROM actions
         JOIN records ON records.id = actions.record_id
         WHERE actions.id = ?`,
      )
      .get(actionId),
  );
  return row ? mapActionView(row) : null;
}

function newId(prefix: string): string {
  return `${prefix}_${randomUUID()}`;
}
