export type EvalScenario = "pendencias" | "checkpoint" | "resumo" | "ausencia" | "esclarecimento" | "dominio";

export interface ObservedCall {
  name: string;
  arguments: unknown;
}

export interface GradeInput {
  scenario: EvalScenario;
  calls: ObservedCall[];
  corpus: string;
  requiredIds: string[];
  forbiddenIds: string[];
  explicitDate: string | null;
}

export interface Grade {
  pass: boolean;
  toolMatched: boolean;
  notes: string[];
}

const KNOWN_TOOLS = new Set(["consultar_pendencias", "consultar_resumo", "consultar_checkpoint"]);

export function gradeConversation(input: GradeInput): Grade {
  const notes: string[] = [];
  const names = input.calls.map((call) => call.name);
  for (const name of names) {
    if (!KNOWN_TOOLS.has(name)) {
      notes.push(`ferramenta não permitida: ${name}`);
    }
  }
  const leaked = input.forbiddenIds.filter((id) => id !== "" && input.corpus.includes(id));
  if (leaked.length > 0) {
    notes.push("a resposta inclui registro de outro domínio");
  }
  const missing = input.requiredIds.filter((id) => id !== "" && !input.corpus.includes(id));
  if (missing.length > 0 && input.scenario !== "ausencia" && input.scenario !== "esclarecimento" && input.scenario !== "dominio") {
    notes.push("a resposta não mostra o id consultado");
  }

  let toolMatched = false;
  if (input.scenario === "pendencias") {
    toolMatched = names.length === 1 && names[0] === "consultar_pendencias";
  } else if (input.scenario === "checkpoint") {
    toolMatched = names.length === 1 && names[0] === "consultar_checkpoint";
  } else if (input.scenario === "resumo") {
    toolMatched = names.length === 1 && names[0] === "consultar_resumo" && dateMatches(input.calls[0], input.explicitDate);
  } else if (input.scenario === "ausencia") {
    const consultedPending = names.length === 0 || (names.length === 1 && names[0] === "consultar_pendencias");
    toolMatched = consultedPending && /não há|nenhum registro|nenhuma pendência/i.test(input.corpus);
  } else if (input.scenario === "esclarecimento") {
    const invented = input.calls.some((call) => inventedDate(call, input.explicitDate));
    toolMatched = names.length === 0 || !invented;
    if (invented) {
      notes.push("a consulta inventou uma data que não estava na pergunta");
    }
  } else {
    toolMatched = leaked.length === 0 && names.every((name) => KNOWN_TOOLS.has(name));
  }
  if (!toolMatched && input.scenario !== "esclarecimento" && input.scenario !== "dominio") {
    notes.push(`escolha de ferramenta inesperada em ${input.scenario}`);
  }
  return { pass: notes.length === 0 && toolMatched, toolMatched, notes };
}

function dateMatches(call: ObservedCall | undefined, explicitDate: string | null): boolean {
  if (!explicitDate) {
    return false;
  }
  const data = readData(call?.arguments);
  return data === explicitDate;
}

function inventedDate(call: ObservedCall, explicitDate: string | null): boolean {
  const data = readData(call.arguments);
  if (data === null || !/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return false;
  }
  return data !== explicitDate;
}

function readData(value: unknown): string | null {
  const record = asRecord(value);
  if (!record) {
    return null;
  }
  return typeof record.data === "string" ? record.data : null;
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
