#!/usr/bin/env python3
"""Grava exemplos falados somente depois de um início explícito.

Os arquivos ficam no diretório informado e não são enviados a lugar nenhum.
"""

from __future__ import annotations

import argparse
import signal
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iniciar", required=True)
    parser.add_argument("--saida", required=True)
    parser.add_argument("--origem", required=True)
    parser.add_argument("--vezes", type=int, default=8)
    parser.add_argument("--segundos", type=float, default=2)
    args = parser.parse_args()
    if args.iniciar != "sim":
        raise SystemExit("A coleta exige --iniciar sim.")
    if args.vezes < 1 or args.segundos <= 0 or args.segundos > 5:
        raise SystemExit("Use de 1 a várias tomadas, com no máximo 5 segundos cada.")
    destino = Path(args.saida).resolve() / "coleta"
    destino.mkdir(parents=True, exist_ok=True)
    for indice in range(1, args.vezes + 1):
        arquivo = destino / f"moah-{indice:02d}.wav"
        print(f"Tomada {indice} de {args.vezes}. Fale MOAH agora.", flush=True)
        _gravar(args.origem, arquivo, args.segundos)
        print(arquivo.as_posix(), flush=True)
    print("Coleta encerrada. Nenhum arquivo foi enviado.", flush=True)


def _gravar(origem: str, arquivo: Path, segundos: float) -> None:
    processo = subprocess.Popen(
        ["pw-record", "--target", origem, "--rate", "16000", "--channels", "1", "--format", "s16", arquivo.as_posix()],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        processo.wait(timeout=segundos)
    except subprocess.TimeoutExpired:
        processo.send_signal(signal.SIGINT)
        processo.wait(timeout=2)
    if not arquivo.exists() or arquivo.stat().st_size < 1000:
        raise SystemExit(f"A gravação de {arquivo.name} não produziu áudio.")


if __name__ == "__main__":
    main()
