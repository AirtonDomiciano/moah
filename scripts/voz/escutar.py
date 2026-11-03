#!/usr/bin/env python3
"""Escuta o microfone nomeado e responde à pronúncia treinada.

Não grava o ambiente. Fecha a captura antes da saudação. Encerra o processo
de gravação ao sair.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--habilitar", required=True)
    parser.add_argument("--modelo", required=True)
    parser.add_argument("--recursos", required=True)
    parser.add_argument("--origem", required=True)
    parser.add_argument("--destino", required=True)
    parser.add_argument("--limiar", type=float, default=0.5)
    parser.add_argument("--duracao", type=float, default=0)
    parser.add_argument("--provar-eco", action="store_true")
    args = parser.parse_args()
    if args.habilitar != "sim":
        raise SystemExit("A escuta exige --habilitar sim.")
    modelo = Path(args.modelo)
    if not modelo.is_file():
        raise SystemExit(f"Modelo ausente: {modelo}")
    sys.path.insert(0, str(Path(args.recursos) / "hey_pran_openwakeword_v060"))
    from openwakeword.model import Model

    detector = Model(wakeword_models=[str(modelo)], inference_framework="onnx", vad_threshold=0)
    chave = next(iter(detector.models))
    inicio = time.time()
    captura: subprocess.Popen[bytes] | None = None
    pico = 0.0
    acertos = 0

    def encerrar(_signum: int, _frame: object) -> None:
        _fechar(captura)
        _estado("desligado", microfone="liberado", pico=pico, acertos=acertos)
        raise SystemExit(0)

    signal.signal(signal.SIGINT, encerrar)
    signal.signal(signal.SIGTERM, encerrar)
    try:
        if args.provar_eco:
            _estado("aguardando", microfone="retido")
            captura = _abrir(args.origem)
            _saudacao(args.destino)
            pico = _ler(detector, chave, captura, args.limiar, 4, False)
            _fechar(captura)
            captura = None
            _estado("desligado", microfone="liberado", pico=pico, eco=True)
            return
        _estado("aguardando", microfone="retido")
        while args.duracao <= 0 or time.time() - inicio < args.duracao:
            captura = _abrir(args.origem)
            detectou, parcial = _aguardar(detector, chave, captura, args.limiar, inicio, args.duracao)
            pico = max(pico, parcial)
            _fechar(captura)
            captura = None
            if not detectou:
                break
            acertos += 1
            _estado("saudacao", microfone="liberado", pico=pico, acertos=acertos)
            _saudacao(args.destino)
            _estado("aguardando", microfone="liberado", pico=pico, acertos=acertos)
        _estado("desligado", microfone="liberado", pico=pico, acertos=acertos)
    finally:
        _fechar(captura)


def _aguardar(detector, chave: str, captura: subprocess.Popen[bytes], limiar: float, inicio: float, duracao: float) -> tuple[bool, float]:
    pico = 0.0
    while duracao <= 0 or time.time() - inicio < duracao:
        quadro = _quadro(captura)
        if quadro is None:
            return False, pico
        score = float(detector.predict(quadro).get(chave, 0.0))
        pico = max(pico, score)
        if score >= limiar:
            return True, pico
    return False, pico


def _ler(detector, chave: str, captura: subprocess.Popen[bytes], limiar: float, segundos: float, _parar: bool) -> float:
    fim = time.time() + segundos
    pico = 0.0
    while time.time() < fim:
        quadro = _quadro(captura)
        if quadro is None:
            break
        pico = max(pico, float(detector.predict(quadro).get(chave, 0.0)))
    return pico


def _quadro(captura: subprocess.Popen[bytes]) -> np.ndarray | None:
    if captura.stdout is None:
        return None
    bruto = captura.stdout.read(1280 * 2)
    if len(bruto) < 1280 * 2:
        return None
    return np.frombuffer(bruto, dtype=np.int16)


def _abrir(origem: str) -> subprocess.Popen[bytes]:
    return subprocess.Popen(
        ["pw-record", "--target", origem, "--rate", "16000", "--channels", "1", "--format", "s16", "--raw", "-"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )


def _fechar(captura: subprocess.Popen[bytes] | None) -> None:
    if captura is None or captura.poll() is not None:
        return
    captura.terminate()
    try:
        captura.wait(timeout=1)
    except subprocess.TimeoutExpired:
        captura.kill()
        captura.wait(timeout=1)


def _saudacao(destino: str) -> None:
    with tempfile.TemporaryDirectory() as pasta:
        arquivo = Path(pasta) / "ola.wav"
        subprocess.run(["espeak", "-v", "pt-br", "-s", "140", "-w", str(arquivo), "Estou aqui."], check=True)
        subprocess.run(["pw-play", "--target", destino, str(arquivo)], check=True)


def _estado(fase: str, microfone: str, pico: float = 0, acertos: int = 0, eco: bool = False) -> None:
    json.dump(
        {"fase": fase, "microfone": microfone, "pico": round(pico, 4), "acertos": acertos, "eco": eco, "detectorConfirmado": False},
        sys.stdout,
    )
    sys.stdout.write("\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
