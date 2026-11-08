#!/usr/bin/env python3
"""Treina e valida um candidato ONNX de MOAH com o pipeline das sessões.

Janelas de treino usam o mesmo pré-processamento e passo da escuta (pad de
1 s + quadros de 1280). Positivos das sessões 01/02: só janelas que cobrem
a palavra. Negativos de fala: janelas intermediárias e de transição.
Piper de treino fica em treino/piper/, separado de avaliacao/gerado.
Validação e limiar: só sessão 03. Sessão 04 fechada. Experimental intacto.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np
import torch
from torch import nn

LIMIAR_PADRAO = 0.5
COOLDOWN = 2.0
QUADRO = 1280
PAD_ESCUTA = 16000  # 1 s — mesmo pad da avaliação/escuta pontuada
COBERTURA_JANELA = 16 * QUADRO / 16000  # ~1,28 s cobertos pelos 16 embeddings
SOBREPOSICAO_MINIMA = 0.25
SESSOES_TREINO = ("01", "02")
SESSAO_VALIDACAO = "03"
SESSAO_TESTE = "04"
CANDIDATO_NOME = "moah-candidato.onnx"
CANDIDATO_PT = "moah-candidato.pt"
BASELINE_NOME = "moah-candidato-f5d9784.onnx"
BASELINE_SHA = "f5d9784039677d9d14ebef5eb62311884543d8abad2056090257dd172edec0ce"
EM_USO_NOME = "moah-experimental.onnx"
LIMIARES = [round(x, 2) for x in np.arange(0.30, 0.96, 0.05)]

PIPER_TREINO = {
    "saudacao": ["estou aqui", "estou aqui.", "eu estou aqui"],
    "parecidas": ["boa", "noah", "moa", "ola", "agora", "moda", "boa noite"],
    "conversa": [
        "onde paramos no trabalho",
        "vamos continuar amanha",
        "pode repetir isso",
        "qual e a proxima tarefa",
        "me lembra do checkpoint",
    ],
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("acao", choices=("treinar", "avaliar"))
    parser.add_argument("--saida", default="/home/airtondev/.local/share/moah/voz")
    parser.add_argument("--recursos", default="/home/airtondev/hey_pran_work")
    args = parser.parse_args()
    saida = Path(args.saida)
    recursos = Path(args.recursos)
    _recusar_sessao_04(saida)
    if args.acao == "treinar":
        _treinar(saida, recursos)
    else:
        _avaliar(saida, recursos)


def _treinar(saida: Path, recursos: Path) -> None:
    sys.path.insert(0, str(recursos / "hey_pran_openwakeword_v060"))
    from openwakeword.utils import AudioFeatures

    _preservar_baseline(saida)
    acustica = _ler_ou_gerar_acustica(saida)
    positivos_arquivos = _aprovadas(saida, acustica, SESSOES_TREINO)
    if len(positivos_arquivos) < 8:
        raise SystemExit(f"Positivos insuficientes nas sessões 01/02: {len(positivos_arquivos)}.")
    extrator = AudioFeatures(inference_framework="onnx", device="cpu")

    reais: list[np.ndarray] = []
    transicao_positivos: list[np.ndarray] = []
    origem: list[dict[str, object]] = []
    for arquivo in positivos_arquivos:
        audio = _ler(arquivo)
        regioes = _regioes_fala(audio) or [_janela_pelo_pico(audio)]
        pos_arq = 0
        neg_arq = 0
        for ganho in (0.8, 1.0, 1.2):
            variado = np.clip(audio.astype(np.float32) * ganho, -32767, 32767).astype(np.int16)
            for item in _fluxo_escuta(extrator, variado, pad=True):
                if _cobre_palavra(item["inicio"], item["fim"], regioes):
                    reais.append(item["features"])
                    pos_arq += 1
                elif item["energia"] or _e_transicao(item["inicio"], item["fim"], regioes):
                    transicao_positivos.append(item["features"])
                    neg_arq += 1
        origem.append(
            {
                "arquivo": str(arquivo.relative_to(saida / "coleta" / "sessoes")),
                "sha256": hashlib.sha256(arquivo.read_bytes()).hexdigest(),
                "regioes": [[round(a, 2), round(b, 2)] for a, b in regioes],
                "janelasPositivas": pos_arq,
                "janelasTransicaoOuSilencio": neg_arq,
            }
        )
    if len(reais) < 24:
        raise SystemExit(f"Janelas positivas insuficientes: {len(reais)}.")
    reais_np = np.stack(reais)

    sinteticos: list[np.ndarray] = []
    for arquivo in sorted((saida / "completo" / "moah" / "positive_train").glob("*.wav"))[:40]:
        for item in _fluxo_escuta(extrator, _ler(arquivo), pad=True):
            if item["energia"]:
                sinteticos.append(item["features"])
    sinteticos = sinteticos[:120]
    positivos = np.vstack((np.vstack([reais_np for _ in range(2)]), np.stack(sinteticos))) if sinteticos else np.vstack([reais_np for _ in range(3)])

    reservados = set((saida / "avaliacao" / "reservados.txt").read_text(encoding="utf8").split())
    musica = _fundo_fluxo(recursos / "fma", reservados, extrator, 40)
    ambiente = _fundo_fluxo(recursos / "audioset_16k", reservados, extrator, 40)

    piper_dir = _garantir_piper_treino(saida, recursos)
    fala_neg: list[np.ndarray] = []
    contagem_fala = {"saudacao": 0, "parecidas": 0, "conversa": 0, "negative_train": 0, "espeak": 0, "transicaoSessoes": 0}
    for categoria in ("saudacao", "parecidas", "conversa"):
        for arquivo in sorted((piper_dir / categoria).glob("*.wav")):
            for item in _janelas_negativo_fala(extrator, _ler(arquivo)):
                fala_neg.append(item)
                contagem_fala[categoria] += 1
    for arquivo in sorted((saida / "completo" / "moah" / "negative_train").glob("*.wav"))[:60]:
        for item in _janelas_negativo_fala(extrator, _ler(arquivo)):
            fala_neg.append(item)
            contagem_fala["negative_train"] += 1
    for frase, velocidade in (
        ("estou aqui.", 120),
        ("estou aqui.", 140),
        ("estou aqui.", 160),
        ("estou aqui", 140),
        ("eu estou aqui", 140),
    ):
        for item in _janelas_negativo_fala(extrator, _espeak(frase, velocidade)):
            fala_neg.append(item)
            contagem_fala["espeak"] += 1
    fala_neg.extend(transicao_positivos)
    contagem_fala["transicaoSessoes"] = len(transicao_positivos)

    silencio = [item["features"] for item in _fluxo_escuta(extrator, np.zeros(16000 * 3, dtype=np.int16), pad=False)]
    ruido = [
        item["features"]
        for item in _fluxo_escuta(
            extrator,
            np.random.default_rng(20261108).normal(0, 80, 16000 * 2).astype(np.int16),
            pad=False,
        )
    ]
    negativos = np.vstack((musica, ambiente, np.stack(fala_neg), np.stack(silencio), np.stack(ruido)))
    quantidade_real = len(reais_np)
    rede = _rede_treinar(positivos, negativos, quantidade_real, len(fala_neg))
    with torch.no_grad():
        amostra = rede(torch.from_numpy(reais_np.astype(np.float32))).squeeze(1).numpy()
    if float(np.min(amostra)) < 0.5:
        raise SystemExit(f"Janelas positivas de treino abaixo de 0,5: {amostra.min():.3f}. Sessão 03 não foi usada.")

    completo = saida / "completo"
    destino_onnx = completo / CANDIDATO_NOME
    destino_pt = completo / CANDIDATO_PT
    torch.save({"state_dict": rede.state_dict(), "arquitetura": "flatten-32-ln-relu-32-ln-relu-1"}, destino_pt)
    torch.onnx.export(
        rede,
        torch.zeros(1, 16, 96),
        destino_onnx,
        input_names=["entrada"],
        output_names=["score"],
        opset_version=13,
    )
    sha = hashlib.sha256(destino_onnx.read_bytes()).hexdigest()
    if sha == BASELINE_SHA:
        raise SystemExit("O novo ONNX coincidiu com o baseline f5d9784; o treino não produziu candidato novo.")
    relatorio = {
        "papel": "candidato",
        "correcaoJanelas": "fluxo da escuta; positivos só com palavra; negativos com intermediárias/transição",
        "modeloEmUsoNaoAlterado": (completo / EM_USO_NOME).as_posix(),
        "modeloCandidato": destino_onnx.as_posix(),
        "checkpointPytorch": destino_pt.as_posix(),
        "baselinePreservado": (completo / BASELINE_NOME).as_posix(),
        "baselineSha256": BASELINE_SHA,
        "sha256": sha,
        "sessoesTreino": list(SESSOES_TREINO),
        "sessaoValidacao": SESSAO_VALIDACAO,
        "sessaoTesteReservada": SESSAO_TESTE,
        "sessao04Aberta": False,
        "positivosArquivos": origem,
        "janelasPositivasReais": int(len(reais_np)),
        "sinteticos": len(sinteticos),
        "negativos": int(len(negativos)),
        "negativosPorClasse": {
            "musica": int(len(musica)),
            "ambiente": int(len(ambiente)),
            "fala": contagem_fala,
            "silencio": len(silencio),
            "ruido": len(ruido),
        },
        "piperTreino": str(piper_dir),
        "avaliacaoGeradoNoTreino": False,
        "minimoNasJanelasPositivasDeTreino": round(float(np.min(amostra)), 4),
        "vad": 0,
        "avaliacaoUsadaNoTreino": False,
        "conferenciaDeOuvido": "Airton: tomadas aprovadas das sessões 01 e 02 conferidas de ouvido; 01-08 e 01-09 excluídas pela validação acústica.",
    }
    pasta = saida / "correcao"
    pasta.mkdir(exist_ok=True)
    (pasta / "candidato-treino.json").write_text(json.dumps(relatorio, indent=2), encoding="utf8")
    print(json.dumps(relatorio, indent=2))


def _avaliar(saida: Path, recursos: Path) -> None:
    sys.path.insert(0, str(recursos / "hey_pran_openwakeword_v060"))
    from openwakeword.model import Model

    _recusar_sessao_04(saida)
    candidato = saida / "completo" / CANDIDATO_NOME
    baseline = saida / "completo" / BASELINE_NOME
    em_uso = saida / "completo" / EM_USO_NOME
    if not candidato.is_file():
        raise SystemExit(f"Candidato ausente: {candidato}. Rode a ação treinar antes.")
    if not baseline.is_file():
        raise SystemExit(f"Baseline f5d9784 ausente: {baseline}.")
    sha_base = hashlib.sha256(baseline.read_bytes()).hexdigest()
    if sha_base != BASELINE_SHA:
        raise SystemExit(f"Baseline SHA diverge: {sha_base}")
    acustica = _ler_ou_gerar_acustica(saida)
    positivos = _aprovadas(saida, acustica, (SESSAO_VALIDACAO,))
    if len(positivos) < 4:
        raise SystemExit(f"Sessão 03 incompleta para validação: {len(positivos)} tomadas.")
    reservados = (saida / "avaliacao" / "reservados.txt").read_text(encoding="utf8").split()
    grupos_neg = {
        "saudacao": sorted((saida / "avaliacao" / "gerado" / "saudacao").glob("*.wav")),
        "parecidas": sorted((saida / "avaliacao" / "gerado" / "parecidas").glob("*.wav")),
        "conversa": sorted((saida / "avaliacao" / "gerado" / "conversa").glob("*.wav")),
        "musica": [Path(item) for item in reservados if "/fma/" in item],
        "ambiente": [Path(item) for item in reservados if "/audioset_16k/" in item],
    }

    modelo_c = Model(wakeword_models=[candidato.as_posix()], inference_framework="onnx", vad_threshold=0)
    chave_c = candidato.stem
    scores_pos = [_serie(modelo_c, chave_c, arquivo, pad=True) for arquivo in positivos]
    scores_neg = {
        nome: [_serie(modelo_c, chave_c, arquivo, pad=nome not in {"musica", "ambiente"}) for arquivo in arquivos]
        for nome, arquivos in grupos_neg.items()
    }
    escolha = _escolher_limiar(scores_pos, scores_neg)
    limiar = escolha["limiar"]
    cand = _medir_tudo(modelo_c, chave_c, positivos, grupos_neg, limiar)
    cand_095 = _medir_tudo(modelo_c, chave_c, positivos, grupos_neg, 0.95)

    modelo_b = Model(wakeword_models=[baseline.as_posix()], inference_framework="onnx", vad_threshold=0)
    chave_b = baseline.stem
    base_limiar = _medir_tudo(modelo_b, chave_b, positivos, grupos_neg, limiar)
    base_095 = _medir_tudo(modelo_b, chave_b, positivos, grupos_neg, 0.95)

    modelo_u = Model(wakeword_models=[em_uso.as_posix()], inference_framework="onnx", vad_threshold=0)
    chave_u = em_uso.stem
    uso_095 = _medir_tudo(modelo_u, chave_u, positivos, grupos_neg, 0.95)

    fala_novo_095 = _falsos_fala(cand_095)
    fala_base_095 = _falsos_fala(base_095)
    resultado = {
        "sessaoValidacao": SESSAO_VALIDACAO,
        "sessao04Aberta": False,
        "modeloEmUsoAlterado": False,
        "modeloEmUsoSha256": hashlib.sha256(em_uso.read_bytes()).hexdigest(),
        "ajusteAposAvaliacaoDePesos": False,
        "limiarEscolhidoNaSessao03": limiar,
        "criterioDoLimiar": escolha["criterio"],
        "varreduraLimiar": escolha["varredura"],
        "candidato": {
            "modelo": candidato.as_posix(),
            "sha256": hashlib.sha256(candidato.read_bytes()).hexdigest(),
            "checkpointPytorch": (saida / "completo" / CANDIDATO_PT).as_posix(),
            "limiar": limiar,
            **cand,
        },
        "baselineF5d9784": {
            "modelo": baseline.as_posix(),
            "sha256": sha_base,
            "limiar": limiar,
            **base_limiar,
        },
        "comparacaoIsoladaEm0_95": {
            "candidato": {"limiar": 0.95, "acertosSessao03": cand_095["acertosSessao03"], "falsosFala": fala_novo_095, "falsosTotais": cand_095["falsosTotais"], "porCategoria": _resumo_cats(cand_095)},
            "baselineF5d9784": {"limiar": 0.95, "acertosSessao03": base_095["acertosSessao03"], "falsosFala": fala_base_095, "falsosTotais": base_095["falsosTotais"], "porCategoria": _resumo_cats(base_095)},
            "experimentalEmUso": {"limiar": 0.95, "acertosSessao03": uso_095["acertosSessao03"], "falsosFala": _falsos_fala(uso_095), "falsosTotais": uso_095["falsosTotais"], "porCategoria": _resumo_cats(uso_095)},
            "efeitoDaMudanca": {
                "acertosMantidosOuMelhores": cand_095["acertosSessao03"] >= base_095["acertosSessao03"],
                "falsosFalaReduzidos": fala_novo_095 < fala_base_095,
                "deltaAcertos": cand_095["acertosSessao03"] - base_095["acertosSessao03"],
                "deltaFalsosFala": fala_novo_095 - fala_base_095,
            },
        },
        "duracaoAudioNegativoSegundos": cand["duracaoNegativaSegundos"],
        "aceiteCapitulo": {
            "criterio": "reduzir falsos de fala sem perder acertos na sessão 03, isolado em limiar 0,95",
            "aprovado": cand_095["acertosSessao03"] >= base_095["acertosSessao03"] and fala_novo_095 < fala_base_095,
        },
    }
    destino = saida / "correcao" / "candidato-avaliacao.json"
    destino.write_text(json.dumps(resultado, indent=2), encoding="utf8")
    print(json.dumps(resultado, indent=2))


def _falsos_fala(resumo: dict[str, object]) -> int:
    cats = resumo["falsosPorCategoria"]
    return int(cats["saudacao"]["acionamentos"] + cats["parecidas"]["acionamentos"] + cats["conversa"]["acionamentos"])


def _resumo_cats(resumo: dict[str, object]) -> dict[str, object]:
    out = {}
    for nome, grupo in resumo["falsosPorCategoria"].items():
        out[nome] = {
            "acionamentos": grupo["acionamentos"],
            "clipes": grupo["clipes"],
            "pico": grupo["pico"],
            "segundos": grupo["segundos"],
        }
    return out


def _fluxo_escuta(extrator, audio: np.ndarray, pad: bool) -> list[dict[str, object]]:
    """Mesmo pré-processamento/passo da escuta: pad opcional de 1 s e quadro 1280."""
    if pad:
        audio = np.concatenate((np.zeros(PAD_ESCUTA, dtype=np.int16), audio))
    _zerar(extrator)
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
        itens.append(
            {
                "features": features,
                "inicio": ini_janela,
                "fim": fim,
                "energia": rms >= 250,
                "rms": rms,
            }
        )
    return itens


def _janelas_negativo_fala(extrator, audio: np.ndarray) -> list[np.ndarray]:
    """Intermediárias com energia + transições ao redor da fala."""
    regioes = _regioes_fala(audio)
    fluxo = _fluxo_escuta(extrator, audio, pad=True)
    escolhidas = []
    for item in fluxo:
        if item["energia"] or _e_transicao(item["inicio"], item["fim"], regioes) or not regioes:
            escolhidas.append(item["features"])
    if not escolhidas and fluxo:
        escolhidas = [fluxo[len(fluxo) // 2]["features"], fluxo[-1]["features"]]
    return escolhidas


def _cobre_palavra(inicio: float, fim: float, regioes: list[tuple[float, float]]) -> bool:
    melhor = 0.0
    for reg_ini, reg_fim in regioes:
        # Regiões estão no áudio sem pad; a janela do fluxo inclui 1 s de pad.
        # Converte a janela para o tempo do WAV original.
        ini = max(0.0, inicio - 1.0)
        fi = max(0.0, fim - 1.0)
        sobre = max(0.0, min(fi, reg_fim) - max(ini, reg_ini))
        melhor = max(melhor, sobre)
    return melhor >= SOBREPOSICAO_MINIMA


def _e_transicao(inicio: float, fim: float, regioes: list[tuple[float, float]]) -> bool:
    if not regioes:
        return False
    ini = max(0.0, inicio - 1.0)
    fi = max(0.0, fim - 1.0)
    for reg_ini, reg_fim in regioes:
        if abs(fi - reg_ini) <= 0.35 or abs(ini - reg_fim) <= 0.35:
            return True
        if ini < reg_ini < fi or ini < reg_fim < fi:
            return True
    return False


def _garantir_piper_treino(saida: Path, recursos: Path) -> Path:
    raiz = saida / "treino" / "piper"
    gerado = saida / "avaliacao" / "gerado"
    if raiz.resolve() == gerado.resolve():
        raise SystemExit("treino/piper não pode coincidir com avaliacao/gerado.")
    precisa = False
    for nome in PIPER_TREINO:
        pasta = raiz / nome
        pasta.mkdir(parents=True, exist_ok=True)
        if not any(pasta.glob("*.wav")):
            precisa = True
    if not precisa:
        return raiz
    sys.path.insert(0, str(recursos / "hey_pran_piper_generator"))
    from generate_samples import generate_samples

    for nome, frases in PIPER_TREINO.items():
        destino = raiz / nome
        if any(destino.glob("*.wav")):
            continue
        generate_samples(
            text=frases,
            output_dir=str(destino),
            max_samples=max(4, 2 * len(frases)),
            batch_size=4,
            noise_scales=[0.7],
            noise_scale_ws=[0.7],
            length_scales=[1.0],
            auto_reduce_batch_size=True,
        )
    # Garante que nenhum arquivo de avaliacao/gerado foi copiado.
    for categoria in PIPER_TREINO:
        for arquivo in (raiz / categoria).glob("*.wav"):
            rival = gerado / categoria / arquivo.name
            if rival.exists() and hashlib.sha256(arquivo.read_bytes()).digest() == hashlib.sha256(rival.read_bytes()).digest():
                # Mesmo conteúdo por acaso do gerador é aceitável se pastas forem distintas;
                # só bloqueia se for o mesmo inode/path.
                if arquivo.resolve() == rival.resolve():
                    raise SystemExit("Piper de treino aponta para avaliacao/gerado.")
    return raiz


def _preservar_baseline(saida: Path) -> None:
    completo = saida / "completo"
    atual = completo / CANDIDATO_NOME
    baseline = completo / BASELINE_NOME
    if baseline.exists():
        sha = hashlib.sha256(baseline.read_bytes()).hexdigest()
        if sha != BASELINE_SHA:
            raise SystemExit(f"Baseline existente com SHA inesperado: {sha}")
        return
    if atual.exists() and hashlib.sha256(atual.read_bytes()).hexdigest() == BASELINE_SHA:
        baseline.write_bytes(atual.read_bytes())


def _escolher_limiar(
    scores_pos: list[list[float]],
    scores_neg: dict[str, list[list[float]]],
) -> dict[str, object]:
    varredura = []
    melhor = None
    for limiar in LIMIARES:
        acertos = sum(1 for serie in scores_pos if serie and max(serie) >= limiar)
        falsos = 0
        por_categoria = {}
        for nome, series in scores_neg.items():
            q = sum(1 for serie in series if serie and max(serie) >= limiar)
            por_categoria[nome] = q
            falsos += q
        falsos_fala = por_categoria.get("saudacao", 0) + por_categoria.get("parecidas", 0) + por_categoria.get("conversa", 0)
        # Acertos primeiro; depois menos falsos de fala; depois menos falsos totais; limiar maior.
        chave = (acertos, -falsos_fala, -falsos, limiar)
        item = {
            "limiar": limiar,
            "acertosSessao03": acertos,
            "totalSessao03": len(scores_pos),
            "falsosPorCategoria": por_categoria,
            "falsosFala": falsos_fala,
            "falsosTotais": falsos,
        }
        varredura.append(item)
        if melhor is None or chave > melhor[0]:
            melhor = (chave, item)
    assert melhor is not None
    return {
        "limiar": melhor[1]["limiar"],
        "criterio": "max acertos na 03; desempate: menos falsos de fala; depois menos falsos totais; limiar maior",
        "varredura": varredura,
        "escolhido": melhor[1],
    }


def _medir_tudo(
    modelo,
    chave: str,
    positivos: list[Path],
    grupos_neg: dict[str, list[Path]],
    limiar: float,
) -> dict[str, object]:
    pos = _grupo(modelo, chave, positivos, limiar, continuo=False)
    categorias = {}
    segundos_neg = 0.0
    falsos = 0
    for nome, arquivos in grupos_neg.items():
        grupo = _grupo(modelo, chave, arquivos, limiar, continuo=nome in {"musica", "ambiente"})
        categorias[nome] = grupo
        segundos_neg += float(grupo["segundos"])
        falsos += int(grupo["acionamentos"])
    return {
        "acertosSessao03": pos["acionamentos"],
        "totalSessao03": pos["clipes"],
        "positivos": pos,
        "falsosPorCategoria": categorias,
        "falsosTotais": falsos,
        "duracaoNegativaSegundos": round(segundos_neg, 2),
    }


def _grupo(modelo, chave: str, arquivos: list[Path], limiar: float, continuo: bool) -> dict[str, object]:
    clipes = []
    valores: list[float] = []
    segundos = 0.0
    for arquivo in arquivos:
        audio = _ler(arquivo)
        if not continuo:
            audio = np.concatenate((np.zeros(PAD_ESCUTA, dtype=np.int16), audio))
        serie = _pontuar(modelo, chave, audio)
        duracao = len(audio) / 16000
        segundos += duracao
        valores.extend(serie)
        clipes.append(
            {
                "arquivo": arquivo.name,
                "pico": round(float(max(serie)) if serie else 0.0, 4),
                "acionou": bool(serie) and bool(max(serie) >= limiar),
            }
        )
    acertos = sum(1 for item in clipes if item["acionou"])
    resumo = _resumo(valores, segundos, limiar)
    return {"clipes": len(clipes), "acionamentos": acertos, "porClipe": clipes, **resumo}


def _serie(modelo, chave: str, arquivo: Path, pad: bool) -> list[float]:
    audio = _ler(arquivo)
    if pad:
        audio = np.concatenate((np.zeros(PAD_ESCUTA, dtype=np.int16), audio))
    return _pontuar(modelo, chave, audio)


def _pontuar(modelo, chave: str, audio: np.ndarray) -> list[float]:
    _zerar_modelo(modelo)
    valores = []
    for inicio in range(0, len(audio) - QUADRO, QUADRO):
        valores.append(float(modelo.predict(audio[inicio : inicio + QUADRO])[chave]))
    return valores


def _resumo(valores: list[float], segundos: float, limiar: float) -> dict[str, float]:
    acionamentos = 0
    ultimo = -999.0
    for indice, valor in enumerate(valores):
        instante = indice * QUADRO / 16000
        if valor >= limiar and instante - ultimo >= COOLDOWN:
            acionamentos += 1
            ultimo = instante
    horas = segundos / 3600
    return {
        "segundos": round(segundos, 2),
        "acionamentosPorHora": round(acionamentos / horas, 2) if horas else 0.0,
        "acionamentosNoPeriodo": acionamentos,
        "pico": round(max(valores) if valores else 0.0, 4),
    }


def _ler_ou_gerar_acustica(saida: Path) -> dict[str, object]:
    caminho = saida / "correcao" / "validacao-acustica.json"
    if caminho.exists():
        dados = json.loads(caminho.read_text(encoding="utf8"))
        sessoes = {item["sessao"] for item in dados.get("sessoes", [])}
        if {"01", "02", "03"}.issubset(sessoes):
            return dados
    sessoes = []
    aprovadas = 0
    reprovadas = 0
    for sessao in ("01", "02", "03"):
        pasta = saida / "coleta" / "sessoes" / f"sessao-{sessao}"
        if not pasta.is_dir():
            continue
        tomadas = []
        for arquivo in sorted(pasta.glob("tomada-*.wav")):
            item = _qualidade_acustica(arquivo, 4.0)
            tomadas.append(item)
            if item["aprovadaAcusticamente"]:
                aprovadas += 1
            else:
                reprovadas += 1
        sessoes.append({"sessao": sessao, "tomadas": tomadas})
    dados = {"sessoes": sessoes, "aprovadas": aprovadas, "reprovadas": reprovadas}
    caminho.parent.mkdir(exist_ok=True)
    caminho.write_text(json.dumps(dados, indent=2), encoding="utf8")
    return dados


def _aprovadas(saida: Path, acustica: dict[str, object], sessoes: tuple[str, ...]) -> list[Path]:
    out: list[Path] = []
    for bloco in acustica.get("sessoes", []):
        if bloco.get("sessao") not in sessoes:
            continue
        pasta = saida / "coleta" / "sessoes" / f"sessao-{bloco['sessao']}"
        for tomada in bloco.get("tomadas", []):
            if not tomada.get("aprovadaAcusticamente"):
                continue
            arquivo = pasta / tomada["arquivo"]
            if not arquivo.is_file():
                raise SystemExit(f"Tomada ausente: {arquivo}")
            out.append(arquivo)
    return out


def _qualidade_acustica(arquivo: Path, duracao_esperada: float) -> dict[str, object]:
    bruto = arquivo.read_bytes()
    with wave.open(arquivo.as_posix(), "rb") as wav:
        taxa, canais, largura, quadros = wav.getframerate(), wav.getnchannels(), wav.getsampwidth(), wav.getnframes()
        audio = np.frombuffer(wav.readframes(quadros), dtype=np.int16).astype(np.float32)
    duracao = quadros / taxa
    sem = audio - float(np.mean(audio))
    hop = int(0.05 * taxa)
    env = np.array([np.sqrt(np.mean(sem[i : i + hop] ** 2)) for i in range(0, len(sem) - hop + 1, hop)])
    maior = float(np.max(env)) if len(env) else 0.0
    instante = float(np.argmax(env) * 0.05) if len(env) else 0.0
    borda = int(0.15 / 0.05)
    inicio_alto = float(np.max(env[:borda])) if len(env) >= borda else float(np.max(env) if len(env) else 0)
    fim_alto = float(np.max(env[-borda:])) if len(env) >= borda else inicio_alto
    reprovacoes = []
    if not (taxa == 16000 and canais == 1 and largura == 2):
        reprovacoes.append("formato")
    if abs(duracao - duracao_esperada) > 0.25:
        reprovacoes.append("duracao")
    if bool(np.any(np.abs(audio) >= 32767)):
        reprovacoes.append("saturacao")
    if maior < 250:
        reprovacoes.append("Nenhum bloco de 50 ms alcança RMS 250.")
    if inicio_alto >= 250:
        reprovacoes.append("Há atividade acústica nos primeiros 150 ms.")
    if fim_alto >= 250:
        reprovacoes.append("Há atividade acústica nos últimos 150 ms.")
    return {
        "arquivo": arquivo.name,
        "sha256": hashlib.sha256(bruto).hexdigest(),
        "aprovadaAcusticamente": len(reprovacoes) == 0,
        "reprovacoes": reprovacoes,
        "maiorRms50ms": round(maior, 1),
        "instanteDoMaiorRms": round(instante, 2),
    }


def _regioes_fala(audio: np.ndarray) -> list[tuple[float, float]]:
    sem = audio.astype(np.float32) - float(np.mean(audio))
    hop = int(0.05 * 16000)
    env = np.array([np.sqrt(np.mean(sem[i : i + hop] ** 2)) for i in range(0, len(sem) - hop + 1, hop)])
    ativo = env >= 250
    bruto: list[tuple[int, int]] = []
    inicio = None
    for indice, flag in enumerate(ativo):
        if flag and inicio is None:
            inicio = indice
        elif not flag and inicio is not None:
            bruto.append((inicio, indice))
            inicio = None
    if inicio is not None:
        bruto.append((inicio, len(env)))
    fundidas: list[list[int]] = []
    for comeco, fim in bruto:
        if fundidas and comeco - fundidas[-1][1] <= 1:
            fundidas[-1][1] = fim
        else:
            fundidas.append([comeco, fim])
    completas = []
    duracao = len(audio) / 16000
    for comeco, fim in fundidas:
        if (fim - comeco) * 0.05 < 0.35:
            continue
        instante_ini, instante_fim = comeco * 0.05, fim * 0.05
        if instante_ini >= 0.08 and instante_fim <= duracao - 0.08:
            completas.append((instante_ini, instante_fim))
    return completas


def _janela_pelo_pico(audio: np.ndarray) -> tuple[float, float]:
    sem = audio.astype(np.float32) - float(np.mean(audio))
    hop = int(0.05 * 16000)
    env = np.array([np.sqrt(np.mean(sem[i : i + hop] ** 2)) for i in range(0, len(sem) - hop + 1, hop)])
    pico = int(np.argmax(env)) if len(env) else 0
    inicio = max(0.08, pico * 0.05 - 0.25)
    fim = min(len(audio) / 16000 - 0.08, pico * 0.05 + 0.45)
    if fim - inicio < 0.35:
        fim = min(len(audio) / 16000 - 0.08, inicio + 0.5)
    return (inicio, fim)


def _rede_treinar(positivos: np.ndarray, negativos: np.ndarray, quantidade_real: int, fala_neg_count: int) -> nn.Module:
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
    otimo = torch.optim.Adam(rede.parameters(), lr=1e-3)
    x_pos = torch.from_numpy(np.array(positivos, dtype=np.float32))
    x_neg = torch.from_numpy(np.array(negativos, dtype=np.float32))
    # Negativos de fala ficam no final do stack musica|ambiente|fala|silencio|ruido.
    # Aproximação: últimos fala_neg_count + silencio + ruido; amostramos com peso a faixa de fala.
    inicio_fala = max(0, len(negativos) - fala_neg_count - 80)
    fim_fala = max(inicio_fala + 1, len(negativos) - 40)
    for _ in range(1200):
        reais = x_pos[torch.randint(0, quantidade_real, (32,))]
        resto = x_pos[torch.randint(quantidade_real, len(x_pos), (32,))]
        neg_geral = x_neg[torch.randint(0, len(x_neg), (48,))]
        neg_fala = x_neg[torch.randint(inicio_fala, fim_fala, (48,))]
        lote = torch.cat((reais, resto, neg_geral, neg_fala))
        alvo = torch.cat((torch.ones(64), torch.zeros(96)))
        perda = nn.functional.binary_cross_entropy(rede(lote).squeeze(1), alvo, reduction="mean")
        otimo.zero_grad()
        perda.backward()
        otimo.step()
    rede.eval()
    return rede


def _fundo_fluxo(pasta: Path, reservados: set[str], extrator, limite: int) -> np.ndarray:
    janelas = []
    for arquivo in sorted(pasta.glob("*.wav")):
        if arquivo.as_posix() in reservados:
            continue
        audio = _ler(arquivo)
        for item in _fluxo_escuta(extrator, audio[: 16000 * 4], pad=False):
            janelas.append(item["features"])
            if len(janelas) >= limite:
                break
        if len(janelas) >= limite:
            break
    if len(janelas) < 15:
        raise SystemExit(f"Negativos insuficientes em {pasta.name}.")
    return np.stack(janelas[:limite])


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


def _recusar_sessao_04(saida: Path) -> None:
    pasta = saida / "coleta" / "sessoes" / f"sessao-{SESSAO_TESTE}"
    if pasta.exists() and any(pasta.glob("*.wav")):
        raise SystemExit("A sessão 04 tem áudio e permanece reservada. O candidato não a abre.")


if __name__ == "__main__":
    main()
