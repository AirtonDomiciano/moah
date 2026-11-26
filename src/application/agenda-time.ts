import { assertValidTimeZone } from "../domain/time.js";

export function civilDayUtcRange(date: string, timeZone: string): { timeMin: string; timeMax: string } {
  assertValidTimeZone(timeZone);
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  const start = zonedMidnight(year, month, day, timeZone);
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  const end = zonedMidnight(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), timeZone);
  return { timeMin: start.toISOString(), timeMax: end.toISOString() };
}

function zonedMidnight(year: number, month: number, day: number, timeZone: string): Date {
  let utc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const first = zoneOffsetMs(new Date(utc), timeZone);
  utc -= first;
  const second = zoneOffsetMs(new Date(utc), timeZone);
  if (second !== first) {
    utc -= second - first;
  }
  return new Date(utc);
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour") % 24, value("minute"), value("second"));
  return asUtc - instant.getTime();
}
