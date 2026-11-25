"""Testes do buffer e do contrato do verificador (mocks, sem ONNX)."""

from __future__ import annotations

import json

import numpy as np

from buffer_circular import BufferCircular, QUADRO
from verificador_acustico import ResultadoVerificacao, VerificadorAcustico


def _fala() -> np.ndarray:
    quadro = np.zeros(QUADRO, dtype=np.int16)
    quadro[: QUADRO // 2] = 5000
    return quadro


class _VerificadorFalso:
    def verificar(
        self,
        audio: np.ndarray,
        limiar: float,
        *,
        permitir: bool,
        motivo_bloqueio: str = "bloqueado",
    ) -> ResultadoVerificacao:
        if not permitir:
            return ResultadoVerificacao(False, 0.12, limiar, motivo_bloqueio, 2, 2.5, 3)
        aceito = audio.size >= QUADRO
        return ResultadoVerificacao(
            aceito,
            0.97 if aceito else 0.12,
            limiar,
            "acima_limiar" if aceito else "abaixo_limiar",
            2,
            2.5,
            3,
        )


def _test_buffer() -> None:
    buf = BufferCircular(3)
    for _ in range(5):
        buf.registrar(_fala())
    buf.iniciar_candidato()
    buf.anexar_pos(_fala())
    trecho = buf.concluir()
    assert trecho.size == 4 * QUADRO
    buf.descartar()


def _test_verificador_mock() -> None:
    verificador = _VerificadorFalso()
    trecho = np.concatenate([_fala() for _ in range(6)])
    ok = verificador.verificar(trecho, 0.9, permitir=True)
    negado = verificador.verificar(trecho, 0.9, permitir=False, motivo_bloqueio="modo_manual")
    assert ok.aceito
    assert not negado.aceito
    assert negado.motivo == "modo_manual"


def _test_limiar_verificador() -> None:
    verificador = VerificadorAcustico.__new__(VerificadorAcustico)
    trecho = np.concatenate([_fala() for _ in range(6)])

    def _pontuar(_audio: np.ndarray, score: float) -> tuple[float, int, float]:
        return score, 2, 2.5

    verificador.pontuar = lambda audio: _pontuar(audio, 0.99)  # type: ignore[method-assign]
    acima = verificador.verificar(trecho, 0.95, permitir=True)
    assert acima.aceito and acima.motivo == "acima_limiar"

    verificador.pontuar = lambda audio: _pontuar(audio, 0.40)  # type: ignore[method-assign]
    abaixo = verificador.verificar(trecho, 0.95, permitir=True)
    assert not abaixo.aceito and abaixo.motivo == "abaixo_limiar"

    verificador.pontuar = lambda audio: _pontuar(audio, 0.88)  # type: ignore[method-assign]
    incerteza = verificador.verificar(trecho, 0.95, permitir=True)
    assert not incerteza.aceito and incerteza.motivo == "incerteza"


def _test_estados_json() -> None:
    eventos = [
        {"fase": "aguardando", "etapa": "aguardando ativação"},
        {"fase": "verificando", "etapa": "verificando candidato"},
        {"fase": "confirmada", "etapa": "chamada confirmada", "detectorConfirmado": True},
    ]
    for evento in eventos:
        json.dumps(evento)


def _self_test() -> None:
    _test_buffer()
    _test_verificador_mock()
    _test_limiar_verificador()
    _test_estados_json()
    print("ok")


if __name__ == "__main__":
    _self_test()