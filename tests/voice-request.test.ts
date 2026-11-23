import assert from "node:assert/strict";
import test from "node:test";
import { LOCAL_REMINDER_TOOL } from "../src/domain/policy.js";
import { processSessionReminders } from "../src/application/reminders/index.js";
import {
  formatLocalTimeSpeech,
  handleVoiceRequest,
  VOICE_COMMAND_UNAVAILABLE_SPEECH,
  VOICE_REMINDER_UNAVAILABLE_SPEECH,
} from "../src/application/voice-request.js";
import { cliWorkspace, runCli } from "./helpers.js";

test("pedido de checkpoint usa ferramenta cadastrada e fala só resumo e próximo passo", () => {
  const workspace = cliWorkspace();
  try {
    const saved = runCli(
      [
        "checkpoint",
        "--dominio",
        "pessoal",
        "--projeto",
        "Ledger",
        "--resumo",
        "Menu mobile pronto.",
        "--proximo",
        "Validar recebimentos.",
      ],
      workspace.env,
    );
    assert.equal(saved.status, 0);
    const result = handleVoiceRequest(
      {
        dataDir: workspace.dataDir,
        timeZone: "America/Sao_Paulo",
        now: () => new Date("2026-11-12T15:00:00.000Z"),
      },
      "pessoal",
      "Onde paramos no Ledger?",
    );
    assert.equal(result.status, "ok");
    assert.equal(result.tool, "consultar_checkpoint");
    assert.match(result.terminal, /Projeto: Ledger/);
    assert.match(result.terminal, /Texto: Menu mobile pronto\./);
    assert.match(result.terminal, /Próximo passo: Validar recebimentos\./);
    assert.equal(result.speak, "Menu mobile pronto. Próximo passo: Validar recebimentos.");
  } finally {
    workspace.cleanup();
  }
});

test("STT me lembro de com prazo em minutos cria lembrete local na fila", () => {
  const workspace = cliWorkspace();
  processSessionReminders.clear();
  try {
    const result = handleVoiceRequest(
      {
        dataDir: workspace.dataDir,
        timeZone: "America/Sao_Paulo",
        now: () => new Date("2026-11-12T15:00:00.000Z"),
      },
      "pessoal",
      "Me lembro de tomar água daqui a um minuto.",
    );
    assert.equal(result.status, "ok");
    assert.equal(result.tool, LOCAL_REMINDER_TOOL);
    assert.match(result.terminal, /Lembrete local criado/);
    assert.match(result.terminal, /tomar água/);
    assert.match(result.terminal, /Aviso: vale só nesta sessão/);
    assert.match(result.speak ?? "", /Lembrete criado: tomar água em 1 minuto/);
    assert.match(result.speak ?? "", /Aviso: vale só nesta sessão/);
    assert.equal(processSessionReminders.list("pessoal").length, 1);
    assert.equal(processSessionReminders.list("pessoal")[0]?.texto, "tomar água");
    assert.equal(processSessionReminders.list("pessoal")[0]?.minutos, 1);
  } finally {
    processSessionReminders.clear();
    workspace.cleanup();
  }
});

test("me lembro de sem prazo futuro não agenda nem fala lembrete", () => {
  const workspace = cliWorkspace();
  processSessionReminders.clear();
  try {
    const result = handleVoiceRequest(
      {
        dataDir: workspace.dataDir,
        timeZone: "America/Sao_Paulo",
        now: () => new Date("2026-11-12T15:00:00.000Z"),
      },
      "pessoal",
      "Me lembro de tomar água",
    );
    assert.equal(result.status, "none");
    assert.equal(result.terminal, "");
    assert.equal(result.speak, null);
    assert.equal(result.tool, null);
    assert.equal(processSessionReminders.list().length, 0);
  } finally {
    processSessionReminders.clear();
    workspace.cleanup();
  }
});

test("me lembre sem prazo válido não agenda e avisa", () => {
  const workspace = cliWorkspace();
  processSessionReminders.clear();
  try {
    const result = handleVoiceRequest(
      {
        dataDir: workspace.dataDir,
        timeZone: "America/Sao_Paulo",
        now: () => new Date("2026-11-12T15:00:00.000Z"),
      },
      "pessoal",
      "Me lembre de tomar água",
    );
    assert.equal(result.status, "unavailable");
    assert.equal(result.speak, VOICE_REMINDER_UNAVAILABLE_SPEECH);
    assert.equal(processSessionReminders.list().length, 0);
  } finally {
    processSessionReminders.clear();
    workspace.cleanup();
  }
});

test("que horas são responde o relógio local sem ferramenta", () => {
  const workspace = cliWorkspace();
  const now = new Date("2026-11-23T02:38:00.000Z");
  const context = {
    dataDir: workspace.dataDir,
    timeZone: "America/Sao_Paulo",
    now: () => now,
  };
  try {
    for (const texto of ["Que horas são?", "que hora é", "me diz as horas agora"]) {
      const result = handleVoiceRequest(context, "pessoal", texto);
      assert.equal(result.status, "ok");
      assert.equal(result.tool, null);
      assert.equal(result.speak, "São 23 horas e 38 minutos.");
    }
    const uma = handleVoiceRequest(
      { ...context, now: () => new Date("2026-11-22T04:01:00.000Z") },
      "pessoal",
      "qual é a hora",
    );
    assert.equal(uma.speak, formatLocalTimeSpeech(new Date("2026-11-22T04:01:00.000Z"), "America/Sao_Paulo"));
    assert.equal(uma.speak, "É 1 hora e 1 minuto.");
    const outro = handleVoiceRequest(context, "pessoal", "liga a luz");
    assert.equal(outro.status, "unavailable");
    assert.equal(outro.speak, VOICE_COMMAND_UNAVAILABLE_SPEECH);
  } finally {
    workspace.cleanup();
  }
});

test("voz pedido na CLI cria lembrete e preserva checkpoint do Ledger", () => {
  const workspace = cliWorkspace();
  processSessionReminders.clear();
  try {
    const saved = runCli(
      [
        "checkpoint",
        "--dominio",
        "pessoal",
        "--projeto",
        "Ledger",
        "--resumo",
        "Checkpoint de teste.",
        "--proximo",
        "Seguir.",
      ],
      workspace.env,
    );
    assert.equal(saved.status, 0);
    const ok = runCli(
      ["voz", "pedido", "--dominio", "pessoal", "--texto", "Onde paramos no Ledger?"],
      workspace.env,
    );
    assert.equal(ok.status, 0);
    assert.match(ok.stdout, /"status": "ok"/);
    assert.match(ok.stdout, /consultar_checkpoint/);
    const reminder = runCli(
      [
        "voz",
        "pedido",
        "--dominio",
        "pessoal",
        "--texto",
        "Me lembro de tomar água daqui a um minuto.",
      ],
      workspace.env,
    );
    assert.equal(reminder.status, 0);
    assert.match(reminder.stdout, /"status": "ok"/);
    assert.match(reminder.stdout, /criar_lembrete_local/);
    assert.match(reminder.stdout, /Aviso: vale só nesta sessão/);
    const none = runCli(
      ["voz", "pedido", "--dominio", "pessoal", "--texto", "Me lembro de tomar água"],
      workspace.env,
    );
    assert.equal(none.status, 0);
    assert.match(none.stdout, /"status": "none"/);
    const clock = runCli(
      ["voz", "pedido", "--dominio", "pessoal", "--texto", "Que horas são?"],
      workspace.env,
    );
    assert.equal(clock.status, 0);
    assert.match(clock.stdout, /"status": "ok"/);
    assert.match(clock.stdout, /horas e/);
    assert.match(clock.stdout, /"tool": null/);
  } finally {
    processSessionReminders.clear();
    workspace.cleanup();
  }
});
