"""Presença de fala no trecho de confirmação, antes de aceitar a chamada.

O pico, o score do verificador e a transcrição partem do mesmo PCM
(`trecho` montado pelo buffer). Não descrevem a mesma janela:

- o pico é o máximo do clipe inteiro, depois de tirar o deslocamento DC;
- o score é o máximo das janelas de 1,28 s do fluxo com 1 s de silêncio na frente;
- a transcrição, quando roda, lê o clipe inteiro e não decide o aceite.

Aqui a decisão usa o clipe inteiro: VAD Silero já presente no ambiente
(não o `silero_vad.onnx` do openWakeWord, que não foi baixado) e a duração
em que o RMS de 80 ms fica acima de 4× o piso do próprio trecho. O piso é o
percentil 20, então ruído estacionário não se destaca dele. Não há redução
de ruído nem ganho automático.
"""

from __future__ import annotations

import importlib.util
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from voz_constantes import QUADRO, TAXA

# 80 ms, o mesmo quadro do pipeline. Durações medidas em 23/11/2026:
# estalo até 160 ms acima de 4× o piso; tomadas da sessão 03 a partir de 480 ms.
# O corte de 320 ms é o meio desse intervalo, não um pico absoluto.
JANELA = QUADRO
FATOR_ENERGIA = 4.0
MIN_ENERGIA_MS = 320
# Silero v6: quadro de 512 amostras = 32 ms.
# Fala mantida (sessão 03 e chamada atenuada até ~30 dB sobre o piso do JBL)
# sustenta >= 160 ms em 0,5, ou >= 256 ms em 0,35. O blip mais longo sem fala
# ficou em 64 ms em 0,35. 160 ms é o meio de 64 e 256 nesse limiar fraco,
# e cinco quadros de 32 ms no limiar forte.
LIMIAR_VAD_FORTE = 0.5
MIN_VAD_FORTE_MS = 160
LIMIAR_VAD_FRACO = 0.35
MIN_VAD_FRACO_MS = 160
QUADRO_VAD = 512
CONTEXTO_VAD = 64
MS_VAD = QUADRO_VAD * 1000 // TAXA


@dataclass(frozen=True)
class PresencaFala:
    fala: bool
    motivo: str
    vad_max: float | None
    vad_ms: int
    energia_ms: int


def aplicar_presenca(presenca: PresencaFala, aceito: bool, motivo: str) -> tuple[bool, str]:
    """A falta de fala bloqueia a confirmação. Com fala, vale o modo do verificador."""
    if not presenca.fala:
        return False, presenca.motivo
    return aceito, motivo


def decidir_presenca(
    *,
    vad_max: float | None,
    vad_ms_forte: int,
    vad_ms_fraco: int,
    energia_ms: int,
) -> PresencaFala:
    if vad_max is None:
        fala = energia_ms >= MIN_ENERGIA_MS
    else:
        fala = (
            vad_ms_forte >= MIN_VAD_FORTE_MS
            or vad_ms_fraco >= MIN_VAD_FRACO_MS
            or (energia_ms >= MIN_ENERGIA_MS and vad_max >= LIMIAR_VAD_FRACO)
        )
    return PresencaFala(
        fala=fala,
        motivo="" if fala else "sem_fala",
        vad_max=vad_max,
        vad_ms=max(vad_ms_forte, vad_ms_fraco),
        energia_ms=energia_ms,
    )


def medir_energia_ms(amostras: np.ndarray) -> int:
    """Maior trecho contínuo com RMS de janela >= 4× o percentil 20 do clipe."""
    if amostras.size < JANELA:
        return 0
    sem = amostras.astype(np.float32) - float(np.mean(amostras))
    quadros = amostras.size // JANELA
    rms = np.sqrt(np.mean(sem[: quadros * JANELA].reshape(quadros, JANELA) ** 2, axis=1))
    piso = max(float(np.percentile(rms, 20)), 1.0)
    limiar = piso * FATOR_ENERGIA
    melhor = atual = 0
    for valor in rms:
        if valor >= limiar:
            atual += 1
            melhor = max(melhor, atual)
        else:
            atual = 0
    return melhor * (JANELA * 1000 // TAXA)


def avaliar_presenca(amostras: np.ndarray) -> PresencaFala:
    energia_ms = medir_energia_ms(amostras)
    modelo = _obter_modelo()
    if modelo is None:
        return decidir_presenca(
            vad_max=None,
            vad_ms_forte=0,
            vad_ms_fraco=0,
            energia_ms=energia_ms,
        )
    probs = modelo.probabilidades(amostras)
    if probs.size == 0:
        return decidir_presenca(vad_max=None, vad_ms_forte=0, vad_ms_fraco=0, energia_ms=energia_ms)
    return decidir_presenca(
        vad_max=float(np.max(probs)),
        vad_ms_forte=_duracao_ms(probs, LIMIAR_VAD_FORTE),
        vad_ms_fraco=_duracao_ms(probs, LIMIAR_VAD_FRACO),
        energia_ms=energia_ms,
    )


def _duracao_ms(probs: np.ndarray, limiar: float) -> int:
    melhor = atual = 0
    for valor in probs:
        if float(valor) >= limiar:
            atual += 1
            melhor = max(melhor, atual)
        else:
            atual = 0
    return melhor * MS_VAD


class _SileroV6:
    """Estado zerado a cada clipe. O detector da escuta continua com vad_threshold 0."""

    def __init__(self, caminho: Path) -> None:
        import onnxruntime as ort

        opts = ort.SessionOptions()
        opts.inter_op_num_threads = 1
        opts.intra_op_num_threads = 1
        opts.log_severity_level = 4
        self._sessao = ort.InferenceSession(
            caminho.as_posix(),
            providers=["CPUExecutionProvider"],
            sess_options=opts,
        )

    def probabilidades(self, amostras: np.ndarray) -> np.ndarray:
        if amostras.size < QUADRO_VAD:
            return np.zeros(0, dtype=np.float32)
        audio = np.ascontiguousarray(amostras, dtype=np.float32) / 32768.0
        h = np.zeros((1, 1, 128), dtype=np.float32)
        c = np.zeros((1, 1, 128), dtype=np.float32)
        contexto = np.zeros(CONTEXTO_VAD, dtype=np.float32)
        saidas: list[float] = []
        for inicio in range(0, audio.size - QUADRO_VAD + 1, QUADRO_VAD):
            quadro = audio[inicio : inicio + QUADRO_VAD]
            entrada = np.concatenate((contexto, quadro))[None, :]
            prob, h, c = self._sessao.run(None, {"input": entrada, "h": h, "c": c})
            saidas.append(float(np.asarray(prob).reshape(-1)[0]))
            contexto = quadro[-CONTEXTO_VAD:]
        return np.asarray(saidas, dtype=np.float32)


_modelo: _SileroV6 | None = None
_buscado = False


def _caminho_silero() -> Path | None:
    spec = importlib.util.find_spec("faster_whisper")
    if spec is None or not spec.origin:
        return None
    caminho = Path(spec.origin).resolve().parent / "assets" / "silero_vad_v6.onnx"
    return caminho if caminho.is_file() else None


def _obter_modelo() -> _SileroV6 | None:
    global _modelo, _buscado
    if _buscado:
        return _modelo
    _buscado = True
    caminho = _caminho_silero()
    if caminho is None:
        return None
    _modelo = _SileroV6(caminho)
    return _modelo
