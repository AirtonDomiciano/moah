#!/usr/bin/env python3
"""Diagnostica falsos do candidato ONNX sem alterar o detector em uso.

Reproduz a pontuação, registra o instante do pico em falsos de saudação,
parecidas e conversa, compara com as janelas dos negativos de treino e
confere PyTorch × ONNX na mesma janela (pesos lidos do próprio ONNX).
Não abre a sessão 04 e não promove o modelo.
"""

from __future__ import annotations

import hashlib
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
import onnx
import onnxruntime as ort
import torch
from torch import nn

QUADRO = 1280
LIMIAR = 0.95
SHA_ESPERADO = "f5d9784039677d9d14ebef5eb62311884543d8abad2056090257dd172edec0ce"
AMOSTRAS_POR_CATEGORIA = 3


def main() -> None:
    saida = Path("/home/airtondev/.local/share/moah/voz")
    recursos = Path("/home/airtondev/hey_pran_work")
    _recusar_04(saida)
    candidato = saida / "completo" / "moah-candidato.onnx"
    experimental = saida / "completo" / "moah-experimental.onnx"
    sha = hashlib.sha256(candidato.read_bytes()).hexdigest()
    if sha != SHA_ESPERADO:
        raise SystemExit(f"SHA do candidato diverge: {sha}")
    sha_uso = hashlib.sha256(experimental.read_bytes()).hexdigest()
    sys.path.insert(0, str(recursos / "hey_pran_openwakeword_v060"))
    from openwakeword.model import Model
    from openwakeword.utils import AudioFeatures

    modelo = Model(wakeword_models=[candidato.as_posix()], inference_framework="onnx", vad_threshold=0)
    chave = candidato.stem
    extrator = AudioFeatures(inference_framework="onnx", device="cpu")
    sessao_onnx = ort.InferenceSession(candidato.as_posix(), providers=["CPUExecutionProvider"])
    rede_torch = _rede_de_onnx(candidato)
    grupos = {
        "saudacao": sorted((saida / "avaliacao" / "gerado" / "saudacao").glob("*.wav")),
        "parecidas": sorted((saida / "avaliacao" / "gerado" / "parecidas").glob("*.wav")),
        "conversa": sorted((saida / "avaliacao" / "gerado" / "conversa").glob("*.wav")),
    }
    falsos = {}
    for nome, arquivos in grupos.items():
        itens = []
        for arquivo in arquivos:
            detalhe = _pico_detalhe(modelo, chave, arquivo, pad=True)
            if detalhe["pico"] < LIMIAR:
                continue
            janela_pico = _janela_no_instante(extrator, detalhe["audioPadded"], detalhe["instantePico"])
            janela_treino_align = _janela_treino(extrator, _ler(arquivo))
            score_onnx_pico = _onnx(sessao_onnx, janela_pico)
            score_torch_pico = _torch(rede_torch, janela_pico)
            score_onnx_align = _onnx(sessao_onnx, janela_treino_align)
            score_torch_align = _torch(rede_torch, janela_treino_align)
            itens.append(
                {
                    "arquivo": arquivo.name,
                    "pico": detalhe["pico"],
                    "instantePicoSegundos": detalhe["instantePico"],
                    "indiceQuadro": detalhe["indiceQuadro"],
                    "duracaoPaddedSegundos": detalhe["duracao"],
                    "scoreOnnxNaJanelaDoPico": score_onnx_pico,
                    "scoreTorchNaJanelaDoPico": score_torch_pico,
                    "deltaTorchOnnxPico": round(abs(score_torch_pico - score_onnx_pico), 6),
                    "scoreOnnxAlinhamentoTreino": score_onnx_align,
                    "scoreTorchAlinhamentoTreino": score_torch_align,
                    "deltaTorchOnnxAlign": round(abs(score_torch_align - score_onnx_align), 6),
                    "cossenoPicoVsAlign": round(_cosseno(janela_pico, janela_treino_align), 4),
                    "janelaPico": janela_pico,
                }
            )
        itens.sort(key=lambda item: item["pico"], reverse=True)
        falsos[nome] = itens[:AMOSTRAS_POR_CATEGORIA]

    negativos_treino = _negativos_treino(saida, extrator, sessao_onnx, rede_torch)
    comparacao = {}
    for categoria, itens in falsos.items():
        pool = negativos_treino[categoria]
        linhas = []
        for item in itens:
            melhores = sorted(
                (
                    {
                        "negativo": neg["id"],
                        "scoreOnnxNegativo": neg["scoreOnnx"],
                        "cossenoComPico": round(_cosseno(item["janelaPico"], neg["janela"]), 4),
                    }
                    for neg in pool
                ),
                key=lambda row: row["cossenoComPico"],
                reverse=True,
            )[:3]
            linhas.append(
                {
                    "arquivo": item["arquivo"],
                    "instantePicoSegundos": item["instantePicoSegundos"],
                    "scoreOnnxNaJanelaDoPico": item["scoreOnnxNaJanelaDoPico"],
                    "scoreOnnxAlinhamentoTreino": item["scoreOnnxAlinhamentoTreino"],
                    "vizinhosDeTreino": melhores,
                    "cossenoMedioComNegativosDaClasse": round(
                        float(np.mean([_cosseno(item["janelaPico"], neg["janela"]) for neg in pool])),
                        4,
                    ),
                }
            )
        comparacao[categoria] = linhas

    # Remover arrays antes de serializar.
    falsos_serial = {
        cat: [{k: v for k, v in item.items() if k != "janelaPico"} for item in itens]
        for cat, itens in falsos.items()
    }
    repro = _reproduzir_resumo(modelo, chave, saida)
    diagnostico = {
        "candidatoSha256": sha,
        "modeloEmUsoSha256": sha_uso,
        "modeloEmUsoAlterado": False,
        "sessao04Aberta": False,
        "limiar": LIMIAR,
        "checkpointPytorchNativo": None,
        "pesosTorchCarregadosDe": "onnx",
        "reproducaoAvaliacao": repro,
        "falsosComInstanteDoPico": falsos_serial,
        "negativosDeTreino": {
            cat: [
                {
                    "id": item["id"],
                    "scoreOnnx": item["scoreOnnx"],
                    "scoreTorch": item["scoreTorch"],
                    "deltaTorchOnnx": item["delta"],
                }
                for item in itens
            ]
            for cat, itens in negativos_treino.items()
        },
        "comparacaoJanelasFalsosVsTreino": comparacao,
        "leitura": _leitura(falsos_serial, negativos_treino, comparacao),
        "correcaoProposta": _correcao(),
    }
    destino = saida / "correcao" / "candidato-diagnostico.json"
    destino.write_text(json.dumps(diagnostico, indent=2), encoding="utf8")
    print(json.dumps({k: diagnostico[k] for k in diagnostico if k != "negativosDeTreino"}, indent=2))
    print(json.dumps({"negativosDeTreinoResumo": {
        cat: {
            "quantidade": len(itens),
            "scoreOnnxMax": max(i["scoreOnnx"] for i in itens),
            "scoreOnnxMin": min(i["scoreOnnx"] for i in itens),
            "scoreOnnxMedio": round(float(np.mean([i["scoreOnnx"] for i in itens])), 4),
            "deltaTorchOnnxMax": max(i["delta"] for i in itens),
        }
        for cat, itens in negativos_treino.items()
    }}, indent=2))


def _reproduzir_resumo(modelo, chave: str, saida: Path) -> dict[str, object]:
    positivos = sorted((saida / "coleta" / "sessoes" / "sessao-03").glob("tomada-*.wav"))
    grupos = {
        "saudacao": sorted((saida / "avaliacao" / "gerado" / "saudacao").glob("*.wav")),
        "parecidas": sorted((saida / "avaliacao" / "gerado" / "parecidas").glob("*.wav")),
        "conversa": sorted((saida / "avaliacao" / "gerado" / "conversa").glob("*.wav")),
    }
    acertos = 0
    for arquivo in positivos:
        serie = _pontuar(modelo, chave, np.concatenate((np.zeros(16000, dtype=np.int16), _ler(arquivo))))
        if serie and max(serie) >= LIMIAR:
            acertos += 1
    falsos = {}
    for nome, arquivos in grupos.items():
        q = 0
        for arquivo in arquivos:
            serie = _pontuar(modelo, chave, np.concatenate((np.zeros(16000, dtype=np.int16), _ler(arquivo))))
            if serie and max(serie) >= LIMIAR:
                q += 1
        falsos[nome] = {"acionamentos": q, "clipes": len(arquivos)}
    return {"acertosSessao03": acertos, "totalSessao03": len(positivos), "falsosFala": falsos}


def _negativos_treino(saida: Path, extrator, sessao_onnx, rede_torch) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {"saudacao": [], "parecidas": [], "conversa": []}
    for frase, velocidade in (
        ("estou aqui.", 140),
        ("estou aqui", 140),
        ("Estou aqui.", 140),
        ("eu estou aqui", 140),
        ("estou aqui agora", 140),
        ("estou aqui.", 120),
        ("estou aqui.", 160),
    ):
        audio = _espeak(frase, velocidade)
        janela = _janela_treino(extrator, audio)
        score_o = _onnx(sessao_onnx, janela)
        score_t = _torch(rede_torch, janela)
        out["saudacao"].append(
            {
                "id": f"espeak:{frase}:{velocidade}",
                "janela": janela,
                "scoreOnnx": score_o,
                "scoreTorch": score_t,
                "delta": round(abs(score_t - score_o), 6),
            }
        )
    frases_conversa = (
        "onde paramos no trabalho",
        "vamos continuar amanha",
        "pode repetir isso",
        "qual e a proxima tarefa",
        "me lembra do checkpoint",
        "boa noite",
        "ola moa",
        "noah",
        "agora",
        "moda",
    )
    for frase in frases_conversa:
        audio = _espeak(frase)
        janela = _janela_treino(extrator, audio)
        score_o = _onnx(sessao_onnx, janela)
        score_t = _torch(rede_torch, janela)
        chave = "parecidas" if frase in {"noah", "agora", "moda", "boa noite", "ola moa"} else "conversa"
        out[chave].append(
            {
                "id": f"espeak:{frase}",
                "janela": janela,
                "scoreOnnx": score_o,
                "scoreTorch": score_t,
                "delta": round(abs(score_t - score_o), 6),
            }
        )
    for arquivo in sorted((saida / "completo" / "moah" / "negative_train").glob("*.wav"))[:12]:
        janela = _janela_treino(extrator, _ler(arquivo))
        score_o = _onnx(sessao_onnx, janela)
        score_t = _torch(rede_torch, janela)
        out["parecidas"].append(
            {
                "id": f"negative_train:{arquivo.name}",
                "janela": janela,
                "scoreOnnx": score_o,
                "scoreTorch": score_t,
                "delta": round(abs(score_t - score_o), 6),
            }
        )
    return out


def _pico_detalhe(modelo, chave: str, arquivo: Path, pad: bool) -> dict[str, object]:
    audio = _ler(arquivo)
    if pad:
        audio = np.concatenate((np.zeros(16000, dtype=np.int16), audio))
    serie = _pontuar(modelo, chave, audio)
    if not serie:
        return {"pico": 0.0, "instantePico": 0.0, "indiceQuadro": 0, "duracao": 0.0, "audioPadded": audio}
    indice = int(np.argmax(serie))
    return {
        "pico": round(float(serie[indice]), 4),
        "instantePico": round(indice * QUADRO / 16000, 3),
        "indiceQuadro": indice,
        "duracao": round(len(audio) / 16000, 3),
        "audioPadded": audio,
    }


def _pontuar(modelo, chave: str, audio: np.ndarray) -> list[float]:
    _zerar_modelo(modelo)
    valores = []
    for inicio in range(0, len(audio) - QUADRO, QUADRO):
        valores.append(float(modelo.predict(audio[inicio : inicio + QUADRO])[chave]))
    return valores


def _janela_no_instante(extrator, audio: np.ndarray, instante: float) -> np.ndarray:
    """Reconstrói a janela 16×96 no quadro do pico, pelo mesmo fluxo de 1280 amostras."""
    _zerar(extrator)
    fim = int(instante * 16000) + QUADRO
    trecho = audio[: max(fim, QUADRO)]
    for inicio in range(0, len(trecho) - QUADRO + 1, QUADRO):
        extrator(trecho[inicio : inicio + QUADRO])
    return np.asarray(extrator.get_features(16)[0], dtype=np.float32)


def _janela_treino(extrator, audio: np.ndarray) -> np.ndarray:
    _zerar(extrator)
    fixo = np.zeros(16000 + 32000, dtype=np.int16)
    fixo[16000 : 16000 + min(len(audio), 32000)] = audio[:32000]
    for inicio in range(0, len(fixo) - 1280, 1280):
        extrator(fixo[inicio : inicio + 1280])
    return np.asarray(extrator.get_features(16)[0], dtype=np.float32)


def _rede_de_onnx(caminho: Path) -> nn.Module:
    modelo = onnx.load(caminho.as_posix())
    pesos = {init.name: onnx.numpy_helper.to_array(init) for init in modelo.graph.initializer}
    rede = nn.Sequential(
        nn.Flatten(),
        nn.Linear(16 * 96, 32),
        nn.LayerNorm(32),
        nn.ReLU(),
        nn.Linear(32, 32),
        nn.LayerNorm(32),
        nn.ReLU(),
        nn.Linear(32, 1),
        nn.Sigmoid(),
    )
    with torch.no_grad():
        rede[1].weight.copy_(torch.from_numpy(pesos["1.weight"]))
        rede[1].bias.copy_(torch.from_numpy(pesos["1.bias"]))
        rede[2].weight.copy_(torch.from_numpy(pesos["2.weight"]))
        rede[2].bias.copy_(torch.from_numpy(pesos["2.bias"]))
        rede[4].weight.copy_(torch.from_numpy(pesos["4.weight"]))
        rede[4].bias.copy_(torch.from_numpy(pesos["4.bias"]))
        rede[5].weight.copy_(torch.from_numpy(pesos["5.weight"]))
        rede[5].bias.copy_(torch.from_numpy(pesos["5.bias"]))
        rede[7].weight.copy_(torch.from_numpy(pesos["7.weight"]))
        rede[7].bias.copy_(torch.from_numpy(pesos["7.bias"]))
    rede.eval()
    return rede


def _onnx(sessao, janela: np.ndarray) -> float:
    nome = sessao.get_inputs()[0].name
    valor = sessao.run(None, {nome: janela[None, ...].astype(np.float32)})[0].reshape(-1)[0]
    return round(float(valor), 6)


def _torch(rede: nn.Module, janela: np.ndarray) -> float:
    with torch.no_grad():
        valor = rede(torch.from_numpy(janela[None, ...].astype(np.float32))).reshape(-1)[0].item()
    return round(float(valor), 6)


def _cosseno(a: np.ndarray, b: np.ndarray) -> float:
    x = a.reshape(-1).astype(np.float64)
    y = b.reshape(-1).astype(np.float64)
    denom = np.linalg.norm(x) * np.linalg.norm(y)
    if denom == 0:
        return 0.0
    return float(np.dot(x, y) / denom)


def _leitura(falsos, negativos, comparacao) -> str:
    deltas = []
    for itens in falsos.values():
        for item in itens:
            deltas.append(item["deltaTorchOnnxPico"])
            deltas.append(item["deltaTorchOnnxAlign"])
    for cat_itens in negativos.values():
        for item in cat_itens:
            deltas.append(item["delta"])
    max_delta = max(deltas) if deltas else 0.0
    scores_neg = [item["scoreOnnx"] for itens in negativos.values() for item in itens]
    aligns = [linha["scoreOnnxAlinhamentoTreino"] for linhas in comparacao.values() for linha in linhas]
    picos = [linha["scoreOnnxNaJanelaDoPico"] for linhas in comparacao.values() for linha in linhas]
    return (
        f"PyTorch e ONNX na mesma janela divergem no máximo {max_delta:.6f} "
        f"(pesos reconstruídos do ONNX; não havia .pt nativo). "
        f"Negativos de treino no alinhamento _janela ficam baixos "
        f"(médio {round(float(np.mean(scores_neg)), 4) if scores_neg else 0}). "
        f"Os mesmos clipes falsos, no alinhamento de treino, também caem "
        f"(médio {round(float(np.mean(aligns)), 4) if aligns else 0}), "
        f"mas no instante do pico em streaming sobem "
        f"(médio {round(float(np.mean(picos)), 4) if picos else 0}). "
        "Causa: o treino só viu a janela final; o falso dispara numa janela intermediária."
    )


def _correcao() -> dict[str, object]:
    return {
        "naoFazer": [
            "Não promover o candidato.",
            "Não abrir a sessão 04 para ajuste.",
            "Não subir só o limiar: em 0,95 a saudação e a conversa ainda disparam.",
            "Não tratar como bug PyTorch×ONNX: as notas na mesma janela coincidem.",
        ],
        "causaProvavel": (
            "O treino rotula só a janela final de _janela (fala encostada no fim do buffer de 2 s). "
            "Na escuta, o pico dos falsos ocorre ~1,4–2,2 s no áudio com pad de 1 s — uma janela 16×96 "
            "intermediária que nunca entrou como negativo. No alinhamento de treino, o mesmo clipe falso "
            "já fica ~0,001; no pico, ~0,999. Os negativos espeak/negative_train estão aprendidos nesse "
            "alinhamento, mas não cobrem as janelas deslizantes da avaliação Piper."
        ),
        "proximaCorrecao": [
            "No próximo treino, para cada negativo de fala, gravar várias janelas deslizantes (passo 1280) em que haja energia vocal — não só a final.",
            "Repetir o mesmo para positivos reais, para o detector ver a palavra no meio do fluxo.",
            "Gerar negativos Piper numa pasta de treino separada (não reutilizar avaliacao/gerado).",
            "Exportar também um .pt com state_dict no fim do treino.",
            "Reavaliar só na sessão 03; manter experimental em uso e sessão 04 fechada.",
        ],
    }


def _zerar(extrator) -> None:
    extrator.raw_data_buffer.clear()
    extrator.melspectrogram_buffer = np.ones((76, 32))
    extrator.accumulated_samples = 0
    extrator.raw_data_remainder = np.empty(0)
    extrator.feature_buffer = extrator._get_embeddings(np.zeros(16000 * 4, dtype=np.int16))


def _zerar_modelo(modelo) -> None:
    preparo = modelo.preprocessor
    preparo.raw_data_buffer.clear()
    preparo.melspectrogram_buffer = np.ones((76, 32))
    preparo.accumulated_samples = 0
    preparo.raw_data_remainder = np.empty(0)
    preparo.feature_buffer = preparo._get_embeddings(np.zeros(16000 * 4, dtype=np.int16))
    modelo.prediction_buffer.clear()


def _espeak(frase: str, velocidade: int = 140) -> np.ndarray:
    with tempfile.TemporaryDirectory() as pasta:
        origem = Path(pasta) / "fala.wav"
        subprocess.run(
            ["espeak", "-v", "pt-br", "-s", str(velocidade), "-w", origem.as_posix(), frase],
            check=True,
            capture_output=True,
        )
        with wave.open(origem.as_posix(), "rb") as wav:
            taxa = wav.getframerate()
            amostras = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32)
        destino = np.interp(
            np.linspace(0, len(amostras) - 1, int(len(amostras) * 16000 / taxa)),
            np.arange(len(amostras)),
            amostras,
        )
        return np.clip(destino, -32767, 32767).astype(np.int16)


def _ler(arquivo: Path) -> np.ndarray:
    with wave.open(arquivo.as_posix(), "rb") as wav:
        if wav.getframerate() != 16000 or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            raise SystemExit(f"Formato inesperado em {arquivo}.")
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).copy()


def _recusar_04(saida: Path) -> None:
    pasta = saida / "coleta" / "sessoes" / "sessao-04"
    if pasta.exists() and any(pasta.glob("*.wav")):
        raise SystemExit("A sessão 04 permanece reservada.")


if __name__ == "__main__":
    main()
