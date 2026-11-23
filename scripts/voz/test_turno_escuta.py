"""Regressão do turno falado. Simula captura, transcrição e alto-falante.

Não substitui _falar_etapa: a resposta do pedido não suportado passa pela
chamada que quebrava com texto= e transcricao ao mesmo tempo.
"""

from __future__ import annotations

import io
import json
import time
from contextlib import redirect_stdout

import numpy as np

import escutar
from janela_pedido import LimitesPedido

QUADRO = escutar.QUADRO


class _Detector:
    def predict(self, _quadro: np.ndarray) -> dict[str, float]:
        return {"nome": 0.9}


class _Captura:
    def __init__(self, quadros: list[np.ndarray], pausa_s: float) -> None:
        self.stdout = self
        self._blocos = [np.ascontiguousarray(quadro, dtype=np.int16).tobytes() for quadro in quadros]
        self._pausa_s = pausa_s
        self.returncode: int | None = None

    def read(self, n: int) -> bytes:
        time.sleep(self._pausa_s)
        if not self._blocos:
            return b""
        bloco = self._blocos.pop(0)
        if len(bloco) != n:
            raise AssertionError(f"quadro com {len(bloco)} bytes, esperado {n}")
        return bloco

    def poll(self) -> int | None:
        return self.returncode

    def terminate(self) -> None:
        self.returncode = 0

    def kill(self) -> None:
        self.returncode = -9

    def wait(self, timeout: float | None = None) -> int:
        self.returncode = 0 if self.returncode is None else self.returncode
        return self.returncode


class _Stt:
    def __init__(self, texto: str | None = None, erro: str | None = None) -> None:
        self.texto = texto
        self.erro = erro

    def transcribe(self, _audio: np.ndarray) -> str:
        if self.erro is not None:
            raise RuntimeError(self.erro)
        return self.texto or ""


def _fala() -> np.ndarray:
    quadro = np.zeros(QUADRO, dtype=np.int16)
    quadro[: QUADRO // 2] = 4000
    quadro[QUADRO // 2 :] = -4000
    return quadro


def _mudo() -> np.ndarray:
    return np.zeros(QUADRO, dtype=np.int16)


def _ativar() -> float:
    captura = _Captura([_fala()], pausa_s=0)
    detectou, score, _pico, _trecho, _pos = escutar._aguardar(
        _Detector(),
        "nome",
        captura,
        0.5,
        time.time(),
        0,
        guardar=False,
        diagnostico=False,
        arranque_s=0,
    )
    assert detectou, "a ativação simulada não disparou"
    assert score == 0.9
    return score


def _pedido(com_fala: bool) -> _Captura:
    if com_fala:
        quadros = [_fala(), _fala(), *[_mudo() for _ in range(8)]]
    else:
        quadros = [_mudo() for _ in range(8)]
    return _Captura(quadros, pausa_s=0.03)


def _fases(saida: str) -> list[str]:
    fases: list[str] = []
    for linha in saida.splitlines():
        if not linha.startswith("{"):
            continue
        try:
            payload = json.loads(linha)
        except json.JSONDecodeError:
            continue
        fase = payload.get("fase")
        if isinstance(fase, str):
            fases.append(fase)
    return fases


def _rodar(transcricao: str | None, erro: str | None, com_fala: bool) -> tuple[str, list[str]]:
    falas: list[str] = []

    def gravar(_destino: str, fala: str) -> None:
        falas.append(fala)

    escutar._falar = gravar
    score = _ativar()
    buffer = io.StringIO()
    with redirect_stdout(buffer):
        escutar._conduzir_pedido(
            destino="destino-simulado",
            abrir=lambda: _pedido(com_fala),
            limites=LimitesPedido(espera_s=0.08, silencio_s=0.05, maximo_s=2),
            pico_fala=200,
            obter_stt=lambda: _Stt(transcricao, erro),
            pico=score,
            acertos=1,
            score=score,
            tempos={},
            modelo="modelo-simulado",
            limiar=0.5,
        )
    return buffer.getvalue(), falas


def _self_test() -> None:
    assert escutar._falar_etapa.__kwdefaults__ == {"transcricao": None}

    saida, falas = _rodar("abre a porta", None, True)
    fases = _fases(saida)
    assert fases[:4] == ["saudacao", "ouvindo", "transcrevendo", "executando"], fases
    assert "falando" in fases
    assert fases[-1] == "aguardando", fases
    assert "Comando não disponível." in saida
    assert falas[0] == "Estou aqui."
    assert falas[-1] == "Esse comando ainda não está disponível."
    falando = [json.loads(linha) for linha in saida.splitlines() if linha.startswith("{") and '"falando"' in linha]
    assert falando[-1]["texto"] == "abre a porta"
    assert "abre a porta" not in falas

    saida, falas = _rodar("Que horas são?", None, True)
    assert _fases(saida)[-1] == "aguardando"
    assert falas[0] == "Estou aqui."
    assert "hora" in falas[-1]
    assert "Que horas são?" not in falas

    saida, falas = _rodar(None, None, False)
    fases = _fases(saida)
    assert fases[-1] == "aguardando", fases
    assert "executando" not in fases
    assert falas == ["Estou aqui.", "Não ouvi o pedido."]

    saida, falas = _rodar(None, "stt indisponível", True)
    assert _fases(saida)[-1] == "aguardando"
    assert "stt indisponível" in saida
    assert falas == ["Estou aqui.", "Não consegui transcrever."]
    print("ok")


if __name__ == "__main__":
    _self_test()
