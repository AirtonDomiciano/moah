"""Síntese da fala e reprodução pw-play.

O laço usa a voz Piper Faber. O espeak continua só na comparação.
"""

from __future__ import annotations

import json
import os
import subprocess
import tempfile
from pathlib import Path

VOZ_PADRAO = "faber"
MODELOS = {
    "faber": "pt_BR-faber-medium.onnx",
    "cadu": "pt_BR-cadu-medium.onnx",
    "jeff": "pt_BR-jeff-medium.onnx",
    "edresson": "pt_BR-edresson-low.onnx",
    "tugao": "pt_PT-tugão-medium.onnx",
}

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


def pasta_voz() -> Path:
    override = os.environ.get("MOAH_VOICE_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".local" / "share" / "moah" / "voz"


def modelo_piper(voz: str) -> Path:
    nome = MODELOS.get(voz)
    if nome is None:
        raise RuntimeError("Use espeak, faber, cadu, jeff, edresson ou tugao.")
    return pasta_voz() / "sintese" / "vozes" / nome


def sintetizar_piper(voz: str, texto: str, arquivo: Path) -> None:
    modelo = modelo_piper(voz)
    config = Path(f"{modelo}.json")
    interpretador = pasta_voz() / "sintese" / "venv" / "bin" / "python"
    if not interpretador.is_file():
        raise RuntimeError("Piper ausente. O ambiente de síntese ainda não foi instalado.")
    if not modelo.is_file() or not config.is_file():
        raise RuntimeError(f"Voz ausente: {modelo.name}.")
    _executar(
        [
            str(interpretador),
            "-m",
            "piper",
            "--model",
            str(modelo),
            "--config",
            str(config),
            "--output-file",
            str(arquivo),
            "--",
            texto,
        ]
    )


def falar_espeak(destino: str, texto: str) -> None:
    with tempfile.TemporaryDirectory() as pasta:
        arquivo = Path(pasta) / "fala.wav"
        _executar(["espeak", "-v", "pt-br", "-s", "140", "-w", str(arquivo), texto])
        reproduzir(destino, arquivo)


def diretorio_config() -> Path:
    override = os.environ.get("MOAH_CONFIG_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    xdg = os.environ.get("XDG_CONFIG_HOME", "").strip()
    if xdg:
        return Path(xdg).expanduser().resolve() / "moah"
    return Path.home() / ".config" / "moah"


def voz_configurada() -> str:
    arquivo = diretorio_config() / "config.json"
    if not arquivo.is_file():
        return VOZ_PADRAO
    try:
        dados = json.loads(arquivo.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        print("erro=Configuração de voz ilegível. Usando faber.", flush=True)
        return VOZ_PADRAO
    bloco = dados.get("voz") if isinstance(dados, dict) else None
    sintese = bloco.get("sintese") if isinstance(bloco, dict) else None
    if sintese is None:
        return VOZ_PADRAO
    if sintese == "espeak" or sintese in MODELOS:
        return str(sintese)
    print(f"erro=Voz desconhecida: {sintese}. Usando faber.", flush=True)
    return VOZ_PADRAO


def falar(destino: str, texto: str, voz: str | None = None) -> None:
    escolhida = voz or voz_configurada()
    if escolhida == "espeak":
        falar_espeak(destino, texto)
        return
    try:
        with tempfile.TemporaryDirectory() as pasta:
            arquivo = Path(pasta) / "fala.wav"
            sintetizar_piper(escolhida, texto, arquivo)
            reproduzir(destino, arquivo)
    except Exception as exc:
        detalhe = " ".join(str(exc).split()) or type(exc).__name__
        print(f"erro=Piper falhou ({escolhida}): {detalhe}. Usando espeak.", flush=True)
        falar_espeak(destino, texto)


def reproduzir(destino: str, arquivo: Path) -> None:
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