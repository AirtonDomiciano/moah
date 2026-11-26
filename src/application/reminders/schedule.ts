import { randomUUID } from "node:crypto";
import type { Domain } from "../../domain/constants.js";
import {
  cancelPendingLocalReminder,
  enqueueJob,
  listJobsByKind,
  updatePendingLocalReminder,
  type JobContext,
  type JobRow,
} from "../jobs.js";
import { processSessionReminders, type SessionReminder, type SessionReminderStore } from "./session.js";

export const REMINDER_JOB_KIND = "lembrete_local";

export interface ScheduleLocalReminderInput {
  domain: Domain;
  texto: string;
  minutos?: number;
  segundos?: number;
  recorrente?: boolean;
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
  const segundos = resolveSeconds(input);
  const recorrente = input.recorrente === true;
  const texto = input.texto.trim();
  if (!texto) {
    throw new Error("Informe o texto do lembrete.");
  }
  const now = jobs.now();
  const fireAt = new Date(now.getTime() + segundos * 1000).toISOString();
  const createdAt = now.toISOString();
  const id = `slem_${randomUUID()}`;
  const idempotencyKey = `lembrete_local:${input.domain}:${texto}:${fireAt.slice(0, 19)}:${recorrente ? segundos : "unico"}`;
  const job = enqueueJob(jobs, {
    kind: REMINDER_JOB_KIND,
    payload: {
      reminderId: id,
      domain: input.domain,
      texto,
      minutos: segundos % 60 === 0 ? segundos / 60 : null,
      segundos,
      fireAt,
      session: true,
      recorrente,
      ...(recorrente ? { intervaloSegundos: segundos } : {}),
    },
    idempotencyKey,
    maxAttempts: 8,
  });
  const reminder = store.add({
    id,
    domain: input.domain,
    texto,
    minutos: segundos % 60 === 0 ? segundos / 60 : Math.max(1, Math.round(segundos / 60)),
    fireAt,
    jobId: job.id,
    createdAt,
  });
  const prazo = formatSeconds(segundos);
  const confirmation = recorrente
    ? `Lembrete recorrente: ${texto} a cada ${prazo}.`
    : `Lembrete criado: ${texto} em ${prazo}.`;
  const warning = recorrente
    ? "Aviso: repete só enquanto esta sessão estiver aberta."
    : "Aviso: vale só nesta sessão.";
  return {
    reminder,
    confirmation,
    warning,
    lines: [
      "Lembrete local criado.",
      `Texto: ${texto}`,
      `Em: ${prazo}`,
      `Disparo: ${fireAt}`,
      `Fila: ${job.id}`,
      warning,
    ],
  };
}

function resolveSeconds(input: ScheduleLocalReminderInput): number {
  if (input.segundos !== undefined) {
    if (!Number.isInteger(input.segundos) || input.segundos < 1 || input.segundos > 24 * 60 * 60) {
      throw new Error("Informe um prazo entre 1 segundo e 24 horas.");
    }
    return input.segundos;
  }
  const minutos = input.minutos;
  if (!Number.isInteger(minutos) || minutos === undefined || minutos < 1 || minutos > 24 * 60) {
    throw new Error("Informe minutos entre 1 e 1440.");
  }
  return minutos * 60;
}

export type CancelLocalReminderResult =
  | { kind: "cancelled"; jobId: string; texto: string; recorrente: boolean; confirmation: string }
  | { kind: "ambiguous"; texto: string; options: string[] }
  | { kind: "missing"; texto: string }
  | { kind: "delivered"; texto: string }
  | { kind: "inactive"; texto: string };

export function cancelLocalReminder(
  jobs: JobContext,
  input: { domain: Domain; texto: string },
): CancelLocalReminderResult {
  const consulta = normalizeReminderText(input.texto);
  if (!consulta) {
    throw new Error("Informe qual lembrete cancelar.");
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
    return { kind: "missing", texto: input.texto };
  }
  const current = pending[0] as JobRow;
  const texto = String(current.payload.texto ?? input.texto);
  const recorrente = current.payload.recorrente === true;
  const cancelled = cancelPendingLocalReminder(jobs, current.id);
  if (!cancelled) {
    return { kind: "inactive", texto };
  }
  const confirmation = recorrente ? `Lembrete recorrente cancelado: ${texto}.` : `Lembrete cancelado: ${texto}.`;
  return { kind: "cancelled", jobId: current.id, texto, recorrente, confirmation };
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
  input: { domain: Domain; texto: string; segundos: number; recorrente?: boolean },
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
  const recorrente = input.recorrente === true;
  const payload: Record<string, unknown> = { ...current.payload, texto, fireAt, segundos };
  if (recorrente) {
    payload.recorrente = true;
    payload.intervaloSegundos = segundos;
  } else {
    delete payload.recorrente;
    delete payload.intervaloSegundos;
  }
  const updated = updatePendingLocalReminder(jobs, current.id, payload);
  if (!updated) {
    return { kind: "inactive", texto };
  }
  store.updateByJob(current.id, { texto, fireAt, minutos: Math.max(1, Math.round(segundos / 60)) });
  const prazo = formatSeconds(segundos);
  const confirmation = recorrente
    ? `Lembrete alterado: ${texto} a cada ${prazo}.`
    : `Lembrete alterado: ${texto} em ${prazo}.`;
  const warning = recorrente
    ? "Aviso: repete só enquanto esta sessão estiver aberta."
    : "Aviso: vale só nesta sessão.";
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
