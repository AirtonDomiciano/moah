#!/usr/bin/env python3
"""Reproduz WAV salvo pelo mesmo caminho de verificador ou STT (sem microfone)."""

from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

from audio_metricas import pipeline_ponto, resumo_audio
from verificador_acustico import resolver_verificador


def _ler_wav(caminho: Path) -> tuple[np.ndarray, int]:
    with wave.open(str(caminho), "rb") as wav:
        taxa = wav.getframerate()
        canais = wav.getnchannels()
        largura = wav.getsampwidth()
        if largura != 2:
            raise SystemExit(f"Esperado PCM 16 bit; largura={largura}")
        if canais != 1:
            raise SystemExit(f"Esperado mono; canais={canais}")
        bruto = wav.readframes(wav.getnframes())
    amostras = np.frombuffer(bruto, dtype=np.int16)
    return amostras, taxa


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--etapa", required=True, choices=("verificador", "stt"))
    parser.add_argument("--wav", required=True)
    parser.add_argument("--saida", default="")
    parser.add_argument("--recursos", default="/home/airtondev/hey_pran_work")
    parser.add_argument("--limiar-verificador", type=float, default=0.95)
    parser.add_argument("--modo-verificador", default="teste", choices=("producao", "manual", "teste"))
    parser.add_argument("--verificador", default="")
    parser.add_argument(
        "--contexto",
        default="pedido",
        choices=("pedido", "confirmacao"),
        help="confirmacao: também testa atender_por_texto no texto transcrito",
    )
    parser.add_argument("--confirmacao-flexivel", default="nao", choices=("sim", "nao"))
    args = parser.parse_args()
    caminho = Path(args.wav).expanduser().resolve()
    if not caminho.is_file():
        raise SystemExit(f"WAV ausente: {caminho}")
    amostras, taxa = _ler_wav(caminho)
    if taxa != 16_000:
        raise SystemExit(f"Taxa {taxa} Hz; o pipeline usa 16000 Hz.")

    metricas = resumo_audio(amostras, taxa=taxa)
    print(json.dumps({"wav": caminho.as_posix(), "metricas": metricas}, ensure_ascii=False), flush=True)

    if args.etapa == "verificador":
        voz_dir = _voz_dir(args.saida)
        recursos = Path(args.recursos)
        override = Path(args.verificador).resolve() if args.verificador.strip() else None
        verificador, manifesto, status = resolver_verificador(voz_dir, recursos, override)
        if verificador is None:
            raise SystemExit(f"Verificador indisponível: status={status}")
        modo = args.modo_verificador
        if modo == "manual":
            permitir = False
            motivo_bloqueio = "modo_manual"
        elif modo == "teste":
            permitir = True
            motivo_bloqueio = ""
        else:
            permitir = bool(manifesto and manifesto.validado)
            motivo_bloqueio = "modelo_nao_validado"
        pipeline_ponto(
            "reproduzir_verificador_entrada",
            amostras=amostras,
            imprimir=True,
            limiar=args.limiar_verificador,
            modoVerificador=modo,
        )
        resultado = verificador.verificar(
            amostras,
            args.limiar_verificador,
            permitir=permitir,
            motivo_bloqueio=motivo_bloqueio,
        )
        print(
            json.dumps(
                {
                    "score": resultado.score,
                    "limiar": resultado.limiar,
                    "motivo": resultado.motivo,
                    "aceito": resultado.aceito,
                    "indiceJanela": resultado.indice_janela,
                    "fimJanelaS": resultado.fim_janela_s,
                },
                ensure_ascii=False,
            ),
            flush=True,
        )
        return

    # STT — mesmo worker que escutar.py
    from stt_remoto import SttRemoto, transcrever_pedido
    from voz_constantes import TAXA

    if taxa != TAXA:
        raise SystemExit("STT exige 16 kHz.")
    voz_dir = _voz_dir(args.saida)
    stt_dir = voz_dir / "stt" / "faster-whisper-small"
    stt_python = voz_dir / "stt" / "venv" / "bin" / "python"
    pipeline_ponto("reproduzir_stt_entrada", amostras=amostras, imprimir=True)
    stt = SttRemoto(stt_python, stt_dir)
    try:
        texto = transcrever_pedido(stt, amostras)
    finally:
        stt.close()
    payload: dict[str, object] = {"etapaStt": args.contexto, "texto": texto}
    if args.contexto == "confirmacao":
        from decisao_atender import atender_por_texto

        flexivel = args.confirmacao_flexivel == "sim"
        aceito, normalizado = atender_por_texto(texto, flexivel=flexivel)
        payload["normalizado"] = normalizado
        payload["aceitoComoNome"] = aceito
    print(json.dumps(payload, ensure_ascii=False), flush=True)


def _voz_dir(override: str) -> Path:
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".local" / "share" / "moah" / "voz"


if __name__ == "__main__":
    main()