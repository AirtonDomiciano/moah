import fs from "node:fs";
import path from "node:path";
import { listEvents, snoozeReminder, syncSyntheticCalendar, tickReminders, type CalendarEventInput } from "../application/calendar.js";
import { enqueueJob } from "../application/jobs.js";
import { importTranscript, readMeeting } from "../application/meetings.js";
import { markServiceStarted, markServiceStopped, processOnce, recoverService, requestServiceStop, serviceHealth, stopRequested } from "../application/service.js";
import { backupDatabase, migrateDatabase, previewMigration, restoreDatabase } from "../application/storage.js";
import { AppError } from "../domain/errors.js";
import type { AppConfig } from "../infrastructure/config.js";
import { checkVolume, parseMountTable, pathIsInside } from "../infrastructure/volume.js";
import { one, rejectUnknown, type ParsedArgs } from "./parse-args.js";
import { printJson } from "./present.js";

export async function handleRoutine(
  parsed: ParsedArgs,
  context: { dataDir: string; timeZone: string; now: () => Date; config: AppConfig },
): Promise<boolean> {
  const command = parsed.positionals[0];
  if (command === "armazenamento") {
    await handleStorage(parsed, context);
    return true;
  }
  if (command === "servico") {
    await handleService(parsed, context);
    return true;
  }
  if (command === "agenda") {
    handleAgenda(parsed, context);
    return true;
  }
  if (command === "reuniao") {
    handleMeeting(parsed, context);
    return true;
  }
  return false;
}

async function handleStorage(
  parsed: ParsedArgs,
  context: { dataDir: string; now: () => Date; config: AppConfig },
): Promise<void> {
  const action = parsed.positionals[1];
  if (action === "verificar") {
    rejectUnknown(parsed.options, []);
    const check = verifyConfiguredVolume(context.config);
    printJson({
      banco: context.dataDir,
      documentos: context.config.storage.documentsDir,
      derivados: context.config.storage.derivedDir,
      modelos: context.config.llm.modelsDir ?? null,
      backup: context.config.storage.backupDir,
      volume: check,
    });
    if (check && !check.ok) {
      throw new AppError(check.diagnosis, "validation");
    }
    return;
  }
  if (action === "backup") {
    rejectUnknown(parsed.options, ["destino"]);
    const destination = requiredPath(one(parsed.options, "destino"));
    assertVolume(context.config, destination);
    const result = await backupDatabase(context.dataDir, destination);
    printJson(result);
    if (result.warning) {
      process.stderr.write(`${result.warning}\n`);
    }
    return;
  }
  if (action === "restaurar") {
    rejectUnknown(parsed.options, ["arquivo", "destino"]);
    const result = restoreDatabase(requiredPath(one(parsed.options, "arquivo")), requiredPath(one(parsed.options, "destino")));
    printJson(result);
    return;
  }
  if (action === "previa") {
    rejectUnknown(parsed.options, ["destino"]);
    printJson(previewMigration(context.dataDir, requiredPath(one(parsed.options, "destino"))));
    return;
  }
  if (action === "migrar") {
    rejectUnknown(parsed.options, ["destino", "confirmar"]);
    if (one(parsed.options, "confirmar") !== "sim") {
      throw new AppError("A migração exige --confirmar sim depois da prévia. A origem não é apagada.", "validation");
    }
    const destination = requiredPath(one(parsed.options, "destino"));
    assertVolume(context.config, destination);
    printJson(await migrateDatabase(context.dataDir, destination));
    return;
  }
  throw new AppError("Uso: moah armazenamento verificar|backup|restaurar|previa|migrar.", "validation");
}

async function handleService(
  parsed: ParsedArgs,
  context: { dataDir: string; now: () => Date },
): Promise<void> {
  const action = parsed.positionals[1];
  const jobContext = { dataDir: context.dataDir, now: context.now };
  if (action === "saude") {
    printJson(serviceHealth(context.dataDir));
    return;
  }
  if (action === "enfileirar") {
    rejectUnknown(parsed.options, ["tipo", "chave"]);
    const kind = one(parsed.options, "tipo") ?? "eco";
    if (kind !== "eco") {
      throw new AppError("Nesta versão o serviço só enfileira o tipo eco, sem efeito externo.", "validation");
    }
    printJson(enqueueJob(jobContext, { kind, payload: { eco: true }, idempotencyKey: one(parsed.options, "chave") }));
    return;
  }
  if (action === "iniciar") {
    markServiceStarted(context.dataDir);
    printJson({ iniciado: true });
    return;
  }
  if (action === "processar") {
    if (stopRequested(context.dataDir)) {
      printJson({ processada: false, parada: true });
      return;
    }
    const job = await processOnce(jobContext, {
      eco: async () => ({ done: true, checkpoint: { passo: 1 } }),
    });
    printJson(job ?? { processada: false });
    return;
  }
  if (action === "parar") {
    requestServiceStop(context.dataDir);
    markServiceStopped(context.dataDir);
    printJson({ parado: true, sinal: true });
    return;
  }
  if (action === "recuperar") {
    printJson({ incertas: recoverService(jobContext) });
    return;
  }
  throw new AppError("Uso: moah servico saude|iniciar|enfileirar|processar|parar|recuperar.", "validation");
}

function handleAgenda(
  parsed: ParsedArgs,
  context: { dataDir: string; timeZone: string; now: () => Date; config: AppConfig },
): void {
  const action = parsed.positionals[1];
  const calendar = {
    dataDir: context.dataDir,
    timeZone: context.timeZone,
    now: context.now,
    quietStart: context.config.agenda.quietStart,
    quietEnd: context.config.agenda.quietEnd,
  };
  if (action === "sincronizar") {
    rejectUnknown(parsed.options, ["arquivo"]);
    const events = readSyntheticEvents(requiredPath(one(parsed.options, "arquivo")));
    printJson({ ...syncSyntheticCalendar(calendar, events), aviso: "Agenda sintética. Evento não comprova participação." });
    return;
  }
  if (action === "tick") {
    printJson(tickReminders(calendar));
    return;
  }
  if (action === "adiar") {
    rejectUnknown(parsed.options, ["lembrete", "ate"]);
    const id = one(parsed.options, "lembrete");
    const until = one(parsed.options, "ate");
    if (!id || !until) {
      throw new AppError("Uso: moah agenda adiar --lembrete <id> --ate <instante ISO>.", "validation");
    }
    snoozeReminder(calendar, id, until);
    printJson({ adiado: id, ate: until });
    return;
  }
  if (action === "listar") {
    printJson({ eventos: listEvents(context.dataDir), aviso: "Evento não comprova participação." });
    return;
  }
  throw new AppError("Uso: moah agenda sincronizar|tick|adiar|listar.", "validation");
}

function handleMeeting(
  parsed: ParsedArgs,
  context: { dataDir: string; now: () => Date; config: AppConfig },
): void {
  const action = parsed.positionals[1];
  const meetingContext = {
    dataDir: context.dataDir,
    now: context.now,
    documentsDir: context.config.storage.documentsDir,
  };
  if (context.config.storage.volume) {
    const check = verifyConfiguredVolume(context.config);
    if (!check?.ok) {
      throw new AppError(check?.diagnosis ?? "Volume de documentos não confirmado.", "validation");
    }
  }
  if (action === "importar") {
    rejectUnknown(parsed.options, ["arquivo"]);
    const result = importTranscript(meetingContext, requiredPath(one(parsed.options, "arquivo")));
    printJson({
      id: result.meeting.id,
      duplicada: result.duplicate,
      analise: result.meeting.analysisStatus,
      aviso: "Importação manual. O texto não dispara ações. Análise real permanece pendente sem modelo controlado.",
    });
    return;
  }
  if (action === "ver") {
    rejectUnknown(parsed.options, ["id", "dominio"]);
    const id = one(parsed.options, "id");
    const domain = one(parsed.options, "dominio");
    if (!id || (domain !== "pessoal" && domain !== "imex" && domain !== "aluai")) {
      throw new AppError("Uso: moah reuniao ver --id <reu_> --dominio <pessoal|imex|aluai>.", "validation");
    }
    const meeting = readMeeting(context.dataDir, id, domain);
    if (!meeting) {
      throw new AppError("Reunião não encontrada neste domínio.", "not_found");
    }
    printJson({
      id: meeting.id,
      fonte: meeting.sourceId,
      versao: meeting.sourceVersion,
      resumo: meeting.summary,
      analise: meeting.analysis,
      geradoPorIa: meeting.generatedByAi,
      aviso: "Conteúdo gerado por IA, quando houver, não é decisão confirmada por Airton.",
    });
    return;
  }
  throw new AppError("Uso: moah reuniao importar|ver. A análise real fica pendente até um modelo autorizado.", "validation");
}

function verifyConfiguredVolume(config: AppConfig): ReturnType<typeof checkVolume> | null {
  const volume = config.storage.volume;
  if (!volume) {
    return null;
  }
  if (process.platform !== "linux") {
    return {
      ok: false,
      diagnosis: "A verificação de volume por /proc/mounts vale para Linux. Neste SO o caminho configurado não foi confirmado.",
      source: null,
      fstype: null,
      uuid: null,
    };
  }
  if (!fs.existsSync("/proc/mounts")) {
    return {
      ok: false,
      diagnosis: "Não foi possível ler /proc/mounts. O volume não foi confirmado e nenhum diretório alternativo foi criado.",
      source: null,
      fstype: null,
      uuid: null,
    };
  }
  return checkVolume(volume, parseMountTable(fs.readFileSync("/proc/mounts", "utf8")), uuidOfSource);
}

function uuidOfSource(source: string): string | null {
  const directory = "/dev/disk/by-uuid";
  if (!fs.existsSync(directory)) {
    return null;
  }
  for (const name of fs.readdirSync(directory)) {
    try {
      if (fs.realpathSync(path.join(directory, name)) === source) {
        return name;
      }
    } catch {
      continue;
    }
  }
  return null;
}

function assertVolume(config: AppConfig, destination: string): void {
  const check = verifyConfiguredVolume(config);
  if (check && !check.ok) {
    throw new AppError(check.diagnosis, "validation");
  }
  if (config.storage.volume && !pathIsInside(config.storage.volume.mount, destination)) {
    throw new AppError("O destino não está no volume confirmado.", "validation");
  }
}

function requiredPath(value: string | null): string {
  if (!value || !value.startsWith("/")) {
    throw new AppError("Informe um caminho absoluto.", "validation");
  }
  return value;
}

function readSyntheticEvents(file: string): CalendarEventInput[] {
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as { sintetica?: boolean; eventos?: CalendarEventInput[] };
  if (parsed.sintetica !== true || !Array.isArray(parsed.eventos)) {
    throw new AppError("A agenda precisa ser um arquivo marcado como sintético.", "validation");
  }
  return parsed.eventos;
}
