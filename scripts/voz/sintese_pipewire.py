"""Síntese espeak + reprodução pw-play."""

from __future__ import annotations

import subprocess
import tempfile
from pathlib import Path

_reproducao: subprocess.Popen[bytes] | None = None


def _executar(comando: list[str]) -> None:
    global _reproducao
    _reproducao = subprocess.Popen(comando, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    codigo = _reproducao.wait()
    erro = _reproducao.stderr.read().decode("utf-8", "replace").strip() if _reproducao.stderr else ""
    _reproducao = None
    if codigo != 0:
        raise subprocess.CalledProcessError(codigo, comando, stderr=erro)


def parar_reproducao() -> None:
    global _reproducao
    if _reproducao is None or _reproducao.poll() is not None:
        _reproducao = None
        return
    _reproducao.terminate()
    try:
        _reproducao.wait(timeout=1)
    except subprocess.TimeoutExpired:
        _reproducao.kill()
        _reproducao.wait(timeout=1)
    _reproducao = None


def falar(destino: str, texto: str) -> None:
    with tempfile.TemporaryDirectory() as pasta:
        arquivo = Path(pasta) / "fala.wav"
        _executar(["espeak", "-v", "pt-br", "-s", "140", "-w", str(arquivo), texto])
        _executar(["pw-play", "--target", destino, str(arquivo)])


def falar_seguro(destino: str, texto: str) -> str | None:
    try:
        falar(destino, texto)
        return None
    except Exception as exc:
        detalhe = str(exc).strip()
        return detalhe or type(exc).__name__


def saudacao(destino: str) -> None:
    falar(destino, "Estou aqui.")