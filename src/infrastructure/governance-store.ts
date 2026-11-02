import { randomUUID } from "node:crypto";
import type { DatabaseSync, StatementResultingChanges } from "node:sqlite";
import { actionFingerprint, type ActionProposal } from "../domain/policy.js";
import { openDatabase } from "./database.js";
import { acquireProcessLock } from "./lock.js";
import { databasePath } from "./paths.js";
import { runInTransaction } from "./transaction.js";

export const APPROVAL_STATES = ["pendente", "aprovada", "negada", "expirada", "revogada", "consumida"] as const;
export type ApprovalState = (typeof APPROVAL_STATES)[number];

export interface ApprovalRow {
  id: string;
  state: ApprovalState;
  action: string;
  tool: string;
  domain: string;
  target: string;
  agent: string;
  parameters: Record<string, string>;
  fingerprint: string;
  createdAt: string;
  validUntil: string;
  decidedAt: string | null;
  consumedAt: string | null;
}

export interface AuditInput {
  kind: string;
  approvalId: string | null;
  tool: string;
  domain: string;
  target: string;
  outcome: string;
  fingerprint: string;
  detail: string;
  createdAt: string;
}

export interface AuditRow {
  id: string;
  kind: string;
  approvalId: string | null;
  tool: string;
  domain: string;
  target: string;
  outcome: string;
  fingerprint: string;
  detail: string;
  createdAt: string;
}

export type DispatchStatus = "concluida" | "negada" | "bloqueada" | "falha";

export interface DispatchResult {
  status: DispatchStatus;
  reason: string;
  consumed: boolean;
}

export function withGovernance<T>(dataDir: string, fn: (db: DatabaseSync) => T): T {
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

export function insertPendingApproval(
  db: DatabaseSync,
  proposal: ActionProposal,
  fingerprint: string,
  createdAt: string,
  validUntil: string,
): ApprovalRow {
  const id = `apr_${randomUUID()}`;
  const parametersJson = JSON.stringify(proposal.parameters);
  db.prepare(
    `INSERT INTO approvals (
      id, state, action, tool, domain, target, agent, parameters_json, fingerprint,
      created_at, valid_until, decided_at, consumed_at
    ) VALUES (?, 'pendente', ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`,
  ).run(
    id,
    proposal.action,
    proposal.tool,
    proposal.domain,
    proposal.target,
    proposal.agent,
    parametersJson,
    fingerprint,
    createdAt,
    validUntil,
  );
  const row = selectApproval(db, id);
  if (!row) {
    throw new Error("A aprovação pendente não foi gravada.");
  }
  return row;
}

export function selectApproval(db: DatabaseSync, id: string): ApprovalRow | null {
  const row = db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  return row ? mapApproval(row) : null;
}

export function expireIfNeeded(db: DatabaseSync, id: string, nowIso: string): ApprovalRow | null {
  db.prepare(
    `UPDATE approvals
     SET state = 'expirada'
     WHERE id = ? AND state IN ('pendente', 'aprovada') AND valid_until <= ?`,
  ).run(id, nowIso);
  return selectApproval(db, id);
}

export function transitionApproval(
  db: DatabaseSync,
  id: string,
  from: ApprovalState,
  to: ApprovalState,
  nowIso: string,
): boolean {
  const decidedAt = to === "aprovada" || to === "negada" || to === "revogada" ? nowIso : null;
  const result = db.prepare(
    `UPDATE approvals
     SET state = ?, decided_at = COALESCE(?, decided_at)
     WHERE id = ? AND state = ?`,
  ).run(to, decidedAt, id, from);
  return changes(result) === 1;
}

export function readPaused(db: DatabaseSync): boolean {
  const row = db.prepare("SELECT paused FROM executor_control WHERE id = 1").get() as { paused: number } | undefined;
  return row?.paused === 1;
}

export function writePaused(db: DatabaseSync, paused: boolean): void {
  const result = db.prepare("UPDATE executor_control SET paused = ? WHERE id = 1").run(paused ? 1 : 0);
  if (changes(result) !== 1) {
    throw new Error("O controle do executor não foi atualizado.");
  }
}

export function insertAudit(db: DatabaseSync, input: AuditInput): void {
  db.prepare(
    `INSERT INTO audit_events (
      id, kind, approval_id, tool, domain, target, outcome, fingerprint, detail, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    `aud_${randomUUID()}`,
    input.kind,
    input.approvalId,
    clip(input.tool, 80),
    clip(input.domain, 20),
    publicTarget(input.target),
    clip(input.outcome, 40),
    input.fingerprint,
    clip(input.detail, 200),
    input.createdAt,
  );
}

export function listAuditRows(db: DatabaseSync, limit: number): AuditRow[] {
  const rows = db
    .prepare("SELECT * FROM audit_events ORDER BY created_at, rowid LIMIT ?")
    .all(limit) as unknown as Record<string, unknown>[];
  return rows.map(mapAudit);
}

/**
 * Consome uma aprovação aprovada cujo fingerprint ainda coincide.
 * Duas conexões disputam o mesmo UPDATE; no máximo uma altera a linha.
 * Não usa o lock de processo: a condição SQL é a garantia testada.
 */
export function consumeApprovalNow(filePath: string, id: string, fingerprint: string, nowIso: string): boolean {
  const db = openDatabase(filePath);
  try {
    return runInTransaction(db, () => {
      const result = db
        .prepare(
          `UPDATE approvals
           SET state = 'consumida', consumed_at = ?
           WHERE id = ? AND state = 'aprovada' AND fingerprint = ? AND valid_until > ?`,
        )
        .run(nowIso, id, fingerprint, nowIso);
      return changes(result) === 1;
    });
  } finally {
    db.close();
  }
}

export function dispatchFake(
  db: DatabaseSync,
  proposal: ActionProposal,
  approvalId: string,
  nowIso: string,
): DispatchResult {
  const run = (): DispatchResult => {
    if (readPaused(db)) {
      return {
        status: "bloqueada",
        reason: "O executor está pausado. Novas execuções estão bloqueadas. A pausa não desfaz efeitos já realizados.",
        consumed: false,
      };
    }
    const current = expireIfNeeded(db, approvalId, nowIso);
    if (!current) {
      return { status: "falha", reason: "Aprovação não encontrada.", consumed: false };
    }
    const fingerprint = actionFingerprint(proposal);
    if (!fingerprintMatchesStored(current)) {
      return { status: "falha", reason: "A autorização armazenada está inconsistente.", consumed: false };
    }
    if (current.fingerprint !== fingerprint) {
      return {
        status: "negada",
        reason: "A ação não coincide com a aprovação. Parâmetros, destino ou conteúdo diferentes exigem nova decisão.",
        consumed: false,
      };
    }
    if (current.state === "expirada") {
      return { status: "negada", reason: "A aprovação expirou.", consumed: false };
    }
    if (current.state !== "aprovada") {
      return { status: "negada", reason: `A aprovação está ${current.state} e não pode ser executada.`, consumed: false };
    }
    const result = db
      .prepare(
        `UPDATE approvals
         SET state = 'consumida', consumed_at = ?
         WHERE id = ? AND state = 'aprovada' AND fingerprint = ? AND valid_until > ?`,
      )
      .run(nowIso, approvalId, fingerprint, nowIso);
    if (changes(result) !== 1) {
      return { status: "negada", reason: "A aprovação já foi consumida ou deixou de ser válida.", consumed: false };
    }
    return { status: "concluida", reason: "Execução falsa concluída, sem efeito no computador.", consumed: true };
  };
  return db.isTransaction ? run() : runInTransaction(db, run);
}

function fingerprintMatchesStored(row: ApprovalRow): boolean {
  const proposal: ActionProposal = {
    action: row.action,
    tool: row.tool,
    agent: row.agent,
    domain: row.domain,
    target: row.target,
    parameters: row.parameters,
  };
  return actionFingerprint(proposal) === row.fingerprint;
}

function mapApproval(row: Record<string, unknown>): ApprovalRow {
  const parameters = JSON.parse(String(row.parameters_json)) as Record<string, string>;
  return {
    id: String(row.id),
    state: String(row.state) as ApprovalState,
    action: String(row.action),
    tool: String(row.tool),
    domain: String(row.domain),
    target: String(row.target),
    agent: String(row.agent),
    parameters,
    fingerprint: String(row.fingerprint),
    createdAt: String(row.created_at),
    validUntil: String(row.valid_until),
    decidedAt: row.decided_at === null ? null : String(row.decided_at),
    consumedAt: row.consumed_at === null ? null : String(row.consumed_at),
  };
}

function mapAudit(row: Record<string, unknown>): AuditRow {
  return {
    id: String(row.id),
    kind: String(row.kind),
    approvalId: row.approval_id === null ? null : String(row.approval_id),
    tool: String(row.tool),
    domain: String(row.domain),
    target: String(row.target),
    outcome: String(row.outcome),
    fingerprint: String(row.fingerprint),
    detail: String(row.detail),
    createdAt: String(row.created_at),
  };
}

function publicTarget(target: string): string {
  if (/token|secret|password|senha|bearer|api[-_]?key/i.test(target)) {
    return "[omitido]";
  }
  return clip(target, 80);
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : value.slice(0, max);
}

function changes(result: StatementResultingChanges): number {
  return Number(result.changes);
}
