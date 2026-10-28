import { AppError } from "../domain/errors.js";
import type { ActionInput } from "../domain/types.js";

export function parseActionSpec(spec: string): ActionInput {
  const parts = spec.split(" ;; ");
  const description = parts[0]?.trim() ?? "";
  if (!description) {
    throw new AppError(
      'Ação inválida. Use "descrição" ou "descrição ;; responsavel=Nome ;; prazo=AAAA-MM-DD".',
      "validation",
    );
  }
  let owner: string | null = null;
  let dueOn: string | null = null;
  for (const part of parts.slice(1)) {
    const equals = part.indexOf("=");
    if (equals <= 0) {
      throw new AppError(
        'Ação inválida. Separe os campos com " ;; " e use responsavel= ou prazo=.',
        "validation",
      );
    }
    const key = part.slice(0, equals).trim();
    const value = part.slice(equals + 1).trim();
    if (!value) {
      throw new AppError(`Ação inválida: ${key} está vazio.`, "validation");
    }
    if (key === "responsavel") {
      if (owner !== null) {
        throw new AppError("Ação inválida: responsável repetido.", "validation");
      }
      owner = value;
    } else if (key === "prazo") {
      if (dueOn !== null) {
        throw new AppError("Ação inválida: prazo repetido.", "validation");
      }
      dueOn = value;
    } else {
      throw new AppError(`Campo de ação desconhecido: ${key}. Use responsavel ou prazo.`, "validation");
    }
  }
  return { description, owner, dueOn };
}
