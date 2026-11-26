import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { LOCAL_REMINDER_TOOL } from "../src/domain/policy.js";
import { processSessionReminders } from "../src/application/reminders/index.js";
import {
  formatLocalTimeSpeech,
  handleVoiceRequest,
  VOICE_COMMAND_UNAVAILABLE_SPEECH,
  VOICE_REMINDER_CANCEL_UNAVAILABLE_SPEECH,
  VOICE_REMINDER_UNAVAILABLE_SPEECH,
} from "../src/application/voice-request.js";
import { enqueueJob, listJobsByKind, settlePendingReminder } from "../src/application/jobs.js";
import { loadConfig } from "../src/infrastructure/config.js";
import { cliWorkspace, runCli } from "./helpers.js";

test("lembrete vencido não fica entregue quando a reprodução falha", () => {
  const workspace = cliWorkspace();
  try {
    const context = { dataDir: workspace.dataDir, now: () => new Date("2026-11-25T18:00:00.000Z") };
    const job = enqueueJob(context, {
      kind: "lembrete_local",
      payload: { texto: "beber água", fireAt: "2026-11-25T17:58:00.000Z" },
      idempotencyKey: null,
    });
    const failed = settlePendingReminder(context, job.id, false, "pw-play caiu");
    assert.equal(failed.changed, true);
    assert.equal(failed.state, "falha");
    const repeated = settlePendingReminder(context, job.id, true, null);
    assert.equal(repeated.changed, false);
    assert.equal(repeated.state, "falha");
    const due = enqueueJob(context, {
      kind: "lembrete_local",
      payload: { texto: "beber água", fireAt: "2026-11-25T17:59:00.000Z" },
      idempotencyKey: "outro",
    });
    const spoken = settlePendingReminder(context, due.id, true, null);
    assert.equal(spoken.changed, true);
    assert.equal(spoken.state, "concluida");
  } finally {
    workspace.cleanup();
  }
});

test("config.json grava a voz faber e rejeita síntese desconhecida", () => {
  const workspace = cliWorkspace();
  try {
    assert.equal(loadConfig(workspace.configDir).voz.sintese, "faber");
    fs.writeFileSync(
      path.join(workspace.configDir, "config.json"),
      JSON.stringify({ timezone: "America/Sao_Paulo", voz: { sintese: "faber" } }),
    );
    assert.equal(loadConfig(workspace.configDir).voz.sintese, "faber");
    fs.writeFileSync(
      path.join(workspace.configDir, "config.json"),
      JSON.stringify({ timezone: "America/Sao_Paulo", voz: { sintese: "ryan" } }),
    );
    assert.throws(() => loadConfig(workspace.configDir), /voz\.sintese/);
  } finally {
    workspace.cleanup();
  }
});

test("voz ouvir recusa voz desconhecida antes de abrir o alto-falante", () => {
  const workspace = cliWorkspace();
  try {
    const missing = runCli(["voz", "ouvir"], workspace.env);
    assert.equal(missing.status, 1);
    assert.match(missing.stderr, /Use --voz espeak, faber, cadu, jeff, edresson ou tugao/);
    const refused = runCli(["voz", "ouvir", "--voz", "ryan"], workspace.env);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /Use --voz espeak, faber, cadu, jeff, edresson ou tugao/);
    const frases = spawnSync("python3", [path.resolve("scripts/voz/ouvir_voz.py"), "--self-test"], {
      encoding: "utf8",
    });
    assert.equal(frases.status, 0, frases.stderr);
  } finally {
    workspace.cleanup();
  }
});

test("voz uso recusa flag fora do perfil diário antes de abrir o microfone", () => {
  const workspace = cliWorkspace();
  try {
    const refused = runCli(["voz", "uso", "--diagnostico", "sim"], workspace.env);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /Opção desconhecida: --diagnostico/);
  } finally {
    workspace.cleanup();
  }
});

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

test("alterar lembrete pendente troca o prazo sem criar outro", () => {
  const workspace = cliWorkspace();
  processSessionReminders.clear();
  const now = new Date("2026-11-25T18:00:00.000Z");
  const context = {
    dataDir: workspace.dataDir,
    timeZone: "America/Sao_Paulo",
    now: () => now,
  };
  try {
    const created = handleVoiceRequest(context, "pessoal", "Me lembre de beber água daqui a 2 minutos.");
    assert.equal(created.status, "ok");
    assert.match(created.speak ?? "", /Lembrete criado: beber água em 2 minutos/);
    const changed = handleVoiceRequest(
      context,
      "pessoal",
      "Alterar o lembrete de beber água para 30 segundos.",
    );
    assert.equal(changed.status, "ok");
    assert.equal(changed.tool, "alterar_lembrete_local");
    assert.match(changed.speak ?? "", /Lembrete alterado: beber água em 30 segundos/);
    const jobs = listJobsByKind(workspace.dataDir, "lembrete_local");
    assert.equal(jobs.length, 1);
    assert.equal(jobs[0]?.state, "pendente");
    assert.equal(jobs[0]?.payload.fireAt, new Date(now.getTime() + 30_000).toISOString());
    const missing = handleVoiceRequest(context, "pessoal", "Alterar o lembrete de café para 30 segundos.");
    assert.match(missing.speak ?? "", /Não encontrei um lembrete pendente de café/);
    const cancel = handleVoiceRequest(context, "pessoal", "Cancelar o lembrete de beber água.");
    assert.equal(cancel.speak, VOICE_REMINDER_CANCEL_UNAVAILABLE_SPEECH);
    const bare = handleVoiceRequest(context, "pessoal", "Me lembre de tomar água");
    assert.equal(bare.speak, VOICE_REMINDER_UNAVAILABLE_SPEECH);
    assert.equal(listJobsByKind(workspace.dataDir, "lembrete_local").length, 1);
  } finally {
    processSessionReminders.clear();
    workspace.cleanup();
  }
});

test("alterar pede esclarecimento ou avisa lembrete já entregue", () => {
  const workspace = cliWorkspace();
  processSessionReminders.clear();
  const now = new Date("2026-11-25T18:00:00.000Z");
  const context = {
    dataDir: workspace.dataDir,
    timeZone: "America/Sao_Paulo",
    now: () => now,
  };
  try {
    assert.equal(handleVoiceRequest(context, "pessoal", "Me lembre de água da manhã daqui a 2 minutos.").status, "ok");
    assert.equal(handleVoiceRequest(context, "pessoal", "Me lembre de água da noite daqui a 3 minutos.").status, "ok");
    const before = listJobsByKind(workspace.dataDir, "lembrete_local").map((job) => job.payload.fireAt);
    const ambiguous = handleVoiceRequest(context, "pessoal", "Alterar o lembrete de água para 30 segundos.");
    assert.match(ambiguous.speak ?? "", /Há mais de um lembrete pendente de água/);
    const after = listJobsByKind(workspace.dataDir, "lembrete_local").map((job) => job.payload.fireAt);
    assert.deepEqual(after, before);
    const delivered = handleVoiceRequest(context, "pessoal", "Me lembre de caminhar daqui a 4 minutos.");
    assert.equal(delivered.status, "ok");
    const walking = listJobsByKind(workspace.dataDir, "lembrete_local").find(
      (job) => job.payload.texto === "caminhar",
    );
    assert.ok(walking);
    settlePendingReminder({ dataDir: workspace.dataDir, now: () => now }, walking.id, true, null);
    const late = handleVoiceRequest(context, "pessoal", "Alterar o lembrete de caminhar para 30 segundos.");
    assert.match(late.speak ?? "", /já foi entregue/);
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
