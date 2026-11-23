"""Worker faster-whisper em subprocesso separado."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path

import numpy as np

from pcm_pipewire import amostras_mutas

_STT_WORKER = r"""
import os
import sys
import numpy as np
from faster_whisper import WhisperModel

modelo = WhisperModel(
    os.environ["MOAH_STT_MODEL"],
    device="cpu",
    compute_type="int8",
    local_files_only=True,
)
sys.stdout.write("READY\n")
sys.stdout.flush()
while True:
    cabeca = sys.stdin.buffer.read(8)
    if len(cabeca) < 8:
        break
    n = int.from_bytes(cabeca, "little")
    bruto = sys.stdin.buffer.read(n * 4)
    if len(bruto) < n * 4:
        break
    audio = np.frombuffer(bruto, dtype=np.float32).copy()
    segmentos, _ = modelo.transcribe(audio, language="pt")
    del audio
    sys.stdout.write("".join(s.text for s in segmentos).strip().replace("\n", " ") + "\n")
    sys.stdout.flush()
"""


class SttRemoto:
    def __init__(self, python: Path, modelo: Path) -> None:
        env = os.environ.copy()
        env["HF_HUB_OFFLINE"] = "1"
        env["MOAH_STT_MODEL"] = str(modelo)
        self._proc = subprocess.Popen(
            [str(python), "-u", "-c", _STT_WORKER],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
        pronto = self._proc.stdout.readline() if self._proc.stdout else b""
        if pronto.decode("utf-8", "replace").strip() != "READY":
            erro = self._proc.stderr.read().decode("utf-8", "replace") if self._proc.stderr else ""
            self.close()
            raise RuntimeError(f"Falha ao carregar STT: {erro.strip() or 'sem READY'}")

    def transcrever_pcm(self, audio: np.ndarray) -> str:
        if self._proc.stdin is None or self._proc.stdout is None:
            raise RuntimeError("STT encerrado.")
        payload = len(audio).to_bytes(8, "little") + audio.astype(np.float32, copy=False).tobytes()
        self._proc.stdin.write(payload)
        self._proc.stdin.flush()
        linha = self._proc.stdout.readline()
        if not linha:
            erro = self._proc.stderr.read().decode("utf-8", "replace") if self._proc.stderr else ""
            raise RuntimeError(f"STT encerrou durante a transcrição: {erro.strip()}")
        return linha.decode("utf-8", "replace").rstrip("\n")

    def close(self) -> None:
        if self._proc.poll() is not None:
            return
        if self._proc.stdin is not None:
            try:
                self._proc.stdin.close()
            except BrokenPipeError:
                pass
        self._proc.terminate()
        try:
            self._proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            self._proc.kill()
            self._proc.wait(timeout=1)


def transcrever_pedido(stt: SttRemoto, amostras: np.ndarray) -> str:
    if amostras_mutas(amostras):
        return ""
    audio = amostras.astype(np.float32) / 32768.0
    try:
        conteudo = stt.transcrever_pcm(audio)
        print(f"Transcricao: {conteudo}")
        return conteudo
    finally:
        del audio


def transcrever_pedido_seguro(stt: SttRemoto, amostras: np.ndarray) -> str:
    try:
        return transcrever_pedido(stt, amostras)
    except Exception:
        return ""