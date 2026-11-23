"""Resolução de modos e limiares do manifesto."""

from __future__ import annotations


def resolver_modo_confirmacao(modo: str, manifesto, verificador) -> str:
    if modo == "nao":
        return "nao"
    if modo == "stt":
        return "stt"
    if modo == "acustico":
        return "acustico"
    if modo == "sim":
        if verificador is not None and manifesto is not None and manifesto.validado:
            return "acustico"
        return "stt"
    return "nao"


def resolver_limiar_verificador(override: float, manifesto, modo_verificador: str) -> float:
    if override > 0 and override <= 1:
        return override
    if modo_verificador == "teste" and manifesto is not None and manifesto.limiar_calibrado is not None:
        return manifesto.limiar_calibrado
    if manifesto is not None and manifesto.validado and manifesto.limiar > 0:
        return manifesto.limiar
    return 1.0