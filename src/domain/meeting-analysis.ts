export interface MeetingAnalysis {
  resumo: string;
  assuntos: string[];
  decisoes: string[];
  regrasRelatadas: Array<{ texto: string; confirmada: boolean }>;
  sugestoes: string[];
  duvidas: string[];
  acoes: Array<{ descricao: string; responsavel: string | null; prazo: string | null }>;
}

export function parseAnalysisJson(text: string): { ok: true; value: MeetingAnalysis } | { ok: false; reason: string } {
  const raw = unwrapFence(text.trim());
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    return { ok: false, reason: "A análise não é JSON válido." };
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, reason: "A análise precisa ser um objeto." };
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.resumo !== "string") {
    return { ok: false, reason: "A análise não tem resumo textual." };
  }
  try {
    return {
      ok: true,
      value: {
        resumo: record.resumo.trim(),
        assuntos: stringList(record.assuntos, "assuntos"),
        decisoes: stringList(record.decisoes, "decisoes"),
        regrasRelatadas: rules(record.regrasRelatadas),
        sugestoes: stringList(record.sugestoes, "sugestoes"),
        duvidas: stringList(record.duvidas, "duvidas"),
        acoes: actions(record.acoes),
      },
    };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : "Análise inválida." };
  }
}

function unwrapFence(text: string): string {
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(text);
  return fenced?.[1] ?? text;
}

function stringList(value: unknown, name: string): string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${name} precisa ser uma lista.`);
  }
  return value.map((item) => {
    if (typeof item !== "string" || item.trim() === "") {
      throw new Error(`${name} contém item vazio ou não textual.`);
    }
    return item.trim();
  });
}

function rules(value: unknown): MeetingAnalysis["regrasRelatadas"] {
  if (!Array.isArray(value)) {
    throw new Error("regrasRelatadas precisa ser uma lista.");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("Regra relatada inválida.");
    }
    const record = item as Record<string, unknown>;
    if (typeof record.texto !== "string" || record.texto.trim() === "" || typeof record.confirmada !== "boolean") {
      throw new Error("Regra relatada precisa de texto e confirmada booleana.");
    }
    return { texto: record.texto.trim(), confirmada: record.confirmada };
  });
}

function actions(value: unknown): MeetingAnalysis["acoes"] {
  if (!Array.isArray(value)) {
    throw new Error("acoes precisa ser uma lista.");
  }
  return value.map((item) => {
    if (typeof item !== "object" || item === null) {
      throw new Error("Ação candidata inválida.");
    }
    const record = item as Record<string, unknown>;
    if (typeof record.descricao !== "string" || record.descricao.trim() === "") {
      throw new Error("Ação candidata sem descrição.");
    }
    return {
      descricao: record.descricao.trim(),
      responsavel: optionalText(record.responsavel),
      prazo: optionalText(record.prazo),
    };
  });
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "string") {
    throw new Error("Campo opcional da ação não é texto.");
  }
  return value.trim();
}
