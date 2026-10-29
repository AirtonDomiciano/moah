import readline from "node:readline";
import { converse } from "../application/converse.js";
import {
  concludeAction,
  findCheckpoint,
  listDay,
  listPending,
  registerRecord,
  summarizeDay,
} from "../application/work-log.js";
import { isActionStatus, isDomain } from "../domain/constants.js";
import { AppError } from "../domain/errors.js";
import { civilToday, formatInstant, isSupportedNodeVersion, parseCivilDate, parseExplicitInstant } from "../domain/time.js";
import type { ActionView, Domain } from "../domain/types.js";
import { assertItemCount, validateRecord } from "../domain/validate.js";
import type { ConversationTurn } from "../domain/llm.js";
import { loadConfig } from "../infrastructure/config.js";
import { createLlmProvider, readApiKey } from "../infrastructure/llm/create-provider.js";
import { resolveLlmSettings } from "../infrastructure/llm/settings.js";
import { resolveDirs } from "../infrastructure/paths.js";
import { parseActionSpec } from "./action-spec.js";
import { HELP } from "./help.js";
import { many, one, parseArgs, rejectUnknown } from "./parse-args.js";
import {
  printActions,
  printCheckpoint,
  printConversation,
  printJson,
  printRecord,
  printRecordList,
  printSummary,
} from "./present.js";

const RECORD_OPTIONS = [
  "dominio",
  "texto",
  "resumo",
  "projeto",
  "quando",
  "decisao",
  "acao",
  "proximo",
  "ref",
  "origem",
  "agente",
] as const;

export async function execute(argv: string[]): Promise<void> {
  if (!isSupportedNodeVersion(process.versions.node)) {
    throw new AppError(
      `Esta CLI requer Node.js 22.16 ou superior, na linha 22.x. Versão atual: ${process.versions.node}.`,
      "validation",
    );
  }
  const parsed = parseArgs(argv);
  if (parsed.help || parsed.positionals[0] === "ajuda") {
    process.stdout.write(HELP);
    return;
  }
  if (parsed.positionals.length === 0) {
    process.stdout.write(HELP);
    throw new AppError("Informe um comando. Use moah ajuda para ver a gramática.", "validation");
  }

  const command = parsed.positionals[0];
  const dirs = resolveDirs();
  const config = loadConfig(dirs.configDir);
  const context = {
    dataDir: dirs.dataDir,
    timeZone: config.timezone,
    now: () => new Date(),
  };

  if (command === "registrar" || command === "checkpoint") {
    const type = command === "checkpoint" ? "checkpoint" : parsed.positionals[1];
    const expected = command === "checkpoint" ? 1 : 2;
    if (parsed.positionals.length !== expected) {
      throw new AppError("Uso: moah registrar atividade|reuniao, ou moah checkpoint.", "validation");
    }
    if (type !== "atividade" && type !== "reuniao" && type !== "checkpoint") {
      throw new AppError("Use registrar atividade ou registrar reuniao.", "validation");
    }
    rejectUnknown(parsed.options, RECORD_OPTIONS);
    if (type === "checkpoint" && one(parsed.options, "texto") !== null) {
      throw new AppError("No checkpoint use --resumo. --texto não se aplica.", "validation");
    }
    if (type !== "checkpoint" && one(parsed.options, "resumo") !== null) {
      throw new AppError("Em atividade ou reunião use --texto. --resumo é do checkpoint.", "validation");
    }
    const decisions = many(parsed.options, "decisao");
    const actions = many(parsed.options, "acao").map(parseActionSpec);
    const refs = many(parsed.options, "ref");
    assertItemCount(decisions.length, "decisões");
    assertItemCount(actions.length, "ações");
    assertItemCount(refs.length, "referências");
    const when = one(parsed.options, "quando");
    const saved = registerRecord(
      context,
      validateRecord({
        type,
        domain: requiredDomain(one(parsed.options, "dominio")),
        project: one(parsed.options, "projeto"),
        text: type === "checkpoint" ? requiredValue(parsed.options, "resumo") : requiredValue(parsed.options, "texto"),
        origin: one(parsed.options, "origem"),
        agent: one(parsed.options, "agente"),
        occurredAt: when ? parseExplicitInstant(when, config.timezone) : context.now().toISOString(),
        nextStep: one(parsed.options, "proximo"),
        decisions,
        actions,
        refs,
      }),
    );
    printRecord(saved, config.timezone, parsed.json);
    return;
  }

  if (command === "listar") {
    if (parsed.positionals[1] !== "dia" || parsed.positionals.length !== 2) {
      throw new AppError("Uso: moah listar dia [--data AAAA-MM-DD].", "validation");
    }
    rejectUnknown(parsed.options, ["data", "dominio", "projeto"]);
    const date = dateOrToday(one(parsed.options, "data"), config.timezone);
    const domain = optionalDomain(one(parsed.options, "dominio"));
    const project = one(parsed.options, "projeto");
    const records = listDay(context, { date, domain, project });
    printRecordList(date, config.timezone, records, parsed.json, domain, project);
    return;
  }

  if (command === "pendencias") {
    if (parsed.positionals.length !== 1) {
      throw new AppError("Uso: moah pendencias [--dominio] [--projeto] [--estado].", "validation");
    }
    rejectUnknown(parsed.options, ["dominio", "projeto", "estado"]);
    const actions = listPending(context, {
      domain: optionalDomain(one(parsed.options, "dominio")),
      project: one(parsed.options, "projeto"),
      status: actionStatus(one(parsed.options, "estado")),
    });
    printActions(actions, config.timezone, parsed.json);
    return;
  }

  if (command === "concluir") {
    const actionId = parsed.positionals[1];
    if (!actionId || parsed.positionals.length !== 2) {
      throw new AppError("Uso: moah concluir <id-da-acao>.", "validation");
    }
    rejectUnknown(parsed.options, []);
    const concluded = concludeAction(context, actionId);
    printConcluded(concluded, config.timezone, parsed.json);
    return;
  }

  if (command === "onde-paramos") {
    if (parsed.positionals.length !== 1) {
      throw new AppError("Uso: moah onde-paramos --dominio <domínio> [--projeto <nome>].", "validation");
    }
    rejectUnknown(parsed.options, ["dominio", "projeto"]);
    const domain = requiredDomain(one(parsed.options, "dominio"));
    const project = one(parsed.options, "projeto");
    printCheckpoint(findCheckpoint(context, { domain, project }), domain, project, config.timezone, parsed.json);
    return;
  }

  if (command === "resumo") {
    if (parsed.positionals.length !== 1) {
      throw new AppError("Uso: moah resumo [--data AAAA-MM-DD] [--dominio] [--projeto].", "validation");
    }
    rejectUnknown(parsed.options, ["data", "dominio", "projeto"]);
    const date = dateOrToday(one(parsed.options, "data"), config.timezone);
    const domain = optionalDomain(one(parsed.options, "dominio"));
    const project = one(parsed.options, "projeto");
    printSummary(summarizeDay(context, { date, domain, project }), parsed.json);
    return;
  }

  if (command === "conversar") {
    if (parsed.positionals.length !== 1) {
      throw new AppError(
        "Uso: moah conversar --dominio <domínio> [--projeto <nome>] [--texto <pergunta>] [--provedor simulator|openai-compatible].",
        "validation",
      );
    }
    rejectUnknown(parsed.options, ["dominio", "projeto", "texto", "provedor"]);
    const domain = requiredDomain(one(parsed.options, "dominio"));
    const project = one(parsed.options, "projeto");
    const text = one(parsed.options, "texto");
    const settings = resolveLlmSettings(config.llm, process.env, one(parsed.options, "provedor"));
    const provider = createLlmProvider(settings, readApiKey(process.env));
    if (text !== null) {
      const result = await runTurn(context, domain, project, [], text, provider, settings.maxToolCalls);
      printConversation(result, parsed.json);
      return;
    }
    if (!process.stdin.isTTY) {
      throw new AppError("Informe --texto ou execute moah conversar em um terminal interativo.", "validation");
    }
    await conversationLoop(context, domain, project, provider, settings.maxToolCalls, parsed.json);
    return;
  }

  throw new AppError(`Comando desconhecido: ${command}. Use moah ajuda.`, "validation");
}

function printConcluded(item: ActionView, timeZone: string, json: boolean): void {
  if (item.action.completedAt === null) {
    throw new AppError("A conclusão não gravou o instante.", "persistence");
  }
  if (json) {
    printJson({
      ...item.action,
      recordId: item.recordId,
      recordType: item.recordType,
      domain: item.domain,
      project: item.project,
      origin: item.origin,
      occurredAt: item.occurredAt,
    });
    return;
  }
  process.stdout.write(`Ação ${item.action.id} concluída em ${formatInstant(item.action.completedAt, timeZone)}.\n`);
}

async function runTurn(
  context: { dataDir: string; timeZone: string; now: () => Date },
  domain: Domain,
  project: string | null,
  history: ConversationTurn[],
  text: string,
  provider: ReturnType<typeof createLlmProvider>,
  maxToolCalls: number,
) {
  const controller = new AbortController();
  const onSigint = (): void => {
    controller.abort(new DOMException("Consulta cancelada.", "AbortError"));
  };
  process.on("SIGINT", onSigint);
  try {
    return await converse({
      context,
      domain,
      project,
      history,
      text,
      provider,
      maxToolCalls,
      signal: controller.signal,
    });
  } finally {
    process.off("SIGINT", onSigint);
  }
}

async function conversationLoop(
  context: { dataDir: string; timeZone: string; now: () => Date },
  domain: Domain,
  project: string | null,
  provider: ReturnType<typeof createLlmProvider>,
  maxToolCalls: number,
  json: boolean,
): Promise<void> {
  const history: ConversationTurn[] = [];
  const input = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    for await (const line of input) {
      const text = line.trim();
      if (text === "") {
        continue;
      }
      if (text === "/sair") {
        break;
      }
      try {
        const result = await runTurn(context, domain, project, history, text, provider, maxToolCalls);
        printConversation(result, json);
        if (result.answer) {
          history.push({ role: "user", content: text }, { role: "assistant", content: result.answer });
        }
      } catch (error) {
        if (error instanceof AppError && error.message === "Consulta ao modelo cancelada.") {
          process.stderr.write(`${error.message}\n`);
          continue;
        }
        throw error;
      }
    }
  } finally {
    input.close();
  }
}

function requiredValue(options: Map<string, string[]>, name: string): string {
  const value = one(options, name);
  if (value === null) {
    throw new AppError(`Informe --${name}.`, "validation");
  }
  return value;
}

function requiredDomain(value: string | null): Domain {
  if (value === null) {
    throw new AppError("Informe --dominio pessoal, imex ou aluai.", "validation");
  }
  return optionalDomain(value) ?? failDomain(value);
}

function optionalDomain(value: string | null): Domain | null {
  if (value === null) {
    return null;
  }
  if (!isDomain(value)) {
    return failDomain(value);
  }
  return value;
}

function failDomain(value: string): never {
  throw new AppError(`Domínio inválido: "${value}". Use pessoal, imex ou aluai.`, "validation");
}

function dateOrToday(value: string | null, timeZone: string): string {
  return value === null ? civilToday(timeZone) : parseCivilDate(value);
}

function actionStatus(value: string | null): "pendente" | "concluida" | "todas" {
  const status = value ?? "pendente";
  if (status === "todas") {
    return "todas";
  }
  if (!isActionStatus(status)) {
    throw new AppError("Estado inválido. Use pendente, concluida ou todas.", "validation");
  }
  return status;
}
