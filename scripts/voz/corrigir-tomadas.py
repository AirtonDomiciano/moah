#!/usr/bin/env python3
"""Treina de novo só com tomadas originais que contêm a palavra inteira.

A divisão é por arquivo, antes das variações. moah-06 a moah-08 não entram
no treino. Os WAV originais são só lidos.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
import torch
from torch import nn

LIMIAR = 0.5
TREINO = [f"moah-{indice:02d}.wav" for indice in range(1, 6)]
AVALIACAO = [f"moah-{indice:02d}.wav" for indice in range(6, 9)]


def main() -> None:
    saida = Path("/home/airtondev/.local/share/moah/voz")
    recursos = Path("/home/airtondev/hey_pran_work")
    sys.path.insert(0, str(recursos / "hey_pran_openwakeword_v060"))
    from openwakeword.utils import AudioFeatures

    coleta = saida / "coleta"
    qualidade = [_qualidade(coleta / nome) for nome in TREINO + AVALIACAO]
    positivos_origem = [item for item in qualidade if item["conjunto"] == "treino" and item["regioesCompletas"]]
    manifesto = {
        "regra": (
            "Trecho com RMS de 50 ms acima de 250, duração de pelo menos 0,40 s, "
            "começo depois de 0,08 s, fim pelo menos 0,08 s antes do final, "
            "e silêncio de RMS abaixo de 140 antes e 160 depois."
        ),
        "treino": TREINO,
        "avaliacao": AVALIACAO,
        "positivos": [item["arquivo"] for item in positivos_origem],
        "avaliacaoUsadaNoAjuste": False,
        "originaisPreservados": True,
        "tomadas": qualidade,
    }
    (saida / "correcao").mkdir(exist_ok=True)
    (saida / "correcao" / "tomadas.json").write_text(json.dumps(manifesto, indent=2), encoding="utf8")
    if not positivos_origem:
        raise SystemExit("Nenhuma tomada de treino tem a palavra completa. O treino não começou.")
    extrator = AudioFeatures(inference_framework="onnx", device="cpu")
    reais = []
    for item in positivos_origem:
        audio = _ler(coleta / item["arquivo"])
        for inicio, fim in item["regioesCompletas"]:
            trecho = audio[int(inicio * 16000):int(fim * 16000)]
            for ganho in (0.8, 1.0, 1.2):
                for deslocamento in (0, 1920, 3840):
                    variacao = np.clip(trecho * ganho, -32767, 32767).astype(np.int16)
                    reais.append(_janela(extrator, _posicionar(variacao, deslocamento)))
    reais_np = np.stack(reais)
    sinteticos = [
        _janela(extrator, _ler(arquivo))
        for arquivo in sorted((saida / "completo" / "moah" / "positive_train").glob("*.wav"))[:60]
    ]
    positivos = np.vstack((np.vstack([reais_np for _ in range(3)]), np.stack(sinteticos)))
    reservados = set((saida / "avaliacao" / "reservados.txt").read_text(encoding="utf8").split())
    musica = _fundo(recursos / "fma", reservados, extrator, 60)
    ambiente = _fundo(recursos / "audioset_16k", reservados, extrator, 60)
    parecidas = [
        _janela(extrator, _ler(arquivo))
        for arquivo in sorted((saida / "completo" / "moah" / "negative_train").glob("*.wav"))[:40]
    ]
    saudacao = [_janela(extrator, _espeak(frase)) for frase in ("estou aqui.", "estou aqui")]
    silencio = _quadros(extrator, np.zeros(16000 * 3, dtype=np.int16))
    ruido = _quadros(extrator, np.random.default_rng(20261103).normal(0, 80, 16000 * 2).astype(np.int16))
    negativos = np.vstack((musica, ambiente, np.stack(parecidas), np.stack(saudacao), np.stack(silencio), np.stack(ruido)))
    rede = _treinar(positivos, negativos, len(reais_np) * 3)
    with torch.no_grad():
        amostra = rede(torch.from_numpy(reais_np)).squeeze(1).numpy()
    if float(np.min(amostra)) < 0.5:
        raise SystemExit(f"As variações de treino ficaram abaixo de 0,5: {amostra.min():.3f}. A avaliação não foi consultada.")
    completo = saida / "completo"
    atual = completo / "moah-corrigido.onnx"
    versao = completo / "moah-corrigido-v1.onnx"
    if atual.exists() and not versao.exists():
        versao.write_bytes(atual.read_bytes())
    torch.onnx.export(rede, torch.zeros(1, 16, 96), atual, input_names=["entrada"], output_names=["score"], opset_version=13)
    relatorio = {
        "positivosReais": [item["arquivo"] for item in positivos_origem],
        "variacoesReais": int(len(reais_np)),
        "sinteticos": len(sinteticos),
        "negativos": int(len(negativos)),
        "musica": int(len(musica)),
        "ambiente": int(len(ambiente)),
        "quadrosDeSilencio": len(silencio),
        "minimoNasVariacoesDeTreino": round(float(np.min(amostra)), 4),
        "limiar": LIMIAR,
        "vad": 0,
        "modelo": atual.as_posix(),
        "modeloAnterior": versao.as_posix(),
        "avaliacaoUsadaNoAjuste": False,
    }
    (saida / "correcao" / "treino-tomadas.json").write_text(json.dumps(relatorio, indent=2), encoding="utf8")
    print(json.dumps(relatorio, indent=2))


def _qualidade(arquivo: Path) -> dict[str, object]:
    bruto = arquivo.read_bytes()
    with wave.open(arquivo.as_posix(), "rb") as wav:
        taxa, canais, largura, quadros = wav.getframerate(), wav.getnchannels(), wav.getsampwidth(), wav.getnframes()
        audio = np.frombuffer(wav.readframes(quadros), dtype=np.int16).astype(np.float32)
    duracao = quadros / taxa
    sem = audio - float(np.mean(audio))
    hop = int(0.05 * taxa)
    env = np.array([np.sqrt(np.mean(sem[i:i + hop] ** 2)) for i in range(0, len(sem) - hop + 1, hop)])
    ativo = env >= 250
    bruto_regioes: list[tuple[int, int]] = []
    inicio = None
    for indice, flag in enumerate(ativo):
        if flag and inicio is None:
            inicio = indice
        elif not flag and inicio is not None:
            bruto_regioes.append((inicio, indice))
            inicio = None
    if inicio is not None:
        bruto_regioes.append((inicio, len(env)))
    fundidas: list[tuple[int, int]] = []
    for comeco, fim in bruto_regioes:
        if fundidas and comeco - fundidas[-1][1] <= 1:
            fundidas[-1] = (fundidas[-1][0], fim)
        else:
            fundidas.append((comeco, fim))
    completas = []
    for comeco, fim in fundidas:
        duracao_regiao = (fim - comeco) * 0.05
        if duracao_regiao < 0.40:
            continue
        instante_ini, instante_fim = comeco * 0.05, fim * 0.05
        antes = env[max(0, comeco - 8):comeco]
        depois = env[fim:min(len(env), fim + 10)]
        if (
            instante_ini >= 0.08
            and instante_fim <= duracao - 0.08
            and len(antes) > 0
            and float(np.min(antes)) < 140
            and len(depois) > 0
            and float(np.min(depois)) < 160
        ):
            completas.append([round(instante_ini, 2), round(instante_fim, 2)])
    return {
        "arquivo": arquivo.name,
        "sha256": hashlib.sha256(bruto).hexdigest(),
        "bytes": len(bruto),
        "formatoValido": taxa == 16000 and canais == 1 and largura == 2 and 1.5 <= duracao <= 2.5,
        "duracaoSegundos": round(duracao, 3),
        "pico": int(np.max(np.abs(audio))),
        "saturada": bool(np.any(np.abs(audio) >= 32767)),
        "rmsSemDeslocamento": round(float(np.sqrt(np.mean(sem ** 2))), 1),
        "regioesCompletas": completas,
        "conjunto": "treino" if arquivo.name in TREINO else "avaliacao",
    }


def _treinar(positivos: np.ndarray, negativos: np.ndarray, quantidade_real: int) -> nn.Module:
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
    for _ in range(900):
        reais = x_pos[torch.randint(0, quantidade_real, (32,))]
        resto = x_pos[torch.randint(quantidade_real, len(x_pos), (32,))]
        neg = x_neg[torch.randint(0, len(x_neg), (96,))]
        lote = torch.cat((reais, resto, neg))
        alvo = torch.cat((torch.ones(64), torch.zeros(96)))
        perda = nn.functional.binary_cross_entropy(rede(lote).squeeze(1), alvo, reduction="mean")
        otimo.zero_grad()
        perda.backward()
        otimo.step()
    rede.eval()
    return rede


def _fundo(pasta: Path, reservados: set[str], extrator, limite: int) -> np.ndarray:
    janelas = []
    for arquivo in sorted(pasta.glob("*.wav")):
        if arquivo.as_posix() in reservados:
            continue
        audio = _ler(arquivo)
        janelas.append(_janela(extrator, audio[:32000]))
        if len(audio) > 16000 * 8:
            janelas.append(_janela(extrator, audio[16000 * 8:16000 * 10]))
        if len(janelas) >= limite:
            break
    if len(janelas) < 20:
        raise SystemExit(f"Negativos insuficientes em {pasta.name}.")
    return np.stack(janelas[:limite])


def _posicionar(trecho: np.ndarray, deslocamento: int) -> np.ndarray:
    slot = np.zeros(32000, dtype=np.int16)
    janela_ini, janela_fim = 11520, 32000
    if len(trecho) > janela_fim - janela_ini:
        trecho = trecho[-(janela_fim - janela_ini):]
    folga = janela_fim - janela_ini - len(trecho)
    fim = janela_fim - min(deslocamento, folga)
    inicio = fim - len(trecho)
    slot[inicio:fim] = trecho
    return slot


def _quadros(extrator, audio: np.ndarray) -> list[np.ndarray]:
    _zerar(extrator)
    quadros = []
    for inicio in range(0, len(audio) - 1280, 1280):
        extrator(audio[inicio:inicio + 1280])
        quadros.append(np.asarray(extrator.get_features(16)[0], dtype=np.float32))
    return quadros


def _janela(extrator, audio: np.ndarray) -> np.ndarray:
    _zerar(extrator)
    fixo = np.zeros(16000 + 32000, dtype=np.int16)
    fixo[16000:16000 + min(len(audio), 32000)] = audio[:32000]
    for inicio in range(0, len(fixo) - 1280, 1280):
        extrator(fixo[inicio:inicio + 1280])
    return np.asarray(extrator.get_features(16)[0], dtype=np.float32)


def _zerar(extrator) -> None:
    extrator.raw_data_buffer.clear()
    extrator.melspectrogram_buffer = np.ones((76, 32))
    extrator.accumulated_samples = 0
    extrator.raw_data_remainder = np.empty(0)
    extrator.feature_buffer = extrator._get_embeddings(np.zeros(16000 * 4, dtype=np.int16))


def _espeak(frase: str) -> np.ndarray:
    with tempfile.TemporaryDirectory() as pasta:
        origem = Path(pasta) / "fala.wav"
        subprocess.run(["espeak", "-v", "pt-br", "-s", "140", "-w", origem.as_posix(), frase], check=True, capture_output=True)
        with wave.open(origem.as_posix(), "rb") as wav:
            taxa = wav.getframerate()
            amostras = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32)
        destino = np.interp(np.linspace(0, len(amostras) - 1, int(len(amostras) * 16000 / taxa)), np.arange(len(amostras)), amostras)
        return np.clip(destino, -32767, 32767).astype(np.int16)


def _ler(arquivo: Path) -> np.ndarray:
    with wave.open(arquivo.as_posix(), "rb") as wav:
        if wav.getframerate() != 16000 or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise SystemExit(f"Formato inesperado em {arquivo.name}.")
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).copy()


if __name__ == "__main__":
    main()
