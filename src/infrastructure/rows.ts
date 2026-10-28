import { AppError } from "../domain/errors.js";

export function asRow(value: unknown): Record<string, unknown> | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("Resposta inesperada do SQLite.", "persistence");
  }
  return value as Record<string, unknown>;
}

export function requiredString(row: Record<string, unknown>, key: string): string {
  const value = row[key];
  if (typeof value !== "string") {
    throw new AppError(`Coluna ${key} inválida no banco.`, "persistence");
  }
  return value;
}

export function nullableString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== "string") {
    throw new AppError(`Coluna ${key} inválida no banco.`, "persistence");
  }
  return value;
}

export function requiredNumber(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new AppError(`Coluna ${key} inválida no banco.`, "persistence");
  }
  return value;
}
