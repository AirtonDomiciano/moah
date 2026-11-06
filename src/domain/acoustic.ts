import { createHash } from "node:crypto";

/** Critérios iguais aos de scripts/voz/coletar.py. Não afrouxar para aprovar arquivo. */
export const SAMPLE_RATE = 16_000;
export const ACTIVITY_RMS = 250;
export const HOP_SAMPLES = 800;
export const EDGE_HOPS = 3;
export const DURATION_TOLERANCE_SECONDS = 0.25;

const OBSERVACAO =
  "RMS e silêncio medem a qualidade acústica. Não comprovam que a palavra esteja completa nem que seja MOAH.";

export interface AcousticTake {
  arquivo: string;
  sha256: string;
  bytes: number;
  formatoValido: boolean;
  duracaoSegundos: number | null;
  duracaoEsperadaSegundos: number;
  toleranciaSegundos: number;
  pico: number | null;
  rmsSemDeslocamento: number | null;
  desvioDC: number | null;
  maiorRms50ms: number | null;
  instanteDoMaiorRms: number | null;
  rmsBordaInicio: number | null;
  rmsBordaFim: number | null;
  saturada: boolean;
  atividadeVocal: boolean;
  avisos: string[];
  reprovacoes: string[];
  aprovadaAcusticamente: boolean;
  palavraCompleta: "nao-avaliada";
  observacao: string;
}

export function sha256(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function evaluateWav(bytes: Buffer, arquivo: string, duracaoEsperadaSegundos: number): AcousticTake {
  const digest = sha256(bytes);
  const parsed = parseWav(bytes);
  const avisos = [OBSERVACAO];
  const reprovacoes: string[] = [];
  if (!parsed) {
    reprovacoes.push("O arquivo não é um WAV PCM legível.");
    return resultado(arquivo, digest, bytes.length, duracaoEsperadaSegundos, null, reprovacoes, avisos);
  }
  if (parsed.rate !== SAMPLE_RATE || parsed.channels !== 1 || parsed.bits !== 16) {
    reprovacoes.push("O formato precisa ser 16 kHz, mono, PCM 16 bits.");
  }
  const duracao = parsed.samples.length / SAMPLE_RATE;
  if (Math.abs(duracao - duracaoEsperadaSegundos) > DURATION_TOLERANCE_SECONDS) {
    reprovacoes.push(
      `A duração ${duracao.toFixed(3)} s fica fora de ${duracaoEsperadaSegundos} s com tolerância de ${DURATION_TOLERANCE_SECONDS} s.`,
    );
  }
  const cru = Float64Array.from(parsed.samples);
  let pico = 0;
  let soma = 0;
  let saturada = false;
  for (const amostra of cru) {
    const absoluto = Math.abs(amostra);
    if (absoluto > pico) {
      pico = absoluto;
    }
    if (absoluto >= 32_767) {
      saturada = true;
    }
    soma += amostra;
  }
  if (saturada) {
    reprovacoes.push("Há amostra no teto de 16 bits.");
  }
  const media = cru.length === 0 ? 0 : soma / cru.length;
  let energia = 0;
  for (const amostra of cru) {
    const sem = amostra - media;
    energia += sem * sem;
  }
  const rms = cru.length === 0 ? 0 : Math.sqrt(energia / cru.length);
  const envelope = blocos(cru, media);
  let maior = envelope[0];
  for (const bloco of envelope) {
    if (!maior || bloco.rms > maior.rms) {
      maior = bloco;
    }
  }
  const atividade = maior !== undefined && maior.rms >= ACTIVITY_RMS;
  if (!atividade) {
    reprovacoes.push(`Nenhum bloco de 50 ms alcança RMS ${ACTIVITY_RMS}.`);
  }
  if (envelope.length < 8) {
    reprovacoes.push("A tomada é curta demais para observar as bordas.");
  } else {
    const miolo = mediana(envelope.slice(2, -2).map((bloco) => bloco.rms));
    const limite = Math.max(ACTIVITY_RMS, miolo * 2);
    const inicio = maximo(envelope.slice(0, EDGE_HOPS).map((bloco) => bloco.rms));
    const fim = maximo(envelope.slice(-EDGE_HOPS).map((bloco) => bloco.rms));
    if (inicio > limite) {
      reprovacoes.push("Há atividade acústica nos primeiros 150 ms.");
    }
    if (fim > limite) {
      reprovacoes.push("Há atividade acústica nos últimos 150 ms.");
    }
    return resultado(arquivo, digest, bytes.length, duracaoEsperadaSegundos, {
      formatoValido: reprovacoes.every((motivo) => !motivo.startsWith("O formato")),
      duracao,
      pico,
      rms,
      desvioDC: media,
      maiorRms50ms: maior?.rms ?? 0,
      instanteDoMaiorRms: maior?.instante ?? 0,
      rmsBordaInicio: inicio,
      rmsBordaFim: fim,
      saturada,
      atividadeVocal: atividade,
    }, reprovacoes, avisos);
  }
  return resultado(arquivo, digest, bytes.length, duracaoEsperadaSegundos, {
    formatoValido: reprovacoes.every((motivo) => !motivo.startsWith("O formato")),
    duracao,
    pico,
    rms,
    desvioDC: media,
    maiorRms50ms: maior?.rms ?? 0,
    instanteDoMaiorRms: maior?.instante ?? 0,
    rmsBordaInicio: null,
    rmsBordaFim: null,
    saturada,
    atividadeVocal: atividade,
  }, reprovacoes, avisos);
}

function resultado(
  arquivo: string,
  digest: string,
  bytes: number,
  duracaoEsperadaSegundos: number,
  medidas: {
    formatoValido: boolean;
    duracao: number;
    pico: number;
    rms: number;
    desvioDC: number;
    maiorRms50ms: number;
    instanteDoMaiorRms: number;
    rmsBordaInicio: number | null;
    rmsBordaFim: number | null;
    saturada: boolean;
    atividadeVocal: boolean;
  } | null,
  reprovacoes: string[],
  avisos: string[],
): AcousticTake {
  return {
    arquivo,
    sha256: digest,
    bytes,
    formatoValido: medidas?.formatoValido ?? false,
    duracaoSegundos: medidas ? arredondar(medidas.duracao, 3) : null,
    duracaoEsperadaSegundos,
    toleranciaSegundos: DURATION_TOLERANCE_SECONDS,
    pico: medidas ? Math.round(medidas.pico) : null,
    rmsSemDeslocamento: medidas ? arredondar(medidas.rms, 1) : null,
    desvioDC: medidas ? arredondar(medidas.desvioDC, 1) : null,
    maiorRms50ms: medidas ? arredondar(medidas.maiorRms50ms, 1) : null,
    instanteDoMaiorRms: medidas ? arredondar(medidas.instanteDoMaiorRms, 2) : null,
    rmsBordaInicio: medidas?.rmsBordaInicio === null || medidas?.rmsBordaInicio === undefined
      ? null
      : arredondar(medidas.rmsBordaInicio, 1),
    rmsBordaFim: medidas?.rmsBordaFim === null || medidas?.rmsBordaFim === undefined
      ? null
      : arredondar(medidas.rmsBordaFim, 1),
    saturada: medidas?.saturada ?? false,
    atividadeVocal: medidas?.atividadeVocal ?? false,
    avisos,
    reprovacoes,
    aprovadaAcusticamente: reprovacoes.length === 0,
    palavraCompleta: "nao-avaliada",
    observacao: OBSERVACAO,
  };
}

function parseWav(bytes: Buffer): { rate: number; channels: number; bits: number; samples: Int16Array } | null {
  if (bytes.length < 44 || bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WAVE") {
    return null;
  }
  let offset = 12;
  let rate = 0;
  let channels = 0;
  let bits = 0;
  let audio: Buffer | null = null;
  while (offset + 8 <= bytes.length) {
    const id = bytes.toString("ascii", offset, offset + 4);
    const size = bytes.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + size > bytes.length) {
      return null;
    }
    if (id === "fmt ") {
      channels = bytes.readUInt16LE(start + 2);
      rate = bytes.readUInt32LE(start + 4);
      bits = bytes.readUInt16LE(start + 14);
    } else if (id === "data") {
      audio = bytes.subarray(start, start + size);
    }
    offset = start + size + (size % 2);
  }
  if (!audio || audio.length % 2 !== 0) {
    return null;
  }
  const samples = new Int16Array(audio.length / 2);
  for (let indice = 0; indice < samples.length; indice += 1) {
    samples[indice] = audio.readInt16LE(indice * 2);
  }
  return { rate, channels, bits, samples };
}

function blocos(amostras: Float64Array, media: number): Array<{ rms: number; instante: number }> {
  const saida: Array<{ rms: number; instante: number }> = [];
  for (let inicio = 0; inicio + HOP_SAMPLES <= amostras.length; inicio += HOP_SAMPLES) {
    let energia = 0;
    for (let indice = inicio; indice < inicio + HOP_SAMPLES; indice += 1) {
      const valor = (amostras[indice] ?? 0) - media;
      energia += valor * valor;
    }
    saida.push({ rms: Math.sqrt(energia / HOP_SAMPLES), instante: inicio / SAMPLE_RATE });
  }
  return saida;
}

function mediana(valores: number[]): number {
  if (valores.length === 0) {
    return 0;
  }
  const ordenados = [...valores].sort((a, b) => a - b);
  const meio = Math.floor(ordenados.length / 2);
  const direita = ordenados[meio] ?? 0;
  if (ordenados.length % 2 === 1) {
    return direita;
  }
  return ((ordenados[meio - 1] ?? 0) + direita) / 2;
}

function maximo(valores: number[]): number {
  return valores.reduce((melhor, valor) => Math.max(melhor, valor), 0);
}

function arredondar(valor: number, casas: number): number {
  const fator = 10 ** casas;
  return Math.round(valor * fator) / fator;
}
