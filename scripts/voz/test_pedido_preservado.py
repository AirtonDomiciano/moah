"""Demonstra preservação de pedido falado logo após a chamada no mesmo trecho."""

from __future__ import annotations

import numpy as np

from oww_janela import QUADRO, PAD_ESCUTA, extrair_cauda_pedido

TAXA = 16000


def _impulso(inicio_s: float, duracao_s: float, amplitude: int = 8000) -> np.ndarray:
    total = int(4.2 * TAXA)
    audio = np.zeros(total, dtype=np.int16)
    a = int(inicio_s * TAXA)
    b = a + int(duracao_s * TAXA)
    audio[a:b] = amplitude
    return audio


def _self_test() -> None:
    # Simula "moá" ~1.6s e pedido "que horas" ~2.05–2.6s dentro do trecho pós-disparo.
    audio = _impulso(1.55, 0.25, 9000)
    audio += _impulso(2.05, 0.55, 6000)
    fim_janela = PAD_ESCUTA / TAXA + 1.55 + 0.25
    cauda_corta = extrair_cauda_pedido(audio, 40, fim_janela_s=fim_janela + 0.35)
    cauda = extrair_cauda_pedido(audio, 40, fim_janela_s=fim_janela)
    assert cauda.size > cauda_corta.size
    assert cauda.size >= int(0.4 * TAXA)
    sem = cauda.astype(np.float32) - float(np.mean(cauda))
    assert float(np.max(np.abs(sem))) >= 120
    duracao_cauda_s = cauda.size / TAXA
    print(
        f"ok trecho_total={audio.size/TAXA:.2f}s fim_janela={fim_janela:.2f}s "
        f"cauda={duracao_cauda_s:.2f}s amostras={cauda.size}"
    )


if __name__ == "__main__":
    _self_test()