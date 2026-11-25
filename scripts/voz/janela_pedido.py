"""Janela do pedido falado: espera, silêncio e duração máxima.

Sem áudio e sem dependências. A escuta usa estas decisões para não ficar presa
no microfone.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class LimitesPedido:
    espera_s: float = 4.0
    silencio_s: float = 0.7
    maximo_s: float = 8.0


@dataclass
class JanelaPedido:
    inicio: float
    viu_fala: bool = False
    ultimo_fala: float = 0.0


def decidir(janela: JanelaPedido, agora: float, tem_fala: bool, limites: LimitesPedido) -> str | None:
    """None continua. Caso contrário: espera, silencio ou duracao."""
    if tem_fala:
        janela.viu_fala = True
        janela.ultimo_fala = agora
    decorrido = agora - janela.inicio
    if not janela.viu_fala and decorrido >= limites.espera_s:
        return "espera"
    if janela.viu_fala and agora - janela.ultimo_fala >= limites.silencio_s:
        return "silencio"
    if decorrido >= limites.maximo_s:
        return "duracao"
    return None


def _self_test() -> None:
    limites = LimitesPedido(espera_s=4, silencio_s=0.7, maximo_s=8)
    espera = JanelaPedido(inicio=0)
    assert decidir(espera, 3.9, False, limites) is None
    assert decidir(espera, 4.0, False, limites) == "espera"

    silencio = JanelaPedido(inicio=0)
    assert decidir(silencio, 1.0, True, limites) is None
    assert decidir(silencio, 1.6, False, limites) is None
    assert decidir(silencio, 1.7, False, limites) == "silencio"

    teto = JanelaPedido(inicio=0)
    assert decidir(teto, 7.9, True, limites) is None
    assert decidir(teto, 8.0, True, limites) == "duracao"

    fala_segura_espera = JanelaPedido(inicio=0)
    assert decidir(fala_segura_espera, 4.0, True, limites) is None

    # Sem fala iniciada, o silêncio de encerramento não dispara.
    sem_inicio = JanelaPedido(inicio=0)
    assert decidir(sem_inicio, 0.7, False, limites) is None
    assert sem_inicio.viu_fala is False
    print("ok")


if __name__ == "__main__":
    _self_test()
