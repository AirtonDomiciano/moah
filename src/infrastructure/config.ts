import fs from "node:fs";
import path from "node:path";
import { DEFAULT_TIMEZONE } from "../domain/constants.js";
import { AppError } from "../domain/errors.js";
import { assertValidTimeZone } from "../domain/time.js";
import { parseLlmConfig, type LlmSettings } from "./llm/settings.js";

export interface AppConfig {
  timezone: string;
  llm: Partial<LlmSettings>;
}

export function loadConfig(configDir: string): AppConfig {
  const file = path.join(configDir, "config.json");
  if (!fs.existsSync(file)) {
    return { timezone: DEFAULT_TIMEZONE, llm: {} };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(file, "utf8")) as unknown;
  } catch {
    throw new AppError(`Configuração inválida em ${file}. Use JSON com timezone e, se quiser, llm.`, "validation");
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new AppError(`Configuração inválida em ${file}. O conteúdo deve ser um objeto.`, "validation");
  }
  const record = parsed as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "timezone" && key !== "llm") {
      throw new AppError(`Chave de configuração desconhecida: ${key}.`, "validation");
    }
  }
  const timezone = record.timezone ?? DEFAULT_TIMEZONE;
  if (typeof timezone !== "string" || timezone.trim() === "") {
    throw new AppError("timezone deve ser um nome IANA, por exemplo America/Sao_Paulo.", "validation");
  }
  assertValidTimeZone(timezone.trim());
  const llm = record.llm === undefined ? {} : parseLlmConfig(record.llm);
  return { timezone: timezone.trim(), llm };
}
