import fs from "node:fs";
import path from "node:path";
import { claimNext, enqueueJob, finishJob, jobCounts, recoverExecuting, type JobContext, type JobRow } from "./jobs.js";

export interface ServiceHealth {
  running: boolean;
  pid: number | null;
  jobs: ReturnType<typeof jobCounts>;
  note: string;
}

export async function processOnce(
  context: JobContext,
  handlers: Record<string, (job: JobRow) => Promise<{ done: boolean; checkpoint?: unknown; error?: string }>>,
): Promise<JobRow | null> {
  const job = claimNext(context);
  if (!job) {
    return null;
  }
  const handler = handlers[job.kind];
  if (!handler) {
    return finishJob(context, job.id, null, false, `Tipo de tarefa desconhecido: ${job.kind}.`);
  }
  try {
    const result = await handler(job);
    return finishJob(context, job.id, result.checkpoint ?? job.checkpoint, result.done, result.error ?? null);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na tarefa.";
    return finishJob(context, job.id, job.checkpoint, false, message);
  }
}

export function serviceHealth(dataDir: string): ServiceHealth {
  const pidFile = path.join(dataDir, "moah.service.pid");
  let pid: number | null = null;
  let running = false;
  if (fs.existsSync(pidFile)) {
    const parsed = Number(fs.readFileSync(pidFile, "utf8").trim());
    if (Number.isInteger(parsed) && parsed > 0) {
      pid = parsed;
      try {
        process.kill(parsed, 0);
        running = true;
      } catch {
        running = false;
      }
    }
  }
  return {
    running,
    pid,
    jobs: jobCounts(dataDir),
    note: "O serviço não garante execução única de efeito externo. Tarefa interrompida fica incerta até reconciliação.",
  };
}

export function markServiceStarted(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "moah.service.pid"), String(process.pid));
  fs.rmSync(path.join(dataDir, "moah.service.stop"), { force: true });
}

export function requestServiceStop(dataDir: string): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, "moah.service.stop"), new Date().toISOString());
}

export function stopRequested(dataDir: string): boolean {
  return fs.existsSync(path.join(dataDir, "moah.service.stop"));
}

export function markServiceStopped(dataDir: string): void {
  fs.rmSync(path.join(dataDir, "moah.service.pid"), { force: true });
  fs.rmSync(path.join(dataDir, "moah.service.stop"), { force: true });
}

export function recoverService(context: JobContext): number {
  return recoverExecuting(context);
}

export { enqueueJob };
