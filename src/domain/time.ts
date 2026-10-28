import { AppError } from "./errors.js";

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const LOCAL_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;
const OFFSET_RE =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2})$/;

const DATE_GUIDANCE =
  'Esta CLI aceita somente datas explícitas: AAAA-MM-DD, AAAA-MM-DDTHH:mm ou instante com fuso, por exemplo 2026-10-28T14:30:00-03:00. Expressões como "sexta" não são interpretadas.';

export interface CivilParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
}

export function assertValidTimeZone(timeZone: string): void {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new AppError(`Fuso inválido: ${timeZone}.`, "validation");
  }
}

export function civilToday(timeZone: string, now: Date = new Date()): string {
  assertValidTimeZone(timeZone);
  const parts = partsInZone(now, timeZone);
  return formatDate(parts.year, parts.month, parts.day);
}

export function parseCivilDate(input: string): string {
  const trimmed = input.trim();
  rejectAmbiguousDate(trimmed);
  const match = DATE_RE.exec(trimmed);
  if (!match) {
    throw new AppError(`Data rejeitada: "${trimmed}". ${DATE_GUIDANCE}`, "validation");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  assertCalendarDate(year, month, day, trimmed);
  return formatDate(year, month, day);
}

export function parseExplicitInstant(input: string, timeZone: string): string {
  assertValidTimeZone(timeZone);
  const trimmed = input.trim();
  rejectAmbiguousDate(trimmed);

  const offset = OFFSET_RE.exec(trimmed);
  if (offset) {
    const parts = readMatch(offset, trimmed);
    const offsetMinutes = offset[8] === "Z" ? 0 : parseOffsetMinutes(offset[8] ?? "");
    const utc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.millisecond,
    ) - offsetMinutes * 60_000;
    return new Date(utc).toISOString();
  }

  const local = LOCAL_RE.exec(trimmed);
  if (local) {
    const parts = readMatch(local, trimmed);
    return zonedLocalToUtc(parts, timeZone).toISOString();
  }

  const date = DATE_RE.exec(trimmed);
  if (date) {
    const year = Number(date[1]);
    const month = Number(date[2]);
    const day = Number(date[3]);
    assertCalendarDate(year, month, day, trimmed);
    return zonedLocalToUtc(
      { year, month, day, hour: 0, minute: 0, second: 0, millisecond: 0 },
      timeZone,
    ).toISOString();
  }

  throw new AppError(`Data rejeitada: "${trimmed}". ${DATE_GUIDANCE}`, "validation");
}

export function civilDayBounds(date: string, timeZone: string): { startIso: string; endIso: string } {
  const civil = parseCivilDate(date);
  assertValidTimeZone(timeZone);
  const match = DATE_RE.exec(civil);
  if (!match) {
    throw new AppError(`Data rejeitada: "${date}". ${DATE_GUIDANCE}`, "validation");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const start = zonedLocalToUtc(
    { year, month, day, hour: 0, minute: 0, second: 0, millisecond: 0 },
    timeZone,
  );
  const next = addDays(year, month, day, 1);
  const end = zonedLocalToUtc(
    { year: next.year, month: next.month, day: next.day, hour: 0, minute: 0, second: 0, millisecond: 0 },
    timeZone,
  );
  return { startIso: start.toISOString(), endIso: end.toISOString() };
}

export function formatInstant(iso: string, timeZone: string): string {
  assertValidTimeZone(timeZone);
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(`Instante inválido armazenado: ${iso}.`, "persistence");
  }
  const parts = partsInZone(date, timeZone);
  const clock = `${formatDate(parts.year, parts.month, parts.day)} ${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
  return `${clock} (${formatOffset(date, timeZone)})`;
}

export function formatOffset(date: Date, timeZone: string): string {
  const minutes = offsetMinutesAt(date, timeZone);
  const sign = minutes >= 0 ? "+" : "-";
  const absolute = Math.abs(minutes);
  return `${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

export function isSupportedNodeVersion(version: string): boolean {
  const [majorText, minorText] = version.split(".");
  const major = Number(majorText);
  const minor = Number(minorText);
  return major === 22 && Number.isInteger(minor) && minor >= 16;
}

function rejectAmbiguousDate(input: string): void {
  if (!input) {
    throw new AppError(`Data rejeitada: informe um instante explícito. ${DATE_GUIDANCE}`, "validation");
  }
  const withoutMarkers = input.replace(/[TZ]/g, "");
  if (input.includes("/") || /[A-Za-zÀ-ÿ]/.test(withoutMarkers)) {
    throw new AppError(`Data rejeitada: "${input}". ${DATE_GUIDANCE}`, "validation");
  }
}

function readMatch(match: RegExpExecArray, original: string): CivilParts {
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] === undefined ? 0 : Number(match[6]);
  const fraction = match[7] === undefined ? 0 : Number(match[7].padEnd(3, "0"));
  assertCalendarDate(year, month, day, original);
  if (hour > 23 || minute > 59 || second > 59) {
    throw new AppError(`Data rejeitada: "${original}". ${DATE_GUIDANCE}`, "validation");
  }
  return { year, month, day, hour, minute, second, millisecond: fraction };
}

function assertCalendarDate(year: number, month: number, day: number, original: string): void {
  if (month < 1 || month > 12 || day < 1) {
    throw new AppError(`Data rejeitada: "${original}". ${DATE_GUIDANCE}`, "validation");
  }
  const probe = new Date(Date.UTC(year, month - 1, day));
  const valid =
    probe.getUTCFullYear() === year && probe.getUTCMonth() === month - 1 && probe.getUTCDate() === day;
  if (!valid) {
    throw new AppError(`Data rejeitada: "${original}". ${DATE_GUIDANCE}`, "validation");
  }
}

function parseOffsetMinutes(offset: string): number {
  const match = /^([+-])(\d{2}):(\d{2})$/.exec(offset);
  if (!match) {
    throw new AppError(`Data rejeitada: deslocamento inválido. ${DATE_GUIDANCE}`, "validation");
  }
  const hours = Number(match[2]);
  const minutes = Number(match[3]);
  if (hours > 14 || minutes > 59) {
    throw new AppError(`Data rejeitada: deslocamento inválido. ${DATE_GUIDANCE}`, "validation");
  }
  const total = hours * 60 + minutes;
  return match[1] === "-" ? -total : total;
}

function zonedLocalToUtc(parts: CivilParts, timeZone: string): Date {
  let utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const offset = offsetMinutesAt(new Date(utcGuess), timeZone);
    const next =
      Date.UTC(
        parts.year,
        parts.month - 1,
        parts.day,
        parts.hour,
        parts.minute,
        parts.second,
        parts.millisecond,
      ) - offset * 60_000;
    if (next === utcGuess) {
      break;
    }
    utcGuess = next;
  }
  const resolved = new Date(utcGuess);
  if (!sameLocal(resolved, parts, timeZone)) {
    throw new AppError(
      `O instante ${stamp(parts)} não existe no fuso ${timeZone}. Informe o deslocamento, por exemplo ${stamp(parts)}-03:00.`,
      "validation",
    );
  }
  for (const delta of [30, 60, 90, 120, -30, -60, -90, -120]) {
    const other = new Date(resolved.getTime() + delta * 60_000);
    if (sameLocal(other, parts, timeZone)) {
      throw new AppError(
        `O instante ${stamp(parts)} é ambíguo no fuso ${timeZone}. Informe o deslocamento, por exemplo ${stamp(parts)}-03:00.`,
        "validation",
      );
    }
  }
  return resolved;
}

function sameLocal(date: Date, parts: CivilParts, timeZone: string): boolean {
  const local = partsInZone(date, timeZone);
  return (
    local.year === parts.year &&
    local.month === parts.month &&
    local.day === parts.day &&
    local.hour === parts.hour &&
    local.minute === parts.minute &&
    local.second === parts.second
  );
}

function partsInZone(date: Date, timeZone: string): CivilParts {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const map = new Map<string, string>();
  for (const part of formatter.formatToParts(date)) {
    if (part.type !== "literal") {
      map.set(part.type, part.value);
    }
  }
  let hour = Number(map.get("hour"));
  if (hour === 24) {
    hour = 0;
  }
  return {
    year: Number(map.get("year")),
    month: Number(map.get("month")),
    day: Number(map.get("day")),
    hour,
    minute: Number(map.get("minute")),
    second: Number(map.get("second")),
    millisecond: date.getUTCMilliseconds(),
  };
}

function offsetMinutesAt(date: Date, timeZone: string): number {
  const parts = partsInZone(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  const wholeSeconds = date.getTime() - date.getUTCMilliseconds();
  return Math.round((asUtc - wholeSeconds) / 60_000);
}

function addDays(year: number, month: number, day: number, days: number): Pick<CivilParts, "year" | "month" | "day"> {
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
  };
}

function formatDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad(month)}-${pad(day)}`;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function stamp(parts: CivilParts): string {
  return `${formatDate(parts.year, parts.month, parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}`;
}
