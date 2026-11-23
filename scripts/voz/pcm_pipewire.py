"""Captura PCM via pw-record (quadro a quadro)."""

from __future__ import annotations

import subprocess

import numpy as np

from voz_constantes import CANAIS, FORMATO, PICO_MUDO, QUADRO, TAXA


def medir_quadro(quadro: np.ndarray) -> tuple[float, int, float]:
    dc = float(np.mean(quadro))
    sem = quadro.astype(np.float32) - dc
    pico = int(np.max(np.abs(sem))) if sem.size else 0
    rms = float(np.sqrt(np.mean(sem * sem))) if sem.size else 0.0
    return rms, pico, dc


def tem_fala(quadro: np.ndarray, pico_fala: float) -> bool:
    return medir_quadro(quadro)[1] >= pico_fala


def amostras_mutas(amostras: np.ndarray) -> bool:
    if not amostras.size or not np.any(amostras):
        return True
    sem = amostras.astype(np.float32) - float(np.mean(amostras))
    return float(np.max(np.abs(sem))) < PICO_MUDO


def ler_quadro(captura: subprocess.Popen[bytes]) -> np.ndarray | None:
    if captura.stdout is None:
        return None
    bruto = captura.stdout.read(QUADRO * 2)
    if len(bruto) < QUADRO * 2:
        return None
    return np.frombuffer(bruto, dtype=np.int16)


def abrir_captura(origem: str) -> subprocess.Popen[bytes]:
    return subprocess.Popen(
        [
            "pw-record",
            "--target",
            origem,
            "--rate",
            str(TAXA),
            "--channels",
            str(CANAIS),
            "--format",
            FORMATO,
            "--raw",
            "-",
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )


def fechar_captura(captura: subprocess.Popen[bytes] | None) -> None:
    if captura is None or captura.poll() is not None:
        return
    captura.terminate()
    try:
        captura.wait(timeout=1)
    except subprocess.TimeoutExpired:
        captura.kill()
        captura.wait(timeout=1)