#!/usr/bin/env python3
"""Prepara o classificador do 2º estágio (reusa scripts/voz/candidato.py). Não promove o detector."""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("acao", choices=("treinar", "calibrar"))
    parser.add_argument("--saida", default="")
    parser.add_argument("--recursos", default="")
    parser.add_argument("--marcar-validado", choices=("sim", "nao"), default="nao")
    args = parser.parse_args()
    repo = Path(__file__).resolve().parents[2]
    saida = args.saida or str(Path.home() / ".local/share/moah/voz")
    recursos = args.recursos or "/home/airtondev/hey_pran_work"
    if args.acao == "treinar":
        candidato = repo / "scripts/voz/candidato.py"
        subprocess.run(
            [sys.executable, candidato.as_posix(), "treinar", "--saida", saida, "--recursos", recursos],
            check=True,
        )
        print(
            "Próximo passo: copiar o ONNX treinado para moah-verificador.onnx e calibrar.\n"
            f"  cp {saida}/completo/moah-candidato-fundo.onnx {saida}/completo/moah-verificador.onnx\n"
            f"  {sys.executable} {repo / 'scripts/voz/calibrar_verificador.py'} --saida {saida} --recursos {recursos}"
        )
        return
    calibrar = repo / "scripts/voz/calibrar_verificador.py"
    subprocess.run(
        [
            sys.executable,
            calibrar.as_posix(),
            "--saida",
            saida,
            "--recursos",
            recursos,
            "--marcar-validado",
            args.marcar_validado,
        ],
        check=True,
    )


if __name__ == "__main__":
    main()