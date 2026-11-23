"""Presença de fala: decisão pura e VAD real em sintéticos e WAVs locais."""

from __future__ import annotations

import sys
import wave
from pathlib import Path

import numpy as np

from presenca_fala import (
    PresencaFala,
    aplicar_presenca,
    avaliar_presenca,
    decidir_presenca,
    medir_energia_ms,
)


def _pcm(segundos: float, valor: int = 0) -> np.ndarray:
    return np.full(int(16000 * segundos), valor, dtype=np.int16)


def _test_decisao() -> None:
    silencio = decidir_presenca(vad_max=0.02, vad_ms_forte=0, vad_ms_fraco=0, energia_ms=0)
    assert not silencio.fala and silencio.motivo == "sem_fala"

    ruido = decidir_presenca(vad_max=0.12, vad_ms_forte=0, vad_ms_fraco=0, energia_ms=0)
    assert not ruido.fala

    estalo = decidir_presenca(vad_max=0.06, vad_ms_forte=0, vad_ms_fraco=0, energia_ms=160)
    assert not estalo.fala

    # Meio do vão medido: blip sem fala 64 ms; fala curta 256 ms no limiar 0,35.
    blip = decidir_presenca(vad_max=0.40, vad_ms_forte=0, vad_ms_fraco=64, energia_ms=80)
    assert not blip.fala
    curta = decidir_presenca(vad_max=0.63, vad_ms_forte=32, vad_ms_fraco=256, energia_ms=80)
    assert curta.fala and curta.motivo == ""

    forte = decidir_presenca(vad_max=0.90, vad_ms_forte=160, vad_ms_fraco=160, energia_ms=0)
    assert forte.fala
    quase = decidir_presenca(vad_max=0.90, vad_ms_forte=128, vad_ms_fraco=128, energia_ms=0)
    assert not quase.fala

    # Energia só confirma se o VAD também vê voz; estalo longo sem voz não passa.
    batida = decidir_presenca(vad_max=0.10, vad_ms_forte=0, vad_ms_fraco=0, energia_ms=480)
    assert not batida.fala
    tomada_fraca = decidir_presenca(vad_max=0.63, vad_ms_forte=32, vad_ms_fraco=64, energia_ms=560)
    assert tomada_fraca.fala

    sem_modelo = decidir_presenca(vad_max=None, vad_ms_forte=0, vad_ms_fraco=0, energia_ms=320)
    assert sem_modelo.fala
    sem_modelo_curto = decidir_presenca(vad_max=None, vad_ms_forte=0, vad_ms_fraco=0, energia_ms=160)
    assert not sem_modelo_curto.fala


def _test_modos() -> None:
    sem = PresencaFala(False, "sem_fala", 0.04, 0, 0)
    com = PresencaFala(True, "", 0.9, 320, 480)
    assert aplicar_presenca(sem, True, "acima_limiar") == (False, "sem_fala")
    assert aplicar_presenca(com, False, "modo_manual") == (False, "modo_manual")
    assert aplicar_presenca(com, False, "modelo_nao_validado") == (False, "modelo_nao_validado")
    assert aplicar_presenca(com, False, "abaixo_limiar") == (False, "abaixo_limiar")
    assert aplicar_presenca(com, True, "acima_limiar") == (True, "acima_limiar")


def _test_energia_sintetica() -> None:
    assert medir_energia_ms(_pcm(3.36)) == 0
    rng = np.random.default_rng(0)
    ruido = np.clip(rng.normal(0, 180 / 3.5, 53760), -32767, 32767).astype(np.int16)
    assert medir_energia_ms(ruido) == 0
    estalo = np.zeros(53760, dtype=np.int16)
    estalo[20000:20008] = 12000
    assert medir_energia_ms(estalo) <= 160


def _test_modelo_sintetico() -> None:
    silencio = avaliar_presenca(_pcm(3.36))
    assert silencio.vad_max is not None, "silero_vad_v6 ausente no ambiente do escutar"
    assert not silencio.fala and silencio.motivo == "sem_fala"

    rng = np.random.default_rng(1)
    for desvio in (180 / 3.5, 4000 / 3.5):
        ruido = np.clip(rng.normal(0, desvio, 53760), -32767, 32767).astype(np.int16)
        assert not avaliar_presenca(ruido).fala, desvio

    estalo = np.zeros(53760, dtype=np.int16)
    estalo[20000:20160] = np.linspace(8000, 0, 160).astype(np.int16)
    assert not avaliar_presenca(estalo).fala


def _ler(caminho: Path) -> np.ndarray:
    with wave.open(str(caminho), "rb") as wav:
        if wav.getframerate() != 16000 or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise AssertionError(f"formato inesperado: {caminho}")
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).copy()


def _recorte(pcm: np.ndarray, n: int = 53760) -> np.ndarray:
    if pcm.size <= n:
        return pcm
    ini = (pcm.size - n) // 2
    return pcm[ini : ini + n]


def _test_corpus() -> None:
    voz = Path.home() / ".local" / "share" / "moah" / "voz"
    sessao = voz / "coleta" / "sessoes" / "sessao-03"
    conversa = voz / "avaliacao" / "gerado" / "conversa"
    if not sessao.is_dir() or not conversa.is_dir():
        print("corpus local ausente; só sintéticos", file=sys.stderr)
        return
    for wav in sorted(sessao.glob("tomada-*.wav")):
        presenca = avaliar_presenca(_ler(wav))
        assert presenca.fala, f"{wav.name} vad={presenca.vad_max} energia={presenca.energia_ms}"
    for wav in sorted(conversa.glob("*.wav")):
        presenca = avaliar_presenca(_ler(wav))
        assert presenca.fala, wav.name

    reservados = (voz / "avaliacao" / "reservados.txt").read_text(encoding="utf8").split()
    # Estacionários na medição de 23/11: VAD máximo < 0,2 e sem contraste de 4×.
    estacionarios = {
        "ogHTHIYZq80.wav",
        "owic-GeWQco.wav",
        "s7sRKH_EdAY.wav",
        "003538.wav",
        "003720.wav",
    }
    vistos = 0
    for item in reservados:
        caminho = Path(item)
        if caminho.name not in estacionarios or not caminho.is_file():
            continue
        presenca = avaliar_presenca(_recorte(_ler(caminho)))
        assert not presenca.fala, f"{caminho.name} vad={presenca.vad_max} energia={presenca.energia_ms}"
        vistos += 1
    assert vistos == len(estacionarios)

    cama_path = voz / "diagnostico" / "wavs" / "verificador" / "candidato-20261123-131916.wav"
    fala_path = sessao / "tomada-01.wav"
    if not cama_path.is_file():
        print("candidato quieto ausente; mistura de volume não rodou", file=sys.stderr)
        return
    cama = _ler(cama_path)
    fala = _recorte(_ler(fala_path), cama.size)
    for ganho, espera in ((0.5, True), (0.06, True), (0.03, True), (0.02, False)):
        mix = np.clip(cama.astype(np.float32) + fala.astype(np.float32) * ganho, -32767, 32767).astype(np.int16)
        presenca = avaliar_presenca(mix)
        assert presenca.fala is espera, f"ganho={ganho} fala={presenca.fala} vad={presenca.vad_max}"
    quietos = [
        voz / "diagnostico" / "wavs" / "verificador" / "candidato-20261123-131911.wav",
        cama_path,
    ]
    for wav in quietos:
        presenca = avaliar_presenca(_ler(wav))
        assert not presenca.fala, wav.name


def _self_test() -> None:
    _test_decisao()
    _test_modos()
    _test_energia_sintetica()
    _test_modelo_sintetico()
    _test_corpus()
    print("ok")


if __name__ == "__main__":
    _self_test()
