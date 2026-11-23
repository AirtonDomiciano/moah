"""Confirmação legada por transcrição do nome (modo STT)."""

from __future__ import annotations

import re
import unicodedata

ATIVACOES = frozenset({"MOAH", "MOA"})
ATIVACOES_FLEXIVEIS = frozenset({"MUA", "MULA", "BOA"})
FRASES_FLEXIVEIS = frozenset({"HEY MOA", "HEY MOAH"})


def normalizar_ativacao(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    limpo = re.sub(r"[^A-Za-z0-9]+", " ", sem_acento.upper())
    return " ".join(limpo.split())


def ativacao_confirmada(texto: str, flexivel: bool = False) -> bool:
    normalizado = normalizar_ativacao(texto)
    palavras = normalizado.split()
    if 1 <= len(palavras) <= 2 and all(palavra in ATIVACOES for palavra in palavras):
        return True
    if not flexivel:
        return False
    if len(palavras) == 1 and palavras[0] in ATIVACOES_FLEXIVEIS:
        return True
    return normalizado in FRASES_FLEXIVEIS