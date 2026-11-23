"""Testes do buffer e do contrato do verificador (mocks, sem ONNX)."""

from __future__ import annotations

import json

import numpy as np

from buffer_circular import BufferCircular, QUADRO
from verificador_acustico import ResultadoVerificacao


def _fala() -> np.ndarray:
    quadro = np.zeros(QUADRO, dtype=np.int16)
    quadro[: QUADRO // 2] = 5000
    return quadro


class _VerificadorFalso:
    def verificar(self, audio: np.ndarray, limiar: float, *, permitir: bool) -> ResultadoVerificacao:
        aceito = permitir and audio.size >= QUADRO
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
    negado = verificador.verificar(trecho, 0.9, permitir=False)
    assert ok.aceito
    assert not negado.aceito
    assert negado.motivo == "abaixo_limiar"


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
    _test_estados_json()
    print("ok")


if __name__ == "__main__":
    _self_test()