import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { VoiceSession } from "../src/application/voice-session.js";
import { rememberAsk } from "../src/application/voice-memory.js";
import { fixtureWakeDetector, voicePanel, type VoiceSample } from "../src/domain/voice.js";
import { SimulatorProvider } from "../src/infrastructure/llm/simulator.js";
import { cliWorkspace, runCli, tempDir } from "./helpers.js";

test("ativação pelo nome não consulta o modelo e ignora o próprio áudio", async () => {
  let now = 1_000;
  let asked = 0;
  const spoken: string[] = [];
  const session = new VoiceSession(
    {
      detector: fixtureWakeDetector(),
      transcribe: (samples) => (samples.some((sample) => sample.kind === "fala") ? "Onde paramos no Ledger?" : ""),
      ask: async (text) => {
        asked += 1;
        assert.equal(text, "Onde paramos no Ledger?");
        return "Paramos no checkpoint do Ledger.";
      },
    },
    { now: () => now },
  );
  assert.equal(session.enable("indisponivel").microphone, "indisponivel");
  session.push(mic("nome"));
  assert.equal(session.snapshot().phase, "desligado");
  assert.equal(session.snapshot().llmCalls, 0);

  session.enable("disponivel");
  session.push(mic("ruido"));
  session.push(mic("musica"));
  session.push(mic("silencio"));
  session.push({ origin: "assistente", kind: "nome" });
  assert.equal(session.snapshot().phase, "aguardando");
  assert.equal(session.snapshot().llmCalls, 0);

  session.push(mic("nome"));
  assert.equal(session.snapshot().phase, "saudacao");
  assert.deepEqual(session.snapshot().spoken, ["Estou aqui."]);
  session.push(mic("fala"));
  session.push({ origin: "assistente", kind: "fala" });
  assert.equal(session.snapshot().phase, "saudacao");
  session.playbackEnded();
  assert.equal(session.snapshot().phase, "ouvindo");

  now += 4_000;
  session.push(mic("silencio"));
  assert.equal(session.snapshot().phase, "aguardando");
  assert.equal(asked, 0);

  session.push(mic("nome"));
  session.playbackEnded();
  session.push(mic("fala"));
  session.push(mic("fim"));
  await session.settled;
  const speaking = session.snapshot();
  assert.equal(speaking.phase, "falando");
  assert.equal(speaking.llmCalls, 1);
  assert.equal(speaking.lastAnswer, "Paramos no checkpoint do Ledger.");
  const before = speaking.detectorCalls;
  session.push(mic("nome"));
  session.push({ origin: "assistente", kind: "nome" });
  assert.equal(session.snapshot().phase, "falando");
  assert.equal(session.snapshot().detectorCalls, before);
  assert.equal(session.snapshot().llmCalls, 1);
  session.interrupt();
  assert.equal(session.snapshot().phase, "aguardando");
  session.playbackEnded();
  assert.equal(session.snapshot().phase, "aguardando");
  spoken.push(...session.snapshot().spoken);
  assert.equal(spoken.filter((line) => line === "Estou aqui.").length, 2);
});

test("MOAH pare encerra o pedido sem consulta e desligar não religa", async () => {
  const session = new VoiceSession(
    {
      detector: fixtureWakeDetector(),
      transcribe: () => "MOAH, pare",
      ask: async () => {
        throw new Error("o modelo não deveria ser chamado");
      },
    },
    { now: () => 0 },
  );
  session.enable("disponivel");
  session.push(mic("nome"));
  session.playbackEnded();
  session.push(mic("fala"));
  session.push(mic("fim"));
  await session.settled;
  assert.equal(session.snapshot().phase, "aguardando");
  assert.equal(session.snapshot().llmCalls, 0);
  session.disable();
  session.push(mic("nome"));
  assert.equal(session.snapshot().phase, "desligado");
  assert.equal(session.snapshot().microphone, "liberado");
  assert.equal(session.snapshot().listening, false);
  const panel = voicePanel(session.snapshot());
  assert.equal(panel.status, "Escuta desligada");
  assert.equal(panel.canEnable, true);
  assert.equal(panel.canDisable, false);
});

test("o limite de duração encerra a escuta e consulta uma vez", async () => {
  let now = 0;
  const session = new VoiceSession(
    {
      detector: fixtureWakeDetector(),
      transcribe: () => "Onde paramos no Ledger?",
      ask: async () => "ok",
      limits: { noSpeechMs: 4_000, silenceAfterSpeechMs: 700, maxListenMs: 1_000, maxSamples: 4 },
    },
    { now: () => now },
  );
  session.enable("disponivel");
  session.push(mic("nome"));
  session.playbackEnded();
  session.push(mic("fala"));
  now = 1_000;
  session.push(mic("fala"));
  await session.settled;
  assert.equal(session.snapshot().phase, "falando");
  assert.equal(session.snapshot().llmCalls, 1);
});

test("a pergunta fala com a memória de leitura e não cria tarefa", async () => {
  const workspace = cliWorkspace();
  try {
    const saved = runCli(
      ["checkpoint", "--dominio", "pessoal", "--projeto", "Ledger", "--resumo", "Retomar a revisão do Ledger"],
      workspace.env,
    );
    assert.equal(saved.status, 0);
    const session = new VoiceSession(
      {
        detector: fixtureWakeDetector(),
        transcribe: () => "Onde paramos no Ledger?",
        ask: rememberAsk(
          { dataDir: workspace.dataDir, timeZone: "America/Sao_Paulo", now: () => new Date("2026-11-03T15:00:00.000Z") },
          "pessoal",
          "Ledger",
          new SimulatorProvider(),
          4,
        ),
      },
      { now: () => 0 },
    );
    session.enable("disponivel");
    session.push(mic("nome"));
    assert.equal(session.snapshot().llmCalls, 0);
    session.playbackEnded();
    session.push(mic("fala"));
    session.push(mic("fim"));
    await session.settled;
    assert.match(session.snapshot().lastAnswer ?? "", /Retomar a revisão do Ledger/);
    assert.match(session.snapshot().lastAnswer ?? "", /Simulação/);
    const health = runCli(["servico", "saude"], workspace.env);
    assert.match(health.stdout, /"pendente": 0/);
  } finally {
    workspace.cleanup();
  }
});

test("roteiro simulado não abre o microfone", async () => {
  const workspace = cliWorkspace();
  const files = tempDir("moah-voz-");
  try {
    const script = path.join(files.dir, "roteiro.json");
    fs.writeFileSync(
      script,
      JSON.stringify({
        simulacao: true,
        transcricao: "Onde paramos no Ledger?",
        resposta: "Resposta sintética.",
        passos: [
          { habilitar: "disponivel" },
          { amostra: { origin: "microfone", kind: "nome" } },
          { playback: true },
          { amostra: { origin: "microfone", kind: "fala" } },
          { amostra: { origin: "microfone", kind: "fim" } },
        ],
      }),
    );
    const closed = runCli(["voz", "microfone"], workspace.env);
    assert.equal(closed.status, 3);
    assert.match(closed.stderr, /permanece desligada/);
    const simulated = runCli(["voz", "simular", "--roteiro", script], workspace.env);
    assert.equal(simulated.status, 0);
    assert.match(simulated.stdout, /"simulacao": true/);
    assert.match(simulated.stdout, /"detectorConfirmado": false/);
    assert.match(simulated.stdout, /Aguardando o nome|Falando|Ouvindo o pedido|Consultando a memória/);
  } finally {
    workspace.cleanup();
    files.cleanup();
  }
});

function mic(kind: VoiceSample["kind"]): VoiceSample {
  return { origin: "microfone", kind };
}
