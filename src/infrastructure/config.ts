import fs from "node:fs";
import path from "node:path";
import { DEFAULT_TIMEZONE, isDomain, type Domain } from "../domain/constants.js";
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

export const VOICE_SYNTHESIS = ["espeak", "faber", "cadu", "jeff", "edresson", "tugao"] as const;

export type VoiceSynthesis = (typeof VOICE_SYNTHESIS)[number];

export interface VoiceConfig {
  sintese: VoiceSynthesis;
}

export interface GoogleConfig {
  clientId: string | null;
  clientSecret: string | null;
  calendarios: Partial<Record<Domain, string>>;
}

export interface AppConfig {
  timezone: string;
  llm: Partial<LlmSettings>;
  storage: StorageConfig;
  agenda: AgendaConfig;
  voz: VoiceConfig;
  google: GoogleConfig;
}

export function loadConfig(configDir: string): AppConfig {
  const file = path.join(configDir, "config.json");
  if (!fs.existsSync(file)) {
    return {
      timezone: DEFAULT_TIMEZONE,
      llm: {},
      storage: emptyStorage(),
      agenda: defaultAgenda(),
      voz: defaultVoice(),
      google: defaultGoogle(),
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
    if (key !== "timezone" && key !== "llm" && key !== "storage" && key !== "agenda" && key !== "voz" && key !== "google") {
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
    voz: parseVoice(record.voz),
    google: parseGoogle(record.google),
  };
}

function emptyStorage(): StorageConfig {
  return { volume: null, documentsDir: null, derivedDir: null, backupDir: null };
}

function defaultAgenda(): AgendaConfig {
  return { quietStart: "22:00", quietEnd: "07:00" };
}

function defaultVoice(): VoiceConfig {
  return { sintese: "faber" };
}

function defaultGoogle(): GoogleConfig {
  return { clientId: null, clientSecret: null, calendarios: { pessoal: "primary" } };
}

function parseGoogle(value: unknown): GoogleConfig {
  if (value === undefined) {
    return defaultGoogle();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("google deve ser um objeto.", "validation");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "clientId" && key !== "clientSecret" && key !== "calendarios") {
      throw new AppError(`Chave de google desconhecida: ${key}.`, "validation");
    }
  }
  const clientId = optionalText(record.clientId, "google.clientId");
  const clientSecret = optionalText(record.clientSecret, "google.clientSecret");
  return { clientId, clientSecret, calendarios: parseCalendars(record.calendarios) };
}

function optionalText(value: unknown, name: string): string | null {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new AppError(`${name} deve ser um texto.`, "validation");
  }
  return value.trim();
}

function parseCalendars(value: unknown): Partial<Record<Domain, string>> {
  if (value === undefined) {
    return { pessoal: "primary" };
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("google.calendarios deve ser um objeto.", "validation");
  }
  const record = value as Record<string, unknown>;
  const calendarios: Partial<Record<Domain, string>> = {};
  for (const [key, calendarId] of Object.entries(record)) {
    if (!isDomain(key)) {
      throw new AppError(`Domínio de calendário desconhecido: ${key}.`, "validation");
    }
    if (typeof calendarId !== "string" || !calendarId.trim()) {
      throw new AppError(`google.calendarios.${key} deve ser o id do calendário.`, "validation");
    }
    calendarios[key] = calendarId.trim();
  }
  return calendarios;
}

function parseVoice(value: unknown): VoiceConfig {
  if (value === undefined) {
    return defaultVoice();
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("voz deve ser um objeto.", "validation");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key !== "sintese") {
      throw new AppError(`Chave de voz desconhecida: ${key}.`, "validation");
    }
  }
  const sintese = record.sintese ?? "faber";
  if (typeof sintese !== "string" || !VOICE_SYNTHESIS.includes(sintese as VoiceSynthesis)) {
    throw new AppError("voz.sintese deve ser espeak, faber, cadu, jeff, edresson ou tugao.", "validation");
  }
  return { sintese: sintese as VoiceSynthesis };
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
