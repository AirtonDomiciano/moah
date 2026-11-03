export const SCHEMA_VERSION = 3;

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

export const MIGRATIONS = [
  { version: 1, sql: MIGRATION_V1 },
  { version: 2, sql: MIGRATION_V2 },
  { version: 3, sql: MIGRATION_V3 },
] as const;
