import { isDomain, type Domain } from "../domain/constants.js";
import { ALTER_LOCAL_REMINDER_TOOL, LOCAL_REMINDER_TOOL, READ_TOOLS } from "../domain/policy.js";
import { formatRecordLines } from "./format-record.js";
import { governVoiceTool } from "./governance.js";
import {
  extractMinutesDelay,
  isReminderRequest,
  parseLocalReminder,
  parseReminderChange,
} from "./reminders/index.js";
import { findCheckpoint, listKnownProjects, type WorkLogContext } from "./work-log.js";

export const VOICE_UNAVAILABLE_SPEECH = "Essa capacidade ainda está indisponível.";
export const VOICE_COMMAND_UNAVAILABLE_SPEECH = "Esse comando ainda não está disponível.";
export const VOICE_REMINDER_UNAVAILABLE_SPEECH = "Ainda não consigo criar lembretes.";
export const VOICE_REMINDER_CANCEL_UNAVAILABLE_SPEECH = "Ainda não consigo cancelar lembretes.";

export type VoiceRequestStatus = "ok" | "unavailable" | "ambiguous" | "none" | "denied";

export interface VoiceRequestResult {
  status: VoiceRequestStatus;
  terminal: string;
  speak: string | null;
  tool: string | null;
}

type VoiceIntent =
  | { kind: "tool"; tool: string; args: Record<string, unknown> }
  | { kind: "local"; terminal: string; speak: string }
  | { kind: "unavailable"; detail: string; speak?: string }
  | { kind: "ambiguous"; candidate: string; options: string[] }
  | { kind: "none" };

const CLOCK_REQUEST =
  /^(QUE HORA E|QUE HORA SAO|QUE HORAS|QUE HORAS SAO|QUE HORAS E|QUAL A HORA|QUAL E A HORA|ME DIZ A HORA|ME DIZ AS HORAS|ME DIGA A HORA|ME DIGA AS HORAS|ME FALA A HORA|ME FALA AS HORAS|ME FALA QUE HORAS SAO|ME DIZ QUE HORAS SAO)( AGORA)?$/;

const WRITE_INTENT = /\b(registr[ae]|registre|conclu[ií]|apague|delete|insira|grave)\b/i;
const PENDING_INTENT = /pend[eê]n/i;
const SUMMARY_INTENT = /resumo|\bo que (eu )?fiz\b|\bfizemos\b|\bmeu dia\b/i;
const CHECKPOINT_INTENT = /checkpoint|onde paramos|paramos|retomar/i;
const ONDE_PARAMOS_NO = /ONDE PARAMOS NO (.+)$/;
const DATE_INTENT = /\b(\d{4}-\d{2}-\d{2})\b/;
const MEETING_INTENT = /reuni[aã]o\s+(reu_[0-9a-f-]{8,})/i;

const CATALOG = new Set<string>([...READ_TOOLS, LOCAL_REMINDER_TOOL, ALTER_LOCAL_REMINDER_TOOL]);

export function handleVoiceRequest(
  context: WorkLogContext,
  domain: Domain,
  text: string,
): VoiceRequestResult {
  const trimmed = text.trim();
  if (!trimmed) {
    return { status: "none", terminal: "", speak: null, tool: null };
  }
  const intent = resolveVoiceIntent(context, domain, trimmed);
  if (intent.kind === "none") {
    return { status: "none", terminal: "", speak: null, tool: null };
  }
  if (intent.kind === "local") {
    return { status: "ok", terminal: intent.terminal, speak: intent.speak, tool: null };
  }
  if (intent.kind === "ambiguous") {
    const titulo = titleProject(normalizeWords(intent.candidate));
    const terminal =
      `Projeto ambíguo para «${titulo}». Confirme qual consultar: ${intent.options.join(", ")}.`;
    return { status: "ambiguous", terminal, speak: null, tool: null };
  }
  if (intent.kind === "unavailable") {
    return {
      status: "unavailable",
      terminal: intent.detail,
      speak: intent.speak ?? VOICE_UNAVAILABLE_SPEECH,
      tool: null,
    };
  }
  if (!CATALOG.has(intent.tool)) {
    return {
      status: "unavailable",
      terminal: `Ferramenta ausente do catálogo: ${intent.tool}.`,
      speak: VOICE_UNAVAILABLE_SPEECH,
      tool: intent.tool,
    };
  }
  const execution = governVoiceTool(context, { domain, project: null }, intent.tool, intent.args);
  if (intent.tool === ALTER_LOCAL_REMINDER_TOOL) {
    return presentReminderChange(execution);
  }
  if (!execution.ok) {
    return {
      status: "denied",
      terminal: execution.question ?? execution.lines.join("\n"),
      speak: null,
      tool: intent.tool,
    };
  }
  if (intent.tool === "consultar_checkpoint") {
    return presentCheckpoint(context, domain, intent.args, execution.lines);
  }
  if (intent.tool === LOCAL_REMINDER_TOOL) {
    return presentReminder(execution);
  }
  return {
    status: "ok",
    terminal: execution.lines.join("\n"),
    speak: execution.lines.join(". "),
    tool: intent.tool,
  };
}

export function resolveVoiceIntent(context: WorkLogContext, domain: Domain, text: string): VoiceIntent {
  const other = otherDomain(text, domain);
  if (other) {
    return {
      kind: "unavailable",
      detail: `A sessão de voz está em ${domain}. Consulta a ${other} exige outra sessão.`,
    };
  }
  const clock = clockSpeech(text, context.now(), context.timeZone);
  if (clock) {
    return { kind: "local", terminal: `${clock} (${context.timeZone})`, speak: clock };
  }
  const change = parseReminderChange(text);
  if (change?.kind === "cancel") {
    return {
      kind: "unavailable",
      detail: "Cancelar lembrete não está disponível.",
      speak: VOICE_REMINDER_CANCEL_UNAVAILABLE_SPEECH,
    };
  }
  if (change?.kind === "alter-incomplete") {
    return { kind: "unavailable", detail: change.speak, speak: change.speak };
  }
  if (change?.kind === "alter") {
    return {
      kind: "tool",
      tool: ALTER_LOCAL_REMINDER_TOOL,
      args: { texto: change.texto, segundos: String(change.segundos) },
    };
  }
  const reminder = parseLocalReminder(text);
  if (reminder) {
    return {
      kind: "tool",
      tool: LOCAL_REMINDER_TOOL,
      args: { texto: reminder.texto, minutos: String(reminder.minutos) },
    };
  }
  if (isReminderRequest(text)) {
    return {
      kind: "unavailable",
      detail: "Lembrete sem prazo válido em minutos. Informe daqui a quantos minutos.",
      speak: VOICE_REMINDER_UNAVAILABLE_SPEECH,
    };
  }
  if (WRITE_INTENT.test(text)) {
    return {
      kind: "unavailable",
      detail: "Escrita e conclusão não estão no catálogo liberado para a voz.",
    };
  }
  const wants = [PENDING_INTENT.test(text), SUMMARY_INTENT.test(text), CHECKPOINT_INTENT.test(text)].filter(
    Boolean,
  );
  const meeting = MEETING_INTENT.exec(text);
  if (meeting?.[1]) {
    return { kind: "tool", tool: "consultar_reuniao", args: { id: meeting[1] } };
  }
  if (wants.length > 1) {
    return {
      kind: "unavailable",
      detail: "A pergunta mistura assuntos. Escolha pendências, resumo AAAA-MM-DD ou checkpoint.",
    };
  }
  if (PENDING_INTENT.test(text)) {
    return { kind: "tool", tool: "consultar_pendencias", args: {} };
  }
  if (CHECKPOINT_INTENT.test(text)) {
    return resolveCheckpointIntent(context, text);
  }
  if (SUMMARY_INTENT.test(text)) {
    const date = DATE_INTENT.exec(text)?.[1];
    if (!date) {
      return {
        kind: "unavailable",
        detail: "Informe a data explícita do resumo no formato AAAA-MM-DD.",
      };
    }
    return { kind: "tool", tool: "consultar_resumo", args: { data: date } };
  }
  if (/\bme\s+lembro\s+de\b/i.test(text) && extractMinutesDelay(text) === null) {
    return { kind: "none" };
  }
  return {
    kind: "unavailable",
    detail: "Comando não disponível.",
    speak: VOICE_COMMAND_UNAVAILABLE_SPEECH,
  };
}

export function formatLocalTimeSpeech(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  const horas = hour === 1 ? "1 hora" : `${hour} horas`;
  const minutos = minute === 1 ? "1 minuto" : `${minute} minutos`;
  const verbo = hour === 1 ? "É" : "São";
  return `${verbo} ${horas} e ${minutos}.`;
}

function clockSpeech(text: string, now: Date, timeZone: string): string | null {
  if (!CLOCK_REQUEST.test(normalizeWords(text))) {
    return null;
  }
  return formatLocalTimeSpeech(now, timeZone);
}

function resolveCheckpointIntent(context: WorkLogContext, text: string): VoiceIntent {
  const projectRaw = extractProjectAfterOndeParamos(text);
  if (projectRaw === null) {
    return { kind: "tool", tool: "consultar_checkpoint", args: {} };
  }
  const known = listKnownProjects(context);
  const candidate = normalizeWords(projectRaw);
  if (known.length === 0) {
    return {
      kind: "tool",
      tool: "consultar_checkpoint",
      args: { projeto: titleProject(candidate) },
    };
  }
  const exact = known.filter((project) => normalizeWords(project) === candidate);
  if (exact.length === 1) {
    return { kind: "tool", tool: "consultar_checkpoint", args: { projeto: exact[0] } };
  }
  if (exact.length > 1) {
    return { kind: "ambiguous", candidate: projectRaw, options: exact };
  }
  const prefixes = known.filter((project) => normalizeWords(project).startsWith(candidate));
  if (prefixes.length === 1) {
    return { kind: "tool", tool: "consultar_checkpoint", args: { projeto: prefixes[0] } };
  }
  if (prefixes.length > 1) {
    return { kind: "ambiguous", candidate: projectRaw, options: prefixes };
  }
  return {
    kind: "tool",
    tool: "consultar_checkpoint",
    args: { projeto: titleProject(candidate) },
  };
}

function presentCheckpoint(
  context: WorkLogContext,
  domain: Domain,
  args: Record<string, unknown>,
  fallbackLines: string[],
): VoiceRequestResult {
  const project = typeof args.projeto === "string" ? args.projeto : null;
  const checkpoint = findCheckpoint(context, { domain, project });
  if (!checkpoint) {
    const where = project ? `${domain}/${project}` : domain;
    return {
      status: "ok",
      terminal: `Nenhum checkpoint para ${where}.`,
      speak: null,
      tool: "consultar_checkpoint",
    };
  }
  const terminal = formatRecordLines(checkpoint, context.timeZone).join("\n");
  const next = checkpoint.nextStep ?? "(nenhum)";
  return {
    status: "ok",
    terminal: terminal || fallbackLines.join("\n"),
    speak: `${checkpoint.text} Próximo passo: ${next}`,
    tool: "consultar_checkpoint",
  };
}

function presentReminderChange(execution: {
  ok: boolean;
  lines: string[];
  question: string | null;
  modelPayload: unknown;
}): VoiceRequestResult {
  if (!execution.ok) {
    const speak = execution.question ?? execution.lines[0] ?? "Não encontrei o lembrete.";
    return { status: "unavailable", terminal: speak, speak, tool: ALTER_LOCAL_REMINDER_TOOL };
  }
  const payload =
    typeof execution.modelPayload === "object" && execution.modelPayload !== null
      ? (execution.modelPayload as Record<string, unknown>)
      : {};
  const confirmation =
    typeof payload.confirmation === "string" ? payload.confirmation : execution.lines[0] ?? "Lembrete alterado.";
  const warning = typeof payload.warning === "string" ? payload.warning : "Aviso: vale só nesta sessão.";
  return {
    status: "ok",
    terminal: execution.lines.join("\n"),
    speak: `${confirmation} ${warning}`,
    tool: ALTER_LOCAL_REMINDER_TOOL,
  };
}

function presentReminder(execution: { lines: string[]; modelPayload: unknown }): VoiceRequestResult {
  const payload =
    typeof execution.modelPayload === "object" && execution.modelPayload !== null
      ? (execution.modelPayload as Record<string, unknown>)
      : {};
  const confirmation =
    typeof payload.confirmation === "string" ? payload.confirmation : execution.lines[0] ?? "Lembrete criado.";
  const warning = typeof payload.warning === "string" ? payload.warning : "Aviso: vale só nesta sessão.";
  return {
    status: "ok",
    terminal: execution.lines.join("\n"),
    speak: `${confirmation} ${warning}`,
    tool: LOCAL_REMINDER_TOOL,
  };
}

export { extractMinutesDelay, isReminderRequest, parseLocalReminder } from "./reminders/index.js";

function extractProjectAfterOndeParamos(text: string): string | null {
  const normalized = normalizeWords(text);
  const match = ONDE_PARAMOS_NO.exec(normalized);
  const project = match?.[1]?.trim();
  return project || null;
}

function normalizeWords(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, " ");
}

function titleProject(normalized: string): string {
  return normalized
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function otherDomain(text: string, domain: Domain): Domain | null {
  for (const candidate of ["pessoal", "imex", "aluai"] as const) {
    if (candidate !== domain && new RegExp(`\\b${candidate}\\b`, "i").test(text)) {
      return isDomain(candidate) ? candidate : null;
    }
  }
  return null;
}
