import fs from "node:fs";
import path from "node:path";
import { DEFAULT_TIMEZONE } from "../domain/constants.js";
import { AppError } from "../domain/errors.js";
import { assertValidTimeZone } from "../domain/time.js";
import { parseLlmConfig, type LlmSettings } from "./llm/settings.js";

export interface StorageConfig {
  volume: { mount: string; uuid: string | null; label: string | null } | null;
  documentsDir: string | null;
  derivedDir: string | null;
  backupDir: string | null;
}

export interface AgendaConfig {
  quietStart: string;
  quietEnd: string;
}

export interface AppConfig {
  timezone: string;
  llm: Partial<LlmSettings>;
  storage: StorageConfig;
  agenda: AgendaConfig;
}

export function loadConfig(configDir: string): AppConfig {
  const file = path.join(configDir, "config.json");
  if (!fs.existsSync(file)) {
    return {
      timezone: DEFAULT_TIMEZONE,
      llm: {},
      storage: emptyStorage(),
      agenda: defaultAgenda(),
    };
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
    if (key !== "timezone" && key !== "llm" && key !== "storage" && key !== "agenda") {
      throw new AppError(`Chave de configuração desconhecida: ${key}.`, "validation");
    }
  }
  const timezone = record.timezone ?? DEFAULT_TIMEZONE;
  if (typeof timezone !== "string" || timezone.trim() === "") {
    throw new AppError("timezone deve ser um nome IANA, por exemplo America/Sao_Paulo.", "validation");
  }
  assertValidTimeZone(timezone.trim());
  const llm = record.llm === undefined ? {} : parseLlmConfig(record.llm);
  return {
    timezone: timezone.trim(),
    llm,
    storage: parseStorage(record.storage),
    agenda: parseAgenda(record.agenda),
  };
}

function emptyStorage(): StorageConfig {
  return { volume: null, documentsDir: null, derivedDir: null, backupDir: null };
}

function defaultAgenda(): AgendaConfig {
  return { quietStart: "22:00", quietEnd: "07:00" };
}

function parseStorage(value: unknown): StorageConfig {
  if (value === undefined) {
    return emptyStorage();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("storage deve ser um objeto.", "validation");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "volume" && key !== "documentsDir" && key !== "derivedDir" && key !== "backupDir") {
      throw new AppError(`Chave de storage desconhecida: ${key}.`, "validation");
    }
  }
  return {
    volume: parseVolume(record.volume),
    documentsDir: optionalAbsolute(record.documentsDir, "documentsDir"),
    derivedDir: optionalAbsolute(record.derivedDir, "derivedDir"),
    backupDir: optionalAbsolute(record.backupDir, "backupDir"),
  };
}

function parseVolume(value: unknown): StorageConfig["volume"] {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("storage.volume deve ser um objeto.", "validation");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "mount" && key !== "uuid" && key !== "label") {
      throw new AppError(`Chave de volume desconhecida: ${key}.`, "validation");
    }
  }
  if (typeof record.mount !== "string" || !record.mount.startsWith("/")) {
    throw new AppError("storage.volume.mount deve ser um caminho absoluto.", "validation");
  }
  const uuid = record.uuid === undefined || record.uuid === null ? null : record.uuid;
  if (uuid !== null && (typeof uuid !== "string" || !/^[0-9A-Fa-f-]{8,}$/.test(uuid))) {
    throw new AppError("storage.volume.uuid inválido.", "validation");
  }
  const label = record.label === undefined || record.label === null ? null : record.label;
  if (label !== null && (typeof label !== "string" || label.trim() === "")) {
    throw new AppError("storage.volume.label inválido.", "validation");
  }
  return { mount: record.mount, uuid, label: typeof label === "string" ? label.trim() : null };
}

function optionalAbsolute(value: unknown, name: string): string | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || !value.startsWith("/")) {
    throw new AppError(`${name} deve ser um caminho absoluto.`, "validation");
  }
  return value;
}

function parseAgenda(value: unknown): AgendaConfig {
  if (value === undefined) {
    return defaultAgenda();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("agenda deve ser um objeto.", "validation");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "quietStart" && key !== "quietEnd") {
      throw new AppError(`Chave de agenda desconhecida: ${key}.`, "validation");
    }
  }
  return {
    quietStart: clock(record.quietStart, "quietStart"),
    quietEnd: clock(record.quietEnd, "quietEnd"),
  };
}

function clock(value: unknown, name: string): string {
  if (typeof value !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new AppError(`${name} deve ser HH:mm.`, "validation");
  }
  return value;
}
