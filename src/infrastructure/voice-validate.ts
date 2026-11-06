import fs from "node:fs";
import path from "node:path";
import { evaluateWav, sha256, type AcousticTake } from "../domain/acoustic.js";
import { AppError } from "../domain/errors.js";

export const SESSOES_VALIDAVEIS = ["01", "02", "03"] as const;

const PAPEIS: Record<(typeof SESSOES_VALIDAVEIS)[number], "treino" | "validacao"> = {
  "01": "treino",
  "02": "treino",
  "03": "validacao",
};

export interface SessionValidation {
  sessao: string;
  papel: "treino" | "validacao";
  duracaoEsperadaSegundos: number;
  tomadasPlanejadas: number;
  tomadasEncontradas: number;
  tomadas: AcousticTake[];
  hashesAntes: string[];
  hashesDepois: string[];
  arquivosIntactos: boolean;
}

export interface AcousticReport {
  criterio: string;
  ganhoDeCaptura: {
    valorMedido: number | null;
    informadoPorAirton: string | null;
    registradoNoManifesto: boolean;
  };
  sessoes: SessionValidation[];
  aprovadas: number;
  reprovadas: number;
  observacao: string;
}

export function validateSessions(voiceDir: string, sessoes: readonly string[]): AcousticReport {
  for (const sessao of sessoes) {
    if (sessao === "04") {
      throw new AppError("A sessão 04 é o teste reservado. Esta validação não abre esses arquivos.", "validation");
    }
    if (!SESSOES_VALIDAVEIS.includes(sessao as (typeof SESSOES_VALIDAVEIS)[number])) {
      throw new AppError("A validação acústica aceita apenas as sessões 01, 02 e 03.", "validation");
    }
  }
  const plano = lerPlano(voiceDir);
  const sessoesRelatorio = sessoes.map((sessao) => validarUma(voiceDir, sessao, plano[sessao] ?? { segundos: 4, vezes: 0 }));
  const tomadas = sessoesRelatorio.flatMap((sessao) => sessao.tomadas);
  return {
    criterio: "16 kHz mono PCM 16; duração da sessão com tolerância de 0,25 s; saturação em 32767; atividade e bordas de 150 ms com RMS 250, como na coleta.",
    ganhoDeCaptura: lerGanho(voiceDir),
    sessoes: sessoesRelatorio,
    aprovadas: tomadas.filter((tomada) => tomada.aprovadaAcusticamente).length,
    reprovadas: tomadas.filter((tomada) => !tomada.aprovadaAcusticamente).length,
    observacao: "Aprovação acústica não afirma que a palavra esteja completa nem que a fala seja MOAH.",
  };
}

function validarUma(
  voiceDir: string,
  sessao: string,
  previsto: { segundos: number; vezes: number },
): SessionValidation {
  const papel = PAPEIS[sessao as keyof typeof PAPEIS];
  if (!papel) {
    throw new AppError("A validação acústica aceita apenas as sessões 01, 02 e 03.", "validation");
  }
  const pasta = path.join(voiceDir, "coleta", "sessoes", `sessao-${sessao}`);
  const nomes = fs.existsSync(pasta)
    ? fs.readdirSync(pasta).filter((nome) => nome.endsWith(".wav")).sort()
    : [];
  const caminhos = nomes.map((nome) => path.join(pasta, nome));
  const antes = caminhos.map((arquivo) => sha256(fs.readFileSync(arquivo)));
  const tomadas = caminhos.map((arquivo, indice) => {
    const bytes = fs.readFileSync(arquivo);
    if (sha256(bytes) !== antes[indice]) {
      throw new AppError(`O arquivo ${path.basename(arquivo)} mudou durante a leitura.`, "conflict");
    }
    return evaluateWav(bytes, path.basename(arquivo), previsto.segundos);
  });
  const depois = caminhos.map((arquivo) => sha256(fs.readFileSync(arquivo)));
  return {
    sessao,
    papel,
    duracaoEsperadaSegundos: previsto.segundos,
    tomadasPlanejadas: previsto.vezes,
    tomadasEncontradas: tomadas.length,
    tomadas,
    hashesAntes: antes,
    hashesDepois: depois,
    arquivosIntactos: antes.every((hash, indice) => hash === depois[indice] && hash === tomadas[indice]?.sha256),
  };
}

function lerGanho(voiceDir: string): AcousticReport["ganhoDeCaptura"] {
  const ganho: AcousticReport["ganhoDeCaptura"] = {
    valorMedido: null,
    informadoPorAirton: "85%",
    registradoNoManifesto: false,
  };
  const manifesto = path.join(voiceDir, "correcao", "plano-sessoes.json");
  if (!fs.existsSync(manifesto)) {
    return ganho;
  }
  const plano = JSON.parse(fs.readFileSync(manifesto, "utf8")) as {
    ganhoDeCaptura?: { valorMedido?: unknown; informadoPorAirton?: unknown };
  };
  if (!plano.ganhoDeCaptura) {
    return ganho;
  }
  ganho.registradoNoManifesto = true;
  if (typeof plano.ganhoDeCaptura.valorMedido === "number") {
    ganho.valorMedido = plano.ganhoDeCaptura.valorMedido;
  }
  if (typeof plano.ganhoDeCaptura.informadoPorAirton === "string" && plano.ganhoDeCaptura.informadoPorAirton.trim()) {
    ganho.informadoPorAirton = plano.ganhoDeCaptura.informadoPorAirton.trim();
  }
  return ganho;
}

function lerPlano(voiceDir: string): Record<string, { segundos: number; vezes: number }> {
  const saida: Record<string, { segundos: number; vezes: number }> = {
    "01": { segundos: 4, vezes: 10 },
    "02": { segundos: 4, vezes: 10 },
    "03": { segundos: 4, vezes: 8 },
  };
  const manifesto = path.join(voiceDir, "correcao", "plano-sessoes.json");
  if (!fs.existsSync(manifesto)) {
    return saida;
  }
  const plano = JSON.parse(fs.readFileSync(manifesto, "utf8")) as {
    sessoes?: Array<{ id?: string; segundos?: number; vezes?: number }>;
  };
  for (const sessao of plano.sessoes ?? []) {
    if (sessao.id === "04" || !sessao.id || !(sessao.id in saida)) {
      continue;
    }
    const atual = saida[sessao.id];
    if (!atual) {
      continue;
    }
    if (typeof sessao.segundos === "number" && sessao.segundos > 0) {
      atual.segundos = sessao.segundos;
    }
    if (typeof sessao.vezes === "number" && sessao.vezes > 0) {
      atual.vezes = sessao.vezes;
    }
  }
  return saida;
}
