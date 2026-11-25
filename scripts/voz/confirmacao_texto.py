"""Confirmação legada por transcrição do nome (modo STT)."""

from __future__ import annotations

import re
import unicodedata

_BOA = "BOA"
ATIVACOES = frozenset({"MOAH", "MOA"})
ATIVACOES_FLEXIVEIS = frozenset({"MUA", "MULA", _BOA})
FRASES_FLEXIVEIS = frozenset({"HEY MOA", "HEY MOAH"})


def normalizar_ativacao(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    limpo = re.sub(r"[^A-Za-z0-9]+", " ", sem_acento.upper())
    return " ".join(limpo.split())


def _isolada(palavras: list[str], permitidas: frozenset[str]) -> bool:
    return len(palavras) == 1 and palavras[0] in permitidas


def decidir_ativacao(texto: str, *, flexivel: bool = False) -> tuple[bool, str]:
    normalizado = normalizar_ativacao(texto)
    palavras = normalizado.split()
    if 1 <= len(palavras) <= 2 and all(palavra in ATIVACOES for palavra in palavras):
        return True, normalizado
    # BOA já está em ATIVACOES_FLEXIVEIS. A confirmação por texto aceita só essa
    # palavra isolada, com a mesma regra do modo flexível.
    if _isolada(palavras, ATIVACOES_FLEXIVEIS) and palavras[0] == _BOA:
        return True, normalizado
    if not flexivel:
        return False, normalizado
    if _isolada(palavras, ATIVACOES_FLEXIVEIS):
        return True, normalizado
    if normalizado in FRASES_FLEXIVEIS:
        return True, normalizado
    return False, normalizado


def ativacao_confirmada(texto: str, flexivel: bool = False) -> bool:
    return decidir_ativacao(texto, flexivel=flexivel)[0]