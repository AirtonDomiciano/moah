export const SCHEMA_VERSION = 1;

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

export const MIGRATIONS = [{ version: 1, sql: MIGRATION_V1 }] as const;
