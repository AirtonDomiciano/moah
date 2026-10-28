import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { AppError } from "../src/domain/errors.js";
import { civilDayBounds } from "../src/domain/time.js";
import type { NormalizedRecord, WorkRecord } from "../src/domain/types.js";
import { validateRecord } from "../src/domain/validate.js";
import { openDatabase } from "../src/infrastructure/database.js";
import {
  completeAction,
  countRecords,
  insertRecord,
  latestCheckpoint,
  listActions,
  listRecordsInRange,
  writeRecord,
} from "../src/infrastructure/repository.js";
import { runInTransaction } from "../src/infrastructure/transaction.js";
import { tempDir } from "./helpers.js";

const CREATED = "2026-10-28T15:00:00.000Z";

describe("persistência", () => {
  it("desfaz registro parcial quando a transação falha", () => {
    const workspace = tempDir("moah-db-");
    const db = openDatabase(path.join(workspace.dir, "moah.sqlite"));
    try {
      assert.throws(() => {
        runInTransaction(db, () => {
          writeRecord(db, sampleRecord());
          throw new Error("falha simulada");
        });
      }, /falha simulada/);
      assert.equal(countRecords(db), 0);
      assert.equal(db.isTransaction, false);
    } finally {
      db.close();
      workspace.cleanup();
    }
  });

  it("mantém duas gravações, isola domínio e reabre o esquema", () => {
    const workspace = tempDir("moah-db-");
    const file = path.join(workspace.dir, "moah.sqlite");
    const first = openDatabase(file);
    let meetingId = "";
    let actionId = "";
    try {
      const meeting = insertRecord(first, normalized({ type: "reuniao", domain: "imex", text: "Reunião Imex" }), CREATED);
      const other = insertRecord(
        first,
        normalized({ type: "atividade", domain: "aluai", project: "site", text: "Nota Aluai", decisions: [], actions: [] }),
        CREATED,
      );
      meetingId = meeting.id;
      actionId = meeting.actions[0]?.id ?? "";
      assert.notEqual(actionId, "");
      const bounds = civilDayBounds("2026-10-28", "America/Sao_Paulo");
      const imex = listRecordsInRange(first, bounds.startIso, bounds.endIso, "imex", null);
      assert.deepEqual(imex.map((record) => record.id), [meetingId]);
      assert.equal(imex.some((record) => record.text === other.text), false);

      const early = insertRecord(
        first,
        normalized({
          type: "atividade",
          occurredAt: "2026-10-28T02:30:00.000Z",
          text: "Ainda é dia 27 em São Paulo",
          decisions: [],
          actions: [],
        }),
        CREATED,
      );
      const day28 = listRecordsInRange(first, bounds.startIso, bounds.endIso, null, null).map((record) => record.id);
      assert.equal(day28.includes(early.id), false);
      assert.equal(day28.includes(meetingId), true);

      const concluded = completeAction(first, actionId, "2026-10-28T18:00:00.000Z");
      assert.equal(concluded.action.status, "concluida");
      assert.equal(concluded.action.completedAt, "2026-10-28T18:00:00.000Z");
      assert.throws(() => completeAction(first, actionId, CREATED), (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "conflict");
        return true;
      });
      assert.throws(() => completeAction(first, "act_inexistente", CREATED), (error: unknown) => {
        assert.ok(error instanceof AppError);
        assert.equal(error.code, "not_found");
        return true;
      });

      insertRecord(first, checkpoint("review", "2026-10-28T15:00:00.000Z", "review em análise"), CREATED);
      insertRecord(first, checkpoint("outro", "2026-10-28T16:00:00.000Z", "outro fluxo"), CREATED);
      assert.equal(latestCheckpoint(first, { domain: "imex", project: "review" })?.text, "review em análise");
      assert.equal(latestCheckpoint(first, { domain: "imex", project: null })?.text, "outro fluxo");
      assert.equal(latestCheckpoint(first, { domain: "aluai", project: null }), null);

      const pending = listActions(first, { domain: "aluai", project: null, status: "pendente" });
      assert.equal(pending.some((item) => item.domain === "imex"), false);
      const mode = first.prepare("PRAGMA journal_mode").get() as { journal_mode: string };
      assert.equal(mode.journal_mode, "wal");
      const foreignKeys = first.prepare("PRAGMA foreign_keys").get() as { foreign_keys: number };
      assert.equal(foreignKeys.foreign_keys, 1);
    } finally {
      first.close();
    }

    const second = openDatabase(file);
    try {
      assert.equal(countRecords(second) >= 4, true);
      const reloaded = listRecordsInRange(
        second,
        "2026-10-28T00:00:00.000Z",
        "2026-10-29T00:00:00.000Z",
        "imex",
        "financeiro",
      );
      assert.equal(reloaded.some((record) => record.id === meetingId), true);
      const versions = second.prepare("SELECT COUNT(*) AS total FROM schema_migrations").get() as { total: number };
      assert.equal(versions.total, 1);
    } finally {
      second.close();
      workspace.cleanup();
    }
  });
});

function normalized(overrides: Partial<NormalizedRecord> & Pick<NormalizedRecord, "type" | "text">): NormalizedRecord {
  return validateRecord({
    type: overrides.type,
    domain: overrides.domain ?? "imex",
    project: overrides.project === undefined ? "financeiro" : overrides.project,
    text: overrides.text,
    origin: null,
    agent: null,
    occurredAt: overrides.occurredAt ?? "2026-10-28T12:00:00.000Z",
    nextStep: overrides.nextStep ?? null,
    decisions: overrides.decisions ?? ["Manter o registro manual"],
    actions: overrides.actions ?? [{ description: "Mapear casos de teste", owner: null, dueOn: null }],
    refs: overrides.refs ?? ["memoria://sintetica/imex/nota-1"],
  });
}

function checkpoint(project: string, occurredAt: string, text: string): NormalizedRecord {
  return normalized({
    type: "checkpoint",
    project,
    text,
    occurredAt,
    nextStep: "verificar testes",
    decisions: [],
    actions: [],
    refs: [],
  });
}

function sampleRecord(): WorkRecord {
  return {
    id: "rec_teste",
    type: "reuniao",
    domain: "imex",
    project: "financeiro",
    text: "não deve permanecer",
    origin: "user_report",
    agent: "manual",
    occurredAt: "2026-10-28T12:00:00.000Z",
    createdAt: CREATED,
    nextStep: null,
    decisions: [{ id: "dec_teste", text: "decisão que deve sumir" }],
    actions: [
      {
        id: "act_teste",
        description: "ação que deve sumir",
        owner: null,
        dueOn: null,
        status: "pendente",
        completedAt: null,
      },
    ],
    refs: ["ref-sintetica"],
  };
}
