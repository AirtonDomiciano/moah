"""Aceite da confirmação por texto: MOAH, MOA e BOA isolada."""

from __future__ import annotations

from decisao_atender import atender_por_texto


def _aceita(texto: str, *, flexivel: bool = False) -> bool:
    aceito, _normalizado = atender_por_texto(texto, flexivel=flexivel)
    return aceito


def _self_test() -> None:
    assert _aceita("Boa!")
    assert _aceita("Moa.")
    assert _aceita("MOAH")
    assert not _aceita("")
    assert not _aceita("boa tarde")
    assert not _aceita("uma boa ideia")
    assert not _aceita("Legendas pela comunidade de Amara.org")
    assert not _aceita("MUA")
    assert _aceita("MUA", flexivel=True)
    print("ok")


if __name__ == "__main__":
    _self_test()
