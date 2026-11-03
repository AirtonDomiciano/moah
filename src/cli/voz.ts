import fs from "node:fs";
import { VoiceSession, type VoicePorts } from "../application/voice-session.js";
import { AppError } from "../domain/errors.js";
import { fixtureWakeDetector, unavailableWakeDetector, voicePanel, type VoiceSample } from "../domain/voice.js";
import { probeHeadset } from "../infrastructure/audio-probe.js";
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
    printJson({
      escuta: "desligada",
      microfone: "liberado",
      detector: detector.id,
      detectorConfirmado: detector.confirmedOnHardware,
      aviso: "O microfone só abre depois de uma habilitação explícita e de um detector de MOAH validado no hardware.",
    });
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
  if (action === "microfone") {
    throw new AppError(
      "O detector local de MOAH não está instalado nem validado. A escuta do microfone permanece desligada.",
      "unavailable",
    );
  }
  throw new AppError("Uso: moah voz estado|simular --roteiro <arquivo>|hardware --habilitar sim.", "validation");
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
