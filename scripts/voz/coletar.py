#!/usr/bin/env python3
"""Grava uma sessão depois de um início explícito.

Não sobrescreve arquivo existente. A contagem é só visual. Energia nas
bordas sugere um corte possível e não prova que a palavra esteja completa.
"""

from __future__ import annotations

import argparse
import os
import signal
import subprocess
import threading
import time
import wave
from pathlib import Path

import numpy as np

SESSOES = {
    "01": ("treino", "Fique perto do microfone. Voz calma. Diga MOAH uma só vez."),
    "02": ("treino", "Afaste cerca de um braço. Alterne voz mais forte e mais baixa."),
    "03": ("validacao", "Fique mais longe. Use a entonação do dia a dia. Esta sessão não treina."),
    "04": ("teste", "Misture distância e entonação. Esta sessão fica fechada para treino e ajuste."),
}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--iniciar", required=True)
    parser.add_argument("--saida", required=True)
    parser.add_argument("--origem", required=True)
    parser.add_argument("--vezes", type=int, default=8)
    parser.add_argument("--segundos", type=float, default=2)
    parser.add_argument("--frase", default="MOAH")
    parser.add_argument("--prefixo", default="moah")
    parser.add_argument("--sessao", default="")
    parser.add_argument("--ouvir", default="nao")
    parser.add_argument("--destino", default="")
    args = parser.parse_args()
    if args.iniciar != "sim":
        raise SystemExit("A coleta exige --iniciar sim.")
    if args.vezes < 1 or args.segundos <= 0 or args.segundos > 6:
        raise SystemExit("Use pelo menos uma tomada, com no máximo 6 segundos cada.")
    if args.ouvir not in {"sim", "nao"}:
        raise SystemExit("Use --ouvir sim ou --ouvir nao.")
    if args.ouvir == "sim" and not args.destino:
        raise SystemExit("A reprodução precisa do destino de áudio.")
    if args.sessao:
        if args.sessao not in SESSOES:
            raise SystemExit("A sessão precisa ser 01, 02, 03 ou 04.")
        if args.segundos < 4:
            raise SystemExit("A sessão pede pelo menos 4 segundos, com silêncio antes e depois.")
        papel, instrucao = SESSOES[args.sessao]
        destino = Path(args.saida).resolve() / "coleta" / "sessoes" / f"sessao-{args.sessao}"
        destino.mkdir(parents=True, exist_ok=True)
        if any(destino.glob("tomada-*.wav")):
            raise SystemExit(f"A sessão {args.sessao} já tem tomadas. Nada foi sobrescrito.")
        print(f"Sessão {args.sessao}, papel {papel}. {instrucao}", flush=True)
        nomes = [destino / f"tomada-{indice:02d}.wav" for indice in range(1, args.vezes + 1)]
    else:
        if not args.prefixo.replace("-", "").isalnum():
            raise SystemExit("O prefixo só pode ter letras, números e hífen.")
        destino = Path(args.saida).resolve() / "coleta"
        destino.mkdir(parents=True, exist_ok=True)
        inicio = 1
        while (destino / f"{args.prefixo}-{inicio:02d}.wav").exists():
            inicio += 1
        nomes = [destino / f"{args.prefixo}-{indice:02d}.wav" for indice in range(inicio, inicio + args.vezes)]
    for ordem, arquivo in enumerate(nomes, start=1):
        if arquivo.exists():
            raise SystemExit(f"{arquivo.name} já existe. A coleta não sobrescreve uma tomada.")
        print(f"Tomada {ordem} de {len(nomes)}.", flush=True)
        _contagem()
        _gravar(args.origem, arquivo, args.segundos, args.frase)
        _envelope(arquivo)
        if args.ouvir == "sim":
            print("Reproduzindo para conferência. A reprodução não valida a palavra.", flush=True)
            subprocess.run(["pw-play", "--target", args.destino, arquivo.as_posix()], check=False)
        print(arquivo.as_posix(), flush=True)
    print("Coleta encerrada. Nenhum arquivo foi enviado.", flush=True)


def _contagem() -> None:
    print("A captura começa depois da contagem.", flush=True)
    for numero in (3, 2, 1):
        print(f"\n  {numero}", flush=True)
        time.sleep(1)
    print("\nCapturando.", flush=True)


def _gravar(origem: str, arquivo: Path, segundos: float, frase: str) -> None:
    try:
        descritor = os.open(arquivo, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o664)
    except FileExistsError:
        raise SystemExit(f"{arquivo.name} já existe. A coleta não sobrescreve uma tomada.") from None
    os.close(descritor)
    parar = threading.Event()
    avisos = threading.Thread(target=_avisos, args=(segundos, frase, parar), daemon=True)
    processo = subprocess.Popen(
        ["pw-record", "--target", origem, "--rate", "16000", "--channels", "1", "--format", "s16", arquivo.as_posix()],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    avisos.start()
    try:
        processo.wait(timeout=segundos)
    except subprocess.TimeoutExpired:
        processo.send_signal(signal.SIGINT)
        processo.wait(timeout=2)
    finally:
        parar.set()
        avisos.join(timeout=1)
    if not arquivo.exists() or arquivo.stat().st_size < 1000:
        arquivo.unlink(missing_ok=True)
        raise SystemExit(f"A gravação de {arquivo.name} não produziu áudio e o arquivo vazio foi removido.")


def _avisos(segundos: float, frase: str, parar: threading.Event) -> None:
    fala = "Fique em silêncio." if frase == "-" else f"Fale {frase} agora, uma vez."
    marcos = ((0.0, "Silêncio."), (segundos * 0.25, fala), (segundos * 0.55, "Silêncio até o fim."))
    inicio = time.monotonic()
    for instante, texto in marcos:
        if parar.wait(max(0.0, instante - (time.monotonic() - inicio))):
            return
        print(texto, flush=True)


def _envelope(arquivo: Path) -> None:
    with wave.open(arquivo.as_posix(), "rb") as wav:
        if wav.getframerate() != 16000 or wav.getnchannels() != 1 or wav.getsampwidth() != 2:
            print(f"{arquivo.name} não está em 16 kHz mono PCM 16 bits.", flush=True)
            return
        audio = np.frombuffer(wav.readframes(wav.getnframes()), dtype=np.int16).astype(np.float32)
    sem = audio - float(np.mean(audio))
    hop = 800
    envelope = np.array([np.sqrt(np.mean(sem[i:i + hop] ** 2)) for i in range(0, max(len(sem) - hop, 1), hop)])
    if len(envelope) < 8:
        print("Tomada curta demais para observar as bordas.", flush=True)
    else:
        miolo = float(np.median(envelope[2:-2]))
        if float(np.max(envelope[:3])) > max(250.0, miolo * 2):
            print("Possível corte no início.", flush=True)
        if float(np.max(envelope[-3:])) > max(250.0, miolo * 2):
            print("Possível corte no fim.", flush=True)
        if float(np.max(envelope)) < 250:
            print("Nível baixo em relação ao critério de 250 de RMS.", flush=True)
    print("Energia e silêncio não comprovam que a palavra esteja completa.", flush=True)


if __name__ == "__main__":
    main()
