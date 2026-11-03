import {
  DEFAULT_VOICE_LIMITS,
  WAKE_GREETING,
  isStopCommand,
  type VoiceLimits,
  type VoicePhase,
  type VoiceSample,
  type VoiceSnapshot,
  type WakeDetector,
  type MicrophoneState,
} from "../domain/voice.js";

export interface VoicePorts {
  detector: WakeDetector;
  transcribe(samples: readonly VoiceSample[]): string;
  ask(text: string): Promise<string>;
  limits?: VoiceLimits;
}

export class VoiceSession {
  private phase: VoicePhase = "desligado";
  private microphone: MicrophoneState = "liberado";
  private listening = false;
  private spoken: string[] = [];
  private lastAnswer: string | null = null;
  private discardedSamples = 0;
  private detectorCalls = 0;
  private llmCalls = 0;
  private buffer: VoiceSample[] = [];
  private listenStarted = 0;
  private lastSpeechAt = 0;
  private speechSeen = false;
  private generation = 0;
  private readonly limits: VoiceLimits;
  private idle: Promise<void> = Promise.resolve();

  constructor(
    private readonly ports: VoicePorts,
    private readonly clock: { now(): number },
  ) {
    this.limits = ports.limits ?? DEFAULT_VOICE_LIMITS;
  }

  enable(microphone: "disponivel" | "indisponivel"): VoiceSnapshot {
    if (microphone === "indisponivel") {
      this.reset("desligado", "indisponivel", false);
      return this.snapshot();
    }
    this.generation += 1;
    this.buffer = [];
    this.phase = "aguardando";
    this.microphone = "retido";
    this.listening = true;
    return this.snapshot();
  }

  disable(): VoiceSnapshot {
    this.generation += 1;
    this.reset("desligado", "liberado", false);
    return this.snapshot();
  }

  push(sample: VoiceSample): VoiceSnapshot {
    if (!this.listening || sample.origin === "assistente") {
      if (this.listening && sample.origin === "assistente") {
        this.discardedSamples += 1;
      }
      return this.snapshot();
    }
    if (this.phase === "saudacao" || this.phase === "consultando" || this.phase === "falando") {
      this.discardedSamples += 1;
      return this.snapshot();
    }
    if (this.phase === "aguardando") {
      this.detectorCalls += 1;
      if (this.ports.detector.decide(sample).heardName) {
        this.beginGreeting();
      }
      return this.snapshot();
    }
    this.acceptRequestSample(sample);
    return this.snapshot();
  }

  tick(): VoiceSnapshot {
    if (this.phase !== "ouvindo") {
      return this.snapshot();
    }
    const now = this.clock.now();
    const elapsed = now - this.listenStarted;
    if (!this.speechSeen && elapsed >= this.limits.noSpeechMs) {
      this.discardBuffer();
      this.phase = "aguardando";
      return this.snapshot();
    }
    if (this.speechSeen && now - this.lastSpeechAt >= this.limits.silenceAfterSpeechMs) {
      this.finishListen();
      return this.snapshot();
    }
    if (elapsed >= this.limits.maxListenMs) {
      this.finishListen();
    }
    return this.snapshot();
  }

  playbackEnded(): VoiceSnapshot {
    if (this.phase === "saudacao" && this.listening) {
      this.phase = "ouvindo";
      this.listenStarted = this.clock.now();
      this.lastSpeechAt = this.listenStarted;
      this.speechSeen = false;
      this.discardBuffer();
    } else if (this.phase === "falando" && this.listening) {
      this.phase = "aguardando";
    }
    return this.snapshot();
  }

  interrupt(): VoiceSnapshot {
    if (this.phase === "saudacao" || this.phase === "falando" || this.phase === "consultando") {
      this.generation += 1;
      this.discardBuffer();
      this.phase = this.listening ? "aguardando" : "desligado";
    }
    return this.snapshot();
  }

  get settled(): Promise<void> {
    return this.idle;
  }

  snapshot(): VoiceSnapshot {
    return {
      phase: this.phase,
      microphone: this.microphone,
      listening: this.listening,
      spoken: [...this.spoken],
      lastAnswer: this.lastAnswer,
      discardedSamples: this.discardedSamples,
      detectorCalls: this.detectorCalls,
      llmCalls: this.llmCalls,
      bargeInValidated: false,
    };
  }

  private beginGreeting(): void {
    this.discardBuffer();
    this.phase = "saudacao";
    this.spoken.push(WAKE_GREETING);
  }

  private acceptRequestSample(sample: VoiceSample): void {
    if (sample.kind === "ruido" || sample.kind === "musica" || sample.kind === "silencio") {
      if (sample.kind === "silencio") {
        this.tick();
      }
      return;
    }
    if (sample.kind === "fim") {
      this.finishListen();
      return;
    }
    this.speechSeen = true;
    this.lastSpeechAt = this.clock.now();
    this.buffer.push(sample);
    if (this.buffer.length > this.limits.maxSamples) {
      this.buffer.shift();
      this.discardedSamples += 1;
    }
    if (this.clock.now() - this.listenStarted >= this.limits.maxListenMs) {
      this.finishListen();
    }
  }

  private finishListen(): void {
    const samples = this.buffer;
    this.buffer = [];
    this.speechSeen = false;
    const text = this.ports.transcribe(samples).trim();
    if (!text || isStopCommand(text)) {
      this.phase = "aguardando";
      return;
    }
    const generation = ++this.generation;
    this.phase = "consultando";
    this.llmCalls += 1;
    this.idle = this.ports.ask(text).then((answer) => {
      if (generation !== this.generation || !this.listening) {
        return;
      }
      this.lastAnswer = answer;
      this.phase = "falando";
      this.spoken.push(answer);
    });
  }

  private discardBuffer(): void {
    this.discardedSamples += this.buffer.length;
    this.buffer = [];
  }

  private reset(phase: VoicePhase, microphone: MicrophoneState, listening: boolean): void {
    this.phase = phase;
    this.microphone = microphone;
    this.listening = listening;
    this.discardBuffer();
    this.speechSeen = false;
  }
}
