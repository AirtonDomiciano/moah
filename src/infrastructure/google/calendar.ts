/** Consulta events.list da Calendar API v3. Só lê o calendário informado. */

import { AppError } from "../../domain/errors.js";

export interface CalendarEvent {
  title: string;
  when: string;
  allDay: boolean;
}

export async function listEvents(
  input: {
    accessToken: string;
    calendarId: string;
    timeMin: string;
    timeMax: string;
    timeZone: string;
  },
  fetchImpl: typeof fetch = fetch,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin: input.timeMin,
    timeMax: input.timeMax,
    maxResults: "20",
    timeZone: input.timeZone,
  });
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(input.calendarId)}/events?${params}`;
  let response: Response;
  try {
    response = await fetchImpl(url, { headers: { authorization: `Bearer ${input.accessToken}` } });
  } catch {
    throw new AppError("Não consegui consultar a agenda.", "unavailable");
  }
  if (response.status === 401 || response.status === 403) {
    throw new AppError("A conta Google não autorizou a leitura deste calendário.", "unavailable");
  }
  if (!response.ok) {
    throw new AppError("Não consegui consultar a agenda.", "unavailable");
  }
  const payload = (await response.json()) as {
    items?: Array<{
      status?: string;
      summary?: string;
      start?: { dateTime?: string; date?: string };
    }>;
  };
  return (payload.items ?? [])
    .filter((item) => item.status !== "cancelled")
    .map((item) => ({
      title: item.summary?.trim() || "sem título",
      when: item.start?.dateTime
        ? formatClock(item.start.dateTime, input.timeZone)
        : "o dia inteiro",
      allDay: !item.start?.dateTime,
    }));
}

function formatClock(instant: string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    hour: "numeric",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const hour = parts.find((part) => part.type === "hour")?.value ?? "0";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour}:${minute}`;
}
