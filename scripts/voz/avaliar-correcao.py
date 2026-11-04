#!/usr/bin/env python3
"""Mede o modelo corrigido uma vez. Não altera peso nem limiar."""

from __future__ import annotations

import json
import sys
import wave
from pathlib import Path

import numpy as np

LIMIAR = 0.5
COOLDOWN = 2.0
QUADRO = 1280


def main() -> None:
    saida = Path("/home/airtondev/.local/share/moah/voz")
    recursos = Path("/home/airtondev/hey_pran_work")
    sys.path.insert(0, str(recursos / "hey_pran_openwakeword_v060"))
    from openwakeword.model import Model

    modelo_arquivo = saida / "completo" / "moah-corrigido.onnx"
    experimental_arquivo = saida / "completo" / "moah-experimental.onnx"
    modelo = Model(wakeword_models=[modelo_arquivo.as_posix()], inference_framework="onnx", vad_threshold=0)
    chave = modelo_arquivo.stem
    compatibilidade = _comparar_fluxo(modelo, chave, saida / "coleta" / "moah-01.wav")
    if abs(compatibilidade["ultimoQuadro"] - compatibilidade["scoreDaJanela"]) > 0.05:
        raise SystemExit(f"Treino e execução divergem nesta tomada de treino: {compatibilidade}")
    reservados = (saida / "avaliacao" / "reservados.txt").read_text(encoding="utf8").split()
    grupos = {
        "positivosReais": [saida / "coleta" / f"moah-{indice:02d}.wav" for indice in (6, 7, 8)],
        "treinoRealNaoUsadoNaDecisao": [saida / "coleta" / f"moah-{indice:02d}.wav" for indice in range(1, 6)],
        "parecidas": sorted((saida / "avaliacao" / "gerado" / "parecidas").glob("*.wav")),
        "saudacao": sorted((saida / "avaliacao" / "gerado" / "saudacao").glob("*.wav")),
        "conversa": sorted((saida / "avaliacao" / "gerado" / "conversa").glob("*.wav")),
        "musica": [Path(item) for item in reservados if "/fma/" in item],
        "ambiente": [Path(item) for item in reservados if "/audioset_16k/" in item],
    }
    resultado = {
        "limiar": LIMIAR,
        "vad": 0,
        "cooldownSegundos": COOLDOWN,
        "modelo": modelo_arquivo.as_posix(),
        "modeloExperimental": (saida / "completo" / "moah-experimental.onnx").as_posix(),
        "ajusteAposAvaliacao": False,
        "compatibilidadeNaTomadaDeTreino": compatibilidade,
        "grupos": _medir(modelo, chave, grupos),
    }
    silencio = np.zeros(16000 * 60, dtype=np.int16)
    resultado["silencio60s"] = _resumo(_pontuar(modelo, chave, silencio), 60.0)
    outro = Model(wakeword_models=[experimental_arquivo.as_posix()], inference_framework="onnx", vad_threshold=0)
    resultado["experimentalMesmosClipes"] = _medir(outro, experimental_arquivo.stem, grupos)
    resultado["experimentalMesmosClipes"]["papel"] = "comparacao no mesmo limiar; estes numeros nao mudaram o modelo"
    (saida / "correcao" / "avaliacao.json").write_text(json.dumps(resultado, indent=2), encoding="utf8")
    print(json.dumps(resultado, indent=2))


def _medir(modelo, chave: str, grupos: dict[str, list[Path]]) -> dict[str, object]:
    return {
        nome: _grupo(modelo, chave, arquivos, continuo=nome in {"musica", "ambiente"})
        for nome, arquivos in grupos.items()
    }


def _comparar_fluxo(modelo, chave: str, arquivo: Path) -> dict[str, float]:
    audio = _ler(arquivo)
    fixo = np.zeros(16000 + 32000, dtype=np.int16)
    fixo[16000:16000 + min(len(audio), 32000)] = audio[:32000]
    serie = _pontuar(modelo, chave, fixo)
    preparo = modelo.preprocessor
    _zerar(modelo)
    for inicio in range(0, len(fixo) - QUADRO, QUADRO):
        preparo(fixo[inicio:inicio + QUADRO])
    janela = np.asarray(preparo.get_features(16), dtype=np.float32)
    sessao = modelo.models[chave]
    entrada = sessao.get_inputs()[0].name
    score = float(sessao.run(None, {entrada: janela})[0].reshape(-1)[0])
    return {"ultimoQuadro": round(serie[-1] if serie else 0.0, 4), "scoreDaJanela": round(score, 4)}


def _grupo(modelo, chave: str, arquivos: list[Path], continuo: bool) -> dict[str, object]:
    clipes = []
    valores: list[float] = []
    segundos = 0.0
    for arquivo in arquivos:
        audio = _ler(arquivo)
        if not continuo:
            audio = np.concatenate((np.zeros(16000, dtype=np.int16), audio))
        serie = _pontuar(modelo, chave, audio)
        duracao = len(audio) / 16000
        segundos += duracao
        valores.extend(serie)
        clipes.append({"arquivo": arquivo.name, "pico": round(max(serie) if serie else 0.0, 4), "acionou": bool(serie) and max(serie) >= LIMIAR})
    acertos = sum(1 for item in clipes if item["acionou"])
    resumo = _resumo(valores, segundos)
    return {"clipes": len(clipes), "acionamentos": acertos, "porClipe": clipes, **resumo}


def _pontuar(modelo, chave: str, audio: np.ndarray) -> list[float]:
    _zerar(modelo)
    valores = []
    for inicio in range(0, len(audio) - QUADRO, QUADRO):
        valores.append(float(modelo.predict(audio[inicio:inicio + QUADRO])[chave]))
    return valores


def _resumo(valores: list[float], segundos: float) -> dict[str, float]:
    acionamentos = 0
    ultimo = -999.0
    for indice, valor in enumerate(valores):
        instante = indice * QUADRO / 16000
        if valor >= LIMIAR and instante - ultimo >= COOLDOWN:
            acionamentos += 1
            ultimo = instante
    horas = segundos / 3600
    return {
        "segundos": round(segundos, 2),
        "acionamentosPorHora": round(acionamentos / horas, 2) if horas else 0.0,
        "acionamentosNoPeriodo": acionamentos,
        "pico": round(max(valores) if valores else 0.0, 4),
    }


def _zerar(modelo) -> None:
    preparo = modelo.preprocessor
    preparo.raw_data_buffer.clear()
    preparo.melspectrogram_buffer = np.ones((76, 32))
    preparo.accumulated_samples = 0
    preparo.raw_data_remainder = np.empty(0)
    preparo.feature_buffer = preparo._get_embeddings(np.zeros(16000 * 4, dtype=np.int16))
    modelo.prediction_buffer.clear()


def _ler(arquivo: Path) -> np.ndarray:
    with wave.open(arquivo.as_posix(), "rb") as wav:
        if wav.getframerate() != 16000 or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise SystemExit(f"Formato inesperado em {arquivo}.")
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).copy()


if __name__ == "__main__":
    main()
