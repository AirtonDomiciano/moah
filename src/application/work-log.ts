import type { DatabaseSync } from "node:sqlite";
import type {
  ActionQuery,
  ActionView,
  CheckpointQuery,
  DailySummary,
  DayQuery,
  NormalizedRecord,
  WorkRecord,
} from "../domain/types.js";
import { civilDayBounds } from "../domain/time.js";
import { openDatabase } from "../infrastructure/database.js";
import { acquireProcessLock } from "../infrastructure/lock.js";
import { databasePath } from "../infrastructure/paths.js";
import * as repo from "../infrastructure/repository.js";

export interface WorkLogContext {
  dataDir: string;
  timeZone: string;
  now: () => Date;
}

export function registerRecord(context: WorkLogContext, input: NormalizedRecord): WorkRecord {
  return withDatabase(context.dataDir, (db) => repo.insertRecord(db, input, context.now().toISOString()));
}

export function listDay(context: WorkLogContext, query: DayQuery): WorkRecord[] {
  const bounds = civilDayBounds(query.date, context.timeZone);
  return withDatabase(context.dataDir, (db) =>
    repo.listRecordsInRange(db, bounds.startIso, bounds.endIso, query.domain, query.project),
  );
}

export function listPending(context: WorkLogContext, query: ActionQuery): ActionView[] {
  return withDatabase(context.dataDir, (db) => repo.listActions(db, query));
}

export function concludeAction(context: WorkLogContext, actionId: string): ActionView {
  return withDatabase(context.dataDir, (db) => repo.completeAction(db, actionId, context.now().toISOString()));
}

export function findCheckpoint(context: WorkLogContext, query: CheckpointQuery): WorkRecord | null {
  return withDatabase(context.dataDir, (db) => repo.latestCheckpoint(db, query));
}

export function summarizeDay(context: WorkLogContext, query: DayQuery): DailySummary {
  const records = listDay(context, query);
  const decisions = records.flatMap((record) =>
    record.decisions.map((decision) => ({
      recordId: record.id,
      origin: record.origin,
      text: decision.text,
    })),
  );
  const actions = records.flatMap((record) =>
    record.actions.map((action) => ({
      action,
      recordId: record.id,
      recordType: record.type,
      domain: record.domain,
      project: record.project,
      origin: record.origin,
      occurredAt: record.occurredAt,
    })),
  );
  return {
    date: query.date,
    timezone: context.timeZone,
    domain: query.domain,
    project: query.project,
    activities: records.filter((record) => record.type === "atividade"),
    meetings: records.filter((record) => record.type === "reuniao"),
    checkpoints: records.filter((record) => record.type === "checkpoint"),
    decisions,
    pendingActions: actions.filter((item) => item.action.status === "pendente"),
    concludedActions: actions.filter((item) => item.action.status === "concluida"),
  };
}

function withDatabase<T>(dataDir: string, fn: (db: DatabaseSync) => T): T {
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
