import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { cliWorkspace, runCli, runCliAsync } from "./helpers.js";

describe("cenário de aceite da CLI", () => {
  it("percorre registro, reinício, pendência, checkpoint, resumo e isolamento", () => {
    const workspace = cliWorkspace();
    try {
      const meeting = runCli(
        [
          "--json",
          "registrar",
          "reuniao",
          "--dominio",
          "imex",
          "--projeto",
          "financeiro",
          "--quando",
          "2026-10-28T09:00",
          "--texto",
          "Reunião sintética do financeiro",
          "--decisao",
          "Manter o registro manual",
          "--acao",
          "Mapear casos de teste",
          "--ref",
          "memoria://sintetica/imex/reuniao-1",
        ],
        workspace.env,
      );
      assert.equal(meeting.status, 0, meeting.stderr);
      assert.equal(meeting.stderr, "");
      const created = JSON.parse(meeting.stdout) as {
        id: string;
        origin: string;
        actions: Array<{ id: string; status: string; dueOn: string | null }>;
        decisions: Array<{ text: string }>;
      };
      assert.equal(created.origin, "user_report");
      assert.equal(created.decisions[0]?.text, "Manter o registro manual");
      assert.equal(created.actions[0]?.dueOn, null);
      assert.equal(created.actions[0]?.status, "pendente");
      const actionId = created.actions[0]?.id ?? "";

      const listed = runCli(
        ["--json", "listar", "dia", "--data", "2026-10-28", "--dominio", "imex", "--projeto", "financeiro"],
        workspace.env,
      );
      assert.equal(listed.status, 0, listed.stderr);
      const day = JSON.parse(listed.stdout) as { records: Array<{ id: string; type: string }> };
      assert.equal(day.records.some((record) => record.id === created.id && record.type === "reuniao"), true);

      const open = runCli(["--json", "pendencias", "--dominio", "imex"], workspace.env);
      assert.equal(open.status, 0, open.stderr);
      const openBody = JSON.parse(open.stdout) as { actions: Array<{ id: string }> };
      assert.equal(openBody.actions.some((action) => action.id === actionId), true);

      const done = runCli(["concluir", actionId], workspace.env);
      assert.equal(done.status, 0, done.stderr);
      assert.match(done.stdout, new RegExp(actionId));
      assert.match(done.stdout, /concluída/);

      const stillOpen = runCli(["--json", "pendencias", "--dominio", "imex"], workspace.env);
      const stillBody = JSON.parse(stillOpen.stdout) as { actions: Array<{ id: string }> };
      assert.equal(stillBody.actions.some((action) => action.id === actionId), false);

      const activity = runCli(
        [
          "registrar",
          "atividade",
          "--dominio",
          "imex",
          "--projeto",
          "review",
          "--quando",
          "2026-10-28T10:00",
          "--texto",
          "Análise do fluxo de review",
        ],
        workspace.env,
      );
      assert.equal(activity.status, 0, activity.stderr);
      assert.match(activity.stdout, /atividade/);
      assert.match(activity.stdout, /Origem: user_report/);
      assert.doesNotMatch(activity.stderr, /ExperimentalWarning/);
      assert.doesNotMatch(activity.stderr, /\n\s+at /);

      const checkpoint = runCli(
        [
          "--json",
          "checkpoint",
          "--dominio",
          "imex",
          "--projeto",
          "review",
          "--quando",
          "2026-10-28T11:00",
          "--resumo",
          "review em análise",
          "--proximo",
          "verificar testes",
        ],
        workspace.env,
      );
      assert.equal(checkpoint.status, 0, checkpoint.stderr);
      const savedCheckpoint = JSON.parse(checkpoint.stdout) as { text: string; nextStep: string };
      assert.equal(savedCheckpoint.text, "review em análise");
      assert.equal(savedCheckpoint.nextStep, "verificar testes");

      const resumed = runCli(
        ["--json", "onde-paramos", "--dominio", "imex", "--projeto", "review"],
        workspace.env,
      );
      assert.equal(resumed.status, 0, resumed.stderr);
      const resumeBody = JSON.parse(resumed.stdout) as { checkpoint: { text: string; nextStep: string } | null };
      assert.equal(resumeBody.checkpoint?.text, "review em análise");
      assert.equal(resumeBody.checkpoint?.nextStep, "verificar testes");

      const summary = runCli(["--json", "resumo", "--data", "2026-10-28", "--dominio", "imex"], workspace.env);
      assert.equal(summary.status, 0, summary.stderr);
      const summaryBody = JSON.parse(summary.stdout) as {
        meetings: Array<{ text: string; origin: string }>;
        activities: Array<{ text: string; origin: string }>;
        checkpoints: Array<{ text: string; nextStep: string; origin: string }>;
        decisions: Array<{ text: string; origin: string }>;
        concludedActions: Array<{ id: string; origin: string }>;
        pendingActions: Array<{ id: string }>;
      };
      assert.equal(summaryBody.meetings[0]?.text, "Reunião sintética do financeiro");
      assert.equal(summaryBody.meetings[0]?.origin, "user_report");
      assert.equal(summaryBody.activities.some((item) => item.text === "Análise do fluxo de review"), true);
      assert.equal(summaryBody.checkpoints[0]?.text, "review em análise");
      assert.equal(summaryBody.checkpoints[0]?.nextStep, "verificar testes");
      assert.equal(summaryBody.decisions.some((item) => item.text === "Manter o registro manual" && item.origin === "user_report"), true);
      assert.equal(summaryBody.concludedActions.some((item) => item.id === actionId), true);

      const aluai = runCli(
        [
          "registrar",
          "atividade",
          "--dominio",
          "aluai",
          "--projeto",
          "site",
          "--quando",
          "2026-10-28T12:00",
          "--texto",
          "Ajuste sintético da landing",
        ],
        workspace.env,
      );
      assert.equal(aluai.status, 0, aluai.stderr);
      const aluaiDay = runCli(["--json", "listar", "dia", "--data", "2026-10-28", "--dominio", "aluai"], workspace.env);
      const aluaiBody = JSON.parse(aluaiDay.stdout) as { records: Array<{ text: string; domain: string }> };
      assert.equal(aluaiBody.records.length, 1);
      assert.equal(aluaiBody.records[0]?.domain, "aluai");
      assert.equal(JSON.stringify(aluaiBody).includes("financeiro"), false);
      assert.equal(JSON.stringify(aluaiBody).includes("review em análise"), false);

      const before = countDay(workspace.env);
      const invalid = runCli(
        [
          "registrar",
          "reuniao",
          "--dominio",
          "imex",
          "--quando",
          "2026-10-28T13:00",
          "--texto",
          "não deve gravar",
          "--decisao",
          "decisão órfã",
          "--acao",
          "tarefa ;; prazo=sexta",
        ],
        workspace.env,
      );
      assert.equal(invalid.status, 1);
      assert.match(invalid.stderr, /sexta/);
      assert.doesNotMatch(invalid.stderr, /\n\s+at /);
      assert.equal(countDay(workspace.env), before);
    } finally {
      workspace.cleanup();
    }
  });

  it("mostra pendência em aberto no resumo antes de concluir", () => {
    const workspace = cliWorkspace();
    try {
      const meeting = runCli(
        [
          "--json",
          "registrar",
          "reuniao",
          "--dominio",
          "pessoal",
          "--quando",
          "2026-10-28T08:00",
          "--texto",
          "Nota pessoal sintética",
          "--acao",
          "Revisar o roteiro",
        ],
        workspace.env,
      );
      const created = JSON.parse(meeting.stdout) as { actions: Array<{ id: string }> };
      const summary = runCli(["--json", "resumo", "--data", "2026-10-28", "--dominio", "pessoal"], workspace.env);
      const body = JSON.parse(summary.stdout) as { pendingActions: Array<{ id: string; description: string; origin: string }> };
      assert.equal(body.pendingActions[0]?.id, created.actions[0]?.id);
      assert.equal(body.pendingActions[0]?.description, "Revisar o roteiro");
      assert.equal(body.pendingActions[0]?.origin, "user_report");
    } finally {
      workspace.cleanup();
    }
  });

  it("grava duas invocações paralelas sem perder registros", async () => {
    const workspace = cliWorkspace();
    try {
      const [first, second] = await Promise.all([
        runCliAsync(
          ["--json", "registrar", "atividade", "--dominio", "imex", "--quando", "2026-10-28T14:00", "--texto", "Gravação A"],
          workspace.env,
        ),
        runCliAsync(
          ["--json", "registrar", "atividade", "--dominio", "imex", "--quando", "2026-10-28T14:05", "--texto", "Gravação B"],
          workspace.env,
        ),
      ]);
      assert.equal(first.status, 0, first.stderr);
      assert.equal(second.status, 0, second.stderr);
      const listed = runCli(["--json", "listar", "dia", "--data", "2026-10-28", "--dominio", "imex"], workspace.env);
      const body = JSON.parse(listed.stdout) as { records: Array<{ text: string }> };
      const texts = body.records.map((record) => record.text).sort();
      assert.deepEqual(texts, ["Gravação A", "Gravação B"]);
    } finally {
      workspace.cleanup();
    }
  });

  it("não cria banco quando a configuração ou a data é inválida", () => {
    const workspace = cliWorkspace();
    try {
      fs.writeFileSync(path.join(workspace.configDir, "config.json"), JSON.stringify({ timezone: "America/Sao_Paulo", extra: 1 }));
      const badConfig = runCli(["listar", "dia", "--data", "2026-10-28"], workspace.env);
      assert.equal(badConfig.status, 1);
      assert.match(badConfig.stderr, /desconhecida/);
      assert.equal(fs.existsSync(path.join(workspace.dataDir, "moah.sqlite")), false);

      fs.writeFileSync(path.join(workspace.configDir, "config.json"), JSON.stringify({ timezone: "America/Sao_Paulo" }));
      const relative = runCli(
        ["registrar", "atividade", "--dominio", "imex", "--texto", "nota", "--quando", "sexta"],
        workspace.env,
      );
      assert.equal(relative.status, 1);
      assert.match(relative.stderr, /sexta/);
      assert.equal(fs.existsSync(path.join(workspace.dataDir, "moah.sqlite")), false);
    } finally {
      workspace.cleanup();
    }
  });

  it("retorna código 2 para ação inexistente e 0 com ajuda", () => {
    const workspace = cliWorkspace();
    try {
      const missing = runCli(["concluir", "act_inexistente"], workspace.env);
      assert.equal(missing.status, 2);
      assert.match(missing.stderr, /não encontrada/);
      const help = runCli(["ajuda"], workspace.env);
      assert.equal(help.status, 0);
      assert.match(help.stdout, /moah registrar reuniao/);
    } finally {
      workspace.cleanup();
    }
  });
});

function countDay(env: NodeJS.ProcessEnv): number {
  const listed = runCli(["--json", "listar", "dia", "--data", "2026-10-28"], env);
  assert.equal(listed.status, 0, listed.stderr);
  const body = JSON.parse(listed.stdout) as { records: unknown[] };
  return body.records.length;
}
