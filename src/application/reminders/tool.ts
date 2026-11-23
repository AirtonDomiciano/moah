import type { Domain } from "../../domain/constants.js";
import type { LlmToolDefinition } from "../../domain/llm.js";
import type { ToolExecution } from "../query-tools.js";
import type { JobContext } from "../jobs.js";
import { scheduleLocalReminder } from "./schedule.js";
import type { SessionReminderStore } from "./session.js";
import { processSessionReminders } from "./session.js";

export const CRIAR_LEMBRETE_LOCAL = "criar_lembrete_local";

export const LOCAL_REMINDER_TOOL_DEFINITION: LlmToolDefinition = {
  name: CRIAR_LEMBRETE_LOCAL,
  description:
    "Cria um lembrete avulso local da sessão, com prazo em minutos. Não altera a agenda sincronizada.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      texto: { type: "string", description: "O que lembrar." },
      minutos: { type: "string", description: "Minutos até o disparo, inteiro positivo." },
    },
    required: ["texto", "minutos"],
  },
};

export function executeCriarLembreteLocal(
  jobs: JobContext,
  domain: Domain,
  rawArguments: unknown,
  store: SessionReminderStore = processSessionReminders,
): ToolExecution {
  const args = asObject(rawArguments);
  if (args === null) {
    return failure("Os argumentos da ferramenta precisam ser um objeto JSON.");
  }
  const texto = typeof args.texto === "string" ? args.texto.trim() : "";
  const minutosRaw = args.minutos;
  const minutos =
    typeof minutosRaw === "number"
      ? minutosRaw
      : typeof minutosRaw === "string"
        ? Number(minutosRaw.trim())
        : Number.NaN;
  if (!texto) {
    return failure("Informe texto do lembrete.");
  }
  if (!Number.isInteger(minutos) || minutos < 1) {
    return failure("Informe minutos como inteiro positivo.");
  }
  try {
    const scheduled = scheduleLocalReminder(jobs, { domain, texto, minutos }, store);
    return {
      name: CRIAR_LEMBRETE_LOCAL,
      arguments: args,
      ok: true,
      empty: false,
      question: null,
      references: [scheduled.reminder.id, scheduled.reminder.jobId],
      lines: scheduled.lines,
      modelPayload: {
        tool: CRIAR_LEMBRETE_LOCAL,
        ok: true,
        empty: false,
        confirmation: scheduled.confirmation,
        warning: scheduled.warning,
        lines: scheduled.lines,
        reminderId: scheduled.reminder.id,
        jobId: scheduled.reminder.jobId,
        fireAt: scheduled.reminder.fireAt,
        notice: "Lembrete avulso da sessão; não é evento de agenda sincronizada.",
      },
    };
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Falha ao criar lembrete.");
  }
}

function asObject(value: unknown): Record<string, unknown> | null {
  if (value === undefined || value === null) {
    return {};
  }
  if (typeof value === "string") {
    try {
      return asObject(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function failure(question: string): ToolExecution {
  return {
    name: CRIAR_LEMBRETE_LOCAL,
    arguments: {},
    ok: false,
    empty: null,
    question,
    references: [],
    lines: [`Pergunta necessária: ${question}`],
    modelPayload: { tool: CRIAR_LEMBRETE_LOCAL, ok: false, question },
  };
}
