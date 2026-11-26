import type { Domain } from "../../domain/constants.js";
import type { LlmToolDefinition } from "../../domain/llm.js";
import type { ToolExecution } from "../query-tools.js";
import type { JobContext } from "../jobs.js";
import { rescheduleLocalReminder, scheduleLocalReminder } from "./schedule.js";
import type { SessionReminderStore } from "./session.js";
import { processSessionReminders } from "./session.js";

export const CRIAR_LEMBRETE_LOCAL = "criar_lembrete_local";
export const ALTERAR_LEMBRETE_LOCAL = "alterar_lembrete_local";

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

export function executeAlterarLembreteLocal(
  jobs: JobContext,
  domain: Domain,
  rawArguments: unknown,
  store: SessionReminderStore = processSessionReminders,
): ToolExecution {
  const args = asObject(rawArguments);
  if (args === null) {
    return failureAlter("Os argumentos da ferramenta precisam ser um objeto JSON.");
  }
  const texto = typeof args.texto === "string" ? args.texto.trim() : "";
  const segundosRaw = args.segundos;
  const segundos =
    typeof segundosRaw === "number"
      ? segundosRaw
      : typeof segundosRaw === "string"
        ? Number(segundosRaw.trim())
        : Number.NaN;
  if (!texto) {
    return failureAlter("Informe qual lembrete alterar.");
  }
  if (!Number.isInteger(segundos) || segundos < 1) {
    return failureAlter("Informe o novo prazo em segundos.");
  }
  try {
    const changed = rescheduleLocalReminder(jobs, { domain, texto, segundos }, store);
    if (changed.kind === "updated") {
      return {
        name: ALTERAR_LEMBRETE_LOCAL,
        arguments: args,
        ok: true,
        empty: false,
        question: null,
        references: [changed.jobId],
        lines: changed.lines,
        modelPayload: {
          tool: ALTERAR_LEMBRETE_LOCAL,
          ok: true,
          confirmation: changed.confirmation,
          warning: changed.warning,
          jobId: changed.jobId,
          fireAt: changed.fireAt,
          segundos: changed.segundos,
        },
      };
    }
    if (changed.kind === "ambiguous") {
      return failureAlter(
        `Há mais de um lembrete pendente de ${changed.texto}. Diga qual alterar: ${changed.options.join("; ")}.`,
      );
    }
    if (changed.kind === "delivered") {
      return failureAlter(`O lembrete de ${changed.texto} já foi entregue.`);
    }
    if (changed.kind === "inactive") {
      return failureAlter(`O lembrete de ${changed.texto} não está pendente.`);
    }
    return failureAlter(`Não encontrei um lembrete pendente de ${changed.texto}.`);
  } catch (error) {
    return failureAlter(error instanceof Error ? error.message : "Falha ao alterar lembrete.");
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

function failureAlter(question: string): ToolExecution {
  return {
    name: ALTERAR_LEMBRETE_LOCAL,
    arguments: {},
    ok: false,
    empty: null,
    question,
    references: [],
    lines: [question],
    modelPayload: { tool: ALTERAR_LEMBRETE_LOCAL, ok: false, question },
  };
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
