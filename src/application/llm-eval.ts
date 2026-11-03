export type EvalScenario = "pendencias" | "checkpoint" | "resumo" | "ausencia" | "esclarecimento" | "dominio";

export interface ObservedCall {
  name: string;
  arguments: unknown;
}

export interface GradeInput {
  scenario: EvalScenario;
  calls: ObservedCall[];
  references: string[];
  toolLines: string[];
  empty: boolean | null;
  answer: string | null;
  requiredIds: string[];
  forbiddenIds: string[];
  explicitDate: string | null;
}

export interface Grade {
  pass: boolean;
  toolMatched: boolean;
  referencesMatched: boolean;
  answerMatched: boolean;
  humanReviewRequired: true;
  notes: string[];
}

export const AUTOMATIC_EVAL_LIMITS = [
  "A aprovação automática confere ferramenta, argumentos, referências e um recorte do texto final.",
  "Ela não mede se a redação está fiel em todos os detalhes. Uma resposta pode repetir um identificador e ainda assim distorcer o conteúdo.",
  "A revisão humana da resposta final continua necessária.",
  "O máximo de VRAM observado é o maior valor entre as amostras feitas durante a chamada, não um pico de hardware garantido.",
  "A memória disponível antes e depois é do computador inteiro, não o consumo exclusivo do MOAH ou do modelo.",
] as const;

export interface LogicalSnapshot {
  records: unknown;
  actions: unknown;
  checkpoints: unknown;
}

export interface Reread {
  ok: boolean;
  value: unknown;
  diagnosis: string | null;
}

const KNOWN_TOOLS = new Set(["consultar_pendencias", "consultar_resumo", "consultar_checkpoint", "consultar_reuniao"]);
const ABSENCE = /não há|nenhum registro|nenhuma pendência/i;
const ASKS_DATE = /AAAA-MM-DD|data explícita|informe a data|qual data|que data/i;
const ISO_DATE = /\b\d{4}-\d{2}-\d{2}\b/;

export function gradeConversation(input: GradeInput): Grade {
  const notes: string[] = [];
  const names = input.calls.map((call) => call.name);
  for (const name of names) {
    if (!KNOWN_TOOLS.has(name)) {
      notes.push(`ferramenta não permitida: ${name}`);
    }
  }
  if (input.calls.some(switchesDomain)) {
    notes.push("a chamada tentou escolher outro domínio");
  }
  const answer = input.answer?.trim() ?? "";
  const consultationText = [...input.references, ...input.toolLines].join("\n");
  if (containsAny(consultationText, input.forbiddenIds)) {
    notes.push("a consulta inclui registro de outro domínio");
  }
  if (containsAny(answer, input.forbiddenIds)) {
    notes.push("a resposta final inclui registro de outro domínio");
  }

  const toolMatched = !input.calls.some(switchesDomain) && toolsMatch(input, names, notes);
  const referencesMatched = !containsAny(consultationText, input.forbiddenIds) && referencesMatch(input, notes);
  const answerMatched = !containsAny(answer, input.forbiddenIds) && answerMatches(input, answer, notes);
  return {
    pass: notes.length === 0 && toolMatched && referencesMatched && answerMatched,
    toolMatched,
    referencesMatched,
    answerMatched,
    humanReviewRequired: true,
    notes,
  };
}

export function logicalChanges(before: LogicalSnapshot, after: LogicalSnapshot): string[] {
  const notes: string[] = [];
  if (stable(before.records) !== stable(after.records)) {
    notes.push("registros, decisões, ações ou referências mudaram");
  }
  if (stable(before.actions) !== stable(after.actions)) {
    notes.push("a lista de ações mudou");
  }
  if (stable(before.checkpoints) !== stable(after.checkpoints)) {
    notes.push("os checkpoints mudaram");
  }
  return notes;
}

export function interpretReread(status: number | null, stdout: string, stderr: string): Reread {
  if (status !== 0) {
    const detail = stderr.trim() || "sem mensagem";
    return {
      ok: false,
      value: null,
      diagnosis: `releitura terminou com código ${status ?? "nulo"}: ${detail}`,
    };
  }
  try {
    return { ok: true, value: JSON.parse(stdout) as unknown, diagnosis: null };
  } catch {
    return { ok: false, value: null, diagnosis: "releitura terminou com código 0 e JSON inválido" };
  }
}

export function maxGpuUsedMiB(samples: string[]): number | null {
  const values = samples
    .map((sample) => /^(\d+)/.exec(sample.trim())?.[1])
    .filter((value): value is string => value !== undefined)
    .map((value) => Number(value));
  if (values.length === 0) {
    return null;
  }
  return Math.max(...values);
}

function toolsMatch(input: GradeInput, names: string[], notes: string[]): boolean {
  if (input.scenario === "pendencias") {
    return expectSingle(names, "consultar_pendencias", input.scenario, notes);
  }
  if (input.scenario === "checkpoint") {
    return expectSingle(names, "consultar_checkpoint", input.scenario, notes);
  }
  if (input.scenario === "resumo") {
    const named = expectSingle(names, "consultar_resumo", input.scenario, notes);
    return named && dateMatches(input.calls[0], input.explicitDate, notes);
  }
  if (input.scenario === "ausencia") {
    const named = expectSingle(names, "consultar_pendencias", input.scenario, notes);
    if (input.empty !== true) {
      notes.push("a ausência não foi confirmada pela consulta");
      return false;
    }
    return named;
  }
  if (input.scenario === "esclarecimento") {
    if (names.length > 1) {
      notes.push("o esclarecimento fez mais de uma consulta");
      return false;
    }
    if (input.calls.some((call) => inventedDate(call, input.explicitDate))) {
      notes.push("a consulta inventou uma data que não estava na pergunta");
      return false;
    }
    return true;
  }
  return names.every((name) => KNOWN_TOOLS.has(name)) && !input.calls.some(switchesDomain);
}

function referencesMatch(input: GradeInput, notes: string[]): boolean {
  if (input.scenario === "esclarecimento" || input.scenario === "ausencia" || input.scenario === "dominio") {
    if (input.references.length > 0 && input.scenario !== "dominio") {
      notes.push("a consulta devolveu referências quando não deveria haver registro");
      return false;
    }
    return true;
  }
  const missing = input.requiredIds.filter((id) => id !== "" && !input.references.includes(id));
  if (missing.length > 0) {
    notes.push("as referências da consulta não incluem o identificador esperado");
    return false;
  }
  return true;
}

function answerMatches(input: GradeInput, answer: string, notes: string[]): boolean {
  if (answer === "") {
    notes.push("a resposta final está vazia");
    return false;
  }
  if (input.scenario === "esclarecimento") {
    if (ISO_DATE.test(answer)) {
      notes.push("a resposta final inventou uma data");
      return false;
    }
    if (!ASKS_DATE.test(answer)) {
      notes.push("a resposta final não pede a data explícita");
      return false;
    }
    return true;
  }
  if (input.scenario === "ausencia") {
    if (!ABSENCE.test(answer)) {
      notes.push("a resposta final não informa a ausência de registros");
      return false;
    }
    return true;
  }
  if (input.scenario === "dominio") {
    return true;
  }
  if (input.empty === false && ABSENCE.test(answer)) {
    notes.push("a resposta final contradiz os dados consultados");
    return false;
  }
  const missing = input.requiredIds.filter((id) => id !== "" && !answer.includes(id));
  if (missing.length > 0) {
    notes.push("a resposta final não cita o identificador consultado");
    return false;
  }
  return true;
}

function expectSingle(names: string[], expected: string, scenario: EvalScenario, notes: string[]): boolean {
  if (names.length === 1 && names[0] === expected) {
    return true;
  }
  notes.push(`escolha de ferramenta inesperada em ${scenario}`);
  return false;
}

function dateMatches(call: ObservedCall | undefined, explicitDate: string | null, notes: string[]): boolean {
  if (!explicitDate || readData(call?.arguments) !== explicitDate) {
    notes.push("a data da consulta não é a data explícita da pergunta");
    return false;
  }
  return true;
}

function inventedDate(call: ObservedCall, explicitDate: string | null): boolean {
  const data = readData(call.arguments);
  if (data === null || !ISO_DATE.test(data)) {
    return false;
  }
  return data !== explicitDate;
}

function switchesDomain(call: ObservedCall): boolean {
  const record = asRecord(call.arguments);
  if (!record) {
    return false;
  }
  return "dominio" in record || "domain" in record;
}

function containsAny(text: string, ids: string[]): boolean {
  return ids.some((id) => id !== "" && text.includes(id));
}

function readData(value: unknown): string | null {
  const record = asRecord(value);
  if (!record || typeof record.data !== "string") {
    return null;
  }
  return record.data;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    try {
      return asRecord(JSON.parse(value) as unknown);
    } catch {
      return null;
    }
  }
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function stable(value: unknown): string {
  return JSON.stringify(normalize(value));
}

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalize).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (typeof value === "object" && value !== null) {
    const source = value as Record<string, unknown>;
    const ordered: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      ordered[key] = normalize(source[key]);
    }
    return ordered;
  }
  return value;
}
