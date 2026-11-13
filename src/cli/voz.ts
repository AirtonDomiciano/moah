import fs from "node:fs";
import path from "node:path";
import { handleVoiceRequest } from "../application/voice-request.js";
import { VoiceSession, type VoicePorts } from "../application/voice-session.js";
import { isDomain } from "../domain/constants.js";
import { AppError } from "../domain/errors.js";
import { fixtureWakeDetector, unavailableWakeDetector, voicePanel, type VoiceSample } from "../domain/voice.js";
import { deviceIds, probeHeadset } from "../infrastructure/audio-probe.js";
import { loadConfig } from "../infrastructure/config.js";
import { resolveDirs } from "../infrastructure/paths.js";
import { validateSessions } from "../infrastructure/voice-validate.js";
import { correctedModelPath, runVoiceScript, trainedModelPath, voiceDirectory } from "../infrastructure/wake-command.js";
import { one, rejectUnknown, type ParsedArgs } from "./parse-args.js";
import { printJson } from "./present.js";

export async function handleVoice(parsed: ParsedArgs): Promise<boolean> {
  if (parsed.positionals[0] !== "voz") {
    return false;
  }
  const action = parsed.positionals[1] ?? "estado";
  if (action === "estado") {
    rejectUnknown(parsed.options, []);
    const detector = unavailableWakeDetector();
    const dir = voiceDirectory(process.env);
    const model = trainedModelPath(dir);
    const corrected = correctedModelPath(dir);
    const installed = fs.existsSync(model);
    printJson({
      escuta: "desligada",
      microfone: "liberado",
      detector: installed ? "experimental" : detector.id,
      detectorConfirmado: false,
      modelo: installed ? model : null,
      modeloCorrigido: fs.existsSync(corrected) ? corrected : null,
      limiar: 0.5,
      vad: 0,
      aviso: installed
        ? "A escuta usa o modelo experimental. Ele não está confirmado. A coleta nova ainda não substitui as oito tomadas, e os resultados já vistos não serão o teste final."
        : "O microfone só abre depois de uma habilitação explícita e de um detector de MOAH validado no hardware.",
    });
    return true;
  }
  if (action === "pedido") {
    rejectUnknown(parsed.options, ["texto", "dominio"]);
    const texto = one(parsed.options, "texto");
    if (texto === null || !texto.trim()) {
      throw new AppError("Informe --texto com o pedido transcrito.", "validation");
    }
    const dominioRaw = one(parsed.options, "dominio") ?? "pessoal";
    if (!isDomain(dominioRaw)) {
      throw new AppError(`Domínio inválido: "${dominioRaw}". Use pessoal, imex ou aluai.`, "validation");
    }
    const dirs = resolveDirs();
    const config = loadConfig(dirs.configDir);
    const result = handleVoiceRequest(
      { dataDir: dirs.dataDir, timeZone: config.timezone, now: () => new Date() },
      dominioRaw,
      texto,
    );
    printJson(result);
    return true;
  }
  if (action === "simular") {
    rejectUnknown(parsed.options, ["roteiro"]);
    const file = one(parsed.options, "roteiro");
    if (!file || !file.startsWith("/")) {
      throw new AppError("Informe --roteiro com um caminho absoluto.", "validation");
    }
    printJson(await runFixture(file));
    return true;
  }
  if (action === "hardware") {
    rejectUnknown(parsed.options, ["habilitar", "microfone"]);
    if (one(parsed.options, "habilitar") !== "sim") {
      throw new AppError("A prova de hardware exige --habilitar sim.", "validation");
    }
    const choice = one(parsed.options, "microfone") ?? "jbl";
    if (choice !== "jbl" && choice !== "camera") {
      throw new AppError("Use --microfone jbl ou --microfone camera.", "validation");
    }
    printJson(await probeHeadset(true, choice));
    return true;
  }
  if (action === "escutar") {
    rejectUnknown(parsed.options, [
      "habilitar",
      "microfone",
      "duracao",
      "modelo",
      "limiar",
      "confirmar-ativacao",
      "confirmacao-flexivel",
      "diagnostico",
    ]);
    if (one(parsed.options, "habilitar") !== "sim") {
      throw new AppError("A escuta exige --habilitar sim.", "validation");
    }
    const choice = microphoneChoice(one(parsed.options, "microfone"));
    const dir = voiceDirectory(process.env);
    const model = resolveListenModel(dir, one(parsed.options, "modelo"));
    const limiar = resolveListenThreshold(one(parsed.options, "limiar"));
    const confirmar = resolveConfirmWake(one(parsed.options, "confirmar-ativacao"));
    const flexivel = resolveConfirmFlexible(one(parsed.options, "confirmacao-flexivel"));
    const diagnostico = resolveDiagnostico(one(parsed.options, "diagnostico"));
    const devices = await deviceIds(choice);
    const duration = one(parsed.options, "duracao");
    await runVoiceScript(process.env, "escutar.py", [
      "--habilitar",
      "sim",
      "--modelo",
      model,
      "--limiar",
      limiar,
      "--confirmar-ativacao",
      confirmar,
      "--confirmacao-flexivel",
      flexivel,
      "--diagnostico",
      diagnostico,
      "--recursos",
      resourcesOf(dir),
      "--origem",
      devices.source,
      "--destino",
      devices.sink,
      ...(duration ? ["--duracao", duration] : []),
    ]);
    return true;
  }
  if (action === "coletar") {
    rejectUnknown(parsed.options, ["iniciar", "microfone", "vezes", "segundos", "frase", "prefixo", "sessao", "ouvir", "tomada"]);
    if (one(parsed.options, "iniciar") !== "sim") {
      throw new AppError("A coleta exige --iniciar sim.", "validation");
    }
    const choice = microphoneChoice(one(parsed.options, "microfone"));
    const devices = await deviceIds(choice);
    const session = one(parsed.options, "sessao");
    const times = one(parsed.options, "vezes") ?? (session ? "10" : "8");
    const seconds = one(parsed.options, "segundos") ?? (session ? "4" : "2");
    const phrase = one(parsed.options, "frase") ?? "MOAH";
    const prefix = one(parsed.options, "prefixo") ?? "moah";
    const listen = one(parsed.options, "ouvir") === "sim";
    const take = one(parsed.options, "tomada");
    await runVoiceScript(process.env, "coletar.py", [
      "--iniciar",
      "sim",
      "--saida",
      voiceDirectory(process.env),
      "--origem",
      devices.source,
      "--vezes",
      times,
      "--segundos",
      seconds,
      "--frase",
      phrase,
      "--prefixo",
      prefix,
      ...(session ? ["--sessao", session] : []),
      ...(take ? ["--tomada", take] : []),
      ...(listen ? ["--ouvir", "sim", "--destino", devices.sink] : []),
    ]);
    return true;
  }
  if (action === "validar") {
    rejectUnknown(parsed.options, ["sessao"]);
    const pedida = one(parsed.options, "sessao");
    const sessoes = pedida ? [normalizarSessao(pedida)] : ["01", "02", "03"];
    const dir = voiceDirectory(process.env);
    const relatorio = validateSessions(dir, sessoes);
    if (relatorio.sessoes.some((sessao) => !sessao.arquivosIntactos)) {
      throw new AppError("Um WAV mudou durante a validação. Nenhum original foi alterado pelo comando.", "conflict");
    }
    const destino = path.join(dir, "correcao");
    fs.mkdirSync(destino, { recursive: true });
    fs.writeFileSync(path.join(destino, "validacao-acustica.json"), `${JSON.stringify(relatorio, null, 2)}\n`);
    printJson(relatorio);
    return true;
  }
  if (action === "microfone") {
    throw new AppError(
      "O detector local de MOAH não está instalado nem validado. A escuta do microfone permanece desligada.",
      "unavailable",
    );
  }
  throw new AppError("Uso: moah voz estado|pedido|simular|hardware|escutar|coletar|validar.", "validation");
}

function normalizarSessao(valor: string): string {
  const texto = valor.trim();
  if (!/^\d{1,2}$/.test(texto)) {
    throw new AppError("Use --sessao 01, 02 ou 03.", "validation");
  }
  return texto.padStart(2, "0");
}

async function runFixture(file: string): Promise<unknown> {
  const script = JSON.parse(fs.readFileSync(file, "utf8")) as {
    simulacao?: boolean;
    transcricao?: string;
    resposta?: string;
    passos?: Array<{ habilitar?: "disponivel" | "indisponivel"; desligar?: boolean; amostra?: VoiceSample; tick?: boolean; playback?: boolean; interromper?: boolean }>;
  };
  if (script.simulacao !== true || !Array.isArray(script.passos)) {
    throw new AppError("O roteiro de voz precisa ser marcado como simulação.", "validation");
  }
  let now = 0;
  const ports: VoicePorts = {
    detector: fixtureWakeDetector(),
    transcribe: () => script.transcricao ?? "",
    ask: async () => script.resposta ?? "",
  };
  const session = new VoiceSession(ports, { now: () => now });
  for (const step of script.passos) {
    if (step.habilitar) {
      session.enable(step.habilitar);
    }
    if (step.desligar) {
      session.disable();
    }
    if (step.amostra) {
      session.push(step.amostra);
    }
    if (step.tick) {
      now += 1_000;
      session.tick();
    }
    if (step.playback) {
      session.playbackEnded();
    }
    if (step.interromper) {
      session.interrupt();
    }
    await session.settled;
  }
  const snapshot = session.snapshot();
  return {
    simulacao: true,
    detectorConfirmado: ports.detector.confirmedOnHardware,
    painel: voicePanel(snapshot),
    fase: snapshot.phase,
    falas: snapshot.spoken,
    consultasAoModelo: snapshot.llmCalls,
  };
}

function microphoneChoice(value: string | null | undefined): "jbl" | "camera" {
  const choice = value ?? "jbl";
  if (choice !== "jbl" && choice !== "camera") {
    throw new AppError("Use --microfone jbl ou --microfone camera.", "validation");
  }
  return choice;
}

function resolveListenModel(dir: string, override: string | null): string {
  if (override === null) {
    const model = trainedModelPath(dir);
    if (!fs.existsSync(model)) {
      throw new AppError(
        "O detector completo de MOAH ainda não foi treinado. A escuta permanece desligada.",
        "unavailable",
      );
    }
    return model;
  }
  if (!override.startsWith("/")) {
    throw new AppError("Informe --modelo com um caminho absoluto para o ONNX.", "validation");
  }
  const model = path.resolve(override);
  if (!model.endsWith(".onnx")) {
    throw new AppError("O --modelo precisa ser um arquivo .onnx.", "validation");
  }
  if (!fs.existsSync(model) || !fs.statSync(model).isFile()) {
    throw new AppError(`Modelo ausente: ${model}`, "unavailable");
  }
  return model;
}

function resolveListenThreshold(value: string | null): string {
  if (value === null) {
    return "0.5";
  }
  const limiar = Number(value);
  if (!Number.isFinite(limiar) || limiar <= 0 || limiar > 1) {
    throw new AppError("Informe --limiar com um número maior que 0 e no máximo 1.", "validation");
  }
  return String(limiar);
}

function resolveConfirmWake(value: string | null): "sim" | "nao" {
  if (value === null || value === "nao") {
    return "nao";
  }
  if (value === "sim") {
    return "sim";
  }
  throw new AppError("Use --confirmar-ativacao sim ou nao.", "validation");
}

function resolveConfirmFlexible(value: string | null): "sim" | "nao" {
  if (value === null || value === "nao") {
    return "nao";
  }
  if (value === "sim") {
    return "sim";
  }
  throw new AppError("Use --confirmacao-flexivel sim ou nao.", "validation");
}

function resolveDiagnostico(value: string | null): "sim" | "nao" {
  if (value === null || value === "nao") {
    return "nao";
  }
  if (value === "sim") {
    return "sim";
  }
  throw new AppError("Use --diagnostico sim ou nao.", "validation");
}

function resourcesOf(dir: string): string {
  const file = path.join(dir, "runtime.json");
  if (!fs.existsSync(file)) {
    throw new AppError("O treino local ainda não registrou os recursos do detector.", "unavailable");
  }
  const runtime = JSON.parse(fs.readFileSync(file, "utf8")) as { recursos?: string };
  if (!runtime.recursos) {
    throw new AppError("O registro do treino não informa os recursos.", "unavailable");
  }
  return runtime.recursos;
}
