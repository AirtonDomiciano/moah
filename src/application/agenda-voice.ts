/** Consulta da agenda Google pela voz. A fala sai só do que a API devolveu. */

import type { Domain } from "../domain/constants.js";
import type { LlmProvider, LlmToolDefinition } from "../domain/llm.js";
import { voiceAuthority, evaluatePolicy, validateProposal } from "../domain/policy.js";
import { addCivilDays, civilToday, parseCivilDate } from "../domain/time.js";
import { listEvents, type CalendarEvent } from "../infrastructure/google/calendar.js";
import { accessToken, readTokens } from "../infrastructure/google/oauth.js";
import type { GoogleConfig } from "../infrastructure/config.js";
import { civilDayUtcRange } from "./agenda-time.js";
import { isReminderRequest, parseLocalReminder, parseReminderChange } from "./reminders/index.js";
import type { VoiceRequestResult } from "./voice-request.js";
import type { WorkLogContext } from "./work-log.js";

export const AGENDA_DATE_SPEECH = "De qual data? Diga hoje, amanhã ou uma data AAAA-MM-DD.";
export const AGENDA_DISCONNECTED_SPEECH = "A conta Google ainda não está conectada.";
export const AGENDA_DOMAIN_SPEECH = "Não há agenda conectada para este domínio.";
export const AGENDA_FAILURE_SPEECH = "Não consegui consultar a agenda.";

const AGENDA_TOOL: LlmToolDefinition = {
  name: "consultar_agenda",
  description: "Informa só a data civil AAAA-MM-DD da agenda pedida. Não lista eventos.",
  parameters: {
    type: "object",
    additionalProperties: false,
    properties: {
      data: { type: "string", description: "Data civil AAAA-MM-DD." },
    },
    required: ["data"],
  },
};

export function resolveAgendaDate(
  text: string,
  timeZone: string,
  now: Date,
): { kind: "date"; data: string; label: string } | { kind: "ask" } | { kind: "no" } {
  if (parseReminderChange(text) || parseLocalReminder(text) || isReminderRequest(text)) {
    return { kind: "no" };
  }
  if (!/\b(reuni[oõ]es|reuni[aã]o|agenda|compromissos|calend[aá]rio)\b/i.test(text)) {
    return { kind: "no" };
  }
  const explicit = text.match(/\b(\d{4}-\d{2}-\d{2})\b/)?.[1];
  if (explicit) {
    const data = parseCivilDate(explicit);
    return { kind: "date", data, label: data };
  }
  const today = civilToday(timeZone, now);
  if (/\bhoje\b/i.test(text)) {
    return { kind: "date", data: today, label: "Hoje" };
  }
  if (/amanh[ãa](?!\p{L})/iu.test(text)) {
    const data = addCivilDays(today, 1);
    return { kind: "date", data, label: "Amanhã" };
  }
  if (/\bontem\b/i.test(text)) {
    const data = addCivilDays(today, -1);
    return { kind: "date", data, label: "Ontem" };
  }
  return { kind: "ask" };
}

export function speakAgenda(label: string, events: CalendarEvent[]): string {
  if (events.length === 0) {
    return `${label}: não há reuniões.`;
  }
  const items = events.map((event) =>
    event.allDay ? `${event.when}, ${event.title}` : `${event.when}, ${event.title}`,
  );
  return `${label}: ${items.join(". ")}.`;
}

export async function answerAgendaQuestion(input: {
  context: WorkLogContext;
  domain: Domain;
  text: string;
  google: GoogleConfig;
  provider: LlmProvider | null;
  fetchImpl?: typeof fetch;
}): Promise<VoiceRequestResult | null> {
  let resolved = resolveAgendaDate(input.text, input.context.timeZone, input.context.now());
  if (resolved.kind === "no") {
    return null;
  }
  if (resolved.kind === "ask" && input.provider && input.provider.id !== "simulator") {
    const data = await dateFromModel(input.provider, input.text, civilToday(input.context.timeZone, input.context.now()));
    resolved = data ? { kind: "date", data, label: data } : { kind: "ask" };
  }
  if (resolved.kind === "ask") {
    return { status: "unavailable", terminal: AGENDA_DATE_SPEECH, speak: AGENDA_DATE_SPEECH, tool: "consultar_agenda" };
  }
  const decision = evaluatePolicy(
    validateProposal({
      action: "consultar",
      tool: "consultar_agenda",
      agent: "voz",
      domain: input.domain,
      target: input.domain,
      parameters: { data: resolved.data },
    }),
    voiceAuthority(input.domain),
  );
  if (decision.decision !== "allow") {
    return { status: "denied", terminal: decision.reason, speak: null, tool: "consultar_agenda" };
  }
  const calendarId = input.google.calendarios[input.domain];
  if (!calendarId) {
    return { status: "unavailable", terminal: AGENDA_DOMAIN_SPEECH, speak: AGENDA_DOMAIN_SPEECH, tool: "consultar_agenda" };
  }
  if (!readTokens(input.context.dataDir)) {
    return {
      status: "unavailable",
      terminal: AGENDA_DISCONNECTED_SPEECH,
      speak: AGENDA_DISCONNECTED_SPEECH,
      tool: "consultar_agenda",
    };
  }
  if (!input.google.clientId) {
    return {
      status: "unavailable",
      terminal: "Falta o clientId Google na configuração.",
      speak: "A agenda ainda não tem o identificador do aplicativo.",
      tool: "consultar_agenda",
    };
  }
  try {
    const token = await accessToken(
      { clientId: input.google.clientId, clientSecret: input.google.clientSecret },
      input.context.dataDir,
      input.fetchImpl,
      input.context.now(),
    );
    const range = civilDayUtcRange(resolved.data, input.context.timeZone);
    const events = await listEvents(
      {
        accessToken: token,
        calendarId,
        timeMin: range.timeMin,
        timeMax: range.timeMax,
        timeZone: input.context.timeZone,
      },
      input.fetchImpl,
    );
    const speak = speakAgenda(resolved.label, events);
    return { status: "ok", terminal: speak, speak, tool: "consultar_agenda" };
  } catch (error) {
    const message = error instanceof Error ? error.message : AGENDA_FAILURE_SPEECH;
    const speak = message.includes("conectada") || message.includes("autorizou") ? message : AGENDA_FAILURE_SPEECH;
    return { status: "unavailable", terminal: message, speak, tool: "consultar_agenda" };
  }
}

async function dateFromModel(provider: LlmProvider, text: string, today: string): Promise<string | null> {
  try {
    const completion = await provider.complete({
      messages: [
        {
          role: "system",
          content: `Hoje é ${today}. Se o pedido for de agenda, chame consultar_agenda com a data AAAA-MM-DD. Não invente eventos.`,
        },
        { role: "user", content: text },
      ],
      tools: [AGENDA_TOOL],
    });
    const call = completion.toolCalls.find((item) => item.name === "consultar_agenda");
    const args = call?.arguments;
    const data = typeof args === "object" && args !== null && "data" in args ? String((args as { data?: unknown }).data ?? "") : "";
    return data ? parseCivilDate(data) : null;
  } catch {
    return null;
  }
}

