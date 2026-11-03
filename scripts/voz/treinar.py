#!/usr/bin/env python3
"""Treina o detector local de MOAH fora do Git.

Usa o Piper e os negativos já presentes na máquina do PRAN. O arquivo grande
de características fica mapeado em disco. A avaliação final não entra no treino.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import threading
import time
from pathlib import Path

import numpy as np

FRASES_NEGATIVAS = [
    "estou aqui",
    "estou aqui.",
    "boa",
    "noah",
    "moa",
    "ola",
    "agora",
    "moda",
    "boa noite",
    "onde paramos",
    "vamos continuar",
]
AVALIACAO = {
    "saudacao": ["estou aqui", "estou aqui."],
    "parecidas": ["boa", "noah", "moa", "ola", "agora", "moda", "boa noite"],
    "conversa": ["onde paramos no trabalho", "vamos continuar amanha", "pode repetir isso"],
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--modo", choices=("amostra", "completo"), required=True)
    parser.add_argument("--saida", required=True)
    parser.add_argument("--recursos", required=True)
    parser.add_argument("--repositorio", required=True)
    args = parser.parse_args()
    saida = Path(args.saida).resolve()
    recursos = Path(args.recursos).resolve()
    repositorio = Path(args.repositorio).resolve()
    if _dentro(saida, repositorio):
        raise SystemExit("A saída do treino precisa ficar fora do repositório.")
    _exigir(recursos)
    saida.mkdir(parents=True, exist_ok=True)
    (saida / "runtime.json").write_text(
        json.dumps(
            {
                "python": str(recursos / "hey_pran_env/bin/python"),
                "recursos": str(recursos),
                "openwakeword": str(recursos / "hey_pran_openwakeword_v060"),
                "silero": "nao-baixado",
                "motivoSilero": "A inferência usa vad_threshold 0, como o PRAN. O arquivo silero_vad.onnx não foi necessário.",
            },
            indent=2,
        ),
        encoding="utf8",
    )
    fundo = _fundo(saida, recursos)
    selecao = _selecao(saida, recursos / "validation_set_features.npy")
    config = _config(args.modo, saida, recursos, fundo, selecao)
    config_path = saida / args.modo / "treino.yaml"
    config_path.parent.mkdir(parents=True, exist_ok=True)
    config_path.write_text(_yaml(config), encoding="utf8")
    antes = shutil.disk_usage(saida)
    inicio = time.time()
    pico = {"rss_kib": 0, "rss_soma_kib": 0, "vram_mib": 0, "memoria_disponivel_kib": _disponivel()}
    log_path = saida / args.modo / "treino.log"
    processo = _iniciar(recursos, config_path, log_path)
    parar = threading.Event()
    vigia = threading.Thread(target=_vigiar, args=(processo.pid, pico, parar), daemon=True)
    vigia.start()
    codigo = processo.wait()
    parar.set()
    vigia.join(timeout=2)
    duracao = round(time.time() - inicio, 1)
    depois = shutil.disk_usage(saida)
    log = log_path.read_text(encoding="utf8", errors="replace") if log_path.exists() else ""
    modelo = saida / args.modo / "moah" / "moah.onnx"
    if not modelo.exists():
        modelo = saida / args.modo / "moah.onnx"
    relatorio = {
        "modo": args.modo,
        "codigo": codigo,
        "duracaoSegundos": duracao,
        "rssProcessoMaxKiB": pico["rss_kib"],
        "rssSomaMaxKiB": pico["rss_soma_kib"],
        "memoriaDisponivelMinKiB": pico["memoria_disponivel_kib"],
        "vramMaxMiB": pico["vram_mib"],
        "discoLivreAntesBytes": antes.free,
        "discoLivreDepoisBytes": depois.free,
        "modelo": str(modelo) if modelo.exists() else "",
        "resultado": _resultado(log),
        "negativosCarregadosPorInteiro": False,
        "avaliacaoUsadaNoTreino": False,
    }
    (saida / args.modo / "relatorio.json").write_text(json.dumps(relatorio, indent=2), encoding="utf8")
    print(json.dumps(relatorio, indent=2))
    if codigo != 0 or not modelo.exists():
        raise SystemExit(codigo or 1)


def _exigir(recursos: Path) -> None:
    nomes = [
        "hey_pran_openwakeword_v060",
        "hey_pran_piper_generator",
        "hey_pran_env/bin/python",
        "openwakeword_features_ACAV100M_2000_hrs_16bit.npy",
        "validation_set_features.npy",
        "audioset_16k",
        "fma",
        "mit_rirs",
    ]
    faltando = [nome for nome in nomes if not (recursos / nome).exists()]
    if faltando:
        raise SystemExit("Recursos ausentes: " + ", ".join(faltando))


def _fundo(saida: Path, recursos: Path) -> dict[str, Path]:
    destino = saida / "fundo"
    origem = {
        "audioset": recursos / "audioset_16k",
        "fma": recursos / "fma",
        "rir": recursos / "mit_rirs",
    }
    avaliacao = saida / "avaliacao"
    avaliacao.mkdir(parents=True, exist_ok=True)
    reservados: list[str] = []
    for nome, pasta in origem.items():
        arquivos = sorted(
            item for item in pasta.iterdir() if item.is_file() and item.suffix.lower() in {".wav", ".flac"}
        )
        reserva = arquivos[-8:] if nome != "rir" else []
        reservados.extend(str(item) for item in reserva)
        links = destino / nome
        links.mkdir(parents=True, exist_ok=True)
        usados = {item.name for item in reserva}
        for item in arquivos:
            if item.name in usados:
                continue
            atalho = links / item.name
            if not atalho.exists():
                atalho.symlink_to(item)
    (avaliacao / "reservados.txt").write_text("\n".join(reservados) + "\n", encoding="utf8")
    return {"audioset": destino / "audioset", "fma": destino / "fma", "rir": destino / "rir"}


def _selecao(saida: Path, origem: Path) -> Path:
    destino = saida / "selecao_fp.npy"
    if destino.exists():
        return destino
    matriz = np.load(origem, mmap_mode="r")
    linhas = min(32000, matriz.shape[0])
    recorte = np.lib.format.open_memmap(destino, mode="w+", dtype=matriz.dtype, shape=(linhas, matriz.shape[1]))
    recorte[:] = np.asarray(matriz[:linhas])
    recorte.flush()
    del recorte
    del matriz
    return destino


def _config(modo: str, saida: Path, recursos: Path, fundo: dict[str, Path], selecao: Path) -> dict[str, object]:
    amostra = modo == "amostra"
    return {
        "augmentation_batch_size": 8 if amostra else 16,
        "augmentation_rounds": 1,
        "background_paths": [str(fundo["audioset"]), str(fundo["fma"])],
        "background_paths_duplication_rate": [1, 1],
        "batch_n_per_class": {
            "ACAV100M_sample": 32 if amostra else 256,
            "adversarial_negative": 4 if amostra else 16,
            "positive": 4 if amostra else 16,
        },
        "custom_negative_phrases": FRASES_NEGATIVAS,
        "false_positive_validation_data_path": str(selecao),
        "feature_data_files": {
            "ACAV100M_sample": str(recursos / "openwakeword_features_ACAV100M_2000_hrs_16bit.npy"),
        },
        "layer_size": 32,
        "max_negative_weight": 1500,
        "model_name": "moah",
        "model_type": "dnn",
        "n_samples": 8 if amostra else 1000,
        "n_samples_val": 4 if amostra else 200,
        "output_dir": str(saida / modo),
        "piper_sample_generator_path": str(recursos / "hey_pran_piper_generator"),
        "rir_paths": [str(fundo["rir"])],
        "steps": 100 if amostra else 10000,
        "target_accuracy": 0.6,
        "target_false_positives_per_hour": 0.2,
        "target_phrase": ["moah"],
        "target_recall": 0.25,
        "tts_batch_size": 8 if amostra else 14,
    }


def _yaml(config: dict[str, object]) -> str:
    import yaml

    return yaml.safe_dump(config, allow_unicode=True, sort_keys=False)


def _iniciar(recursos: Path, config: Path, log_path: Path) -> subprocess.Popen[str]:
    env = os.environ.copy()
    env["PYTHONPATH"] = str(recursos / "hey_pran_openwakeword_v060")
    env["PYTHONUNBUFFERED"] = "1"
    log = log_path.open("w", encoding="utf8")
    return subprocess.Popen(
        [
            str(recursos / "hey_pran_env/bin/python"),
            "-m",
            "openwakeword.train",
            "--training_config",
            str(config),
            "--generate_clips",
            "--augment_clips",
            "--train_model",
        ],
        cwd=str(recursos),
        env=env,
        stdout=log,
        stderr=subprocess.STDOUT,
        text=True,
    )


def _vigiar(pid: int, pico: dict[str, int], parar: threading.Event) -> None:
    while not parar.is_set():
        maior, soma = _rss(pid)
        pico["rss_kib"] = max(pico["rss_kib"], maior)
        pico["rss_soma_kib"] = max(pico["rss_soma_kib"], soma)
        pico["vram_mib"] = max(pico["vram_mib"], _vram())
        pico["memoria_disponivel_kib"] = min(pico["memoria_disponivel_kib"], _disponivel())
        parar.wait(1)


def _rss(pid: int) -> tuple[int, int]:
    maior = 0
    total = 0
    pendentes = [pid]
    vistos: set[int] = set()
    while pendentes:
        atual = pendentes.pop()
        if atual in vistos:
            continue
        vistos.add(atual)
        try:
            status = Path(f"/proc/{atual}/status").read_text(encoding="utf8")
        except OSError:
            continue
        for linha in status.splitlines():
            if linha.startswith("VmRSS:"):
                rss = int(linha.split()[1])
                maior = max(maior, rss)
                total += rss
        filhos = Path(f"/proc/{atual}/task/{atual}/children")
        try:
            pendentes.extend(int(item) for item in filhos.read_text(encoding="utf8").split())
        except OSError:
            continue
    return maior, total


def _disponivel() -> int:
    for linha in Path("/proc/meminfo").read_text(encoding="utf8").splitlines():
        if linha.startswith("MemAvailable:"):
            return int(linha.split()[1])
    return 0


def _vram() -> int:
    try:
        texto = subprocess.check_output(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            text=True,
            stderr=subprocess.DEVNULL,
        )
    except (OSError, subprocess.CalledProcessError):
        return 0
    return max(int(item.strip()) for item in texto.splitlines() if item.strip())


def _resultado(log: str) -> str:
    linhas = [linha.strip() for linha in log.splitlines() if "Final Model" in linha or linha.startswith("Saving ONNX")]
    return " | ".join(linhas[-6:])


def _dentro(caminho: Path, raiz: Path) -> bool:
    try:
        caminho.relative_to(raiz)
        return True
    except ValueError:
        return False


if __name__ == "__main__":
    main()
