import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { AppError } from "../domain/errors.js";
import { MIGRATIONS, SCHEMA_VERSION } from "./migrations.js";
import { runInTransaction } from "./transaction.js";

export function openDatabase(filePath: string): DatabaseSync {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath, {
    timeout: 5000,
    enableForeignKeyConstraints: true,
  });
  try {
    const mode = db.prepare("PRAGMA journal_mode = WAL").get() as { journal_mode?: string } | undefined;
    if (mode?.journal_mode !== "wal") {
      throw new AppError(
        `O SQLite não ativou o modo WAL${mode?.journal_mode ? ` (recebido: ${mode.journal_mode})` : ""}. Use um diretório de dados em sistema de arquivos local.`,
        "persistence",
      );
    }
    db.exec("PRAGMA foreign_keys = ON");
    db.exec("PRAGMA busy_timeout = 5000");
    migrate(db);
    return db;
  } catch (error) {
    db.close();
    throw error;
  }
}

export function migrate(db: DatabaseSync): void {
  runInTransaction(db, () => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        applied_at TEXT NOT NULL
      )
    `);
    const row = db.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as
      | { version: number | null }
      | undefined;
    const current = typeof row?.version === "number" ? row.version : 0;
    if (current > SCHEMA_VERSION) {
      throw new AppError(
        `O banco está na versão ${current}, mais nova do que esta CLI (${SCHEMA_VERSION}).`,
        "persistence",
      );
    }
    for (const migration of MIGRATIONS) {
      if (migration.version <= current) {
        continue;
      }
      db.exec(migration.sql);
      db.prepare("INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)").run(
        migration.version,
        new Date().toISOString(),
      );
    }
  });
}
