#!/usr/bin/env python3
"""Grava exemplos falados somente depois de um início explícito.

Os arquivos ficam no diretório informado e não são enviados a lugar nenhum.
"""

from __future__ import annotations

import argparse
import os
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
    parser.add_argument("--frase", default="MOAH")
    parser.add_argument("--prefixo", default="moah")
    args = parser.parse_args()
    if args.iniciar != "sim":
        raise SystemExit("A coleta exige --iniciar sim.")
    if args.vezes < 1 or args.segundos <= 0 or args.segundos > 5:
        raise SystemExit("Use de 1 a várias tomadas, com no máximo 5 segundos cada.")
    if not args.prefixo.replace("-", "").isalnum():
        raise SystemExit("O prefixo só pode ter letras, números e hífen.")
    destino = Path(args.saida).resolve() / "coleta"
    destino.mkdir(parents=True, exist_ok=True)
    inicio = 1
    while (destino / f"{args.prefixo}-{inicio:02d}.wav").exists():
        inicio += 1
    for indice in range(inicio, inicio + args.vezes):
        arquivo = destino / f"{args.prefixo}-{indice:02d}.wav"
        if arquivo.exists():
            raise SystemExit(f"{arquivo.name} já existe. A coleta não sobrescreve uma tomada.")
        pedido = "Fique em silêncio agora." if args.frase == "-" else f"Fale {args.frase} agora."
        print(f"Tomada {indice - inicio + 1} de {args.vezes}. {pedido}", flush=True)
        _gravar(args.origem, arquivo, args.segundos)
        print(arquivo.as_posix(), flush=True)
    print("Coleta encerrada. Nenhum arquivo foi enviado.", flush=True)


def _gravar(origem: str, arquivo: Path, segundos: float) -> None:
    try:
        descritor = os.open(arquivo, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o664)
    except FileExistsError:
        raise SystemExit(f"{arquivo.name} já existe. A coleta não sobrescreve uma tomada.") from None
    os.close(descritor)
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
        arquivo.unlink(missing_ok=True)
        raise SystemExit(f"A gravação de {arquivo.name} não produziu áudio e o arquivo vazio foi removido.")


if __name__ == "__main__":
    main()
