import {
  DEFAULT_AGENT,
  DEFAULT_ORIGIN,
  LIMITS,
  isDomain,
} from "./constants.js";
import { AppError } from "./errors.js";
import { parseCivilDate } from "./time.js";
import type { ActionInput, NormalizedRecord, RecordType } from "./types.js";

export interface RecordDraft {
  type: RecordType;
  domain: string;
  project: string | null;
  text: string;
  origin: string | null;
  agent: string | null;
  occurredAt: string;
  nextStep: string | null;
  decisions: string[];
  actions: ActionInput[];
  refs: string[];
}

export function validateRecord(draft: RecordDraft): NormalizedRecord {
  if (!isDomain(draft.domain)) {
    throw new AppError(
      `Domínio inválido: "${draft.domain}". Use pessoal, imex ou aluai.`,
      "validation",
    );
  }
  const origin = draft.origin ?? DEFAULT_ORIGIN;
  if (origin !== DEFAULT_ORIGIN) {
    throw new AppError(
      `Origem não aceita nesta CLI: "${origin}". Use ${DEFAULT_ORIGIN}.`,
      "validation",
    );
  }
  const agent = draft.agent ?? DEFAULT_AGENT;
  if (agent !== DEFAULT_AGENT) {
    throw new AppError(
      `Agente não aceito nesta CLI: "${agent}". Use ${DEFAULT_AGENT}.`,
      "validation",
    );
  }
  return {
    type: draft.type,
    domain: draft.domain,
    project: optionalText(draft.project, "projeto", LIMITS.project),
    text: requiredText(draft.text, draft.type === "checkpoint" ? "resumo" : "texto", LIMITS.text),
    origin,
    agent,
    occurredAt: draft.occurredAt,
    nextStep: optionalText(draft.nextStep, "proximo", LIMITS.nextStep),
    decisions: draft.decisions.map((decision, index) =>
      requiredText(decision, `decisão ${index + 1}`, LIMITS.decision),
    ),
    actions: draft.actions.map((action) => validateAction(action)),
    refs: draft.refs.map((ref, index) => requiredText(ref, `referência ${index + 1}`, LIMITS.ref)),
  };
}

export function validateAction(action: ActionInput): ActionInput {
  const description = requiredText(action.description, "ação", LIMITS.actionDescription);
  const owner = optionalText(action.owner, "responsável", LIMITS.owner);
  const dueOn = action.dueOn === null ? null : parseCivilDate(action.dueOn);
  return { description, owner, dueOn };
}

function requiredText(value: string, label: string, limit: number): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError(`Informe ${label}.`, "validation");
  }
  assertBounded(trimmed, label, limit);
  return trimmed;
}

function optionalText(value: string | null, label: string, limit: number): string | null {
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw new AppError(`Informe ${label} ou omita a opção.`, "validation");
  }
  assertBounded(trimmed, label, limit);
  return trimmed;
}

function assertBounded(value: string, label: string, limit: number): void {
  if (value.includes("\0")) {
    throw new AppError(`${label} contém um caractere inválido.`, "validation");
  }
  if (value.length > limit) {
    throw new AppError(`${label} excede ${limit} caracteres.`, "validation");
  }
}

export function assertItemCount(count: number, label: string): void {
  if (count > LIMITS.items) {
    throw new AppError(`No máximo ${LIMITS.items} ${label} por registro.`, "validation");
  }
}
