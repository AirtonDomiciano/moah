import { isDomain, type Domain } from "../domain/constants.js";
import { READ_TOOLS } from "../domain/policy.js";
import { formatRecordLines } from "./format-record.js";
import { governQuery } from "./governance.js";
import { findCheckpoint, listKnownProjects, type WorkLogContext } from "./work-log.js";

export const VOICE_UNAVAILABLE_SPEECH = "Essa capacidade ainda está indisponível.";
export const VOICE_REMINDER_UNAVAILABLE_SPEECH = "Ainda não consigo criar lembretes.";

export type VoiceRequestStatus = "ok" | "unavailable" | "ambiguous" | "none" | "denied";

export interface VoiceRequestResult {
  status: VoiceRequestStatus;
  terminal: string;
  speak: string | null;
  tool: string | null;
}

type VoiceIntent =
  | { kind: "tool"; tool: string; args: Record<string, unknown> }
  | { kind: "unavailable"; detail: string; speak?: string }
  | { kind: "ambiguous"; candidate: string; options: string[] }
  | { kind: "none" };

const WRITE_INTENT = /\b(registr[ae]|registre|conclu[ií]|apague|delete|insira|grave)\b/i;
const PENDING_INTENT = /pend[eê]n/i;
const SUMMARY_INTENT = /resumo|\bo que (eu )?fiz\b|\bfizemos\b|\bmeu dia\b/i;
const CHECKPOINT_INTENT = /checkpoint|onde paramos|paramos|retomar/i;
const ONDE_PARAMOS_NO = /ONDE PARAMOS NO (.+)$/;
const DATE_INTENT = /\b(\d{4}-\d{2}-\d{2})\b/;
const MEETING_INTENT = /reuni[aã]o\s+(reu_[0-9a-f-]{8,})/i;
/** Pedido explícito de lembrete (imperativo / agenda). */
const REMINDER_COMMAND =
  /\b(me\s+lembr[ae]|lembre[- ]?me|lembrar(?:\s+de)?|lembrete|agend[ae]r?|alarme)\b/i;
/** Variante STT de “me lembre”: só conta com prazo futuro em minutos. */
const REMEMBER_STT = /\bme\s+lembro\s+de\b/i;
/** Aceita “daqui a 5 minutos” e a forma STT “daqui 5 minutos”. */
const DELAY_REMINDER =
  /\bdaqui(?:\s+a)?\s+\d+\s*(minuto|minutos|hora|horas|segundo|segundos)\b/i;
const DELAY_MINUTES_DIGIT = /\bdaqui(?:\s+a)?\s+(\d+)\s*minutos?\b/i;
const DELAY_MINUTES_WORD = /\bdaqui(?:\s+a)?\s+([a-záéíóúâêôãõç]+)\s*minutos?\b/i;

const MINUTE_WORDS: Record<string, number> = {
  um: 1,
  uma: 1,
  dois: 2,
  tres: 3,
  três: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  quinze: 15,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
};

const REGISTERED = new Set<string>(READ_TOOLS);

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
  if (!REGISTERED.has(intent.tool)) {
    return {
      status: "unavailable",
      terminal: `Ferramenta ausente do catálogo: ${intent.tool}.`,
      speak: VOICE_UNAVAILABLE_SPEECH,
      tool: intent.tool,
    };
  }
  const execution = governQuery(context, { domain, project: null }, intent.tool, intent.args);
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
  if (isReminderRequest(text)) {
    return {
      kind: "unavailable",
      detail: "Catálogo sem ferramenta de lembretes. Agenda/lembrete ainda não cadastrados para a voz.",
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
  return { kind: "none" };
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

/** “me lembre/lembra” seguem; “me lembro de” só com prazo explícito e válido em minutos. */
export function isReminderRequest(text: string): boolean {
  if (REMINDER_COMMAND.test(text) || DELAY_REMINDER.test(text)) {
    return true;
  }
  return REMEMBER_STT.test(text) && extractMinutesDelay(text) !== null;
}

/** Minutos futuros explícitos (dígito ou palavra); null se ausente ou inválido. */
export function extractMinutesDelay(text: string): number | null {
  const digit = DELAY_MINUTES_DIGIT.exec(text);
  if (digit?.[1]) {
    const value = Number(digit[1]);
    return Number.isInteger(value) && value > 0 ? value : null;
  }
  const word = DELAY_MINUTES_WORD.exec(text);
  if (!word?.[1]) {
    return null;
  }
  const key = word[1]
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  const value = MINUTE_WORDS[key] ?? MINUTE_WORDS[word[1].toLowerCase()];
  return value !== undefined && value > 0 ? value : null;
}

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
