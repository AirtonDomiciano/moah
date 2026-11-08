#!/usr/bin/env python3
"""Treina e valida um candidato ONNX de MOAH com o pipeline das sessões.

Treino: tomadas acusticamente aprovadas das sessões 01 e 02 (Airton conferiu
de ouvido). Negativos: saudação «Estou aqui», palavras parecidas e conversa.
Validação e escolha de limiar: só sessão 03. Sessão 04 permanece fechada.
O arquivo fica separado do modelo em uso (experimental).
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
SESSOES_TREINO = ("01", "02")
SESSAO_VALIDACAO = "03"
SESSAO_TESTE = "04"
CANDIDATO_NOME = "moah-candidato.onnx"
EM_USO_NOME = "moah-experimental.onnx"
LIMIARES = [round(x, 2) for x in np.arange(0.30, 0.96, 0.05)]


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

    acustica = _ler_ou_gerar_acustica(saida)
    positivos_arquivos = _aprovadas(saida, acustica, SESSOES_TREINO)
    if len(positivos_arquivos) < 8:
        raise SystemExit(f"Positivos insuficientes nas sessões 01/02: {len(positivos_arquivos)}.")
    extrator = AudioFeatures(inference_framework="onnx", device="cpu")
    reais: list[np.ndarray] = []
    origem: list[dict[str, object]] = []
    for arquivo in positivos_arquivos:
        audio = _ler(arquivo)
        regioes = _regioes_fala(audio)
        if not regioes:
            regioes = [_janela_pelo_pico(audio)]
        for inicio, fim in regioes:
            trecho = audio[int(inicio * 16000) : int(fim * 16000)]
            if len(trecho) < 1600:
                continue
            for ganho in (0.8, 1.0, 1.2):
                for deslocamento in (0, 1920, 3840):
                    variacao = np.clip(trecho.astype(np.float32) * ganho, -32767, 32767).astype(np.int16)
                    reais.append(_janela(extrator, _posicionar(variacao, deslocamento)))
            origem.append(
                {
                    "arquivo": str(arquivo.relative_to(saida / "coleta" / "sessoes")),
                    "sha256": hashlib.sha256(arquivo.read_bytes()).hexdigest(),
                    "regioes": [[round(a, 2), round(b, 2)] for a, b in regioes],
                }
            )
    if len(reais) < 24:
        raise SystemExit(f"Variações reais insuficientes: {len(reais)}.")
    reais_np = np.stack(reais)
    sinteticos = [
        _janela(extrator, _ler(arquivo))
        for arquivo in sorted((saida / "completo" / "moah" / "positive_train").glob("*.wav"))[:40]
    ]
    positivos = np.vstack((np.vstack([reais_np for _ in range(2)]), np.stack(sinteticos))) if sinteticos else np.vstack([reais_np for _ in range(3)])
    reservados = set((saida / "avaliacao" / "reservados.txt").read_text(encoding="utf8").split())
    musica = _fundo(recursos / "fma", reservados, extrator, 40)
    ambiente = _fundo(recursos / "audioset_16k", reservados, extrator, 40)
    # Negativos de fala só do gerador de treino e do espeak. Os WAV em
    # avaliacao/gerado ficam fora do treino e servem só na sessão de validação.
    parecidas = [
        _janela(extrator, _ler(arquivo))
        for arquivo in sorted((saida / "completo" / "moah" / "negative_train").glob("*.wav"))[:80]
    ]
    saudacao = [
        _janela(extrator, _espeak(frase))
        for frase in ("estou aqui.", "estou aqui", "Estou aqui.", "eu estou aqui", "estou aqui agora")
    ]
    for velocidade in (120, 140, 160):
        saudacao.append(_janela(extrator, _espeak("estou aqui.", velocidade)))
    conversa = [
        _janela(extrator, _espeak(frase))
        for frase in (
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
    ]
    silencio = _quadros(extrator, np.zeros(16000 * 3, dtype=np.int16))
    ruido = _quadros(extrator, np.random.default_rng(20261108).normal(0, 80, 16000 * 2).astype(np.int16))
    negativos = np.vstack(
        (
            musica,
            ambiente,
            np.stack(parecidas),
            np.stack(saudacao),
            np.stack(conversa),
            np.stack(silencio),
            np.stack(ruido),
        )
    )
    quantidade_real = len(reais_np)
    rede = _rede_treinar(positivos, negativos, quantidade_real)
    with torch.no_grad():
        amostra = rede(torch.from_numpy(reais_np.astype(np.float32))).squeeze(1).numpy()
    if float(np.min(amostra)) < 0.5:
        raise SystemExit(f"Variações de treino abaixo de 0,5: {amostra.min():.3f}. Sessão 03 não foi usada.")
    completo = saida / "completo"
    destino = completo / CANDIDATO_NOME
    torch.onnx.export(
        rede,
        torch.zeros(1, 16, 96),
        destino,
        input_names=["entrada"],
        output_names=["score"],
        opset_version=13,
    )
    sha = hashlib.sha256(destino.read_bytes()).hexdigest()
    relatorio = {
        "papel": "candidato",
        "modeloEmUsoNaoAlterado": (completo / EM_USO_NOME).as_posix(),
        "modeloCandidato": destino.as_posix(),
        "sha256": sha,
        "sessoesTreino": list(SESSOES_TREINO),
        "sessaoValidacao": SESSAO_VALIDACAO,
        "sessaoTesteReservada": SESSAO_TESTE,
        "sessao04Aberta": False,
        "positivosArquivos": origem,
        "variacoesReais": int(len(reais_np)),
        "sinteticos": len(sinteticos),
        "negativos": int(len(negativos)),
        "negativosPorClasse": {
            "musica": int(len(musica)),
            "ambiente": int(len(ambiente)),
            "parecidasTreino": len(parecidas),
            "saudacao": len(saudacao),
            "conversa": len(conversa),
            "silencio": len(silencio),
            "ruido": len(ruido),
        },
        "avaliacaoGeradoNoTreino": False,
        "minimoNasVariacoesDeTreino": round(float(np.min(amostra)), 4),
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
    em_uso = saida / "completo" / EM_USO_NOME
    if not candidato.is_file():
        raise SystemExit(f"Candidato ausente: {candidato}. Rode a ação treinar antes.")
    if not em_uso.is_file():
        raise SystemExit(f"Modelo em uso ausente: {em_uso}.")
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
    cand_resumo = _medir_tudo(modelo_c, chave_c, positivos, grupos_neg, limiar)
    modelo_u = Model(wakeword_models=[em_uso.as_posix()], inference_framework="onnx", vad_threshold=0)
    chave_u = em_uso.stem
    uso_no_limiar_candidato = _medir_tudo(modelo_u, chave_u, positivos, grupos_neg, limiar)
    uso_no_padrao = _medir_tudo(modelo_u, chave_u, positivos, grupos_neg, LIMIAR_PADRAO)
    resultado = {
        "sessaoValidacao": SESSAO_VALIDACAO,
        "sessao04Aberta": False,
        "ajusteAposAvaliacaoDePesos": False,
        "limiarEscolhidoNaSessao03": limiar,
        "criterioDoLimiar": escolha["criterio"],
        "varreduraLimiar": escolha["varredura"],
        "candidato": {
            "modelo": candidato.as_posix(),
            "sha256": hashlib.sha256(candidato.read_bytes()).hexdigest(),
            "limiar": limiar,
            **cand_resumo,
        },
        "emUsoMesmoLimiar": {
            "modelo": em_uso.as_posix(),
            "sha256": hashlib.sha256(em_uso.read_bytes()).hexdigest(),
            "limiar": limiar,
            "papel": "comparacao no mesmo limiar; nao e o detector promovido",
            **uso_no_limiar_candidato,
        },
        "emUsoLimiarPadrao": {
            "modelo": em_uso.as_posix(),
            "limiar": LIMIAR_PADRAO,
            "papel": "modelo em uso com limiar atual 0,5",
            **uso_no_padrao,
        },
        "duracaoAudioNegativoSegundos": cand_resumo["duracaoNegativaSegundos"],
    }
    destino = saida / "correcao" / "candidato-avaliacao.json"
    destino.write_text(json.dumps(resultado, indent=2), encoding="utf8")
    print(json.dumps(resultado, indent=2))


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
        # Prioriza acertos na sessão 03; empate: menos falsos; depois limiar mais alto.
        chave = (acertos, -falsos, limiar)
        item = {
            "limiar": limiar,
            "acertosSessao03": acertos,
            "totalSessao03": len(scores_pos),
            "falsosPorCategoria": por_categoria,
            "falsosTotais": falsos,
        }
        varredura.append(item)
        if melhor is None or chave > melhor[0]:
            melhor = (chave, item)
    assert melhor is not None
    return {
        "limiar": melhor[1]["limiar"],
        "criterio": "max acertos na sessão 03; desempate: menos falsos nos negativos de validação; depois limiar maior",
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
            audio = np.concatenate((np.zeros(16000, dtype=np.int16), audio))
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
        audio = np.concatenate((np.zeros(16000, dtype=np.int16), audio))
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
    # Gera a partir dos WAV sem alterar bytes; não abre a 04.
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


def _rede_treinar(positivos: np.ndarray, negativos: np.ndarray, quantidade_real: int) -> nn.Module:
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
    for _ in range(1000):
        reais = x_pos[torch.randint(0, quantidade_real, (32,))]
        resto = x_pos[torch.randint(quantidade_real, len(x_pos), (32,))]
        neg = x_neg[torch.randint(0, len(x_neg), (96,))]
        lote = torch.cat((reais, resto, neg))
        alvo = torch.cat((torch.ones(64), torch.zeros(96)))
        # Peso extra nos negativos de fala (saudação/parecidas/conversa já estão no pool).
        perda = nn.functional.binary_cross_entropy(rede(lote).squeeze(1), alvo, reduction="mean")
        otimo.zero_grad()
        perda.backward()
        otimo.step()
    rede.eval()
    return rede


def _fundo(pasta: Path, reservados: set[str], extrator, limite: int) -> np.ndarray:
    janelas = []
    for arquivo in sorted(pasta.glob("*.wav")):
        if arquivo.as_posix() in reservados:
            continue
        audio = _ler(arquivo)
        janelas.append(_janela(extrator, audio[:32000]))
        if len(audio) > 16000 * 8:
            janelas.append(_janela(extrator, audio[16000 * 8 : 16000 * 10]))
        if len(janelas) >= limite:
            break
    if len(janelas) < 15:
        raise SystemExit(f"Negativos insuficientes em {pasta.name}.")
    return np.stack(janelas[:limite])


def _posicionar(trecho: np.ndarray, deslocamento: int) -> np.ndarray:
    slot = np.zeros(32000, dtype=np.int16)
    janela_ini, janela_fim = 11520, 32000
    if len(trecho) > janela_fim - janela_ini:
        trecho = trecho[-(janela_fim - janela_ini) :]
    folga = janela_fim - janela_ini - len(trecho)
    fim = janela_fim - min(deslocamento, max(folga, 0))
    inicio = fim - len(trecho)
    if inicio < janela_ini:
        inicio = janela_ini
        fim = inicio + len(trecho)
        if fim > janela_fim:
            trecho = trecho[: janela_fim - inicio]
            fim = janela_fim
    slot[inicio:fim] = trecho
    return slot


def _quadros(extrator, audio: np.ndarray) -> list[np.ndarray]:
    _zerar(extrator)
    quadros = []
    for inicio in range(0, len(audio) - 1280, 1280):
        extrator(audio[inicio : inicio + 1280])
        quadros.append(np.asarray(extrator.get_features(16)[0], dtype=np.float32))
    return quadros


def _janela(extrator, audio: np.ndarray) -> np.ndarray:
    _zerar(extrator)
    fixo = np.zeros(16000 + 32000, dtype=np.int16)
    fixo[16000 : 16000 + min(len(audio), 32000)] = audio[:32000]
    for inicio in range(0, len(fixo) - 1280, 1280):
        extrator(fixo[inicio : inicio + 1280])
    return np.asarray(extrator.get_features(16)[0], dtype=np.float32)


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
