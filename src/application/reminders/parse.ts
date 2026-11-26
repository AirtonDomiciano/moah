/** Validação de pedidos de lembrete. Sem agendamento e sem dependência de voz. */

const REMINDER_COMMAND =
  /\b(me\s+lembr[ae]|lembre[- ]?me|lembrar(?:\s+de)?|lembrete|agend[ae]r?|alarme)\b/i;
const REMEMBER_STT = /\bme\s+lembro\s+de\b/i;
const DELAY_REMINDER =
  /\bdaqui(?:\s+a)?\s+\d+\s*(minuto|minutos|hora|horas|segundo|segundos)\b/i;
const DELAY_MINUTES_DIGIT = /\bdaqui(?:\s+a)?\s+(\d+)\s*minutos?\b/i;
const DELAY_MINUTES_WORD = /\bdaqui(?:\s+a)?\s+([a-záéíóúâêôãõç]+)\s*minutos?\b/i;
const ALTER_INTENT = /\balter(?:ar|a|e|o)?\b/i;
const CANCEL_INTENT = /\bcancel(?:ar|a|e|o)?\b/i;
const CHANGE_CONTENT = /\blembrete\s+de\s+(.+?)\s+para\b/i;
const CHANGE_DELAY = /\bpara(?:\s+daqui(?:\s+a)?)?\s+(\d+|[a-záéíóúâêôãõç]+)\s+(segundos?|minutos?)\b/i;

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

export type ParsedLocalReminder = {
  texto: string;
  minutos: number;
};

export type ReminderChange =
  | { kind: "alter"; texto: string; segundos: number }
  | { kind: "alter-incomplete"; speak: string }
  | { kind: "cancel" };

/**
 * “me lembre/lembra” e agenda explícita.
 * “me lembro de” só conta com prazo futuro válido em minutos.
 */
export function isReminderRequest(text: string): boolean {
  if (REMINDER_COMMAND.test(text) || DELAY_REMINDER.test(text)) {
    return true;
  }
  return REMEMBER_STT.test(text) && extractMinutesDelay(text) !== null;
}

/** Minutos futuros explícitos; null se ausente ou inválido. */
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

/**
 * Extrai texto e minutos para criar_lembrete_local.
 * “Me lembro de …” sem prazo devolve null (não agenda).
 * Comando imperativo sem prazo também devolve null.
 */
export function parseReminderChange(text: string): ReminderChange | null {
  const trimmed = text.trim();
  if (!trimmed || !REMINDER_COMMAND.test(trimmed)) {
    return null;
  }
  if (CANCEL_INTENT.test(trimmed)) {
    return { kind: "cancel" };
  }
  if (!ALTER_INTENT.test(trimmed)) {
    return null;
  }
  const content = CHANGE_CONTENT.exec(trimmed)?.[1]?.trim() ?? "";
  const delay = extractChangeDelay(trimmed);
  if (!content || delay === null) {
    const speak = content
      ? `Diga o novo prazo do lembrete de ${content}, por exemplo para 30 segundos.`
      : "Diga qual lembrete alterar e o novo prazo.";
    return { kind: "alter-incomplete", speak };
  }
  return { kind: "alter", texto: content, segundos: delay };
}

function extractChangeDelay(text: string): number | null {
  const match = CHANGE_DELAY.exec(text);
  if (!match?.[1] || !match[2]) {
    return null;
  }
  const amount = Number(match[1]);
  const value = Number.isInteger(amount) && amount > 0 ? amount : wordAmount(match[1]);
  if (value === null) {
    return null;
  }
  const unit = match[2].toLowerCase();
  const segundos = unit.startsWith("minuto") ? value * 60 : value;
  if (segundos < 1 || segundos > 24 * 60 * 60) {
    return null;
  }
  return segundos;
}

function wordAmount(token: string): number | null {
  const key = token
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  return MINUTE_WORDS[key] ?? MINUTE_WORDS[token.toLowerCase()] ?? null;
}

export function parseLocalReminder(text: string): ParsedLocalReminder | null {
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  const minutos = extractMinutesDelay(trimmed);
  if (minutos === null) {
    return null;
  }
  if (REMEMBER_STT.test(trimmed)) {
    return { texto: reminderBody(trimmed), minutos };
  }
  if (REMINDER_COMMAND.test(trimmed) || DELAY_REMINDER.test(trimmed)) {
    return { texto: reminderBody(trimmed), minutos };
  }
  return null;
}

function reminderBody(text: string): string {
  let body = text.trim();
  body = body.replace(/^[.,;:!?\s]+/, "");
  body = body.replace(/\bme\s+lembr[aeo]\s+de\b/i, " ");
  body = body.replace(/\blembre[- ]?me\s*(de)?\b/i, " ");
  body = body.replace(/\blembrar(?:\s+de)?\b/i, " ");
  body = body.replace(/\b(lembrete|alarme|agend[ae]r?)\b/i, " ");
  body = body.replace(/\bdaqui(?:\s+a)?\s+(\d+|[a-záéíóúâêôãõç]+)\s*(minuto|minutos|hora|horas|segundo|segundos)\b/i, " ");
  body = body.replace(/[.,;:!?]+$/g, " ");
  body = body.replace(/\s+/g, " ").trim();
  return body || "lembrete";
}
