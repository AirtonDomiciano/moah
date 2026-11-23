"""Extração de janelas 16×96 (openWakeWord AudioFeatures) para o verificador."""

from __future__ import annotations

import numpy as np

QUADRO = 1280
PAD_ESCUTA = 16000
COBERTURA_JANELA = 16 * QUADRO / 16000


def zerar_extrator(extrator) -> None:
    extrator.raw_data_buffer.clear()
    extrator.melspectrogram_buffer = np.ones((76, 32))
    extrator.accumulated_samples = 0
    extrator.raw_data_remainder = np.empty(0)
    extrator.feature_buffer = extrator._get_embeddings(np.zeros(16000 * 4, dtype=np.int16))


def zerar_detector(detector) -> None:
    preparo = detector.preprocessor
    preparo.raw_data_buffer.clear()
    preparo.melspectrogram_buffer = np.ones((76, 32))
    preparo.accumulated_samples = 0
    preparo.raw_data_remainder = np.empty(0)
    preparo.feature_buffer = preparo._get_embeddings(np.zeros(16000 * 4, dtype=np.int16))
    detector.prediction_buffer.clear()


def fluxo_escuta(extrator, audio: np.ndarray, pad: bool) -> list[dict[str, object]]:
    if pad:
        audio = np.concatenate((np.zeros(PAD_ESCUTA, dtype=np.int16), audio))
    zerar_extrator(extrator)
    itens: list[dict[str, object]] = []
    for inicio in range(0, len(audio) - QUADRO, QUADRO):
        quadro = audio[inicio : inicio + QUADRO]
        extrator(quadro)
        features = np.asarray(extrator.get_features(16)[0], dtype=np.float32)
        fim = (inicio + QUADRO) / 16000
        ini_janela = max(0.0, fim - COBERTURA_JANELA)
        trecho = audio[int(ini_janela * 16000) : inicio + QUADRO]
        sem = trecho.astype(np.float32) - float(np.mean(trecho)) if len(trecho) else trecho.astype(np.float32)
        rms = float(np.sqrt(np.mean(sem**2))) if len(sem) else 0.0
        itens.append({"features": features, "inicio": ini_janela, "fim": fim, "rms": rms})
    return itens


def pontuar_trecho(sessao_onnx, extrator, audio: np.ndarray) -> tuple[float, int, float]:
    """Retorna score máximo, índice da janela vencedora e fim (s) da janela no áudio com pad."""
    if audio.size < QUADRO:
        return 0.0, -1, 0.0
    itens = fluxo_escuta(extrator, audio, pad=True)
    if not itens:
        return 0.0, -1, 0.0
    melhor = 0.0
    indice = 0
    fim_s = 0.0
    nome = sessao_onnx.get_inputs()[0].name
    for i, item in enumerate(itens):
        janela = item["features"]
        valor = sessao_onnx.run(None, {nome: janela[None, ...].astype(np.float32)})[0].reshape(-1)[0]
        pontuacao = float(valor)
        if pontuacao > melhor:
            melhor = pontuacao
            indice = i
            fim_s = float(item["fim"])
    return melhor, indice, fim_s


def extrair_cauda_pedido(
    audio: np.ndarray,
    indice_janela: int,
    *,
    fim_janela_s: float = 0.0,
    taxa: int = 16000,
    pico_minimo: float = 120.0,
) -> np.ndarray:
    """Preserva fala após o fim da janela da chamada até o fim do trecho capturado."""
    if audio.size < QUADRO:
        return np.zeros(0, dtype=np.int16)
    padded = np.concatenate((np.zeros(PAD_ESCUTA, dtype=np.int16), audio))
    if fim_janela_s > 0:
        offset = int(fim_janela_s * taxa)
    elif indice_janela >= 0:
        quadros = list(range(0, len(padded) - QUADRO, QUADRO))
        if indice_janela >= len(quadros):
            return np.zeros(0, dtype=np.int16)
        offset = quadros[indice_janela] + QUADRO
    else:
        return np.zeros(0, dtype=np.int16)
    if offset >= len(padded):
        return np.zeros(0, dtype=np.int16)
    cauda = padded[offset:].copy()
    sem = cauda.astype(np.float32) - float(np.mean(cauda)) if cauda.size else cauda.astype(np.float32)
    if cauda.size and float(np.max(np.abs(sem))) < pico_minimo:
        return np.zeros(0, dtype=np.int16)
    return cauda