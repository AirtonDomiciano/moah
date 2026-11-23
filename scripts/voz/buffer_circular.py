"""Buffer circular de PCM int16 para montar o trecho de confirmação."""

from __future__ import annotations

from collections import deque

import numpy as np

QUADRO = 1280


class BufferCircular:
    """Guarda os últimos quadros de áudio e monta recortes sem reutilizar entre candidatos."""

    def __init__(self, quadros_previos: int) -> None:
        if quadros_previos < 1:
            raise ValueError("quadros_previos precisa ser pelo menos 1.")
        self._previos = quadros_previos
        self._historico: deque[np.ndarray] = deque(maxlen=quadros_previos)
        self._candidato: list[np.ndarray] | None = None

    def registrar(self, quadro: np.ndarray) -> None:
        copia = np.ascontiguousarray(quadro, dtype=np.int16)
        if self._candidato is not None:
            self._candidato.append(copia)
            return
        self._historico.append(copia)

    def iniciar_candidato(self) -> None:
        if self._candidato is not None:
            raise RuntimeError("Já existe um candidato em montagem.")
        self._candidato = list(self._historico)

    def anexar_pos(self, quadro: np.ndarray) -> None:
        if self._candidato is None:
            raise RuntimeError("Candidato não iniciado.")
        self._candidato.append(np.ascontiguousarray(quadro, dtype=np.int16))

    def concluir(self) -> np.ndarray:
        if self._candidato is None:
            return np.zeros(0, dtype=np.int16)
        trecho = np.concatenate(self._candidato)
        self._candidato = None
        self._historico.clear()
        return trecho

    def descartar(self) -> None:
        self._candidato = None
        self._historico.clear()

    def em_candidato(self) -> bool:
        return self._candidato is not None


def _self_test() -> None:
    buf = BufferCircular(4)
    for valor in range(10):
        quadro = np.full(QUADRO, valor, dtype=np.int16)
        buf.registrar(quadro)
    buf.iniciar_candidato()
    buf.anexar_pos(np.full(QUADRO, 99, dtype=np.int16))
    trecho = buf.concluir()
    assert trecho.size == 5 * QUADRO
    assert trecho[0] == 6
    assert trecho[-1] == 99
    buf.descartar()
    assert buf.registrar is not None
    print("ok")


if __name__ == "__main__":
    _self_test()