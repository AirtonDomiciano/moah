import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import { isDomain, type Domain } from "../domain/constants.js";
import { AppError } from "../domain/errors.js";
import { openDatabase } from "../infrastructure/database.js";
import { acquireProcessLock } from "../infrastructure/lock.js";
import { databasePath } from "../infrastructure/paths.js";
import { runInTransaction } from "../infrastructure/transaction.js";

export interface CalendarEventInput {
  externalId: string;
  version: string;
  domain: Domain;
  title: string;
  startsAt: string;
  endsAt: string;
  status: "confirmado" | "cancelado";
  reminderAt: string | null;
}

export interface CalendarContext {
  dataDir: string;
  timeZone: string;
  now: () => Date;
  quietStart: string;
  quietEnd: string;
}

export interface ReminderTick {
  delivered: number;
  overdue: number;
  deferred: number;
}

const SOURCE = "sintetica";

function eventKey(domain: string, externalId: string): string {
  return `${domain}\u0000${externalId}`;
}

export function syncSyntheticCalendar(
  context: CalendarContext,
  scope: Domain,
  events: CalendarEventInput[],
): { upserted: number; cancelled: number } {
  if (!isDomain(scope)) {
    throw new AppError("A sincronização precisa de um domínio pessoal, imex ou aluai.", "validation");
  }
  for (const event of events) {
    if (event.domain !== scope) {
      throw new AppError("O evento não pertence ao domínio declarado na sincronização.", "validation");
    }
  }
  return withDb(context.dataDir, (db) =>
    runInTransaction(db, () => {
      const now = context.now().toISOString();
      const seen = new Set<string>();
      let upserted = 0;
      for (const event of events) {
        seen.add(eventKey(scope, event.externalId));
        const current = db
          .prepare("SELECT id, version FROM calendar_events WHERE source = ? AND domain = ? AND external_id = ?")
          .get(SOURCE, event.domain, event.externalId) as { id: string; version: string } | undefined;
        if (current && current.version === event.version) {
          continue;
        }
        const id = current?.id ?? `evt_${randomUUID()}`;
        if (current) {
          db.prepare(
            `UPDATE calendar_events
             SET version = ?, domain = ?, title = ?, starts_at = ?, ends_at = ?, status = ?, updated_at = ?
             WHERE id = ?`,
          ).run(event.version, event.domain, event.title, event.startsAt, event.endsAt, event.status, now, id);
          db.prepare("UPDATE reminders SET state = 'cancelado' WHERE event_id = ? AND state IN ('agendado', 'adiado')").run(id);
        } else {
          db.prepare(
            `INSERT INTO calendar_events (
              id, source, external_id, version, domain, title, starts_at, ends_at, status, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          ).run(id, SOURCE, event.externalId, event.version, event.domain, event.title, event.startsAt, event.endsAt, event.status, now);
        }
        if (event.status === "confirmado" && event.reminderAt) {
          db.prepare(
            `INSERT INTO reminders (id, event_id, fire_at, state, snooze_until, attempts, delivered_at)
             VALUES (?, ?, ?, 'agendado', NULL, 0, NULL)`,
          ).run(`lem_${randomUUID()}`, id, event.reminderAt);
        }
        upserted += 1;
      }
      const existing = db.prepare("SELECT id, domain, external_id FROM calendar_events WHERE source = ? AND status = 'confirmado'").all(SOURCE) as unknown as Array<{
        id: string;
        domain: string;
        external_id: string;
      }>;
      let cancelled = 0;
      for (const row of existing) {
        if (row.domain !== scope || seen.has(eventKey(row.domain, row.external_id))) {
          continue;
        }
        db.prepare("UPDATE calendar_events SET status = 'cancelado', updated_at = ? WHERE id = ?").run(now, row.id);
        db.prepare("UPDATE reminders SET state = 'cancelado' WHERE event_id = ? AND state IN ('agendado', 'adiado')").run(row.id);
        cancelled += 1;
      }
      return { upserted, cancelled };
    }),
  );
}

export function tickReminders(context: CalendarContext): ReminderTick {
  return withDb(context.dataDir, (db) =>
    runInTransaction(db, () => {
      const now = context.now();
      const nowIso = now.toISOString();
      const previous = db.prepare("SELECT value FROM runtime_marks WHERE name = 'agenda.tick'").get() as { value: string } | undefined;
      const quiet = inQuietHours(now, context.timeZone, context.quietStart, context.quietEnd);
      const rows = db
        .prepare(
          `SELECT reminders.id, reminders.fire_at, reminders.state, reminders.snooze_until, calendar_events.status AS event_status
           FROM reminders JOIN calendar_events ON calendar_events.id = reminders.event_id
           WHERE reminders.state IN ('agendado', 'adiado')`,
        )
        .all() as unknown as Array<{ id: string; fire_at: string; state: string; snooze_until: string | null; event_status: string }>;
      const tick: ReminderTick = { delivered: 0, overdue: 0, deferred: 0 };
      let earliestDeferred: string | null = null;
      for (const row of rows) {
        if (row.event_status === "cancelado") {
          db.prepare("UPDATE reminders SET state = 'cancelado' WHERE id = ?").run(row.id);
          continue;
        }
        const due = row.state === "adiado" ? row.snooze_until ?? row.fire_at : row.fire_at;
        if (due > nowIso) {
          continue;
        }
        if (quiet) {
          tick.deferred += 1;
          if (earliestDeferred === null || due < earliestDeferred) {
            earliestDeferred = due;
          }
          continue;
        }
        const missed = previous ? due <= previous.value : due < nowIso;
        const state = missed ? "vencido" : "entregue";
        db.prepare("UPDATE reminders SET state = ?, attempts = attempts + 1, delivered_at = ? WHERE id = ?").run(
          state,
          state === "entregue" ? nowIso : null,
          row.id,
        );
        db.prepare("INSERT INTO notifications (id, reminder_id, state, detail, created_at) VALUES (?, ?, ?, ?, ?)").run(
          `not_${randomUUID()}`,
          row.id,
          state,
          state === "entregue"
            ? "Lembrete registrado localmente. Entrega, tentativa e confirmação são registros distintos. O PC desligado não garante aviso."
            : "O horário passou antes desta execução. O lembrete ficou vencido, sem confirmação de entrega.",
          nowIso,
        );
        if (state === "entregue") {
          tick.delivered += 1;
        } else {
          tick.overdue += 1;
        }
      }
      if (earliestDeferred) {
        const held = previous?.value ?? shiftBack(earliestDeferred);
        db.prepare(
          `INSERT INTO runtime_marks (name, value) VALUES ('agenda.tick', ?)
           ON CONFLICT(name) DO UPDATE SET value = excluded.value`,
        ).run(held);
      } else {
        db.prepare(
          `INSERT INTO runtime_marks (name, value) VALUES ('agenda.tick', ?)
           ON CONFLICT(name) DO UPDATE SET value = excluded.value`,
        ).run(nowIso);
      }
      return tick;
    }),
  );
}

export function snoozeReminder(context: CalendarContext, reminderId: string, untilIso: string): void {
  withDb(context.dataDir, (db) => {
    const result = db
      .prepare("UPDATE reminders SET state = 'adiado', snooze_until = ? WHERE id = ? AND state IN ('agendado', 'entregue', 'vencido', 'adiado')")
      .run(untilIso, reminderId);
    if (Number(result.changes) !== 1) {
      throw new AppError("Lembrete não encontrado para adiamento.", "not_found");
    }
  });
}

export function listEvents(dataDir: string): Array<{ id: string; title: string; status: string; domain: string }> {
  return withDb(dataDir, (db) =>
    db.prepare("SELECT id, title, status, domain FROM calendar_events ORDER BY starts_at").all() as unknown as Array<{
      id: string;
      title: string;
      status: string;
      domain: string;
    }>,
  );
}

function shiftBack(iso: string): string {
  return new Date(Date.parse(iso) - 1).toISOString();
}

function inQuietHours(now: Date, timeZone: string, start: string, end: string): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const current = hour * 60 + minute;
  const [startHour, startMinute] = start.split(":").map(Number);
  const [endHour, endMinute] = end.split(":").map(Number);
  const from = (startHour ?? 0) * 60 + (startMinute ?? 0);
  const to = (endHour ?? 0) * 60 + (endMinute ?? 0);
  if (from === to) {
    return false;
  }
  if (from < to) {
    return current >= from && current < to;
  }
  return current >= from || current < to;
}

function withDb<T>(dataDir: string, fn: (db: DatabaseSync) => T): T {
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
