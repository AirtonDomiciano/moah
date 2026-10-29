import { AppError } from "../../domain/errors.js";
import type { LlmProvider } from "../../domain/llm.js";
import { OpenAiCompatibleProvider } from "./openai-compatible.js";
import type { LlmSettings } from "./settings.js";
import { SimulatorProvider } from "./simulator.js";

export function createLlmProvider(settings: LlmSettings, apiKey: string | null): LlmProvider {
  if (settings.provider === "simulator") {
    return new SimulatorProvider();
  }
  if (!settings.baseUrl || !settings.model) {
    throw new AppError("O provedor openai-compatible exige endereço e modelo.", "validation");
  }
  return new OpenAiCompatibleProvider({
    baseUrl: settings.baseUrl,
    model: settings.model,
    timeoutMs: settings.timeoutMs,
    apiKey,
  });
}

export function readApiKey(env: NodeJS.ProcessEnv): string | null {
  const value = env.MOAH_LLM_API_KEY?.trim();
  return value ? value : null;
}
