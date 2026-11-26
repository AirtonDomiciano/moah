"""Encaminha texto transcrito para `moah voz pedido`."""

from __future__ import annotations

import json
import os
import subprocess
from pathlib import Path

from eventos_voz import console_enxuto, emitir_linha


def consultar_pedido(texto: str) -> tuple[str | None, str | None]:
    repo = Path(__file__).resolve().parents[2]
    cli = repo / "dist" / "src" / "cli" / "main.js"
    if not cli.is_file():
        return None, "Consulta indisponível: CLI não compilada."
    resultado = subprocess.run(
        [
            "node",
            "--disable-warning=ExperimentalWarning",
            str(cli),
            "voz",
            "pedido",
            "--dominio",
            "pessoal",
            "--texto",
            texto,
        ],
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    bruto = (resultado.stdout or "").strip()
    if resultado.returncode != 0 or not bruto:
        erro = (resultado.stderr or "").strip() or bruto or "Falha ao consultar o catálogo."
        return None, erro
    try:
        payload = json.loads(bruto)
    except json.JSONDecodeError:
        return None, bruto
    terminal = str(payload.get("terminal") or "").strip()
    falar = payload.get("speak")
    fala = falar.strip() if isinstance(falar, str) else ""
    if console_enxuto():
        if fala:
            emitir_linha("resultado", fala)
        elif terminal:
            emitir_linha("resultado", terminal)
    elif terminal:
        print(terminal, flush=True)
    if not fala:
        return None, None
    return fala, None