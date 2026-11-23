"""Espera ativação pelo openWakeWord (estágio 1)."""

from __future__ import annotations

import subprocess
import time
from collections import deque

import numpy as np

from buffer_circular import BufferCircular
from eventos_voz import diag
from pcm_pipewire import ler_quadro, medir_quadro
from voz_constantes import CONFIRMACAO_QUADROS, DIAGNOSTICO_S


def aguardar_ativacao(
    detector,
    chave: str,
    captura: subprocess.Popen[bytes],
    limiar: float,
    inicio: float,
    duracao: float,
    guardar: bool = False,
    diagnostico: bool = False,
    arranque_s: float = 0.0,
    buffer: BufferCircular | None = None,
) -> tuple[bool, float, float, np.ndarray, bool]:
    pico = 0.0
    recentes: deque[np.ndarray] = deque(maxlen=CONFIRMACAO_QUADROS if guardar else 0)
    vazio = np.zeros(0, dtype=np.int16)
    aberto = time.monotonic()
    ultimo_relato = aberto
    primeiro = True
    rms_max = 0.0
    pico_audio = 0
    dc_ultimo = 0.0
    score_max = 0.0
    score_ultimo = 0.0
    quadros = 0
    while duracao <= 0 or time.time() - inicio < duracao:
        quadro = ler_quadro(captura)
        if quadro is None:
            if diagnostico:
                diag(
                    f"audio=interrompido rms={rms_max:.0f} pico={pico_audio} "
                    f"score={score_max:.4f} limiar={limiar:.4f} quadros={quadros}"
                )
            return False, 0.0, pico, vazio, False
        if buffer is not None:
            buffer.registrar(quadro)
        if guardar:
            recentes.append(quadro.copy())
        nivel = medir_quadro(quadro)
        rms_max = max(rms_max, nivel[0])
        pico_audio = max(pico_audio, nivel[1])
        dc_ultimo = nivel[2]
        score = float(detector.predict(quadro).get(chave, 0.0))
        pico = max(pico, score)
        score_max = max(score_max, score)
        score_ultimo = score
        quadros += 1
        agora = time.monotonic()
        if diagnostico and (primeiro or agora - ultimo_relato >= DIAGNOSTICO_S):
            primeiro = False
            diag(
                f"nivel rms={rms_max:.0f} pico={pico_audio} dc={dc_ultimo:.0f} "
                f"score={score_max:.4f} ultimo={score_ultimo:.4f} limiar={limiar:.4f} quadros={quadros}"
            )
            rms_max = 0.0
            pico_audio = 0
            score_max = 0.0
            quadros = 0
            ultimo_relato = agora
        if score < limiar or agora - aberto < arranque_s:
            continue
        if buffer is not None:
            return True, score, pico, vazio, False
        if not guardar:
            return True, score, pico, vazio, False
        if len(recentes) < CONFIRMACAO_QUADROS:
            continue
        return True, score, pico, np.concatenate(list(recentes)), False
    return False, 0.0, pico, vazio, False


def medir_pico_detector(
    detector,
    chave: str,
    captura: subprocess.Popen[bytes],
    limiar: float,
    segundos: float,
) -> float:
    fim = time.time() + segundos
    pico = 0.0
    while time.time() < fim:
        quadro = ler_quadro(captura)
        if quadro is None:
            break
        pico = max(pico, float(detector.predict(quadro).get(chave, 0.0)))
    return pico