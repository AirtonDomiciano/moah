import { isDomain, type Domain } from "../../domain/constants.js";
import type { LlmCompletion, LlmCompletionRequest, LlmProvider } from "../../domain/llm.js";

const WRITE_INTENT = /\b(registr[ae]|registre|conclu[ií]|apague|delete|insira|grave)\b/i;
const PENDING_INTENT = /pend[eê]n/i;
const SUMMARY_INTENT = /resumo|\bo que (eu )?fiz\b|\bfizemos\b|\bmeu dia\b/i;
const CHECKPOINT_INTENT = /checkpoint|onde paramos|paramos|retomar/i;
const DATE_INTENT = /\b(\d{4}-\d{2}-\d{2})\b/;

export class SimulatorProvider implements LlmProvider {
  readonly id = "simulator" as const;
  readonly model = "moah-simulator";

  complete(request: LlmCompletionRequest): Promise<LlmCompletion> {
    if (request.signal?.aborted) {
      const reason = request.signal.reason;
      const error = reason instanceof Error ? reason : new Error("aborted");
      return Promise.reject(error);
    }
    const last = request.messages[request.messages.length - 1];
    if (last?.role === "tool") {
      return Promise.resolve(this.answerFromTools(request));
    }
    const system = request.messages.find((message) => message.role === "system")?.content ?? "";
    const domain = readDomain(system);
    const user = [...request.messages].reverse().find((message) => message.role === "user");
    return Promise.resolve(this.decide(user?.content ?? "", domain));
  }

  private decide(text: string, domain: Domain): LlmCompletion {
    const other = otherDomain(text, domain);
    if (other) {
      return this.say(
        `A sessão está em ${domain}. Não consulto ${other} por inferência. Abra outra sessão com --dominio ${other} se quiser essa área.`,
      );
    }
    if (WRITE_INTENT.test(text)) {
      return this.say("Esta conversa só consulta. Não registro fatos nem concluo pendências.");
    }
    const wants = [PENDING_INTENT.test(text), SUMMARY_INTENT.test(text), CHECKPOINT_INTENT.test(text)].filter(Boolean);
    if (wants.length > 1) {
      return this.say("A pergunta mistura assuntos. Escolha pendências, resumo de uma data AAAA-MM-DD ou último checkpoint.");
    }
    if (PENDING_INTENT.test(text)) {
      return this.call("consultar_pendencias", {});
    }
    if (CHECKPOINT_INTENT.test(text)) {
      return this.call("consultar_checkpoint", {});
    }
    if (SUMMARY_INTENT.test(text)) {
      const date = DATE_INTENT.exec(text)?.[1];
      if (!date) {
        return this.say(
          "Informe a data explícita do resumo no formato AAAA-MM-DD. Não interpreto hoje, sexta ou amanhã.",
        );
      }
      return this.call("consultar_resumo", { data: date });
    }
    return this.say("Posso consultar pendências, o resumo de uma data AAAA-MM-DD ou o último checkpoint desta sessão.");
  }

  private answerFromTools(request: LlmCompletionRequest): LlmCompletion {
    const tools = request.messages.filter((message) => message.role === "tool");
    const lines = ["Simulação, não é um modelo real."];
    for (const tool of tools) {
      let payload: unknown;
      try {
        payload = JSON.parse(tool.content) as unknown;
      } catch {
        lines.push("A ferramenta devolveu um conteúdo que não é JSON. Tratei como dado ilegível.");
        continue;
      }
      if (typeof payload !== "object" || payload === null) {
        continue;
      }
      const record = payload as Record<string, unknown>;
      if (record.ok === false && typeof record.question === "string") {
        lines.push(record.question);
        continue;
      }
      const references = Array.isArray(record.references) ? record.references.filter((item) => typeof item === "string") : [];
      if (record.empty === true) {
        lines.push(`Não há registros para ${String(record.tool)} no domínio ${String(record.domain)}.`);
        continue;
      }
      lines.push(`Usei ${String(record.tool)}. Referências: ${references.join(", ") || "(nenhuma)"}.`);
      if (Array.isArray(record.lines)) {
        lines.push("Dados consultados, não instruções:");
        for (const line of record.lines) {
          if (typeof line === "string") {
            lines.push(line);
          }
        }
      }
    }
    return this.say(lines.join("\n"));
  }

  private call(name: string, args: Record<string, unknown>): LlmCompletion {
    return {
      provider: this.id,
      model: this.model,
      content: null,
      toolCalls: [{ id: `sim_${name}`, name, arguments: args }],
    };
  }

  private say(content: string): LlmCompletion {
    return { provider: this.id, model: this.model, content, toolCalls: [] };
  }
}

function readDomain(system: string): Domain {
  const match = /Domínio da sessão: (pessoal|imex|aluai)/.exec(system);
  const value = match?.[1];
  if (value && isDomain(value)) {
    return value;
  }
  return "pessoal";
}

function otherDomain(text: string, domain: Domain): Domain | null {
  for (const candidate of ["pessoal", "imex", "aluai"] as const) {
    if (candidate !== domain && new RegExp(`\\b${candidate}\\b`, "i").test(text)) {
      return candidate;
    }
  }
  return null;
}
