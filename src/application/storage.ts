import fs from "node:fs";
import path from "node:path";
import { backup } from "node:sqlite";
import { AppError } from "../domain/errors.js";
import { openDatabase } from "../infrastructure/database.js";
import { acquireProcessLock } from "../infrastructure/lock.js";
import { databasePath } from "../infrastructure/paths.js";
import { countRecords } from "../infrastructure/repository.js";

export interface BackupResult {
  file: string;
  records: number;
  sameDevice: boolean;
  warning: string | null;
}

export async function backupDatabase(dataDir: string, destinationDir: string): Promise<BackupResult> {
  fs.mkdirSync(destinationDir, { recursive: true });
  const source = databasePath(dataDir);
  if (!fs.existsSync(source)) {
    throw new AppError("Não há banco para copiar nesse diretório de dados.", "not_found");
  }
  const file = path.join(destinationDir, `moah-backup-${Date.now()}.sqlite`);
  const release = acquireProcessLock(`${source}.lock`);
  try {
    const db = openDatabase(source);
    try {
      await backup(db, file);
    } finally {
      db.close();
    }
  } finally {
    release();
  }
  const records = countInFile(file);
  const sameDevice = sameDeviceAs(source, destinationDir);
  return {
    file,
    records,
    sameDevice,
    warning: sameDevice
      ? "O backup está no mesmo dispositivo da origem. Isso não protege contra a perda física do SSD."
      : null,
  };
}

export function restoreDatabase(backupFile: string, destinationDir: string): { records: number } {
  if (!fs.existsSync(backupFile)) {
    throw new AppError("Arquivo de backup não encontrado.", "not_found");
  }
  const records = countInFile(backupFile);
  fs.mkdirSync(destinationDir, { recursive: true });
  const target = databasePath(destinationDir);
  if (fs.existsSync(target)) {
    throw new AppError("O destino já tem um banco. A restauração não substitui nem apaga a origem.", "conflict");
  }
  fs.copyFileSync(backupFile, target);
  if (countInFile(target) !== records) {
    fs.rmSync(target, { force: true });
    throw new AppError("A restauração não conferiu a quantidade de registros.", "persistence");
  }
  return { records };
}

export interface MigrationPreview {
  source: string;
  destination: string;
  records: number;
  sourceExistsAfter: true;
  deletesSource: false;
}

export function previewMigration(dataDir: string, destinationDir: string): MigrationPreview {
  const source = databasePath(dataDir);
  if (!fs.existsSync(source)) {
    throw new AppError("Não há banco na origem.", "not_found");
  }
  return {
    source,
    destination: databasePath(destinationDir),
    records: countInFile(source),
    sourceExistsAfter: true,
    deletesSource: false,
  };
}

export async function migrateDatabase(dataDir: string, destinationDir: string): Promise<MigrationPreview & { backupFile: string }> {
  const preview = previewMigration(dataDir, destinationDir);
  if (fs.existsSync(preview.destination)) {
    throw new AppError("O destino já tem um banco. A migração não apaga a origem nem substitui o destino.", "conflict");
  }
  fs.mkdirSync(destinationDir, { recursive: true });
  const copied = await backupDatabase(dataDir, destinationDir);
  fs.copyFileSync(copied.file, preview.destination);
  const restored = countInFile(preview.destination);
  if (restored !== preview.records || !fs.existsSync(preview.source)) {
    throw new AppError("A migração não conferiu origem e destino. A origem foi preservada.", "persistence");
  }
  return { ...preview, backupFile: copied.file };
}

function countInFile(file: string): number {
  const db = openDatabase(file);
  try {
    return countRecords(db);
  } finally {
    db.close();
  }
}

function sameDeviceAs(file: string, directory: string): boolean {
  const left = fs.statSync(file).dev;
  const right = fs.statSync(directory).dev;
  return left === right;
}
