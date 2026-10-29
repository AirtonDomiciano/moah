import { AppError } from "../../domain/errors.js";
import type { LlmCompletion, LlmCompletionRequest, LlmProvider, LlmToolCall } from "../../domain/llm.js";

export interface OpenAiCompatibleOptions {
  baseUrl: string;
  model: string;
  timeoutMs: number;
  apiKey: string | null;
  fetchImpl?: typeof fetch;
}

export class OpenAiCompatibleProvider implements LlmProvider {
  readonly id = "openai-compatible" as const;
  readonly model: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly apiKey: string | null;
  private readonly fetchImpl: typeof fetch;

  constructor(options: OpenAiCompatibleOptions) {
    this.model = options.model;
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs;
    this.apiKey = options.apiKey;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    const timeout = AbortSignal.timeout(this.timeoutMs);
    const signal = request.signal ? AbortSignal.any([request.signal, timeout]) : timeout;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (this.apiKey) {
      headers.authorization = `Bearer ${this.apiKey}`;
    }
    let response: Response;
    try {
      response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: this.model,
          messages: request.messages.map(toWireMessage),
          tools: request.tools.map((tool) => ({
            type: "function",
            function: { name: tool.name, description: tool.description, parameters: tool.parameters },
          })),
          tool_choice: "auto",
        }),
        signal,
      });
    } catch (error) {
      throw connectionError(error);
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => undefined);
      throw new AppError(`O modelo respondeu HTTP ${response.status}.`, "unavailable");
    }
    const raw = await response.text();
    if (raw.length > 1_000_000) {
      throw new AppError("A resposta do modelo excedeu o limite aceito.", "unavailable");
    }
    let body: unknown;
    try {
      body = JSON.parse(raw) as unknown;
    } catch {
      throw new AppError("A resposta do modelo não é JSON.", "unavailable");
    }
    return { provider: this.id, model: this.model, ...readCompletion(body) };
  }
}

function toWireMessage(message: LlmCompletionRequest["messages"][number]): Record<string, unknown> {
  if (message.role === "tool") {
    return { role: "tool", tool_call_id: message.toolCallId ?? "", content: message.content };
  }
  if (message.role === "assistant" && message.toolCalls && message.toolCalls.length > 0) {
    return {
      role: "assistant",
      content: message.content || null,
      tool_calls: message.toolCalls.map((call) => ({
        id: call.id,
        type: "function",
        function: {
          name: call.name,
          arguments: typeof call.arguments === "string" ? call.arguments : JSON.stringify(call.arguments ?? {}),
        },
      })),
    };
  }
  return { role: message.role, content: message.content };
}

function readCompletion(body: unknown): Pick<LlmCompletion, "content" | "toolCalls"> {
  if (typeof body !== "object" || body === null) {
    throw new AppError("Resposta do modelo sem mensagem.", "unavailable");
  }
  const choices = (body as { choices?: unknown }).choices;
  const first = Array.isArray(choices) ? choices[0] : undefined;
  if (typeof first !== "object" || first === null) {
    throw new AppError("Resposta do modelo sem mensagem.", "unavailable");
  }
  const message = (first as { message?: unknown }).message;
  if (typeof message !== "object" || message === null) {
    throw new AppError("Resposta do modelo sem mensagem.", "unavailable");
  }
  const record = message as { content?: unknown; tool_calls?: unknown };
  const content = typeof record.content === "string" ? record.content : null;
  const toolCalls = Array.isArray(record.tool_calls) ? record.tool_calls.map(readToolCall) : [];
  return { content, toolCalls };
}

function readToolCall(value: unknown, index: number): LlmToolCall {
  if (typeof value !== "object" || value === null) {
    throw new AppError("Chamada de ferramenta inválida na resposta do modelo.", "unavailable");
  }
  const record = value as { id?: unknown; function?: unknown };
  const fn = record.function;
  if (typeof fn !== "object" || fn === null) {
    throw new AppError("Chamada de ferramenta inválida na resposta do modelo.", "unavailable");
  }
  const name = (fn as { name?: unknown }).name;
  if (typeof name !== "string" || name.trim() === "") {
    throw new AppError("Chamada de ferramenta sem nome.", "unavailable");
  }
  const id = typeof record.id === "string" && record.id.trim() !== "" ? record.id : `call_${index}`;
  return { id, name: name.trim(), arguments: (fn as { arguments?: unknown }).arguments ?? {} };
}

function connectionError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "TimeoutError") {
    return new AppError("Tempo esgotado ao consultar o modelo.", "unavailable");
  }
  if (name === "AbortError") {
    return new AppError("Consulta ao modelo cancelada.", "validation");
  }
  return new AppError("Modelo indisponível. Verifique o endereço configurado.", "unavailable");
}
