export const LLM_PROVIDERS = ["simulator", "openai-compatible"] as const;
export type LlmProviderId = (typeof LLM_PROVIDERS)[number];

export function isLlmProviderId(value: string): value is LlmProviderId {
  return (LLM_PROVIDERS as readonly string[]).includes(value);
}

export interface LlmToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: "object";
    additionalProperties: false;
    properties: Record<string, { type: "string"; description: string }>;
    required?: string[];
  };
}

export interface LlmToolCall {
  id: string;
  name: string;
  arguments: unknown;
}

export interface LlmMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: LlmToolCall[];
}

export interface LlmCompletionRequest {
  messages: LlmMessage[];
  tools: LlmToolDefinition[];
  signal?: AbortSignal;
}

export interface LlmCompletion {
  provider: LlmProviderId;
  model: string;
  content: string | null;
  toolCalls: LlmToolCall[];
}

export interface LlmProvider {
  readonly id: LlmProviderId;
  readonly model: string;
  complete(request: LlmCompletionRequest): Promise<LlmCompletion>;
}

export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}
