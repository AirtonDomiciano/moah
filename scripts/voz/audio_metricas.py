"""Métricas de áudio para depuração do pipeline (sem imprimir por quadro)."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import numpy as np

TAXA_PADRAO = 16_000
PICO_MUDO = 50.0


def resumo_audio(amostras: np.ndarray, *, taxa: int = TAXA_PADRAO) -> dict[str, Any]:
    n = int(amostras.size)
    if n == 0:
        return {
            "taxaHz": taxa,
            "amostras": 0,
            "duracaoS": 0.0,
            "rms": 0.0,
            "pico": 0,
            "dc": 0.0,
            "mudo": True,
        }
    amostras = np.ascontiguousarray(amostras, dtype=np.int16)
    dc = float(np.mean(amostras))
    sem = amostras.astype(np.float32) - dc
    pico = int(np.max(np.abs(sem))) if sem.size else 0
    rms = float(np.sqrt(np.mean(sem.astype(np.float64) ** 2)))
    mudo = pico < PICO_MUDO
    return {
        "taxaHz": taxa,
        "amostras": n,
        "duracaoS": round(n / taxa, 4),
        "rms": round(rms, 2),
        "pico": pico,
        "dc": round(dc, 2),
        "mudo": mudo,
    }


def pipeline_ponto(
    nome: str,
    *,
    amostras: np.ndarray | None = None,
    imprimir: bool = False,
    taxa: int = TAXA_PADRAO,
    **extras: Any,
) -> dict[str, Any]:
    """Âncora para breakpoints: retorna dict inspecionável; imprime só se pedido."""
    payload: dict[str, Any] = {"ponto": nome, **extras}
    if amostras is not None:
        payload["audio"] = resumo_audio(amostras, taxa=taxa)
    if imprimir:
        print(f"pipeline {json.dumps(payload, ensure_ascii=False)}", flush=True)
    return payload


def salvar_wav_int16(destino: Path, amostras: np.ndarray, *, taxa: int = TAXA_PADRAO) -> Path:
    import wave

    destino.parent.mkdir(parents=True, exist_ok=True)
    pcm = np.ascontiguousarray(amostras, dtype=np.int16)
    with wave.open(str(destino), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(taxa)
        wav.writeframes(pcm.tobytes())
    return destino.resolve()


def salvar_wav_com_metricas(
    base: Path,
    subpasta: str,
    rotulo: str,
    amostras: np.ndarray,
    *,
    taxa: int = TAXA_PADRAO,
    extras: dict[str, Any] | None = None,
) -> tuple[Path, dict[str, Any]]:
    from datetime import datetime

    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    pasta = base / "diagnostico" / "wavs" / subpasta
    wav = pasta / f"{rotulo}-{stamp}.wav"
    salvar_wav_int16(wav, amostras, taxa=taxa)
    metricas = resumo_audio(amostras, taxa=taxa)
    meta = {"rotulo": rotulo, "wav": wav.as_posix(), "metricas": metricas, **(extras or {})}
    meta_path = wav.with_suffix(".json")
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf8")
    return wav.resolve(), meta