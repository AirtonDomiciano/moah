#!/usr/bin/env python3
"""Gera clipes sintéticos só para a avaliação, fora das pastas de treino."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


GRUPOS = {
    "saudacao": ["estou aqui", "estou aqui."],
    "parecidas": ["boa", "noah", "moa", "ola", "agora", "moda", "boa noite"],
    "conversa": ["onde paramos no trabalho", "vamos continuar amanha", "pode repetir isso"],
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", required=True)
    parser.add_argument("--recursos", required=True)
    parser.add_argument("--por-frase", type=int, default=4)
    args = parser.parse_args()
    gerador = Path(args.recursos) / "hey_pran_piper_generator"
    sys.path.insert(0, str(gerador))
    from generate_samples import generate_samples

    raiz = Path(args.saida) / "gerado"
    for nome, frases in GRUPOS.items():
        destino = raiz / nome
        destino.mkdir(parents=True, exist_ok=True)
        if any(destino.glob("*.wav")):
            continue
        generate_samples(
            text=frases,
            output_dir=str(destino),
            max_samples=args.por_frase * len(frases),
            batch_size=4,
            noise_scales=[0.7],
            noise_scale_ws=[0.7],
            length_scales=[1.0],
            auto_reduce_batch_size=True,
        )
        print(nome, len(list(destino.glob("*.wav"))), flush=True)


if __name__ == "__main__":
    main()
