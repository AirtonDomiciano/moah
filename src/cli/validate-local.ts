import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  AUTOMATIC_EVAL_LIMITS,
  gradeConversation,
  interpretReread,
  logicalChanges,
  maxGpuUsedMiB,
  type EvalScenario,
  type LogicalSnapshot,
  type ObservedCall,
} from "../application/llm-eval.js";
import { resolveLlmSettings } from "../infrastructure/llm/settings.js";

const cliPath = fileURLToPath(new URL("./main.js", import.meta.url));
const EVAL_DATE = "2026-10-29";
const SAMPLE_INTERVAL_MS = 250;

interface Scenario {
  name: EvalScenario;
  domain: "pessoal" | "imex" | "aluai";
  text: string;
  requiredIds: string[];
  forbiddenIds: string[];
  explicitDate: string | null;
}

interface CommandResult {
  status: number | null;
  stdout: string;
  stderr: string;
  gpuSamples: string[];
}

interface ConsultedItem {
  name: string;
  arguments: unknown;
  references: string[];
  lines: string[];
}

export interface ScenarioEvidence {
  scenario: EvalScenario;
  domain: Scenario["domain"];
  question: string;
  answer: string | null;
  tools: Array<{ name: string; arguments: unknown }>;
  references: string[];
  syntheticData: string[];
  criteria: {
    tool: "aprovado" | "reprovado";
    references: "aprovado" | "reprovado";
    answer: "aprovado" | "reprovado";
  };
  elapsedMs: number;
  pass: boolean;
  humanReviewRequired: true;
  notes: string[];
  provider: string | null;
  simulated: boolean | null;
  model?: string;
}

export function buildScenarioEvidence(input: {
  scenario: Scenario;
  elapsedMs: number;
  answer: string | null;
  consulted: ConsultedItem[];
  toolMatched: boolean;
  referencesMatched: boolean;
  answerMatched: boolean;
  notes: string[];
  provider: string | null;
  simulated: boolean | null;
  model?: string;
}): ScenarioEvidence {
  const evidence: ScenarioEvidence = {
    scenario: input.scenario.name,
    domain: input.scenario.domain,
    question: redact(input.scenario.text),
    answer: input.answer === null ? null : redact(input.answer),
    tools: input.consulted.map((item) => ({
      name: item.name,
      arguments: redactValue(item.arguments),
    })),
    references: input.consulted.flatMap((item) => item.references.map(redact)),
    syntheticData: input.consulted.flatMap((item) => item.lines.map(redact)),
    criteria: {
      tool: mark(input.toolMatched),
      references: mark(input.referencesMatched),
      answer: mark(input.answerMatched),
    },
    elapsedMs: input.elapsedMs,
    pass: input.toolMatched && input.referencesMatched && input.answerMatched && input.notes.length === 0,
    humanReviewRequired: true,
    notes: input.notes.map(redact),
    provider: input.provider,
    simulated: input.simulated,
  };
  if (input.model !== undefined) {
    evidence.model = input.model;
  }
  return evidence;
}

async function main(): Promise<number> {
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
  const gpuBefore = sampleGpu();
  const ramHostAvailableBefore = sampleRam();
  try {
    const created = runSync(env, [
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
    const checkpoint = runSync(env, [
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
    const createdBody = interpretReread(created.status, created.stdout, created.stderr);
    const checkpointBody = interpretReread(checkpoint.status, checkpoint.stdout, checkpoint.stderr);
    if (!createdBody.ok || !checkpointBody.ok) {
      process.stderr.write(`${createdBody.diagnosis ?? checkpointBody.diagnosis ?? "Falha ao preparar registros."}\n`);
      return 1;
    }
    const activity = createdBody.value as { id: string; actions: Array<{ id: string }> };
    const savedCheckpoint = checkpointBody.value as { id: string };
    const actionId = activity.actions[0]?.id ?? "";
    const before = readSnapshot(env);
    if (!before.ok) {
      process.stderr.write(`${before.diagnosis}\n`);
      return 1;
    }
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
    const gpuSamplesDuringCalls: string[] = [];
    const results = [];
    for (const scenario of scenarios) {
      const started = Date.now();
      const response = await runLive(env, [
        "--json",
        "conversar",
        "--dominio",
        scenario.domain,
        "--provedor",
        "openai-compatible",
        "--texto",
        scenario.text,
      ]);
      gpuSamplesDuringCalls.push(...response.gpuSamples);
      const elapsedMs = Date.now() - started;
      const parsed = interpretReread(response.status, response.stdout, response.stderr);
      if (!parsed.ok) {
        results.push(
          buildScenarioEvidence({
            scenario,
            elapsedMs,
            answer: null,
            consulted: [],
            toolMatched: false,
            referencesMatched: false,
            answerMatched: false,
            notes: [parsed.diagnosis ?? "Falha ao ler a resposta."],
            provider: null,
            simulated: null,
          }),
        );
        continue;
      }
      const body = parsed.value as {
        provider: string;
        simulated: boolean;
        model: string;
        answer: string | null;
        consulted: Array<{ name: string; arguments: unknown; empty: boolean | null; references: string[]; lines: string[] }>;
      };
      if (body.simulated || body.provider !== "openai-compatible") {
        results.push(
          buildScenarioEvidence({
            scenario,
            elapsedMs,
            answer: body.answer,
            consulted: body.consulted,
            toolMatched: false,
            referencesMatched: false,
            answerMatched: false,
            notes: ["a resposta veio do simulador"],
            provider: body.provider,
            simulated: body.simulated,
            model: body.model,
          }),
        );
        continue;
      }
      const calls: ObservedCall[] = body.consulted.map((item) => ({ name: item.name, arguments: item.arguments }));
      const grade = gradeConversation({
        scenario: scenario.name,
        calls,
        references: body.consulted.flatMap((item) => item.references),
        toolLines: body.consulted.flatMap((item) => item.lines),
        empty: combinedEmpty(body.consulted.map((item) => item.empty)),
        answer: body.answer,
        requiredIds: scenario.requiredIds,
        forbiddenIds: scenario.forbiddenIds,
        explicitDate: scenario.explicitDate,
      });
      results.push(
        buildScenarioEvidence({
          scenario,
          elapsedMs,
          answer: body.answer,
          consulted: body.consulted,
          toolMatched: grade.toolMatched,
          referencesMatched: grade.referencesMatched,
          answerMatched: grade.answerMatched,
          notes: grade.notes,
          provider: body.provider,
          simulated: body.simulated,
          model: body.model,
        }),
      );
    }
    const after = readSnapshot(env);
    const changes = after.ok ? logicalChanges(before.snapshot, after.snapshot) : [];
    const report = {
      kind: "avaliacao-real",
      automatedTests: false,
      humanReviewRequired: true,
      automaticLimits: AUTOMATIC_EVAL_LIMITS,
      provider: settings.provider,
      model: settings.model,
      baseUrl: settings.baseUrl,
      modelsDir: settings.modelsDir,
      recordsUnchanged: after.ok ? changes.length === 0 : null,
      logicalChanges: changes,
      rereadDiagnosis: after.ok ? null : after.diagnosis,
      ram: {
        exclusiveToModel: false,
        hostAvailableBefore: ramHostAvailableBefore,
        hostAvailableAfter: sampleRam(),
      },
      gpu: {
        hostWide: true,
        peakGuaranteed: false,
        sampleIntervalMs: SAMPLE_INTERVAL_MS,
        before: gpuBefore,
        samplesDuringCalls: gpuSamplesDuringCalls,
        observedMaxUsedMiB: maxGpuUsedMiB(gpuSamplesDuringCalls),
        after: sampleGpu(),
      },
      results,
    };
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    const failed = results.some((item) => !item.pass) || !after.ok || changes.length > 0;
    return failed ? 1 : 0;
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

function readSnapshot(env: NodeJS.ProcessEnv): { ok: true; snapshot: LogicalSnapshot } | { ok: false; diagnosis: string } {
  const day = interpretReread(
    ...commandParts(runSync(env, ["--json", "listar", "dia", "--data", EVAL_DATE])),
  );
  const actions = interpretReread(...commandParts(runSync(env, ["--json", "pendencias", "--estado", "todas"])));
  const checkpoints = {
    pessoal: interpretReread(...commandParts(runSync(env, ["--json", "onde-paramos", "--dominio", "pessoal"]))),
    imex: interpretReread(...commandParts(runSync(env, ["--json", "onde-paramos", "--dominio", "imex"]))),
    aluai: interpretReread(...commandParts(runSync(env, ["--json", "onde-paramos", "--dominio", "aluai"]))),
  };
  const failed = [day, actions, checkpoints.pessoal, checkpoints.imex, checkpoints.aluai].find((item) => !item.ok);
  if (failed && !failed.ok) {
    return { ok: false, diagnosis: failed.diagnosis ?? "Falha ao reler o estado." };
  }
  if (!day.ok || !actions.ok || !checkpoints.pessoal.ok || !checkpoints.imex.ok || !checkpoints.aluai.ok) {
    return { ok: false, diagnosis: "Falha ao reler o estado." };
  }
  const dayBody = day.value as { records?: unknown };
  const actionBody = actions.value as { actions?: unknown };
  return {
    ok: true,
    snapshot: {
      records: dayBody.records ?? [],
      actions: actionBody.actions ?? [],
      checkpoints: {
        pessoal: checkpointOf(checkpoints.pessoal.value),
        imex: checkpointOf(checkpoints.imex.value),
        aluai: checkpointOf(checkpoints.aluai.value),
      },
    },
  };
}

function checkpointOf(value: unknown): unknown {
  if (typeof value === "object" && value !== null && "checkpoint" in value) {
    return (value as { checkpoint: unknown }).checkpoint;
  }
  return null;
}

function commandParts(result: CommandResult): [number | null, string, string] {
  return [result.status, result.stdout, result.stderr];
}

function combinedEmpty(values: Array<boolean | null>): boolean | null {
  if (values.some((value) => value === false)) {
    return false;
  }
  if (values.length > 0 && values.every((value) => value === true)) {
    return true;
  }
  return null;
}

function runSync(env: NodeJS.ProcessEnv, args: string[]): CommandResult {
  const result = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", cliPath, ...args], {
    encoding: "utf8",
    env,
  });
  writeSafeStderr(result.stderr);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, gpuSamples: [] };
}

function runLive(env: NodeJS.ProcessEnv, args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", cliPath, ...args], { env });
    const gpuSamples: string[] = [sampleGpu()];
    const timer = setInterval(() => {
      gpuSamples.push(sampleGpu());
    }, SAMPLE_INTERVAL_MS);
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      clearInterval(timer);
      reject(error);
    });
    child.on("close", (status) => {
      clearInterval(timer);
      writeSafeStderr(stderr);
      resolve({ status, stdout, stderr, gpuSamples });
    });
  });
}

function writeSafeStderr(stderr: string): void {
  if (!stderr) {
    return;
  }
  const safe = stderr.split("\n").filter((line) => !line.includes("MOAH_LLM_API_KEY"));
  process.stderr.write(safe.join("\n"));
  if (safe.length > 0 && !safe[safe.length - 1]?.endsWith("\n")) {
    process.stderr.write("\n");
  }
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

function mark(ok: boolean): "aprovado" | "reprovado" {
  return ok ? "aprovado" : "reprovado";
}

function redact(value: string): string {
  return value
    .replace(/Bearer\s+\S+/gi, "Bearer [omitido]")
    .replace(/MOAH_LLM_API_KEY[=:]\S+/g, "MOAH_LLM_API_KEY=[omitido]");
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return redact(value);
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (typeof value === "object" && value !== null) {
    const source = value as Record<string, unknown>;
    const redacted: Record<string, unknown> = {};
    for (const key of Object.keys(source)) {
      redacted[key] = /api.?key|authorization|secret|token|password/i.test(key) ? "[omitido]" : redactValue(source[key]);
    }
    return redacted;
  }
  return value;
}

const entry = process.argv[1];
if (entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha na avaliação real.";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  }
}
