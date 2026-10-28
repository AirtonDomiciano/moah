import type { DatabaseSync } from "node:sqlite";

export function runInTransaction<T>(db: DatabaseSync, fn: () => T): T {
  if (db.isTransaction) {
    throw new Error("Transação já aberta.");
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    try {
      if (db.isTransaction) {
        db.exec("ROLLBACK");
      }
    } catch {
      // A falha original é a que interessa ao chamador.
    }
    throw error;
  }
}
