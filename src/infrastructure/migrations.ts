export const SCHEMA_VERSION = 5;

export const MIGRATION_V1 = `
CREATE TABLE records (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('atividade', 'reuniao', 'checkpoint')),
  domain TEXT NOT NULL CHECK (domain IN ('pessoal', 'imex', 'aluai')),
  project TEXT,
  body TEXT NOT NULL,
  origin TEXT NOT NULL,
  agent TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  next_step TEXT
);

CREATE INDEX idx_records_domain_occurred ON records (domain, occurred_at);
CREATE INDEX idx_records_checkpoint ON records (type, domain, project, occurred_at, created_at);

CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES records(id),
  body TEXT NOT NULL,
  position INTEGER NOT NULL
);

CREATE TABLE actions (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES records(id),
  description TEXT NOT NULL,
  owner TEXT,
  due_on TEXT,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'concluida')),
  completed_at TEXT,
  position INTEGER NOT NULL
);

CREATE INDEX idx_actions_status ON actions (status);

CREATE TABLE record_refs (
  id TEXT PRIMARY KEY,
  record_id TEXT NOT NULL REFERENCES records(id),
  ref TEXT NOT NULL,
  position INTEGER NOT NULL
);
`;

export const MIGRATION_V2 = `
CREATE TABLE approvals (
  id TEXT PRIMARY KEY,
  state TEXT NOT NULL CHECK (state IN ('pendente', 'aprovada', 'negada', 'expirada', 'revogada', 'consumida')),
  action TEXT NOT NULL,
  tool TEXT NOT NULL,
  domain TEXT NOT NULL,
  target TEXT NOT NULL,
  agent TEXT NOT NULL,
  parameters_json TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  created_at TEXT NOT NULL,
  valid_until TEXT NOT NULL,
  decided_at TEXT,
  consumed_at TEXT
);

CREATE INDEX idx_approvals_state ON approvals (state, valid_until);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  approval_id TEXT,
  tool TEXT NOT NULL,
  domain TEXT NOT NULL,
  target TEXT NOT NULL,
  outcome TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_audit_created ON audit_events (created_at);

CREATE TABLE executor_control (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  paused INTEGER NOT NULL CHECK (paused IN (0, 1))
);

INSERT INTO executor_control (id, paused) VALUES (1, 0);
`;

export const MIGRATION_V3 = `
ALTER TABLE approvals ADD COLUMN fingerprint_version INTEGER NOT NULL DEFAULT 1;
`;

export const MIGRATION_V4 = `
CREATE TABLE jobs (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('pendente', 'executando', 'concluida', 'falha', 'cancelada', 'incerta')),
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL,
  max_attempts INTEGER NOT NULL,
  error TEXT,
  checkpoint_json TEXT,
  idempotency_key TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  finished_at TEXT
);

CREATE UNIQUE INDEX idx_jobs_idempotency ON jobs (idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE calendar_events (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  version TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmado', 'cancelado')),
  updated_at TEXT NOT NULL,
  UNIQUE (source, external_id)
);

CREATE TABLE reminders (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  fire_at TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('agendado', 'adiado', 'entregue', 'vencido', 'cancelado')),
  snooze_until TEXT,
  attempts INTEGER NOT NULL,
  delivered_at TEXT
);

CREATE UNIQUE INDEX idx_reminders_event_fire ON reminders (event_id, fire_at) WHERE state IN ('agendado', 'adiado');

CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  reminder_id TEXT NOT NULL,
  state TEXT NOT NULL,
  detail TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE runtime_marks (
  name TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE imported_meetings (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  domain TEXT NOT NULL,
  project TEXT,
  occurred_on TEXT,
  transcript TEXT NOT NULL,
  participants_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (domain, source_id, source_version)
);

CREATE TABLE meeting_analyses (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  source_version TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pendente', 'valida', 'invalida', 'substituida')),
  model TEXT NOT NULL,
  simulated INTEGER NOT NULL,
  summary TEXT,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`;

export const MIGRATION_V5 = `
CREATE TABLE calendar_events_v5 (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  version TEXT NOT NULL,
  domain TEXT NOT NULL,
  title TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('confirmado', 'cancelado')),
  updated_at TEXT NOT NULL,
  UNIQUE (source, domain, external_id)
);

INSERT INTO calendar_events_v5 (
  id, source, external_id, version, domain, title, starts_at, ends_at, status, updated_at
)
SELECT id, source, external_id, version, domain, title, starts_at, ends_at, status, updated_at
FROM calendar_events;

DROP TABLE calendar_events;
ALTER TABLE calendar_events_v5 RENAME TO calendar_events;
`;

export const MIGRATIONS = [
  { version: 1, sql: MIGRATION_V1 },
  { version: 2, sql: MIGRATION_V2 },
  { version: 3, sql: MIGRATION_V3 },
  { version: 4, sql: MIGRATION_V4 },
  { version: 5, sql: MIGRATION_V5 },
] as const;
