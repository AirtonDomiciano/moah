import { randomUUID } from "node:crypto";
import type { Domain } from "../../domain/constants.js";
import { enqueueJob, listJobsByKind, updatePendingLocalReminder, type JobContext, type JobRow } from "../jobs.js";
import { processSessionReminders, type SessionReminder, type SessionReminderStore } from "./session.js";

export const REMINDER_JOB_KIND = "lembrete_local";

export interface ScheduleLocalReminderInput {
  domain: Domain;
  texto: string;
  minutos: number;
}

export interface ScheduleLocalReminderResult {
  reminder: SessionReminder;
  confirmation: string;
  warning: string;
  lines: string[];
}

export function scheduleLocalReminder(
  jobs: JobContext,
  input: ScheduleLocalReminderInput,
  store: SessionReminderStore = processSessionReminders,
): ScheduleLocalReminderResult {
  const minutos = input.minutos;
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 24 * 60) {
    throw new Error("Informe minutos entre 1 e 1440.");
  }
  const texto = input.texto.trim();
  if (!texto) {
    throw new Error("Informe o texto do lembrete.");
  }
  const now = jobs.now();
  const fireAt = new Date(now.getTime() + minutos * 60_000).toISOString();
  const createdAt = now.toISOString();
  const id = `slem_${randomUUID()}`;
  const idempotencyKey = `lembrete_local:${input.domain}:${texto}:${fireAt.slice(0, 16)}`;
  const job = enqueueJob(jobs, {
    kind: REMINDER_JOB_KIND,
    payload: {
      reminderId: id,
      domain: input.domain,
      texto,
      minutos,
      fireAt,
      session: true,
    },
    idempotencyKey,
    maxAttempts: 8,
  });
  const reminder = store.add({
    id,
    domain: input.domain,
    texto,
    minutos,
    fireAt,
    jobId: job.id,
    createdAt,
  });
  const confirmation = `Lembrete criado: ${texto} em ${formatMinutes(minutos)}.`;
  const warning = "Aviso: vale só nesta sessão.";
  return {
    reminder,
    confirmation,
    warning,
    lines: [
      "Lembrete local criado.",
      `Texto: ${texto}`,
      `Em: ${formatMinutes(minutos)}`,
      `Disparo: ${fireAt}`,
      `Fila: ${job.id}`,
      warning,
    ],
  };
}

function formatMinutes(minutos: number): string {
  return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
}

export type RescheduleLocalReminderResult =
  | {
      kind: "updated";
      jobId: string;
      texto: string;
      segundos: number;
      fireAt: string;
      confirmation: string;
      warning: string;
      lines: string[];
    }
  | { kind: "ambiguous"; texto: string; options: string[] }
  | { kind: "missing"; texto: string }
  | { kind: "delivered"; texto: string }
  | { kind: "inactive"; texto: string };

export function rescheduleLocalReminder(
  jobs: JobContext,
  input: { domain: Domain; texto: string; segundos: number },
  store: SessionReminderStore = processSessionReminders,
): RescheduleLocalReminderResult {
  const segundos = input.segundos;
  if (!Number.isInteger(segundos) || segundos < 1 || segundos > 24 * 60 * 60) {
    throw new Error("Informe um prazo entre 1 segundo e 24 horas.");
  }
  const consulta = normalizeReminderText(input.texto);
  if (!consulta) {
    throw new Error("Informe qual lembrete alterar.");
  }
  const rows = listJobsByKind(jobs.dataDir, REMINDER_JOB_KIND).filter(
    (job) => String(job.payload.domain ?? "") === input.domain,
  );
  const pendingAll = rows.filter((job) => job.state === "pendente");
  const exact = pendingAll.filter((job) => normalizeReminderText(String(job.payload.texto ?? "")) === consulta);
  const pending =
    exact.length > 0
      ? exact
      : pendingAll.filter((job) => normalizeReminderText(String(job.payload.texto ?? "")).includes(consulta));
  if (pending.length > 1) {
    return { kind: "ambiguous", texto: input.texto, options: pending.map((job) => String(job.payload.texto ?? "")) };
  }
  if (pending.length === 0) {
    const delivered = rows.some((job) => job.state === "concluida" && reminderMatches(job, consulta));
    if (delivered) {
      return { kind: "delivered", texto: input.texto };
    }
    const inactive = rows.some((job) => job.state !== "pendente" && reminderMatches(job, consulta));
    return inactive ? { kind: "inactive", texto: input.texto } : { kind: "missing", texto: input.texto };
  }
  const current = pending[0] as JobRow;
  const texto = String(current.payload.texto ?? input.texto);
  const fireAt = new Date(jobs.now().getTime() + segundos * 1000).toISOString();
  const payload = { ...current.payload, texto, fireAt, segundos };
  const updated = updatePendingLocalReminder(jobs, current.id, payload);
  if (!updated) {
    return { kind: "inactive", texto };
  }
  store.updateByJob(current.id, { texto, fireAt, minutos: Math.max(1, Math.round(segundos / 60)) });
  const prazo = formatSeconds(segundos);
  const confirmation = `Lembrete alterado: ${texto} em ${prazo}.`;
  const warning = "Aviso: vale só nesta sessão.";
  return {
    kind: "updated",
    jobId: current.id,
    texto,
    segundos,
    fireAt,
    confirmation,
    warning,
    lines: ["Lembrete local alterado.", `Texto: ${texto}`, `Em: ${prazo}`, `Disparo: ${fireAt}`, `Fila: ${current.id}`, warning],
  };
}

export function normalizeReminderText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function reminderMatches(job: JobRow, consulta: string): boolean {
  const texto = normalizeReminderText(String(job.payload.texto ?? ""));
  return texto === consulta || texto.includes(consulta);
}

function formatSeconds(segundos: number): string {
  if (segundos % 60 === 0) {
    const minutos = segundos / 60;
    return minutos === 1 ? "1 minuto" : `${minutos} minutos`;
  }
  return segundos === 1 ? "1 segundo" : `${segundos} segundos`;
}
