#!/usr/bin/env python3
"""Mede o modelo já treinado em áudios que não entraram no ajuste.

Não altera pesos e não envia áudio para fora da máquina.
"""

from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path

import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--modelo", required=True)
    parser.add_argument("--recursos", required=True)
    parser.add_argument("--avaliacao", required=True)
    parser.add_argument("--limiar", type=float, default=0.5)
    args = parser.parse_args()
    sys.path.insert(0, str(Path(args.recursos) / "hey_pran_openwakeword_v060"))
    from openwakeword.model import Model

    modelo = Path(args.modelo)
    pasta = Path(args.avaliacao)
    detector = Model(wakeword_models=[str(modelo)], inference_framework="onnx", vad_threshold=0)
    chave = next(iter(detector.models))
    grupos: dict[str, list[float]] = {}
    reservados = pasta / "reservados.txt"
    if reservados.exists():
        for caminho in reservados.read_text(encoding="utf8").splitlines():
            if not caminho:
                continue
            grupo = "musica" if "/fma/" in caminho else "ambiente"
            grupos.setdefault(grupo, []).append(_pico(detector, chave, Path(caminho)))
    for arquivo in sorted(pasta.glob("gerado/**/*.wav")):
        grupos.setdefault(arquivo.parent.name, []).append(_pico(detector, chave, arquivo))
    resumo = {
        grupo: {
            "amostras": len(valores),
            "pico": round(max(valores), 4) if valores else 0,
            "acimaDoLimiar": sum(valor >= args.limiar for valor in valores),
        }
        for grupo, valores in sorted(grupos.items())
    }
    destino = pasta / "resultado.json"
    destino.write_text(json.dumps({"limiar": args.limiar, "grupos": resumo, "ajuste": False}, indent=2), encoding="utf8")
    print(destino.read_text(encoding="utf8"))


def _pico(detector, chave: str, arquivo: Path) -> float:
    with wave.open(arquivo.as_posix(), "rb") as wav:
        if wav.getframerate() != 16000 or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise SystemExit(f"Formato inesperado em {arquivo.name}.")
        amostras = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16)
    pico = 0.0
    for inicio in range(0, len(amostras) - 1280, 1280):
        pico = max(pico, float(detector.predict(amostras[inicio:inicio + 1280]).get(chave, 0.0)))
    return pico


if __name__ == "__main__":
    main()
