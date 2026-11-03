export const WAKE_NAME = "MOAH";
export const WAKE_GREETING = "Estou aqui.";

export type VoicePhase = "desligado" | "aguardando" | "saudacao" | "ouvindo" | "consultando" | "falando";

export type MicrophoneState = "liberado" | "retido" | "indisponivel";

export interface VoiceSample {
  origin: "microfone" | "assistente";
  kind: "silencio" | "ruido" | "musica" | "nome" | "fala" | "fim";
}

export interface WakeDetector {
  readonly id: string;
  readonly confirmedOnHardware: boolean;
  decide(sample: VoiceSample): { heardName: boolean };
}

export interface VoiceSnapshot {
  phase: VoicePhase;
  microphone: MicrophoneState;
  listening: boolean;
  spoken: string[];
  lastAnswer: string | null;
  discardedSamples: number;
  detectorCalls: number;
  llmCalls: number;
  bargeInValidated: false;
}

export interface VoiceLimits {
  noSpeechMs: number;
  silenceAfterSpeechMs: number;
  maxListenMs: number;
  maxSamples: number;
}

export const DEFAULT_VOICE_LIMITS: VoiceLimits = {
  noSpeechMs: 4_000,
  silenceAfterSpeechMs: 700,
  maxListenMs: 20_000,
  maxSamples: 32,
};

export function fixtureWakeDetector(): WakeDetector {
  return {
    id: "fixture",
    confirmedOnHardware: false,
    decide(sample) {
      return { heardName: sample.origin === "microfone" && sample.kind === "nome" };
    },
  };
}

export function unavailableWakeDetector(): WakeDetector {
  return {
    id: "nao-instalado",
    confirmedOnHardware: false,
    decide() {
      return { heardName: false };
    },
  };
}

export function isStopCommand(text: string): boolean {
  const normalized = text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized === "moah pare";
}

export function voicePanel(snapshot: VoiceSnapshot): {
  status: string;
  detail: string;
  canEnable: boolean;
  canDisable: boolean;
  canInterrupt: boolean;
} {
  const status = panelStatus(snapshot);
  return {
    status,
    detail:
      snapshot.bargeInValidated === false
        ? "A interrupção por voz durante a fala não foi validada no hardware. Use o controle de parar."
        : status,
    canEnable: snapshot.phase === "desligado" && snapshot.microphone !== "indisponivel",
    canDisable: snapshot.listening,
    canInterrupt: snapshot.phase === "falando" || snapshot.phase === "saudacao",
  };
}

function panelStatus(snapshot: VoiceSnapshot): string {
  if (snapshot.microphone === "indisponivel") {
    return "Microfone indisponível";
  }
  switch (snapshot.phase) {
    case "desligado":
      return "Escuta desligada";
    case "aguardando":
      return "Aguardando o nome";
    case "ouvindo":
      return "Ouvindo o pedido";
    case "consultando":
      return "Consultando a memória";
    case "saudacao":
    case "falando":
      return "Falando";
    default:
      return "Escuta desligada";
  }
}
