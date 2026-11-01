import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gradeConversation, type EvalScenario, type ObservedCall } from "../application/llm-eval.js";
import { resolveLlmSettings } from "../infrastructure/llm/settings.js";

const cliPath = fileURLToPath(new URL("./main.js", import.meta.url));

interface Scenario {
  name: EvalScenario;
  domain: "pessoal" | "imex" | "aluai";
  text: string;
  requiredIds: string[];
  forbiddenIds: string[];
  explicitDate: string | null;
}

function main(): number {
  const settings = resolveLlmSettings({}, process.env, null);
  if (settings.provider !== "openai-compatible") {
    process.stderr.write(
      "A avaliação real exige MOAH_LLM_PROVIDER=openai-compatible. O simulador permanece só para os testes automáticos.\n",
    );
    return 1;
  }
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moah-llm-real-"));
  const dataDir = path.join(root, "data");
  const configDir = path.join(root, "config");
  fs.mkdirSync(dataDir);
  fs.mkdirSync(configDir);
  fs.writeFileSync(path.join(configDir, "config.json"), JSON.stringify({ timezone: "America/Sao_Paulo" }));
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    MOAH_DATA_DIR: dataDir,
    MOAH_CONFIG_DIR: configDir,
    MOAH_LLM_PROVIDER: "openai-compatible",
  };
  const beforeGpu = sampleGpu();
  const beforeRam = sampleRam();
  try {
    const created = run(env, [
      "--json",
      "registrar",
      "atividade",
      "--dominio",
      "imex",
      "--quando",
      "2026-10-29T10:00",
      "--texto",
      "Nota sintetica para avaliar o modelo",
      "--acao",
      "Conferir a ferramenta",
    ]);
    const checkpoint = run(env, [
      "--json",
      "checkpoint",
      "--dominio",
      "imex",
      "--quando",
      "2026-10-29T11:00",
      "--resumo",
      "Checkpoint sintetico da avaliacao",
      "--proximo",
      "Medir a resposta",
    ]);
    if (created.status !== 0 || checkpoint.status !== 0) {
      process.stderr.write("Não foi possível preparar os registros sintéticos.\n");
      return 1;
    }
    const activity = JSON.parse(created.stdout) as { id: string; actions: Array<{ id: string }> };
    const savedCheckpoint = JSON.parse(checkpoint.stdout) as { id: string };
    const actionId = activity.actions[0]?.id ?? "";
    const scenarios: Scenario[] = [
      {
        name: "pendencias",
        domain: "imex",
        text: "quais são as pendências?",
        requiredIds: [actionId],
        forbiddenIds: [],
        explicitDate: null,
      },
      {
        name: "checkpoint",
        domain: "imex",
        text: "qual foi o último checkpoint?",
        requiredIds: [savedCheckpoint.id],
        forbiddenIds: [],
        explicitDate: null,
      },
      {
        name: "resumo",
        domain: "imex",
        text: "resume o dia 2026-10-29",
        requiredIds: [activity.id],
        forbiddenIds: [],
        explicitDate: "2026-10-29",
      },
      {
        name: "ausencia",
        domain: "pessoal",
        text: "quais são as pendências?",
        requiredIds: [],
        forbiddenIds: [activity.id, actionId, savedCheckpoint.id],
        explicitDate: null,
      },
      {
        name: "esclarecimento",
        domain: "imex",
        text: "o que fizemos sexta?",
        requiredIds: [],
        forbiddenIds: [],
        explicitDate: null,
      },
      {
        name: "dominio",
        domain: "pessoal",
        text: "liste as pendências da aluai",
        requiredIds: [],
        forbiddenIds: [activity.id, actionId, savedCheckpoint.id],
        explicitDate: null,
      },
    ];
    const during: string[] = [];
    const results = scenarios.map((scenario) => {
      const started = Date.now();
      const response = run(env, [
        "--json",
        "conversar",
        "--dominio",
        scenario.domain,
        "--provedor",
        "openai-compatible",
        "--texto",
        scenario.text,
      ]);
      const elapsedMs = Date.now() - started;
      during.push(sampleGpu());
      if (response.status !== 0) {
        return {
          scenario: scenario.name,
          elapsedMs,
          pass: false,
          toolMatched: false,
          notes: [`a conversa terminou com código ${response.status ?? "nulo"}`],
          provider: null,
          simulated: null,
        };
      }
      const body = JSON.parse(response.stdout) as {
        provider: string;
        simulated: boolean;
        model: string;
        answer: string | null;
        consulted: Array<{ name: string; arguments: unknown; lines: string[] }>;
      };
      if (body.simulated || body.provider !== "openai-compatible") {
        return {
          scenario: scenario.name,
          elapsedMs,
          pass: false,
          toolMatched: false,
          notes: ["a resposta veio do simulador"],
          provider: body.provider,
          simulated: body.simulated,
        };
      }
      const calls: ObservedCall[] = body.consulted.map((item) => ({
        name: item.name,
        arguments: "arguments" in item ? item.arguments : {},
      }));
      const corpus = [body.answer ?? "", ...body.consulted.flatMap((item) => item.lines)].join("\n");
      const grade = gradeConversation({
        scenario: scenario.name,
        calls,
        corpus,
        requiredIds: scenario.requiredIds,
        forbiddenIds: scenario.forbiddenIds,
        explicitDate: scenario.explicitDate,
      });
      return {
        scenario: scenario.name,
        elapsedMs,
        pass: grade.pass,
        toolMatched: grade.toolMatched,
        notes: grade.notes,
        provider: body.provider,
        simulated: body.simulated,
        model: body.model,
      };
    });
    const after = run(env, ["--json", "pendencias", "--dominio", "imex"]);
    const pending = JSON.parse(after.stdout) as { actions: Array<{ id: string; status: string }> };
    const unchanged = pending.actions.some((item) => item.id === actionId && item.status === "pendente");
    const report = {
      kind: "avaliacao-real",
      automatedTests: false,
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl,
      modelsDir: settings.modelsDir,
      recordsUnchanged: unchanged,
      ramBefore: beforeRam,
      ramAfter: sampleRam(),
      gpuBefore: beforeGpu,
      gpuDuring: during,
      gpuAfter: sampleGpu(),
      results,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    const failed = results.some((item) => !item.pass) || !unchanged;
    return failed ? 1 : 0;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function run(env: NodeJS.ProcessEnv, args: string[]): { status: number | null; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", cliPath, ...args], {
    encoding: "utf8",
    env,
  });
  if (result.stderr) {
    const safe = result.stderr.split("\n").filter((line) => !line.includes("MOAH_LLM_API_KEY"));
    process.stderr.write(safe.join("\n"));
    if (safe.length > 0 && !safe[safe.length - 1]?.endsWith("\n")) {
      process.stderr.write("\n");
    }
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function sampleGpu(): string {
  const result = spawnSync(
    "nvidia-smi",
    ["--query-gpu=memory.used,memory.free,utilization.gpu", "--format=csv,noheader"],
    { encoding: "utf8" },
  );
  return result.status === 0 ? result.stdout.trim() : "nvidia-smi indisponível";
}

function sampleRam(): string {
  const info = fs.readFileSync("/proc/meminfo", "utf8");
  const available = /^MemAvailable:\s+(\d+)/m.exec(info)?.[1] ?? "desconhecida";
  return `MemAvailable_kB=${available}`;
}

try {
  process.exitCode = main();
} catch (error) {
  const message = error instanceof Error ? error.message : "Falha na avaliação real.";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}
