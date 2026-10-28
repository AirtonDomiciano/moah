export const DOMAINS = ["pessoal", "imex", "aluai"] as const;
export type Domain = (typeof DOMAINS)[number];

export const RECORD_TYPES = ["atividade", "reuniao", "checkpoint"] as const;
export type RecordType = (typeof RECORD_TYPES)[number];

export const ACTION_STATUSES = ["pendente", "concluida"] as const;
export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const DEFAULT_ORIGIN = "user_report";
export const DEFAULT_AGENT = "manual";
export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export const LIMITS = {
  text: 10_000,
  decision: 2_000,
  actionDescription: 2_000,
  owner: 200,
  project: 200,
  ref: 500,
  nextStep: 2_000,
  items: 40,
} as const;

export function isDomain(value: string): value is Domain {
  return (DOMAINS as readonly string[]).includes(value);
}

export function isRecordType(value: string): value is RecordType {
  return (RECORD_TYPES as readonly string[]).includes(value);
}

export function isActionStatus(value: string): value is ActionStatus {
  return (ACTION_STATUSES as readonly string[]).includes(value);
}
