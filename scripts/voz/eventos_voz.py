"""JSON de estado e configuração impresso na stdout."""

from __future__ import annotations

import hashlib
import json
import os
import sys
import time
import wave
from pathlib import Path

import numpy as np

from janela_pedido import LimitesPedido
from voz_constantes import (
    CANAIS,
    FORMATO,
    POS_CONFIRMACAO_S,
    PRE_CONFIRMACAO_S,
    QUADRO,
    TAXA,
)


def ms_desde(inicio: float) -> int:
    return int((time.perf_counter() - inicio) * 1000)


_enxuto = False


def definir_console(enxuto: bool) -> None:
    global _enxuto
    _enxuto = enxuto


def diag(mensagem: str) -> None:
    print(f"diagnostico {mensagem}", flush=True)


def emitir_tempos(valores: dict[str, int]) -> None:
    if _enxuto:
        return
    json.dump({"temposMs": valores}, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    sys.stdout.flush()


def voz_dir() -> Path:
    override = os.environ.get("MOAH_VOICE_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".local" / "share" / "moah" / "voz"


def salvar_wav_confirmacao(pasta: Path, indice: int, amostras: np.ndarray) -> Path:
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / f"confirmacao-{indice:02d}.wav"
    pcm = np.ascontiguousarray(amostras, dtype=np.int16)
    with wave.open(str(destino), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(TAXA)
        wav.writeframes(pcm.tobytes())
    return destino.resolve()


def emitir_configuracao(
    *,
    modelo: Path,
    chave: str,
    limiar: float,
    origem: str,
    destino: str,
    modo_confirmacao: str,
    diagnostico: bool,
    gravar: bool,
    salvar_wavs: bool,
    depurar: bool,
    limites: LimitesPedido,
    pico_fala: float,
    arranque: float,
    verificador,
    manifesto,
    status_verificador: str,
    limiar_verificador: float,
    modo_verificador: str,
    voz_dir_path: Path,
) -> None:
    digest = hashlib.sha256(modelo.read_bytes()).hexdigest()
    payload = {
        "configuracao": {
            "modelo": str(modelo),
            "chave": chave,
            "sha256": digest,
            "limiar": limiar,
            "taxa": TAXA,
            "canais": CANAIS,
            "formato": FORMATO,
            "quadro": QUADRO,
            "vad": 0,
            "origem": origem,
            "destino": destino,
            "confirmarAtivacao": modo_confirmacao != "nao",
            "modoConfirmacao": modo_confirmacao,
            "diagnostico": diagnostico,
            "gravarDiagnostico": gravar,
            "salvarWavs": salvar_wavs,
            "depurar": depurar,
            "pastaWavs": str(voz_dir_path / "diagnostico" / "wavs"),
            "modoVerificador": modo_verificador,
            "verificador": {
                "status": status_verificador,
                "caminho": verificador.caminho if verificador else None,
                "sha256": verificador.sha256 if verificador else None,
                "limiar": limiar_verificador,
                "validado": manifesto.validado if manifesto else False,
            },
            "janelaConfirmacaoSegundos": {
                "antes": PRE_CONFIRMACAO_S,
                "depois": POS_CONFIRMACAO_S,
            },
            "esperaS": limites.espera_s,
            "silencioS": limites.silencio_s,
            "pedidoMaxS": limites.maximo_s,
            "picoFala": pico_fala,
            "arranqueS": arranque,
        }
    }
    if _enxuto:
        print(
            f"escuta limiar={limiar} verificador={modo_verificador} limiar_verificador={limiar_verificador}",
            flush=True,
        )
        return
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    sys.stdout.flush()


def emitir_estado(
    fase: str,
    microfone: str,
    pico: float = 0,
    acertos: int = 0,
    eco: bool = False,
    texto: str | None = None,
    score: float | None = None,
    modelo: str | None = None,
    limiar: float | None = None,
    confirmarAtivacao: bool | None = None,
    modoConfirmacao: str | None = None,
    scoreVerificador: float | None = None,
    motivoRejeicao: str | None = None,
    etapa: str | None = None,
    detectorConfirmado: bool = False,
) -> None:
    etapas = {
        "aguardando": "aguardando ativação",
        "verificando": "verificando candidato",
        "confirmada": "chamada confirmada",
        "saudacao": "respondendo à ativação",
        "ouvindo": "ouvindo",
        "transcrevendo": "transcrevendo",
        "executando": "executando",
        "falando": "falando",
        "desligado": "desligado",
    }
    payload: dict[str, object] = {
        "fase": fase,
        "etapa": etapas.get(fase, fase),
        "microfone": microfone,
        "pico": round(pico, 4),
        "acertos": acertos,
        "eco": eco,
        "detectorConfirmado": detectorConfirmado,
    }
    if score is not None:
        payload["score"] = round(score, 4)
    if modelo is not None:
        payload["modelo"] = modelo
    if limiar is not None:
        payload["limiar"] = limiar
    if confirmarAtivacao is not None:
        payload["confirmarAtivacao"] = confirmarAtivacao
    if modoConfirmacao is not None:
        payload["modoConfirmacao"] = modoConfirmacao
    if scoreVerificador is not None:
        payload["scoreVerificador"] = round(scoreVerificador, 4)
    if motivoRejeicao is not None:
        payload["motivoRejeicao"] = motivoRejeicao
    if etapa is not None:
        payload["etapaConfirmacao"] = etapa
    if texto is not None:
        payload["texto"] = texto
    if _enxuto:
        if fase != "verificando":
            print(fase, flush=True)
        return
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    sys.stdout.flush()