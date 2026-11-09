#!/usr/bin/env python3
"""Escuta o microfone nomeado, responde à pronúncia e transcreve o pedido.

Não grava o ambiente. Fecha a captura antes da saudação. Descarta o buffer do
pedido após a transcrição. O STT roda no venv separado sob MOAH_VOICE_DIR/stt.
"""

from __future__ import annotations

import argparse
import json
import os
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np

TAXA = 16_000
QUADRO = 1280
PEDIDO_S = 8.0
PICO_MUDO = 50.0

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


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--habilitar", required=True)
    parser.add_argument("--modelo", required=True)
    parser.add_argument("--recursos", required=True)
    parser.add_argument("--origem", required=True)
    parser.add_argument("--destino", required=True)
    parser.add_argument("--limiar", type=float, default=0.5)
    parser.add_argument("--duracao", type=float, default=0)
    parser.add_argument("--pedido", type=float, default=PEDIDO_S)
    parser.add_argument("--provar-eco", action="store_true")
    args = parser.parse_args()
    if args.habilitar != "sim":
        raise SystemExit("A escuta exige --habilitar sim.")
    modelo = Path(args.modelo)
    if not modelo.is_file():
        raise SystemExit(f"Modelo ausente: {modelo}")
    stt_dir = _voz_dir() / "stt" / "faster-whisper-small"
    stt_python = _voz_dir() / "stt" / "venv" / "bin" / "python"
    if not (stt_dir / "model.bin").is_file():
        raise SystemExit(f"Modelo STT ausente: {stt_dir}")
    if not stt_python.is_file():
        raise SystemExit(f"Interpretador STT ausente: {stt_python}")
    sys.path.insert(0, str(Path(args.recursos) / "hey_pran_openwakeword_v060"))
    from openwakeword.model import Model

    detector = Model(wakeword_models=[str(modelo)], inference_framework="onnx", vad_threshold=0)
    chave = next(iter(detector.models))
    stt = _Stt(stt_python, stt_dir)
    inicio = time.time()
    captura: subprocess.Popen[bytes] | None = None
    pico = 0.0
    acertos = 0

    def encerrar(_signum: int, _frame: object) -> None:
        _fechar(captura)
        stt.close()
        _estado("desligado", microfone="liberado", pico=pico, acertos=acertos)
        raise SystemExit(0)

    signal.signal(signal.SIGINT, encerrar)
    signal.signal(signal.SIGTERM, encerrar)
    try:
        if args.provar_eco:
            _estado("aguardando", microfone="retido")
            captura = _abrir(args.origem)
            _saudacao(args.destino)
            pico = _ler(detector, chave, captura, args.limiar, 4, False)
            _fechar(captura)
            captura = None
            _estado("desligado", microfone="liberado", pico=pico, eco=True)
            return
        _estado("aguardando", microfone="retido")
        while args.duracao <= 0 or time.time() - inicio < args.duracao:
            captura = _abrir(args.origem)
            detectou, parcial = _aguardar(detector, chave, captura, args.limiar, inicio, args.duracao)
            pico = max(pico, parcial)
            _fechar(captura)
            captura = None
            if not detectou:
                break
            acertos += 1
            _estado("saudacao", microfone="liberado", pico=pico, acertos=acertos)
            _saudacao(args.destino)
            _estado("ouvindo", microfone="retido", pico=pico, acertos=acertos)
            captura = _abrir(args.origem)
            amostras = _capturar_pedido(captura, args.pedido)
            _fechar(captura)
            captura = None
            texto = _transcrever(stt, amostras)
            del amostras
            print(texto, flush=True)
            _estado("aguardando", microfone="liberado", pico=pico, acertos=acertos, texto=texto)
        _estado("desligado", microfone="liberado", pico=pico, acertos=acertos)
    finally:
        _fechar(captura)
        stt.close()


class _Stt:
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
            raise SystemExit(f"Falha ao carregar STT: {erro.strip() or 'sem READY'}")

    def transcribe(self, audio: np.ndarray) -> str:
        if self._proc.stdin is None or self._proc.stdout is None:
            raise SystemExit("STT encerrado.")
        payload = len(audio).to_bytes(8, "little") + audio.astype(np.float32, copy=False).tobytes()
        self._proc.stdin.write(payload)
        self._proc.stdin.flush()
        linha = self._proc.stdout.readline()
        if not linha:
            erro = self._proc.stderr.read().decode("utf-8", "replace") if self._proc.stderr else ""
            raise SystemExit(f"STT encerrou durante a transcrição: {erro.strip()}")
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


def _aguardar(detector, chave: str, captura: subprocess.Popen[bytes], limiar: float, inicio: float, duracao: float) -> tuple[bool, float]:
    pico = 0.0
    while duracao <= 0 or time.time() - inicio < duracao:
        quadro = _quadro(captura)
        if quadro is None:
            return False, pico
        score = float(detector.predict(quadro).get(chave, 0.0))
        pico = max(pico, score)
        if score >= limiar:
            return True, pico
    return False, pico


def _ler(detector, chave: str, captura: subprocess.Popen[bytes], limiar: float, segundos: float, _parar: bool) -> float:
    fim = time.time() + segundos
    pico = 0.0
    while time.time() < fim:
        quadro = _quadro(captura)
        if quadro is None:
            break
        pico = max(pico, float(detector.predict(quadro).get(chave, 0.0)))
    return pico


def _capturar_pedido(captura: subprocess.Popen[bytes], segundos: float) -> np.ndarray:
    fim = time.time() + max(0.1, segundos)
    blocos: list[np.ndarray] = []
    while time.time() < fim:
        quadro = _quadro(captura)
        if quadro is None:
            break
        blocos.append(quadro.copy())
    if not blocos:
        return np.zeros(0, dtype=np.int16)
    return np.concatenate(blocos)


def _transcrever(stt: _Stt, amostras: np.ndarray) -> str:
    if _muda(amostras):
        return ""
    audio = amostras.astype(np.float32) / 32768.0
    try:
        return stt.transcribe(audio)
    finally:
        del audio


def _muda(amostras: np.ndarray) -> bool:
    if not amostras.size or not np.any(amostras):
        return True
    sem = amostras.astype(np.float32) - float(np.mean(amostras))
    return float(np.max(np.abs(sem))) < PICO_MUDO


def _quadro(captura: subprocess.Popen[bytes]) -> np.ndarray | None:
    if captura.stdout is None:
        return None
    bruto = captura.stdout.read(QUADRO * 2)
    if len(bruto) < QUADRO * 2:
        return None
    return np.frombuffer(bruto, dtype=np.int16)


def _abrir(origem: str) -> subprocess.Popen[bytes]:
    return subprocess.Popen(
        ["pw-record", "--target", origem, "--rate", str(TAXA), "--channels", "1", "--format", "s16", "--raw", "-"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )


def _fechar(captura: subprocess.Popen[bytes] | None) -> None:
    if captura is None or captura.poll() is not None:
        return
    captura.terminate()
    try:
        captura.wait(timeout=1)
    except subprocess.TimeoutExpired:
        captura.kill()
        captura.wait(timeout=1)


def _saudacao(destino: str) -> None:
    with tempfile.TemporaryDirectory() as pasta:
        arquivo = Path(pasta) / "ola.wav"
        subprocess.run(["espeak", "-v", "pt-br", "-s", "140", "-w", str(arquivo), "Estou aqui."], check=True)
        subprocess.run(["pw-play", "--target", destino, str(arquivo)], check=True)


def _voz_dir() -> Path:
    override = os.environ.get("MOAH_VOICE_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".local" / "share" / "moah" / "voz"


def _estado(
    fase: str,
    microfone: str,
    pico: float = 0,
    acertos: int = 0,
    eco: bool = False,
    texto: str | None = None,
) -> None:
    payload = {
        "fase": fase,
        "microfone": microfone,
        "pico": round(pico, 4),
        "acertos": acertos,
        "eco": eco,
        "detectorConfirmado": False,
    }
    if texto is not None:
        payload["texto"] = texto
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
