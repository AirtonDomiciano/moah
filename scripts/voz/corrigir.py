#!/usr/bin/env python3
"""Diagnostica o modelo zerado e treina outro sem usar a avaliação final.

As oito tomadas reais são divididas antes de qualquer score: 01–05 treinam,
06–08 ficam só para a medição posterior.
"""

from __future__ import annotations

import json
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np
import onnxruntime as ort
import torch
from torch import nn

LIMIAR = 0.5
TREINO_REAL = [f"moah-{indice:02d}.wav" for indice in range(1, 6)]
AVALIACAO_REAL = [f"moah-{indice:02d}.wav" for indice in range(6, 9)]


def main() -> None:
    saida = Path("/home/airtondev/.local/share/moah/voz")
    recursos = Path("/home/airtondev/hey_pran_work")
    import sys
    sys.path.insert(0, str(recursos / "hey_pran_openwakeword_v060"))
    from openwakeword.utils import AudioFeatures

    completo = saida / "completo"
    experimental = completo / "moah-experimental.onnx"
    if not experimental.exists():
        experimental.write_bytes((completo / "moah.onnx").read_bytes())
    diagnostico = _diagnosticar(completo)
    manifesto = {
        "treinoReal": TREINO_REAL,
        "avaliacaoReal": AVALIACAO_REAL,
        "limiar": LIMIAR,
        "avaliacaoUsadaNoAjuste": False,
    }
    (saida / "correcao").mkdir(exist_ok=True)
    (saida / "correcao" / "manifesto.json").write_text(json.dumps(manifesto, indent=2), encoding="utf8")
    extrator = AudioFeatures(inference_framework="onnx", device="cpu")
    positivos, negativos, compat = _montar(saida, recursos, extrator)
    rede = _treinar(positivos, negativos)
    destino = completo / "moah-corrigido.onnx"
    torch.onnx.export(
        rede,
        torch.zeros(1, 16, 96),
        destino,
        input_names=["entrada"],
        output_names=["score"],
        opset_version=13,
    )
    relatorio = {
        "diagnostico": diagnostico,
        "compatibilidade": compat,
        "positivosDeTreino": int(len(positivos)),
        "negativosDeTreino": int(len(negativos)),
        "limiar": LIMIAR,
        "modeloExperimental": str(experimental),
        "modeloCorrigido": str(destino),
        "avaliacaoUsadaNoAjuste": False,
    }
    (saida / "correcao" / "treino.json").write_text(json.dumps(relatorio, indent=2), encoding="utf8")
    print(json.dumps(relatorio, indent=2))


def _diagnosticar(completo: Path) -> dict[str, object]:
    oficial = completo / "moah-oficial.onnx"
    positivos = np.load(completo / "moah" / "positive_features_train.npy", mmap_mode="r")
    sessao = ort.InferenceSession(oficial.as_posix(), providers=["CPUExecutionProvider"])
    nome = sessao.get_inputs()[0].name
    amostras = []
    for linha in np.asarray(positivos[:8], dtype=np.float32):
        valor = sessao.run(None, {nome: linha[None, ...]})[0].reshape(-1)[0]
        amostras.append(round(float(valor), 6))
    return {
        "modelo": oficial.name,
        "scoresEmPositivosDeTreino": amostras,
        "maximo": max(amostras),
        "causa": (
            "O auto_train eleva o peso dos negativos até 1500 e só guarda checkpoints "
            "do fim do treino. A média desses checkpoints fica saturada no negativo. "
            "As características continuam separáveis; o arquivo exportado é que responde perto de zero."
        ),
        "rotuloDeMusicaEAmbiente": (
            "No treino oficial, música e ambiente só entram misturados ao fundo dos clipes. "
            "Não há uma classe negativa só com esses sons. A segunda passagem também treinou "
            "apenas fala, por isso o modelo experimental os aceita."
        ),
    }


def _montar(saida: Path, recursos: Path, extrator) -> tuple[np.ndarray, np.ndarray, dict[str, object]]:
    reservados = set((saida / "avaliacao" / "reservados.txt").read_text(encoding="utf8").split())
    reais = []
    for nome in TREINO_REAL:
        audio = _ler(saida / "coleta" / nome)
        for ganho in (0.8, 1.0, 1.2):
            reais.append(_janela(extrator, np.clip(audio * ganho, -32767, 32767).astype(np.int16)))
    reais_empilhados = np.stack(reais)
    reais_repetidos = np.vstack([reais_empilhados for _ in range(8)])
    sinteticos = [
        _janela(extrator, _ler(arquivo))
        for arquivo in sorted((saida / "completo" / "moah" / "positive_train").glob("*.wav"))[:120]
    ]
    positivos = np.vstack((reais_repetidos, np.stack(sinteticos)))
    musica = _amostras(recursos / "fma", reservados, extrator, 80)
    ambiente = _amostras(recursos / "audioset_16k", reservados, extrator, 80)
    parecidas = [
        _janela(extrator, _ler(arquivo))
        for arquivo in sorted((saida / "completo" / "moah" / "negative_train").glob("*.wav"))[:40]
    ]
    saudacao = [_janela(extrator, _espeak(frase)) for frase in ("estou aqui.", "estou aqui")]
    silencio = [_janela(extrator, np.zeros(32000, dtype=np.int16)) for _ in range(8)]
    ruido = _janela(extrator, np.random.default_rng(20261103).normal(0, 80, 32000).astype(np.int16))
    negativos = np.vstack((musica, ambiente, np.stack(parecidas), np.stack(saudacao), np.stack(silencio), ruido[None, :]))
    return positivos, negativos, {
        "amostragem": "16000 Hz, mono, int16",
        "janela": "16 embeddings de 96, os mesmos 80 ms da execução",
        "extracao": "fluxo contínuo do AudioFeatures, igual ao predict",
        "tomadasReaisDeTreino": TREINO_REAL,
        "repeticoesDaMesmaTomada": 8,
        "musicaRotuladaNegativa": int(len(musica)),
        "ambienteRotuladoNegativo": int(len(ambiente)),
        "saudacaoRotuladaNegativa": len(saudacao),
        "sinteticosPositivosPeloMesmoFluxo": len(sinteticos),
        "reservadosForaDoTreino": True,
    }


def _treinar(positivos: np.ndarray, negativos: np.ndarray) -> nn.Module:
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
    x_pos = torch.from_numpy(np.array(positivos, dtype=np.float32))
    x_neg = torch.from_numpy(np.array(negativos, dtype=np.float32))
    for _ in range(700):
        pos = x_pos[torch.randint(0, len(x_pos), (64,))]
        neg = x_neg[torch.randint(0, len(x_neg), (64,))]
        lote = torch.cat((pos, neg))
        alvo = torch.cat((torch.ones(64), torch.zeros(64)))
        perda = nn.functional.binary_cross_entropy(rede(lote).squeeze(1), alvo)
        otimo.zero_grad()
        perda.backward()
        otimo.step()
    rede.eval()
    return rede


def _amostras(pasta: Path, reservados: set[str], extrator, limite: int) -> np.ndarray:
    janelas = []
    for arquivo in sorted(pasta.glob("*.wav")):
        if arquivo.as_posix() in reservados:
            continue
        janelas.append(_janela(extrator, _ler(arquivo)[:32000]))
        if len(janelas) >= limite:
            break
    if len(janelas) < limite:
        raise SystemExit(f"Só havia {len(janelas)} arquivos utilizáveis em {pasta.name}.")
    return np.stack(janelas)


def _espeak(frase: str) -> np.ndarray:
    with tempfile.TemporaryDirectory() as pasta:
        origem = Path(pasta) / "fala.wav"
        subprocess.run(["espeak", "-v", "pt-br", "-s", "140", "-w", origem.as_posix(), frase], check=True, capture_output=True)
        with wave.open(origem.as_posix(), "rb") as wav:
            taxa = wav.getframerate()
            amostras = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32)
            if wav.getnchannels() == 2:
                amostras = amostras.reshape(-1, 2).mean(axis=1)
        destino = np.interp(
            np.linspace(0, len(amostras) - 1, int(len(amostras) * 16000 / taxa)),
            np.arange(len(amostras)),
            amostras,
        )
        return np.clip(destino, -32767, 32767).astype(np.int16)


def _janela(extrator, audio: np.ndarray) -> np.ndarray:
    extrator.raw_data_buffer.clear()
    extrator.melspectrogram_buffer = np.ones((76, 32))
    extrator.accumulated_samples = 0
    extrator.raw_data_remainder = np.empty(0)
    extrator.feature_buffer = extrator._get_embeddings(np.zeros(16000 * 4, dtype=np.int16))
    fixo = np.zeros(16000 + 32000, dtype=np.int16)
    fixo[16000:16000 + min(len(audio), 32000)] = audio[:32000]
    for inicio in range(0, len(fixo) - 1280, 1280):
        extrator(fixo[inicio:inicio + 1280])
    return np.asarray(extrator.get_features(16)[0], dtype=np.float32)


def _ler(arquivo: Path) -> np.ndarray:
    with wave.open(arquivo.as_posix(), "rb") as wav:
        if wav.getframerate() != 16000 or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise SystemExit(f"Formato inesperado em {arquivo.name}.")
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).copy()


if __name__ == "__main__":
    main()
