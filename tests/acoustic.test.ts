import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { evaluateWav, SAMPLE_RATE, sha256 } from "../src/domain/acoustic.js";
import { validateSessions } from "../src/infrastructure/voice-validate.js";
import { cliWorkspace, runCli, tempDir } from "./helpers.js";

const RAIZ = fileURLToPath(new URL("../..", import.meta.url));

function amostras(segundos: number, valor: (indice: number) => number): Int16Array {
  const total = Math.round(SAMPLE_RATE * segundos);
  const saida = new Int16Array(total);
  for (let indice = 0; indice < total; indice += 1) {
    saida[indice] = valor(indice);
  }
  return saida;
}

function fala(inicio: number, fim: number): (indice: number) => number {
  return (indice) => {
    const instante = indice / SAMPLE_RATE;
    if (instante < inicio || instante >= fim) {
      return 0;
    }
    return Math.round(Math.sin((2 * Math.PI * 220 * indice) / SAMPLE_RATE) * 8_000);
  };
}

function wav(samples: Int16Array, taxa = SAMPLE_RATE): Buffer {
  const dados = Buffer.alloc(samples.length * 2);
  for (let indice = 0; indice < samples.length; indice += 1) {
    dados.writeInt16LE(samples[indice] ?? 0, indice * 2);
  }
  const cabecalho = Buffer.alloc(44);
  cabecalho.write("RIFF", 0);
  cabecalho.writeUInt32LE(36 + dados.length, 4);
  cabecalho.write("WAVE", 8);
  cabecalho.write("fmt ", 12);
  cabecalho.writeUInt32LE(16, 16);
  cabecalho.writeUInt16LE(1, 20);
  cabecalho.writeUInt16LE(1, 22);
  cabecalho.writeUInt32LE(taxa, 24);
  cabecalho.writeUInt32LE(taxa * 2, 28);
  cabecalho.writeUInt16LE(2, 32);
  cabecalho.writeUInt16LE(16, 34);
  cabecalho.write("data", 36);
  cabecalho.writeUInt32LE(dados.length, 40);
  return Buffer.concat([cabecalho, dados]);
}

function gravar(diretorio: string, sessao: string, nome: string, conteudo: Buffer): string {
  const pasta = path.join(diretorio, "coleta", "sessoes", `sessao-${sessao}`);
  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, nome);
  fs.writeFileSync(arquivo, conteudo);
  return arquivo;
}

test("a duração de 4 s aceita a folga e a de 2 s continua no próprio critério", () => {
  const quatro = evaluateWav(wav(amostras(4, fala(1, 1.6))), "quatro.wav", 4);
  const quase = evaluateWav(wav(amostras(3.8, fala(1, 1.5))), "quase.wav", 4);
  const longe = evaluateWav(wav(amostras(3.74, fala(1, 1.5))), "longe.wav", 4);
  const legado = evaluateWav(wav(amostras(2, fala(0.6, 1.1))), "legado.wav", 2);
  const legadoNoLugarErrado = evaluateWav(wav(amostras(2, fala(0.6, 1.1))), "curta.wav", 4);
  const quatroNoLugarErrado = evaluateWav(wav(amostras(4, fala(1, 1.6))), "longa.wav", 2);
  assert.equal(quatro.aprovadaAcusticamente, true);
  assert.equal(quase.aprovadaAcusticamente, true);
  assert.equal(longe.aprovadaAcusticamente, false);
  assert.match(longe.reprovacoes.join(" "), /duração/);
  assert.equal(legado.aprovadaAcusticamente, true);
  assert.equal(legadoNoLugarErrado.aprovadaAcusticamente, false);
  assert.equal(quatroNoLugarErrado.aprovadaAcusticamente, false);
  assert.equal(quatro.palavraCompleta, "nao-avaliada");
});

test("silêncio, saturação e bordas reprovam sem aprovar o arquivo", () => {
  const silencio = evaluateWav(wav(amostras(4, () => 0)), "silencio.wav", 4);
  const saturada = amostras(4, fala(1, 1.6));
  saturada[20_000] = 32_767;
  const teto = evaluateWav(wav(saturada), "teto.wav", 4);
  const inicio = evaluateWav(wav(amostras(4, fala(0, 0.2))), "inicio.wav", 4);
  const fim = evaluateWav(wav(amostras(4, fala(3.85, 4))), "fim.wav", 4);
  assert.equal(silencio.atividadeVocal, false);
  assert.equal(silencio.aprovadaAcusticamente, false);
  assert.equal(teto.saturada, true);
  assert.equal(teto.aprovadaAcusticamente, false);
  assert.match(inicio.reprovacoes.join(" "), /primeiros 150 ms/);
  assert.match(fim.reprovacoes.join(" "), /últimos 150 ms/);
  for (const tomada of [silencio, teto, inicio, fim]) {
    assert.equal(tomada.palavraCompleta, "nao-avaliada");
    assert.match(tomada.observacao, /Não comprovam/);
  }
});

test("a validação não altera os bytes do WAV", () => {
  const voz = tempDir("moah-acustica-");
  const original = wav(amostras(4, fala(1, 1.6)));
  const arquivo = gravar(voz.dir, "01", "tomada-01.wav", original);
  const antes = fs.readFileSync(arquivo);
  const relatorio = validateSessions(voz.dir, ["01"]);
  const depois = fs.readFileSync(arquivo);
  assert.deepEqual(depois, antes);
  assert.equal(relatorio.sessoes[0]?.arquivosIntactos, true);
  assert.equal(relatorio.sessoes[0]?.hashesAntes[0], sha256(original));
  assert.equal(relatorio.sessoes[0]?.hashesDepois[0], sha256(depois));
  assert.equal(relatorio.sessoes[0]?.tomadas[0]?.aprovadaAcusticamente, true);
  voz.cleanup();
});

test("o comando recusa a sessão 04 e não inclui o arquivo reservado", () => {
  const espaco = cliWorkspace();
  const voz = tempDir("moah-acustica-cli-");
  const reservado = wav(amostras(4, fala(1, 1.6)));
  const arquivo = gravar(voz.dir, "04", "tomada-01.wav", reservado);
  const antes = sha256(fs.readFileSync(arquivo));
  const recusa = runCli(["voz", "validar", "--sessao", "04"], {
    ...espaco.env,
    MOAH_VOICE_DIR: voz.dir,
  });
  assert.equal(recusa.status, 1);
  assert.match(recusa.stderr, /sessão 04/);
  assert.equal(sha256(fs.readFileSync(arquivo)), antes);
  assert.equal(recusa.stdout.includes(antes), false);
  espaco.cleanup();
  voz.cleanup();
});

test("o comando de validação devolve métricas e preserva a tomada", () => {
  const espaco = cliWorkspace();
  const voz = tempDir("moah-acustica-cmd-");
  const original = wav(amostras(4, fala(1, 1.6)));
  const arquivo = gravar(voz.dir, "02", "tomada-01.wav", original);
  const resultado = runCli(["voz", "validar", "--sessao", "02"], {
    ...espaco.env,
    MOAH_VOICE_DIR: voz.dir,
  });
  assert.equal(resultado.status, 0, resultado.stderr);
  const relatorio = JSON.parse(resultado.stdout) as {
    sessoes: Array<{ papel: string; tomadas: Array<{ sha256: string; palavraCompleta: string }> }>;
    ganhoDeCaptura: { valorMedido: null; informadoPorAirton: string };
  };
  assert.equal(relatorio.sessoes[0]?.papel, "treino");
  assert.equal(relatorio.sessoes[0]?.tomadas[0]?.sha256, sha256(original));
  assert.equal(relatorio.sessoes[0]?.tomadas[0]?.palavraCompleta, "nao-avaliada");
  assert.equal(relatorio.ganhoDeCaptura.valorMedido, null);
  assert.equal(relatorio.ganhoDeCaptura.informadoPorAirton, "85%");
  assert.deepEqual(fs.readFileSync(arquivo), original);
  espaco.cleanup();
  voz.cleanup();
});

test("o validador não importa treino nem PyTorch", () => {
  const arquivos = [
    path.join(RAIZ, "src/domain/acoustic.ts"),
    path.join(RAIZ, "src/infrastructure/voice-validate.ts"),
  ];
  for (const arquivo of arquivos) {
    const texto = fs.readFileSync(arquivo, "utf8");
    assert.doesNotMatch(texto, /torch|pytorch|corrigir-tomadas|onnx/i);
  }
});
