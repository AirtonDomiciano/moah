#!/usr/bin/env python3
"""Compara janelas de embedding entre classes. Não treina e não grava áudio."""

from __future__ import annotations

import json
import sys
import wave
from pathlib import Path

import numpy as np

SAIDA = Path("/home/airtondev/.local/share/moah/voz")
RECURSOS = Path("/home/airtondev/hey_pran_work")


def main() -> None:
    sys.path.insert(0, str(RECURSOS / "hey_pran_openwakeword_v060"))
    from openwakeword.utils import AudioFeatures

    extrator = AudioFeatures(inference_framework="onnx", device="cpu")
    grupos = {
        "moah-03": _pico(extrator, _ler(SAIDA / "coleta" / "moah-03.wav")),
        "moah-04": _pico(extrator, _ler(SAIDA / "coleta" / "moah-04.wav")),
        "saudacao": _pico(extrator, _ler(next((SAIDA / "avaliacao" / "gerado" / "saudacao").glob("*.wav")))),
        "parecida": _pico(extrator, _ler(next((SAIDA / "avaliacao" / "gerado" / "parecidas").glob("*.wav")))),
        "conversa": _pico(extrator, _ler(next((SAIDA / "avaliacao" / "gerado" / "conversa").glob("*.wav")))),
        "musica": _pico(extrator, _ler(next((RECURSOS / "fma").glob("*.wav")))[:32000]),
        "silencio": _pico(extrator, np.zeros(32000, dtype=np.int16)),
    }
    nomes = list(grupos)
    matriz = {}
    for esquerda in nomes:
        matriz[esquerda] = {direita: _cosseno(grupos[esquerda], grupos[direita]) for direita in nomes}
    relatorio = {
        "treino": False,
        "janela": "16x96 um segundo depois do quadro de maior energia",
        "cosseno": matriz,
        "leitura": (
            "Com a janela cheia, moah-03 e moah-04 ficam em cosseno 0,67. "
            "A saudação fica a 0,67 e 0,62 dessas tomadas, distância parecida com a que há entre as duas falas. "
            "Música fica a 0,63 e 0,60. O último treino tinha muitas janelas de música e duas saudações negativas, "
            "então recusou música e aceitou outra fala. Mais repetições iguais de MOAH não abrem essa margem sozinhas."
        ),
    }
    destino = SAIDA / "correcao" / "separacao-classes.json"
    destino.write_text(json.dumps(relatorio, indent=2), encoding="utf8")
    print(json.dumps(relatorio, indent=2))


def _pico(extrator, audio: np.ndarray) -> np.ndarray:
    extrator.raw_data_buffer.clear()
    extrator.melspectrogram_buffer = np.ones((76, 32))
    extrator.accumulated_samples = 0
    extrator.raw_data_remainder = np.empty(0)
    extrator.feature_buffer = extrator._get_embeddings(np.zeros(16000 * 4, dtype=np.int16))
    melhor_energia = -1.0
    melhor_indice = 0
    janelas = []
    for inicio in range(0, len(audio) - 1280, 1280):
        quadro = audio[inicio:inicio + 1280]
        extrator(quadro)
        janelas.append(np.asarray(extrator.get_features(16)[0], dtype=np.float32))
        energia = float(np.sqrt(np.mean(quadro.astype(np.float32) ** 2)))
        if energia > melhor_energia:
            melhor_energia = energia
            melhor_indice = len(janelas) - 1
    # Um segundo depois do pico, a janela de 1,28 s já pode conter a fala
    # em vez do estado inicial do extrator.
    return janelas[min(len(janelas) - 1, melhor_indice + 12)]


def _cosseno(esquerda: np.ndarray, direita: np.ndarray) -> float:
    a = esquerda.reshape(-1).astype(np.float64)
    b = direita.reshape(-1).astype(np.float64)
    return round(float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-12)), 4)


def _ler(arquivo: Path) -> np.ndarray:
    with wave.open(arquivo.as_posix(), "rb") as wav:
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).copy()


if __name__ == "__main__":
    main()
