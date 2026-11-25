#!/usr/bin/env python3
"""Calibra limiar do verificador com sessão 03 e grupos negativos. Não promove sozinho."""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import wave
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))

from verificador_acustico import MANIFESTO_NOME, MODELO_PADRAO, VerificadorAcustico


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--saida", default="")
    parser.add_argument("--recursos", default="")
    parser.add_argument("--modelo", default="")
    parser.add_argument("--marcar-validado", choices=("sim", "nao"), default="nao")
    args = parser.parse_args()
    saida = _voz_dir(args.saida)
    recursos = Path(args.recursos or "/home/airtondev/hey_pran_work")
    modelo = Path(args.modelo) if args.modelo else saida / "completo" / MODELO_PADRAO
    if not modelo.is_file():
        alt = saida / "completo" / "moah-candidato-fundo.onnx"
        if alt.is_file():
            modelo = alt
        else:
            raise SystemExit(f"Modelo ausente: {modelo}. Treine antes com scripts/voz/treinar_verificador.py.")
    verificador = VerificadorAcustico(recursos, modelo)
    positivos = _tomadas_sessao(saida, "03")
    if len(positivos) < 4:
        raise SystemExit(f"Sessão 03 incompleta: {len(positivos)} tomadas.")
    negativos: list[tuple[str, Path]] = []
    for nome in ("saudacao", "parecidas", "conversa"):
        for arquivo in sorted((saida / "avaliacao" / "gerado" / nome).glob("*.wav")):
            negativos.append((nome, arquivo))
    reservados = (saida / "avaliacao" / "reservados.txt").read_text(encoding="utf8").split()
    for item in reservados:
        caminho = Path(item)
        if caminho.is_file():
            rotulo = "musica" if "/fma/" in item else "ambiente" if "/audioset" in item else "reservado"
            negativos.append((rotulo, caminho))

    limiares = [round(x, 2) for x in np.arange(0.35, 0.96, 0.05)]
    varredura: list[dict[str, object]] = []
    melhor_perfeito: dict[str, object] | None = None
    melhor_parcial: dict[str, object] | None = None
    for limiar in limiares:
        acertos = sum(1 for audio in positivos if verificador.pontuar(audio)[0] >= limiar)
        falsos = sum(1 for _, arquivo in negativos if verificador.pontuar(_ler(arquivo))[0] >= limiar)
        item = {
            "limiar": limiar,
            "acertosSessao03": acertos,
            "totalSessao03": len(positivos),
            "falsosNegativos": falsos,
            "totalNegativos": len(negativos),
        }
        varredura.append(item)
        if acertos == len(positivos) and (
            melhor_perfeito is None or falsos < int(melhor_perfeito["falsosNegativos"])  # type: ignore[index]
        ):
            melhor_perfeito = item
        if melhor_parcial is None or acertos > int(melhor_parcial["acertosSessao03"]):  # type: ignore[index]
            melhor_parcial = item
        elif acertos == int(melhor_parcial["acertosSessao03"]) and falsos < int(melhor_parcial["falsosNegativos"]):  # type: ignore[index]
            melhor_parcial = item

    escolhido = melhor_perfeito or melhor_parcial
    limiar_operacional = escolhido["limiar"] if melhor_perfeito else None

    destino_modelo = saida / "completo" / MODELO_PADRAO
    if modelo.resolve() != destino_modelo.resolve():
        destino_modelo.write_bytes(modelo.read_bytes())

    treino_json = saida / "correcao" / "candidato-treino.json"
    sessoes_treino = ["01", "02"]
    if treino_json.is_file():
        sessoes_treino = list(json.loads(treino_json.read_text(encoding="utf8")).get("sessoesTreino", sessoes_treino))

    manifesto = {
        "papel": "verificador-segundo-estagio",
        "modelo": destino_modelo.as_posix(),
        "sha256": hashlib.sha256(destino_modelo.read_bytes()).hexdigest(),
        "limiarCalibrado": escolhido["limiar"] if escolhido else None,
        "limiarOperacional": limiar_operacional,
        "validado": args.marcar_validado == "sim" and melhor_perfeito is not None,
        "treino": "scripts/voz/treinar_verificador.py",
        "calibracao": {
            "varredura": varredura,
            "melhorPerfeito8de8": melhor_perfeito,
            "melhorParcial": melhor_parcial,
            "observacao": (
                "Nenhum limiar atingiu 8/8 na sessão 03."
                if melhor_perfeito is None
                else "Existe limiar com 8/8; revisar falsos antes de validado:true."
            ),
        },
        "dados": {
            "treino": sessoes_treino,
            "calibracao": "03",
            "testeFechado": "04",
        },
        "detectorEmUsoNaoAlterado": (saida / "completo" / "moah-experimental.onnx").as_posix(),
        "criterio": "máximo acertos na sessão 03; depois menos falsos nos negativos reservados",
        "sessao04Aberta": False,
    }
    pasta = saida / "correcao"
    pasta.mkdir(parents=True, exist_ok=True)
    (pasta / MANIFESTO_NOME).write_text(json.dumps(manifesto, indent=2), encoding="utf8")
    (pasta / "diagnostico-verificador-sessao03.json").write_text(
        json.dumps(_detalhe_por_arquivo(verificador, positivos, saida), indent=2),
        encoding="utf8",
    )
    print(json.dumps(manifesto, indent=2))


def _detalhe_por_arquivo(verificador: VerificadorAcustico, audios: list[np.ndarray], saida: Path) -> dict:
    acustica = json.loads((saida / "correcao" / "validacao-acustica.json").read_text(encoding="utf8"))
    meta: dict[str, dict] = {}
    for bloco in acustica.get("sessoes", []):
        if bloco.get("sessao") != "03":
            continue
        for tomada in bloco.get("tomadas", []):
            meta[str(tomada["arquivo"])] = tomada
    pasta = saida / "coleta" / "sessoes" / "sessao-03"
    linhas = []
    for arquivo, audio in zip(sorted(pasta.glob("*.wav")), audios, strict=True):
        score, indice, fim_s = verificador.pontuar(audio)
        tomada = meta.get(arquivo.name, {})
        linhas.append(
            {
                "arquivo": arquivo.name,
                "rotulo": "positivo_validacao_sessao_03",
                "duracaoSegundos": round(len(audio) / 16000, 3),
                "instanteMaiorRmsSegundos": tomada.get("instanteDoMaiorRms"),
                "scoreMaximo": round(score, 6),
                "indiceJanelaVencedora": indice,
                "fimJanelaSegundosComPad": round(fim_s, 3),
            }
        )
    return {"tomadas": linhas}


def _tomadas_sessao(saida: Path, sessao: str) -> list[np.ndarray]:
    acustica_path = saida / "correcao" / "validacao-acustica.json"
    if not acustica_path.is_file():
        raise SystemExit(f"Validação acústica ausente: {acustica_path}")
    acustica = json.loads(acustica_path.read_text(encoding="utf8"))
    out: list[np.ndarray] = []
    for bloco in acustica.get("sessoes", []):
        if bloco.get("sessao") != sessao:
            continue
        pasta = saida / "coleta" / "sessoes" / f"sessao-{sessao}"
        for tomada in bloco.get("tomadas", []):
            if not tomada.get("aprovadaAcusticamente"):
                continue
            arquivo = pasta / tomada["arquivo"]
            if not arquivo.is_file():
                raise SystemExit(f"Tomada ausente: {arquivo}")
            out.append(_ler(arquivo))
    return out


def _ler(arquivo: Path) -> np.ndarray:
    with wave.open(arquivo.as_posix(), "rb") as wav:
        return np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).copy()


def _voz_dir(override: str) -> Path:
    if override.strip():
        return Path(override).expanduser().resolve()
    return Path.home() / ".local/share/moah" / "voz"


if __name__ == "__main__":
    main()