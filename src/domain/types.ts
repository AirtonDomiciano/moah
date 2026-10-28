import type { ActionStatus, Domain, RecordType } from "./constants.js";

export type { ActionStatus, Domain, RecordType };

export interface ActionInput {
  description: string;
  owner: string | null;
  dueOn: string | null;
}

export interface NormalizedRecord {
  type: RecordType;
  domain: Domain;
  project: string | null;
  text: string;
  origin: "user_report";
  agent: "manual";
  occurredAt: string;
  nextStep: string | null;
  decisions: string[];
  actions: ActionInput[];
  refs: string[];
}

export interface Decision {
  id: string;
  text: string;
}

export interface ActionItem {
  id: string;
  description: string;
  owner: string | null;
  dueOn: string | null;
  status: ActionStatus;
  completedAt: string | null;
}

export interface WorkRecord {
  id: string;
  type: RecordType;
  domain: Domain;
  project: string | null;
  text: string;
  origin: string;
  agent: string;
  occurredAt: string;
  createdAt: string;
  nextStep: string | null;
  decisions: Decision[];
  actions: ActionItem[];
  refs: string[];
}

export interface ActionView {
  action: ActionItem;
  recordId: string;
  recordType: RecordType;
  domain: Domain;
  project: string | null;
  origin: string;
  occurredAt: string;
}

export interface DayQuery {
  date: string;
  domain: Domain | null;
  project: string | null;
}

export interface ActionQuery {
  domain: Domain | null;
  project: string | null;
  status: ActionStatus | "todas";
}

export interface CheckpointQuery {
  domain: Domain;
  project: string | null;
}

export interface DailySummary {
  date: string;
  timezone: string;
  domain: Domain | null;
  project: string | null;
  activities: WorkRecord[];
  meetings: WorkRecord[];
  checkpoints: WorkRecord[];
  decisions: Array<{ recordId: string; origin: string; text: string }>;
  pendingActions: ActionView[];
  concludedActions: ActionView[];
}
