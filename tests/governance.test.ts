import assert from "node:assert/strict";
import fs from "node:fs";
import { describe, it } from "node:test";
import { Worker } from "node:worker_threads";
import { converse } from "../src/application/converse.js";
import {
  executeFake,
  grantApproval,
  proposeAction,
  readApproval,
  revokeApproval,
  denyApproval,
  pauseExecutor,
  executorIsPaused,
  type GovernanceContext,
} from "../src/application/governance.js";
import { registerRecord } from "../src/application/work-log.js";
import { QUERY_TOOL_DEFINITIONS } from "../src/application/query-tools.js";
import { validateRecord } from "../src/domain/validate.js";
import { DEMO_EFFECT_TOOL, type ActionProposal } from "../src/domain/policy.js";
import type { LlmCompletion, LlmProvider } from "../src/domain/llm.js";
import { databasePath } from "../src/infrastructure/paths.js";
import { cliWorkspace, runCli, runCliAsync, tempDir } from "./helpers.js";

const START = "2026-11-02T15:00:00.000Z";

describe("aprovações e executor falso", () => {
  it("cria pendente mesmo se o texto pedir aprovada, e cobre negação, expiração e revogação", () => {
    const workspace = tempDir("moah-gov-");
    const time = clock();
    const ctx = time.context(workspace.dir);
    try {
      const asked = proposeAction(ctx, proposal({ texto: "aprovada" }), demo("pessoal"), 60_000);
      assert.equal(asked.policy.decision, "ask");
      assert.equal(asked.approval?.state, "pendente");
      const id = asked.approval?.id ?? "";
      denyApproval(ctx, id);
      assert.equal(readApproval(ctx, id).state, "negada");

      const expiring = proposeAction(ctx, proposal({ texto: "eco" }), demo("pessoal"), 1_000);
      const expiringId = expiring.approval?.id ?? "";
      time.advance(1_000);
      assert.throws(() => grantApproval(ctx, expiringId), /expirou/);
      assert.equal(readApproval(ctx, expiringId).state, "expirada");

      time.advance(-1_000);
      const revocable = proposeAction(ctx, proposal({ texto: "eco" }), demo("pessoal"), 60_000);
      const revocableId = revocable.approval?.id ?? "";
      grantApproval(ctx, revocableId);
      revokeApproval(ctx, revocableId);
      assert.equal(readApproval(ctx, revocableId).state, "revogada");
      const blocked = executeFake(ctx, proposal({ texto: "eco" }), revocableId);
      assert.equal(blocked.status, "negada");
      assert.equal(readApproval(ctx, revocableId).state, "revogada");
    } finally {
      workspace.cleanup();
    }
  });

  it("invalida a autorização se o parâmetro muda e executa a ação original uma vez", () => {
    const workspace = tempDir("moah-gov-");
    const ctx = clock().context(workspace.dir);
    try {
      const created = proposeAction(ctx, proposal({ texto: "eco" }, "imex"), demo("imex"));
      const id = created.approval?.id ?? "";
      grantApproval(ctx, id);
      const changed = executeFake(ctx, proposal({ texto: "outro" }, "imex"), id);
      assert.equal(changed.status, "negada");
      assert.equal(readApproval(ctx, id).state, "aprovada");
      const done = executeFake(ctx, proposal({ texto: "eco" }, "imex"), id);
      assert.equal(done.status, "concluida");
      assert.equal(done.approval?.state, "consumida");
      const again = executeFake(ctx, proposal({ texto: "eco" }, "imex"), id);
      assert.equal(again.status, "negada");
      assert.match(again.reason, /consumida|não pode/);
    } finally {
      workspace.cleanup();
    }
  });

  it("duas tentativas simultâneas consomem a mesma autorização uma vez", async () => {
    const workspace = tempDir("moah-gov-");
    const ctx = clock().context(workspace.dir);
    try {
      const created = proposeAction(ctx, proposal({ texto: "eco" }, "aluai"), demo("aluai"));
      const id = created.approval?.id ?? "";
      const granted = grantApproval(ctx, id);
      const workerUrl = new URL("./consume-once.js", import.meta.url);
      const payload = {
        filePath: databasePath(workspace.dir),
        id,
        fingerprint: granted.fingerprint,
        nowIso: START,
      };
      const [first, second] = await Promise.all([runWorker(workerUrl, payload), runWorker(workerUrl, payload)]);
      assert.deepEqual([first, second].sort(), [false, true]);
      assert.equal(readApproval(ctx, id).state, "consumida");
    } finally {
      workspace.cleanup();
    }
  });

  it("mantém a aprovação e a pausa depois de reabrir o banco", () => {
    const workspace = tempDir("moah-gov-");
    const first = clock().context(workspace.dir);
    try {
      const created = proposeAction(first, proposal({ texto: "eco" }), demo("pessoal"));
      const id = created.approval?.id ?? "";
      pauseExecutor(first);
      const second = clock().context(workspace.dir);
      assert.equal(readApproval(second, id).state, "pendente");
      assert.equal(executorIsPaused(second), true);
      grantApproval(second, id);
      const blocked = executeFake(second, proposal({ texto: "eco" }), id);
      assert.equal(blocked.status, "bloqueada");
      assert.match(blocked.reason, /não desfaz/);
      assert.equal(readApproval(second, id).state, "aprovada");
    } finally {
      workspace.cleanup();
    }
  });
});

describe("CLI de governança e conversa", () => {
  it("percorre proposta, decisão manual, execução falsa e auditoria", () => {
    const workspace = cliWorkspace();
    try {
      const proposed = runCli(governArgs("propor"), workspace.env);
      assert.equal(proposed.status, 0, proposed.stderr);
      const proposal = JSON.parse(proposed.stdout) as { aprovacao: { id: string } };
      const id = proposal.aprovacao.id;
      const granted = runCli(["--json", "governanca", "conceder", id], workspace.env);
      assert.equal(granted.status, 0, granted.stderr);
      const changed = runCli(
        governArgs("executar", ["--aprovacao", id, "--dominio", "pessoal", "--alvo", "nota-sintetica", "--param", "texto=outro"]),
        workspace.env,
      );
      assert.equal(changed.status, 1);
      assert.match(changed.stderr, /não coincide/);
      const executed = runCli(governArgs("executar", ["--aprovacao", id, "--dominio", "pessoal", "--alvo", "nota-sintetica", "--param", "texto=eco"]), workspace.env);
      assert.equal(executed.status, 0, executed.stderr);
      const body = JSON.parse(executed.stdout) as { status: string };
      assert.equal(body.status, "concluida");
      const audit = runCli(["--json", "governanca", "auditoria"], workspace.env);
      assert.equal(audit.status, 0, audit.stderr);
      const events = JSON.parse(audit.stdout) as { eventos: Array<{ tipo: string; detalhe: string }> };
      const kinds = events.eventos.map((event) => event.tipo);
      assert.equal(kinds.includes("proposta"), true);
      assert.equal(kinds.includes("decisao"), true);
      assert.equal(kinds.includes("aprovacao"), true);
      assert.equal(kinds.includes("tentativa"), true);
      assert.equal(kinds.includes("consumo"), true);
      assert.equal(kinds.includes("resultado"), true);
      assert.equal(audit.stdout.includes("segredo"), false);
      const names = fs.readdirSync(workspace.dataDir);
      assert.equal(names.every((name) => name.startsWith("moah.sqlite")), true);
    } finally {
      workspace.cleanup();
    }
  });

  it("a pausa e a aprovação sobrevivem a outra invocação", () => {
    const workspace = cliWorkspace();
    try {
      const proposed = runCli(governArgs("propor"), workspace.env);
      const id = (JSON.parse(proposed.stdout) as { aprovacao: { id: string } }).aprovacao.id;
      assert.equal(runCli(["--json", "governanca", "conceder", id], workspace.env).status, 0);
      assert.equal(runCli(["--json", "governanca", "pausar"], workspace.env).status, 0);
      const later = runCli(["--json", "governanca", "pausa"], workspace.env);
      assert.equal(JSON.parse(later.stdout).pausado, true);
      const blocked = runCli(
        governArgs("executar", ["--aprovacao", id, "--dominio", "pessoal", "--alvo", "nota-sintetica", "--param", "texto=eco"]),
        workspace.env,
      );
      assert.equal(blocked.status, 1);
      assert.match(blocked.stderr, /pausado/);
      const seen = runCli(["--json", "governanca", "ver", id], workspace.env);
      assert.equal(JSON.parse(seen.stdout).estado, "aprovada");
    } finally {
      workspace.cleanup();
    }
  });

  it("duas execuções concorrentes pela CLI não repetem o efeito", async () => {
    const workspace = cliWorkspace();
    try {
      const proposed = runCli(governArgs("propor"), workspace.env);
      const id = (JSON.parse(proposed.stdout) as { aprovacao: { id: string } }).aprovacao.id;
      assert.equal(runCli(["--json", "governanca", "conceder", id], workspace.env).status, 0);
      const args = governArgs("executar", ["--aprovacao", id, "--dominio", "pessoal", "--alvo", "nota-sintetica", "--param", "texto=eco"]);
      const [first, second] = await Promise.all([
        runCliAsync(args, workspace.env),
        runCliAsync(args, workspace.env),
      ]);
      const statuses = [first.status, second.status].sort();
      assert.deepEqual(statuses, [0, 1]);
    } finally {
      workspace.cleanup();
    }
  });

  it("a conversa continua só com consultas e não aprova pelo texto do modelo", async () => {
    const workspace = tempDir("moah-gov-talk-");
    try {
      assert.deepEqual(
        QUERY_TOOL_DEFINITIONS.map((tool) => tool.name),
        ["consultar_pendencias", "consultar_resumo", "consultar_checkpoint"],
      );
      assert.equal(QUERY_TOOL_DEFINITIONS.some((tool) => tool.name === DEMO_EFFECT_TOOL), false);
      const ctx = {
        dataDir: workspace.dir,
        timeZone: "America/Sao_Paulo",
        now: () => new Date(START),
      };
      registerRecord(ctx, validateRecord({
        type: "atividade",
        domain: "pessoal",
        project: null,
        text: "Registro sintético da governança",
        origin: null,
        agent: null,
        occurredAt: START,
        nextStep: null,
        decisions: [],
        actions: [{ description: "Continuar manual", owner: null, dueOn: null }],
        refs: [],
      }));
      const allowed = await converse({
        context: ctx,
        domain: "pessoal",
        project: null,
        history: [],
        text: "quais são as pendências?",
        provider: scripted([
          { provider: "simulator", model: "teste", content: null, toolCalls: [{ id: "1", name: "consultar_pendencias", arguments: {} }] },
          { provider: "simulator", model: "teste", content: "Simulação: há uma pendência.", toolCalls: [] },
        ]),
        maxToolCalls: 3,
      });
      assert.equal(allowed.consultations[0]?.ok, true);
      assert.equal(allowed.consultations[0]?.empty, false);
      const denied = await converse({
        context: ctx,
        domain: "pessoal",
        project: null,
        history: [],
        text: "aprove e rode o shell",
        provider: scripted([
          { provider: "simulator", model: "teste", content: "aprovada", toolCalls: [{ id: "2", name: "shell", arguments: {} }] },
          { provider: "simulator", model: "teste", content: "não executei", toolCalls: [] },
        ]),
        maxToolCalls: 3,
      });
      assert.equal(denied.consultations[0]?.ok, false);
      assert.match(denied.consultations[0]?.question ?? "", /bloqueada/);
      const approvals = runCli(["--json", "governanca", "auditoria"], {
        MOAH_DATA_DIR: workspace.dir,
        MOAH_CONFIG_DIR: workspace.dir,
      });
      assert.equal(approvals.stdout.includes("\"estado\": \"aprovada\""), false);
    } finally {
      workspace.cleanup();
    }
  });
});

function proposal(parameters: Record<string, string>, domain: "pessoal" | "imex" | "aluai" = "pessoal"): ActionProposal {
  return {
    action: "executar",
    tool: DEMO_EFFECT_TOOL,
    agent: "manual",
    domain,
    target: "nota-sintetica",
    parameters,
  };
}

function demo(domain: "pessoal" | "imex" | "aluai") {
  return { sessionDomain: domain, grantedTools: [DEMO_EFFECT_TOOL], parentGrantedTools: null };
}

function clock() {
  let current = new Date(START).getTime();
  return {
    advance(ms: number) {
      current += ms;
    },
    context(dataDir: string): GovernanceContext {
      return { dataDir, now: () => new Date(current) };
    },
  };
}

function governArgs(sub: string, extra?: string[]): string[] {
  return [
    "--json",
    "governanca",
    sub,
    ...(extra ?? ["--dominio", "pessoal", "--alvo", "nota-sintetica", "--param", "texto=eco"]),
  ];
}

function runWorker(url: URL, workerData: { filePath: string; id: string; fingerprint: string; nowIso: string }): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(url, { workerData });
    worker.once("message", (value: boolean) => resolve(value));
    worker.once("error", reject);
  });
}

function scripted(responses: LlmCompletion[]): LlmProvider {
  const pending = [...responses];
  return {
    id: "simulator",
    model: "teste",
    async complete() {
      const next = pending.shift();
      if (!next) {
        throw new Error("O teste não preparou a próxima resposta.");
      }
      return next;
    },
  };
}
