import { AppError } from "../../domain/errors.js";
import { isLlmProviderId, type LlmProviderId } from "../../domain/llm.js";

export interface LlmSettings {
  provider: LlmProviderId;
  baseUrl: string | null;
  model: string | null;
  timeoutMs: number;
  maxToolCalls: number;
}

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  provider: "simulator",
  baseUrl: null,
  model: null,
  timeoutMs: 30_000,
  maxToolCalls: 3,
};

export function parseLlmConfig(value: unknown): Partial<LlmSettings> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new AppError("llm deve ser um objeto.", "validation");
  }
  const record = value as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!["provider", "baseUrl", "model", "timeoutMs", "maxToolCalls"].includes(key)) {
      throw new AppError(`Chave de llm desconhecida: ${key}.`, "validation");
    }
  }
  const parsed: Partial<LlmSettings> = {};
  if (record.provider !== undefined) {
    if (typeof record.provider !== "string" || !isLlmProviderId(record.provider)) {
      throw new AppError("llm.provider deve ser simulator ou openai-compatible.", "validation");
    }
    parsed.provider = record.provider;
  }
  if (record.baseUrl !== undefined) {
    parsed.baseUrl = parseBaseUrl(record.baseUrl);
  }
  if (record.model !== undefined) {
    parsed.model = parseModel(record.model);
  }
  if (record.timeoutMs !== undefined) {
    parsed.timeoutMs = parseBoundedInteger(record.timeoutMs, "llm.timeoutMs", 100, 120_000);
  }
  if (record.maxToolCalls !== undefined) {
    parsed.maxToolCalls = parseBoundedInteger(record.maxToolCalls, "llm.maxToolCalls", 1, 8);
  }
  return parsed;
}

export function resolveLlmSettings(
  fileSettings: Partial<LlmSettings>,
  env: NodeJS.ProcessEnv,
  providerOverride: string | null,
): LlmSettings {
  const fromEnv = readEnv(env);
  const merged: LlmSettings = { ...DEFAULT_LLM_SETTINGS, ...fileSettings, ...fromEnv };
  if (providerOverride !== null) {
    if (!isLlmProviderId(providerOverride)) {
      throw new AppError("provedor deve ser simulator ou openai-compatible.", "validation");
    }
    merged.provider = providerOverride;
  }
  if (merged.baseUrl) {
    merged.baseUrl = parseBaseUrl(merged.baseUrl);
  }
  if (merged.provider === "openai-compatible") {
    if (!merged.baseUrl) {
      throw new AppError("Informe llm.baseUrl ou MOAH_LLM_BASE_URL para o provedor openai-compatible.", "validation");
    }
    if (!merged.model) {
      throw new AppError("Informe llm.model ou MOAH_LLM_MODEL para o provedor openai-compatible.", "validation");
    }
  }
  return merged;
}

export function parseBaseUrl(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new AppError("llm.baseUrl deve ser uma URL http ou https.", "validation");
  }
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new AppError("llm.baseUrl deve ser uma URL http ou https.", "validation");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new AppError("llm.baseUrl deve usar http ou https.", "validation");
  }
  if (url.username || url.password) {
    throw new AppError("A URL do modelo não pode conter credenciais.", "validation");
  }
  return value.trim().replace(/\/+$/, "");
}

function readEnv(env: NodeJS.ProcessEnv): Partial<LlmSettings> {
  const parsed: Partial<LlmSettings> = {};
  const provider = env.MOAH_LLM_PROVIDER?.trim();
  if (provider) {
    if (!isLlmProviderId(provider)) {
      throw new AppError("MOAH_LLM_PROVIDER deve ser simulator ou openai-compatible.", "validation");
    }
    parsed.provider = provider;
  }
  const baseUrl = env.MOAH_LLM_BASE_URL?.trim();
  if (baseUrl) {
    parsed.baseUrl = parseBaseUrl(baseUrl);
  }
  const model = env.MOAH_LLM_MODEL?.trim();
  if (model) {
    parsed.model = parseModel(model);
  }
  const timeout = env.MOAH_LLM_TIMEOUT_MS?.trim();
  if (timeout) {
    parsed.timeoutMs = parseBoundedInteger(Number(timeout), "MOAH_LLM_TIMEOUT_MS", 100, 120_000);
  }
  const calls = env.MOAH_LLM_MAX_TOOL_CALLS?.trim();
  if (calls) {
    parsed.maxToolCalls = parseBoundedInteger(Number(calls), "MOAH_LLM_MAX_TOOL_CALLS", 1, 8);
  }
  return parsed;
}

function parseModel(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "" || value.includes("\0") || value.includes("\n")) {
    throw new AppError("llm.model deve ser um nome de modelo.", "validation");
  }
  if (value.trim().length > 200) {
    throw new AppError("llm.model excede 200 caracteres.", "validation");
  }
  return value.trim();
}

function parseBoundedInteger(value: unknown, label: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new AppError(`${label} deve ser um inteiro entre ${min} e ${max}.`, "validation");
  }
  return value;
}
