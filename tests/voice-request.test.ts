import assert from "node:assert/strict";
import test from "node:test";
import {
  handleVoiceRequest,
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

test("lembrete exige ferramenta ausente e devolve fala de indisponível", () => {
  const workspace = cliWorkspace();
  try {
    const result = handleVoiceRequest(
      {
        dataDir: workspace.dataDir,
        timeZone: "America/Sao_Paulo",
        now: () => new Date("2026-11-12T15:00:00.000Z"),
      },
      "pessoal",
      "Me lembre de tomar água daqui 5 minutos.",
    );
    assert.equal(result.status, "unavailable");
    assert.equal(result.tool, null);
    assert.match(result.terminal, /Catálogo sem ferramenta de lembretes/);
    assert.equal(result.speak, VOICE_REMINDER_UNAVAILABLE_SPEECH);
  } finally {
    workspace.cleanup();
  }
});

test("STT me lembro de com prazo em minutos trata como lembrete ausente", () => {
  const workspace = cliWorkspace();
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
    assert.equal(result.status, "unavailable");
    assert.equal(result.tool, null);
    assert.match(result.terminal, /Catálogo sem ferramenta de lembretes/);
    assert.equal(result.speak, VOICE_REMINDER_UNAVAILABLE_SPEECH);
  } finally {
    workspace.cleanup();
  }
});

test("me lembro de sem prazo futuro não agenda nem fala lembrete", () => {
  const workspace = cliWorkspace();
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
  } finally {
    workspace.cleanup();
  }
});

test("voz pedido na CLI devolve JSON dos dois caminhos", () => {
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
    const missing = runCli(
      [
        "voz",
        "pedido",
        "--dominio",
        "pessoal",
        "--texto",
        "Me lembre de tomar água daqui 5 minutos.",
      ],
      workspace.env,
    );
    assert.equal(missing.status, 0);
    assert.match(missing.stdout, /"status": "unavailable"/);
    assert.match(missing.stdout, /Catálogo sem ferramenta de lembretes/);
    assert.match(missing.stdout, /Ainda não consigo criar lembretes/);
  } finally {
    workspace.cleanup();
  }
});
