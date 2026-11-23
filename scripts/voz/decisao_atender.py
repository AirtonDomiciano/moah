"""Breakpoint: atender ou não pelo nome.

Modo STT: lista explícita MOAH/MOA (transcrição).
Modo acústico: score do verificador (sem if em string).
"""

from __future__ import annotations

from confirmacao_texto import ATIVACOES, ATIVACOES_FLEXIVEIS, FRASES_FLEXIVEIS, normalizar_ativacao
from verificador_acustico import ResultadoVerificacao


def atender_por_texto(transcrito: str, *, flexivel: bool = False) -> tuple[bool, str]:
    normalizado = normalizar_ativacao(transcrito)
    palavras = normalizado.split()
    # breakpoint aqui — equivalente a if nome in ('MOAH', 'MOA', ...)
    if 1 <= len(palavras) <= 2 and all(palavra in ATIVACOES for palavra in palavras):
        return True, normalizado
    if not flexivel:
        return False, normalizado
    if len(palavras) == 1 and palavras[0] in ATIVACOES_FLEXIVEIS:
        return True, normalizado
    if normalizado in FRASES_FLEXIVEIS:
        return True, normalizado
    return False, normalizado


def atender_por_acustico(resultado: ResultadoVerificacao) -> bool:
    # breakpoint aqui — seu --confirmar-ativacao acustico (score, limiar, motivo)
    return resultado.aceito