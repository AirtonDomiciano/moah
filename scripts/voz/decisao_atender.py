"""Breakpoint: atender ou não pelo nome.

Modo STT: MOAH/MOA e a palavra isolada BOA (já listada no modo flexível).
Modo acústico: score do verificador (sem if em string).
"""

from __future__ import annotations

from confirmacao_texto import decidir_ativacao
from verificador_acustico import ResultadoVerificacao


def atender_por_texto(transcrito: str, *, flexivel: bool = False) -> tuple[bool, str]:
    # breakpoint aqui — confirmação por texto
    return decidir_ativacao(transcrito, flexivel=flexivel)


def atender_por_acustico(resultado: ResultadoVerificacao) -> bool:
    # breakpoint aqui — seu --confirmar-ativacao acustico (score, limiar, motivo)
    return resultado.aceito