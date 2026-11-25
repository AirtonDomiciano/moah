"""Regressão do turno falado. Simula captura, transcrição e alto-falante.

Não substitui _falar_etapa: a resposta do pedido não suportado passa pela
chamada que quebrava com texto= e transcricao ao mesmo tempo.
"""

from __future__ import annotations

import io
import json
import subprocess
import tempfile
import time
import wave
from contextlib import redirect_stdout
from pathlib import Path

import numpy as np

import escutar
import sintese_pipewire
from janela_pedido import LimitesPedido
from pcm_pipewire import tem_fala
from presenca_fala import avaliar_presenca

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
        self.chamadas = 0
        self.audios: list[np.ndarray] = []

    def transcribe(self, audio: np.ndarray) -> str:
        self.audios.append(np.array(audio, copy=True))
        if self.erro is not None:
            raise RuntimeError(self.erro)
        return self.texto or ""

    def transcrever_pcm(self, audio: np.ndarray) -> str:
        return self.transcribe(audio)


_SINTOSE: dict[str, np.ndarray] = {}


def _sintese(texto: str) -> np.ndarray:
    pronto = _SINTOSE.get(texto)
    if pronto is not None:
        return pronto
    with tempfile.TemporaryDirectory() as pasta:
        arquivo = Path(pasta) / "fala.wav"
        subprocess.check_call(
            ["espeak", "-v", "pt-br", "-s", "140", "-w", str(arquivo), texto],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        with wave.open(str(arquivo), "rb") as wav:
            pcm = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).copy()
            taxa = wav.getframerate()
    n = int(round(pcm.size * 16000 / taxa))
    pcm = pcm[np.linspace(0, pcm.size - 1, n).astype(np.int32)]
    _SINTOSE[texto] = pcm
    return pcm


def _quadros_fala(texto: str) -> list[np.ndarray]:
    pcm = _sintese(texto)
    quadros = [pcm[i : i + QUADRO] for i in range(0, pcm.size - QUADRO + 1, QUADRO)]
    while quadros and not tem_fala(quadros[-1], 200):
        quadros.pop()
    assert quadros, texto
    assert avaliar_presenca(np.concatenate(quadros)).fala, texto
    return [quadro.copy() for quadro in quadros]


def _ruido(n: int, semente: int = 1) -> np.ndarray:
    rng = np.random.default_rng(semente)
    audio = np.clip(rng.normal(0, 4000 / 3.5, n), -32767, 32767).astype(np.int16)
    assert tem_fala(audio, 200)
    assert not avaliar_presenca(audio).fala
    return audio


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
        quadros = [*_quadros_fala("que horas são"), *[_mudo() for _ in range(12)]]
    else:
        quadros = [_mudo() for _ in range(12)]
    return _Captura(quadros, pausa_s=0.02)


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


def _rodar(
    transcricao: str | None,
    erro: str | None,
    com_fala: bool,
    *,
    quadros: list[np.ndarray] | None = None,
    pre_cauda: np.ndarray | None = None,
    espera_s: float = 1.2,
    silencio_s: float = 0.18,
    pausa_s: float = 0.02,
) -> tuple[str, list[str], _Stt]:
    falas: list[str] = []
    stt = _Stt(transcricao, erro)

    def gravar(_destino: str, fala: str) -> None:
        falas.append(fala)

    def obter() -> _Stt:
        stt.chamadas += 1
        return stt

    sintese_pipewire.falar = gravar
    escutar._falar = gravar
    score = _ativar()
    fonte = _pedido(com_fala) if quadros is None else _Captura(quadros, pausa_s=pausa_s)
    buffer = io.StringIO()
    with redirect_stdout(buffer):
        escutar._conduzir_pedido(
            destino="destino-simulado",
            abrir=lambda: fonte,
            limites=LimitesPedido(espera_s=espera_s, silencio_s=silencio_s, maximo_s=4),
            pico_fala=200,
            obter_stt=obter,
            pico=score,
            acertos=1,
            score=score,
            tempos={},
            modelo="modelo-simulado",
            limiar=0.5,
            pre_cauda=pre_cauda,
        )
    return buffer.getvalue(), falas, stt


def _pcm_stt(audio: np.ndarray) -> np.ndarray:
    return np.round(audio * 32768.0).astype(np.int16)


def _pedido_linha(saida: str) -> str:
    for linha in saida.splitlines():
        if linha.startswith("pedido motivo="):
            return linha
    raise AssertionError(saida)


def _self_test() -> None:
    assert escutar._falar_etapa.__kwdefaults__ == {"transcricao": None}

    fala = _quadros_fala("abre a porta")
    saida, falas, stt = _rodar(
        "abre a porta",
        None,
        True,
        quadros=[*fala, *[_mudo() for _ in range(12)]],
    )
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
    assert stt.chamadas == 1 and "presenca=fala" in saida and "encaminhaConsulta=sim" in saida
    pedido = _pcm_stt(stt.audios[0])
    assert np.array_equal(pedido[:QUADRO], fala[0])
    assert pedido.size > len(fala) * QUADRO

    saida, falas, stt = _rodar("Que horas são?", None, True)
    assert _fases(saida)[-1] == "aguardando"
    assert falas[0] == "Estou aqui."
    assert "hora" in falas[-1]
    assert "Que horas são?" not in falas
    assert stt.chamadas == 1

    mudos = [_mudo() for _ in range(16)]
    saida, falas, stt = _rodar(None, None, False, quadros=mudos, espera_s=0.16)
    fases = _fases(saida)
    assert fases[-1] == "aguardando", fases
    assert "transcrevendo" not in fases and "executando" not in fases
    assert falas == ["Estou aqui.", "Não ouvi o pedido."]
    assert stt.chamadas == 0
    assert "presenca=sem_fala" in _pedido_linha(saida) and "motivo=espera" in _pedido_linha(saida)
    assert "encaminhaConsulta" not in saida and "diagnostico stt" not in saida

    saida, falas, stt = _rodar(None, "stt indisponível", True)
    assert _fases(saida)[-1] == "aguardando"
    assert "stt indisponível" in saida
    assert falas == ["Estou aqui.", "Não consegui transcrever."]
    assert stt.chamadas == 1

    _cenarios_da_cauda()
    print("ok")


def _cenarios_da_cauda() -> None:
    pausa = 0.02
    silencio = 0.18
    # Chamada sem pedido: já coberto acima. Cauda com pico, sem fala, não arma o silêncio.
    cauda_ruido = _ruido(7040)
    mudos = [_mudo() for _ in range(20)]
    saida, falas, stt = _rodar(
        "Legenda indevida",
        None,
        False,
        quadros=mudos,
        pre_cauda=cauda_ruido,
        espera_s=0.22,
        silencio_s=silencio,
        pausa_s=pausa,
    )
    assert "motivo=espera" in _pedido_linha(saida), _pedido_linha(saida)
    assert "presenca=sem_fala" in saida
    assert stt.chamadas == 0 and "executando" not in _fases(saida)
    assert falas == ["Estou aqui.", "Não ouvi o pedido."]
    assert "Legenda indevida" not in saida

    # Ruído ao vivo, sem fala: o pico não encerra no silêncio curto nem chama o STT.
    ruido = _ruido(6 * QUADRO, semente=2)
    quadros_ruido = [ruido[i : i + QUADRO] for i in range(0, ruido.size, QUADRO)]
    saida, falas, stt = _rodar(
        "Legenda indevida",
        None,
        False,
        quadros=[*quadros_ruido, *[_mudo() for _ in range(20)]],
        espera_s=0.28,
        silencio_s=0.1,
        pausa_s=pausa,
    )
    assert "motivo=espera" in _pedido_linha(saida), _pedido_linha(saida)
    assert stt.chamadas == 0 and falas[-1] == "Não ouvi o pedido."

    # Pergunta depois da saudação, com demora maior que o silêncio e menor que a espera.
    pergunta = _quadros_fala("que horas são")
    demora = [_mudo() for _ in range(12)]
    saida, falas, stt = _rodar(
        "Que horas são?",
        None,
        True,
        quadros=[*demora, *pergunta, *[_mudo() for _ in range(12)]],
        pre_cauda=cauda_ruido,
        espera_s=1.2,
        silencio_s=silencio,
        pausa_s=pausa,
    )
    assert "motivo=silencio" in _pedido_linha(saida), _pedido_linha(saida)
    assert stt.chamadas == 1 and "executando" in _fases(saida)
    audio = _pcm_stt(stt.audios[0])
    offset = cauda_ruido.size + len(demora) * QUADRO
    assert audio.size >= offset + len(pergunta) * QUADRO
    assert np.array_equal(audio[: cauda_ruido.size], cauda_ruido)
    assert np.array_equal(audio[offset : offset + QUADRO], pergunta[0])
    assert np.array_equal(audio[offset + (len(pergunta) - 1) * QUADRO : offset + len(pergunta) * QUADRO], pergunta[-1])

    # Chamada e pedido juntos: a cauda com fala entra inteira e o fim permanece.
    pedido = np.concatenate(pergunta)
    assert avaliar_presenca(pedido).fala
    saida, _falas, stt = _rodar(
        "Que horas são?",
        None,
        True,
        quadros=[*pergunta[:4], *[_mudo() for _ in range(16)]],
        pre_cauda=pedido,
        espera_s=1.2,
        silencio_s=0.25,
        pausa_s=pausa,
    )
    assert "motivo=silencio" in _pedido_linha(saida), _pedido_linha(saida)
    assert stt.chamadas == 1
    audio = _pcm_stt(stt.audios[0])
    assert np.array_equal(audio[: pedido.size], pedido)
    continuacao = np.concatenate(pergunta[:4])
    assert np.array_equal(audio[pedido.size : pedido.size + continuacao.size], continuacao)
    assert audio.size > pedido.size + continuacao.size


if __name__ == "__main__":
    _self_test()
