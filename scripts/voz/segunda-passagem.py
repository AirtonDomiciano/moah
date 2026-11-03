#!/usr/bin/env python3
"""Segunda passagem sobre características já gravadas.

O auto_train oficial colapsou no score zero. Esta passagem não recarrega os
17 GB, não usa a pasta de avaliação e exporta outro ONNX.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from torch import nn


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", required=True)
    parser.add_argument("--recursos", required=True)
    args = parser.parse_args()
    base = Path(args.saida) / "completo" / "moah"
    positivos = np.array(np.load(base / "positive_features_train.npy", mmap_mode="r"), dtype=np.float32)
    negativos = np.array(np.load(base / "negative_features_train.npy", mmap_mode="r"), dtype=np.float32)
    corte = int(len(positivos) * 0.8)
    acav = np.load(Path(args.recursos) / "openwakeword_features_ACAV100M_2000_hrs_16bit.npy", mmap_mode="r")
    fala = np.array(acav[100_000:108_000], dtype=np.float32)
    treino_x = np.concatenate([positivos[:corte], negativos[:corte], fala], axis=0)
    treino_y = np.concatenate([
        np.ones(corte, dtype=np.float32),
        np.zeros(corte + len(fala), dtype=np.float32),
    ])
    rede = nn.Sequential(
        nn.Flatten(),
        nn.Linear(16 * 96, 32),
        nn.LayerNorm(32),
        nn.ReLU(),
        nn.Linear(32, 32),
        nn.LayerNorm(32),
        nn.ReLU(),
        nn.Linear(32, 1),
        nn.Sigmoid(),
    )
    otimo = torch.optim.Adam(rede.parameters(), lr=1e-3)
    x = torch.from_numpy(treino_x)
    y = torch.from_numpy(treino_y)
    for _ in range(1200):
        indice = torch.randint(0, len(x), (256,))
        previsto = rede(x[indice]).squeeze(1)
        peso = torch.where(y[indice] > 0.5, torch.full_like(y[indice], 6.0), torch.ones_like(y[indice]))
        perda = (peso * nn.functional.binary_cross_entropy(previsto, y[indice], reduction="none")).mean()
        otimo.zero_grad()
        perda.backward()
        otimo.step()
    with torch.no_grad():
        pos = rede(torch.from_numpy(positivos[corte:])).squeeze(1).numpy()
        neg = rede(torch.from_numpy(negativos[corte:])).squeeze(1).numpy()
    destino = Path(args.saida) / "completo" / "moah.onnx"
    oficial = Path(args.saida) / "completo" / "moah-oficial.onnx"
    if destino.exists() and not oficial.exists():
        oficial.write_bytes(destino.read_bytes())
    exemplo = torch.zeros(1, 16, 96)
    torch.onnx.export(rede, exemplo, destino, input_names=["entrada"], output_names=["score"], opset_version=13)
    relatorio = {
        "positivosAcimaDeMeio": int((pos >= 0.5).sum()),
        "positivos": int(len(pos)),
        "negativosAcimaDeMeio": int((neg >= 0.5).sum()),
        "negativos": int(len(neg)),
        "avaliacaoDeAudioUsada": False,
        "modelo": str(destino),
    }
    (Path(args.saida) / "completo" / "segunda-passagem.json").write_text(json.dumps(relatorio, indent=2), encoding="utf8")
    print(json.dumps(relatorio, indent=2))


if __name__ == "__main__":
    main()
