import { randomUUID } from "node:crypto";
import type { Domain } from "../../domain/constants.js";
import { enqueueJob, type JobContext } from "../jobs.js";
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
