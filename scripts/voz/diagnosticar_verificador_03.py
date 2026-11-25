#!/usr/bin/env python3
"""Diagnóstico dos 8 positivos da sessão 03 para o verificador do 2º estágio."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import wave
from pathlib import Path

import numpy as np
import onnxruntime as ort

QUADRO = 1280
PAD = 16000
LIMIARES = [round(x, 2) for x in np.arange(0.35, 0.96, 0.05)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", default=str(Path.home() / ".local/share/moah/voz"))
    parser.add_argument("--recursos", default="/home/airtondev/hey_pran_work")
    parser.add_argument("--modelo", default="")
    args = parser.parse_args()
    saida = Path(args.saida)
    recursos = Path(args.recursos)
    modelo = Path(args.modelo) if args.modelo else saida / "completo" / "moah-verificador.onnx"
    sys.path.insert(0, str(recursos / "hey_pran_openwakeword_v060"))
    from openwakeword.model import Model
    from openwakeword.utils import AudioFeatures

    sys.path.insert(0, str(Path(__file__).parent))
    from oww_janela import fluxo_escuta, pontuar_trecho, zerar_extrator
    from candidato import _zerar_modelo, _pontuar, PAD_ESCUTA  # type: ignore

    sha = hashlib.sha256(modelo.read_bytes()).hexdigest()
    extrator = AudioFeatures(inference_framework="onnx", device="cpu")
    sessao = ort.InferenceSession(modelo.as_posix(), providers=["CPUExecutionProvider"])
    oww = Model(wakeword_models=[modelo.as_posix()], inference_framework="onnx", vad_threshold=0)
    chave = modelo.stem

    acustica = json.loads((saida / "correcao" / "validacao-acustica.json").read_text(encoding="utf8"))
    tomadas_meta: dict[str, dict] = {}
    for bloco in acustica.get("sessoes", []):
        if bloco.get("sessao") != "03":
            continue
        for tomada in bloco.get("tomadas", []):
            tomadas_meta[str(tomada["arquivo"])] = tomada

    pasta = saida / "coleta" / "sessoes" / "sessao-03"
    linhas = []
    for arquivo in sorted(pasta.glob("*.wav")):
        audio = _ler(arquivo)
        meta = tomadas_meta.get(arquivo.name, {})
        dur = len(audio) / 16000
        palavra = meta.get("instanteDoMaiorRms")
        padded = np.concatenate((np.zeros(PAD, dtype=np.int16), audio))

        zerar_extrator(extrator)
        score_fluxo, idx, fim_s = pontuar_trecho(sessao, extrator, audio)
        itens = fluxo_escuta(extrator, audio, pad=True)
        scores_janelas = [_onnx(sessao, item["features"]) for item in itens]
        janela_treino = _janela_treino_fixo(extrator, audio)
        score_alinhamento = _onnx(sessao, janela_treino)

        _zerar_modelo(oww)
        serie_oww = _pontuar(oww, chave, padded)
        pico_oww = max(serie_oww) if serie_oww else 0.0

        linhas.append(
            {
                "arquivo": arquivo.name,
                "rotulo": "positivo_sessao_03_validacao",
                "duracaoSegundos": round(dur, 3),
                "instanteMaiorRmsSegundos": palavra,
                "scoreMaxFluxoEscuta": round(score_fluxo, 6),
                "indiceJanelaVencedora": idx,
                "scoreAlinhamentoTreinoFixo": round(score_alinhamento, 6),
                "picoOpenWakeWordModel": round(pico_oww, 6),
                "limiaresAcima": {str(l): bool(score_fluxo >= l) for l in LIMIARES},
                "minScoreJanelas": round(min(scores_janelas), 6),
                "maxScoreJanelas": round(max(scores_janelas), 6),
            }
        )

    relatorio = {
        "modelo": modelo.as_posix(),
        "sha256": sha,
        "identidade": _identidade(saida, sha),
        "equivalencia": {
            "pcm": "int16 mono 16 kHz, sem reescala no classificador; padding 1 s de zeros antes do fluxo",
            "embeddings": "AudioFeatures.get_features(16)[0] shape (16,96) float32",
            "janelaInferencia": "max sobre quadros 1280 com pad=true (fluxo_escuta)",
            "janelaAvaliacaoCandidato": "fixo: pad 1s + audio em slot [1s,3s] alinhamento treino (diagnosticar)",
            "saidaOnnx": "probabilidade (Sigmoid na exportação); alvo 1=MOAH, 0=negativo",
            "owwModelNoMesmoOnnx": "openWakeWord.Model no mesmo arquivo — caminho distinto do classificador",
        },
        "tomadas": linhas,
        "resumoLimiares": _resumo(linhas),
    }
    print(json.dumps(relatorio, indent=2, ensure_ascii=False))


def _identidade(saida: Path, sha: str) -> dict:
    mapa = {}
    for nome in ("moah-verificador.onnx", "moah-candidato-fundo.onnx", "moah-candidato.onnx", "moah-candidato-49ac8909.onnx"):
        caminho = saida / "completo" / nome
        if caminho.is_file():
            mapa[nome] = hashlib.sha256(caminho.read_bytes()).hexdigest()
    treino = saida / "correcao" / "candidato-treino.json"
    papel = None
    if treino.is_file():
        papel = json.loads(treino.read_text(encoding="utf8")).get("papel")
    return {
        "sha256Verificador": sha,
        "arquivosCompleto": mapa,
        "geradoPor": "scripts/voz/candidato.py treinar → moah-candidato-fundo.onnx; cópia para moah-verificador.onnx",
        "papelTreino": papel,
        "independencia": "AudioFeatures compartilhado; classificador MLP 16×96→sigmoid é independente do moah-experimental.onnx (wake)",
    }


def _resumo(linhas: list[dict]) -> dict:
    out = {}
    for limiar in LIMIARES:
        acertos = sum(1 for item in linhas if item["scoreMaxFluxoEscuta"] >= limiar)
        out[str(limiar)] = acertos
    return {"acertosPorLimiar": out, "total": len(linhas)}


def _janela_treino_fixo(extrator, audio: np.ndarray) -> np.ndarray:
    from candidato import _zerar  # type: ignore

    _zerar(extrator)
    fixo = np.zeros(16000 + 32000, dtype=np.int16)
    fixo[16000 : 16000 + min(len(audio), 32000)] = audio[:32000]
    for inicio in range(0, len(fixo) - QUADRO + 1, QUADRO):
        extrator(fixo[inicio : inicio + QUADRO])
    return np.asarray(extrator.get_features(16)[0], dtype=np.float32)


def _onnx(sessao, janela: np.ndarray) -> float:
    nome = sessao.get_inputs()[0].name
    return float(sessao.run(None, {nome: janela[None, ...].astype(np.float32)})[0].reshape(-1)[0])


def _ler(arquivo: Path) -> np.ndarray:
    with wave.open(arquivo.as_posix(), "rb") as wav:
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).copy()


if __name__ == "__main__":
    main()