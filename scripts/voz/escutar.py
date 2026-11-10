#!/usr/bin/env python3
"""Escuta o microfone nomeado, responde à pronúncia e transcreve o pedido.

Não grava o ambiente. Fecha a captura antes da saudação. Descarta o buffer do
pedido após a transcrição. O STT roda no venv separado sob MOAH_VOICE_DIR/stt.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import signal
import subprocess
import sys
import tempfile
import time
import unicodedata
import wave
from collections import deque
from pathlib import Path

import numpy as np

TAXA = 16_000
QUADRO = 1280
PEDIDO_S = 8.0
PICO_MUDO = 50.0
# ~1,6 s imediatamente antes/incluindo o quadro do disparo (janela curta em memória).
CONFIRMACAO_QUADROS = 20
DIAGNOSTICO_MAX = 3
ATIVACOES = frozenset({"MOAH", "MOA"})

_STT_WORKER = r"""
import os
import sys
import numpy as np
from faster_whisper import WhisperModel

modelo = WhisperModel(
    os.environ["MOAH_STT_MODEL"],
    device="cpu",
    compute_type="int8",
    local_files_only=True,
)
sys.stdout.write("READY\n")
sys.stdout.flush()
while True:
    cabeca = sys.stdin.buffer.read(8)
    if len(cabeca) < 8:
        break
    n = int.from_bytes(cabeca, "little")
    bruto = sys.stdin.buffer.read(n * 4)
    if len(bruto) < n * 4:
        break
    audio = np.frombuffer(bruto, dtype=np.float32).copy()
    segmentos, _ = modelo.transcribe(audio, language="pt")
    del audio
    sys.stdout.write("".join(s.text for s in segmentos).strip().replace("\n", " ") + "\n")
    sys.stdout.flush()
"""


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--habilitar", required=True)
    parser.add_argument("--modelo", required=True)
    parser.add_argument("--recursos", required=True)
    parser.add_argument("--origem", required=True)
    parser.add_argument("--destino", required=True)
    parser.add_argument("--limiar", type=float, default=0.5)
    parser.add_argument("--duracao", type=float, default=0)
    parser.add_argument("--pedido", type=float, default=PEDIDO_S)
    parser.add_argument("--confirmar-ativacao", default="nao")
    parser.add_argument("--diagnostico", default="nao")
    parser.add_argument("--provar-eco", action="store_true")
    args = parser.parse_args()
    if args.habilitar != "sim":
        raise SystemExit("A escuta exige --habilitar sim.")
    if args.confirmar_ativacao not in {"sim", "nao"}:
        raise SystemExit("Use --confirmar-ativacao sim ou nao.")
    if args.diagnostico not in {"sim", "nao"}:
        raise SystemExit("Use --diagnostico sim ou nao.")
    confirmar = args.confirmar_ativacao == "sim"
    diagnostico = args.diagnostico == "sim"
    diagnostico_dir = _voz_dir() / "diagnostico" / "confirmacao"
    diagnostico_salvos = 0

    modelo = Path(args.modelo)
    if not modelo.is_file():
        raise SystemExit(f"Modelo ausente: {modelo}")
    stt_dir = _voz_dir() / "stt" / "faster-whisper-small"
    stt_python = _voz_dir() / "stt" / "venv" / "bin" / "python"
    if not (stt_dir / "model.bin").is_file():
        raise SystemExit(f"Modelo STT ausente: {stt_dir}")
    if not stt_python.is_file():
        raise SystemExit(f"Interpretador STT ausente: {stt_python}")
    sys.path.insert(0, str(Path(args.recursos) / "hey_pran_openwakeword_v060"))
    from openwakeword.model import Model

    detector = Model(wakeword_models=[str(modelo)], inference_framework="onnx", vad_threshold=0)
    chave = next(iter(detector.models))
    stt = _Stt(stt_python, stt_dir)
    inicio = time.time()
    captura: subprocess.Popen[bytes] | None = None
    pico = 0.0
    acertos = 0

    def encerrar(_signum: int, _frame: object) -> None:
        _fechar(captura)
        stt.close()
        _estado("desligado", microfone="liberado", pico=pico, acertos=acertos)
        raise SystemExit(0)

    signal.signal(signal.SIGINT, encerrar)
    signal.signal(signal.SIGTERM, encerrar)
    try:
        if args.provar_eco:
            _estado("aguardando", microfone="retido", modelo=str(modelo), limiar=args.limiar)
            captura = _abrir(args.origem)
            _saudacao(args.destino)
            pico = _ler(detector, chave, captura, args.limiar, 4, False)
            _fechar(captura)
            captura = None
            _estado("desligado", microfone="liberado", pico=pico, eco=True)
            return
        _estado(
            "aguardando",
            microfone="retido",
            modelo=str(modelo),
            limiar=args.limiar,
            confirmarAtivacao=confirmar,
        )
        while args.duracao <= 0 or time.time() - inicio < args.duracao:
            captura = _abrir(args.origem)
            detectou, score, parcial, trecho = _aguardar(
                detector,
                chave,
                captura,
                args.limiar,
                inicio,
                args.duracao,
                guardar=confirmar,
            )
            pico = max(pico, parcial)
            _fechar(captura)
            captura = None
            if not detectou:
                break
            if confirmar:
                _estado(
                    "confirmando",
                    microfone="liberado",
                    pico=pico,
                    score=score,
                    acertos=acertos,
                    modelo=str(modelo),
                    limiar=args.limiar,
                )
                wav_diag: Path | None = None
                # Só grava o que de fato seguiria para o Whisper (não mudo).
                if diagnostico and diagnostico_salvos < DIAGNOSTICO_MAX and not _muda(trecho):
                    diagnostico_salvos += 1
                    wav_diag = _salvar_wav_confirmacao(diagnostico_dir, diagnostico_salvos, trecho)
                reconhecido = _transcrever_seguro(stt, trecho)
                del trecho
                if wav_diag is not None:
                    print(f"{reconhecido}\n{wav_diag}", flush=True)
                else:
                    print(reconhecido, flush=True)
                if not _ativacao_confirmada(reconhecido):
                    _estado(
                        "aguardando",
                        microfone="liberado",
                        pico=pico,
                        acertos=acertos,
                        texto=reconhecido,
                        confirmarAtivacao=True,
                    )
                    continue
            else:
                del trecho
            acertos += 1
            _estado(
                "saudacao",
                microfone="liberado",
                pico=pico,
                score=score,
                acertos=acertos,
                modelo=str(modelo),
                limiar=args.limiar,
            )
            _saudacao(args.destino)
            _estado("ouvindo", microfone="retido", pico=pico, acertos=acertos)
            captura = _abrir(args.origem)
            amostras = _capturar_pedido(captura, args.pedido)
            _fechar(captura)
            captura = None
            texto = _transcrever(stt, amostras)
            del amostras
            print(texto, flush=True)
            consulta = _analisar_onde_paramos(texto)
            if consulta is not None:
                _estado("consultando", microfone="liberado", pico=pico, acertos=acertos, texto=texto)
                if consulta[0] == "ambiguo":
                    _pedir_confirmacao_projeto(consulta[1], consulta[2])
                else:
                    _consultar_checkpoint(consulta[1])
            _estado("aguardando", microfone="liberado", pico=pico, acertos=acertos, texto=texto)
        _estado("desligado", microfone="liberado", pico=pico, acertos=acertos)
    finally:
        _fechar(captura)
        stt.close()


class _Stt:
    def __init__(self, python: Path, modelo: Path) -> None:
        env = os.environ.copy()
        env["HF_HUB_OFFLINE"] = "1"
        env["MOAH_STT_MODEL"] = str(modelo)
        self._proc = subprocess.Popen(
            [str(python), "-u", "-c", _STT_WORKER],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
        pronto = self._proc.stdout.readline() if self._proc.stdout else b""
        if pronto.decode("utf-8", "replace").strip() != "READY":
            erro = self._proc.stderr.read().decode("utf-8", "replace") if self._proc.stderr else ""
            self.close()
            raise SystemExit(f"Falha ao carregar STT: {erro.strip() or 'sem READY'}")

    def transcribe(self, audio: np.ndarray) -> str:
        if self._proc.stdin is None or self._proc.stdout is None:
            raise SystemExit("STT encerrado.")
        payload = len(audio).to_bytes(8, "little") + audio.astype(np.float32, copy=False).tobytes()
        self._proc.stdin.write(payload)
        self._proc.stdin.flush()
        linha = self._proc.stdout.readline()
        if not linha:
            erro = self._proc.stderr.read().decode("utf-8", "replace") if self._proc.stderr else ""
            raise SystemExit(f"STT encerrou durante a transcrição: {erro.strip()}")
        return linha.decode("utf-8", "replace").rstrip("\n")

    def close(self) -> None:
        if self._proc.poll() is not None:
            return
        if self._proc.stdin is not None:
            try:
                self._proc.stdin.close()
            except BrokenPipeError:
                pass
        self._proc.terminate()
        try:
            self._proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            self._proc.kill()
            self._proc.wait(timeout=1)


def _aguardar(
    detector,
    chave: str,
    captura: subprocess.Popen[bytes],
    limiar: float,
    inicio: float,
    duracao: float,
    guardar: bool = False,
) -> tuple[bool, float, float, np.ndarray]:
    """Retorna (detectou, score do disparo, pico local, trecho PCM curto).

    Com guardar=True, só aceita disparo depois que a captura atual preencheu a
    janela de confirmação (~1,6 s). Disparos anteriores são ignorados; exige-se
    um novo score acima do limiar com o buffer já completo.
    """
    pico = 0.0
    recentes: deque[np.ndarray] = deque(maxlen=CONFIRMACAO_QUADROS if guardar else 0)
    vazio = np.zeros(0, dtype=np.int16)
    while duracao <= 0 or time.time() - inicio < duracao:
        quadro = _quadro(captura)
        if quadro is None:
            return False, 0.0, pico, vazio
        if guardar:
            recentes.append(quadro.copy())
        score = float(detector.predict(quadro).get(chave, 0.0))
        pico = max(pico, score)
        if score < limiar:
            continue
        if not guardar:
            return True, score, pico, vazio
        if len(recentes) < CONFIRMACAO_QUADROS:
            continue
        return True, score, pico, np.concatenate(list(recentes))
    return False, 0.0, pico, vazio


def _ler(detector, chave: str, captura: subprocess.Popen[bytes], limiar: float, segundos: float, _parar: bool) -> float:
    fim = time.time() + segundos
    pico = 0.0
    while time.time() < fim:
        quadro = _quadro(captura)
        if quadro is None:
            break
        pico = max(pico, float(detector.predict(quadro).get(chave, 0.0)))
    return pico


def _capturar_pedido(captura: subprocess.Popen[bytes], segundos: float) -> np.ndarray:
    fim = time.time() + max(0.1, segundos)
    blocos: list[np.ndarray] = []
    while time.time() < fim:
        quadro = _quadro(captura)
        if quadro is None:
            break
        blocos.append(quadro.copy())
    if not blocos:
        return np.zeros(0, dtype=np.int16)
    return np.concatenate(blocos)


def _salvar_wav_confirmacao(pasta: Path, indice: int, amostras: np.ndarray) -> Path:
    """Grava o PCM int16 que, dividido por 32768, é o float enviado ao Whisper."""
    pasta.mkdir(parents=True, exist_ok=True)
    destino = pasta / f"confirmacao-{indice:02d}.wav"
    pcm = np.ascontiguousarray(amostras, dtype=np.int16)
    with wave.open(str(destino), "wb") as wav:
        wav.setnchannels(1)
        wav.setsampwidth(2)
        wav.setframerate(TAXA)
        wav.writeframes(pcm.tobytes())
    return destino.resolve()


def _transcrever(stt: _Stt, amostras: np.ndarray) -> str:
    if _muda(amostras):
        return ""
    audio = amostras.astype(np.float32) / 32768.0
    try:
        return stt.transcribe(audio)
    finally:
        del audio


def _transcrever_seguro(stt: _Stt, amostras: np.ndarray) -> str:
    try:
        return _transcrever(stt, amostras)
    except Exception:
        return ""


def _normalizar_ativacao(texto: str) -> str:
    sem_acento = unicodedata.normalize("NFKD", texto)
    sem_acento = "".join(c for c in sem_acento if not unicodedata.combining(c))
    limpo = re.sub(r"[^A-Za-z0-9]+", " ", sem_acento.upper())
    return " ".join(limpo.split())


def _ativacao_confirmada(texto: str) -> bool:
    palavras = _normalizar_ativacao(texto).split()
    return 1 <= len(palavras) <= 2 and all(palavra in ATIVACOES for palavra in palavras)


_PADRAO_ONDE_PARAMOS = re.compile(r"ONDE PARAMOS NO (.+)$")


def _extrair_projeto_onde_paramos(texto: str) -> str | None:
    """Extrai o projeto após «onde paramos no», ignorando prefixo (ex.: «Pão,»)."""
    normalizado = _normalizar_ativacao(texto)
    achado = _PADRAO_ONDE_PARAMOS.search(normalizado)
    if not achado:
        return None
    projeto = achado.group(1).strip()
    return projeto or None


def _titulo_projeto(normalizado: str) -> str:
    return " ".join(parte.capitalize() for parte in normalizado.split())


def _data_dir() -> Path:
    override = os.environ.get("MOAH_DATA_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    xdg = os.environ.get("XDG_DATA_HOME", "").strip()
    if xdg:
        return Path(xdg).expanduser().resolve() / "moah"
    return Path.home() / ".local" / "share" / "moah"


def _projetos_conhecidos() -> list[str]:
    banco = _data_dir() / "moah.sqlite"
    if not banco.is_file():
        return []
    try:
        import sqlite3

        with sqlite3.connect(f"file:{banco}?mode=ro", uri=True) as conn:
            linhas = conn.execute(
                "SELECT DISTINCT project FROM records WHERE project IS NOT NULL AND trim(project) != '' ORDER BY project"
            ).fetchall()
        return [str(linha[0]) for linha in linhas]
    except Exception:
        return []


def _analisar_onde_paramos(texto: str) -> tuple[str, str] | tuple[str, str, list[str]] | None:
    """None se não for o pedido; ('consultar', projeto); ('ambiguo', candidato, opções)."""
    candidato = _extrair_projeto_onde_paramos(texto)
    if candidato is None:
        return None
    conhecidos = _projetos_conhecidos()
    cand_n = _normalizar_ativacao(candidato)
    if not conhecidos:
        return ("consultar", _titulo_projeto(cand_n))
    exatos = [p for p in conhecidos if _normalizar_ativacao(p) == cand_n]
    if len(exatos) == 1:
        return ("consultar", exatos[0])
    if len(exatos) > 1:
        return ("ambiguo", candidato, exatos)
    prefixos = [p for p in conhecidos if _normalizar_ativacao(p).startswith(cand_n)]
    if len(prefixos) == 1:
        return ("consultar", prefixos[0])
    if len(prefixos) > 1:
        return ("ambiguo", candidato, prefixos)
    return ("consultar", _titulo_projeto(cand_n))


def _pedir_confirmacao_projeto(candidato: str, opcoes: list[str]) -> None:
    lista = ", ".join(opcoes)
    print(
        f"Projeto ambíguo para «{_titulo_projeto(_normalizar_ativacao(candidato))}». "
        f"Confirme qual consultar: {lista}.",
        flush=True,
    )


def _consultar_checkpoint(projeto: str) -> None:
    """Consulta de leitura: mesmo caminho de `moah onde-paramos --projeto …`."""
    repo = Path(__file__).resolve().parents[2]
    cli = repo / "dist" / "src" / "cli" / "main.js"
    if not cli.is_file():
        print("Consulta indisponível: CLI não compilada.", flush=True)
        return
    resultado = subprocess.run(
        [
            "node",
            "--disable-warning=ExperimentalWarning",
            str(cli),
            "onde-paramos",
            "--dominio",
            "pessoal",
            "--projeto",
            projeto,
        ],
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    saida = (resultado.stdout or "").strip()
    if not saida:
        erro = (resultado.stderr or "").strip()
        saida = erro or f"Nenhum checkpoint para pessoal/{projeto}."
    print(saida, flush=True)


def _muda(amostras: np.ndarray) -> bool:
    if not amostras.size or not np.any(amostras):
        return True
    sem = amostras.astype(np.float32) - float(np.mean(amostras))
    return float(np.max(np.abs(sem))) < PICO_MUDO


def _quadro(captura: subprocess.Popen[bytes]) -> np.ndarray | None:
    if captura.stdout is None:
        return None
    bruto = captura.stdout.read(QUADRO * 2)
    if len(bruto) < QUADRO * 2:
        return None
    return np.frombuffer(bruto, dtype=np.int16)


def _abrir(origem: str) -> subprocess.Popen[bytes]:
    return subprocess.Popen(
        ["pw-record", "--target", origem, "--rate", str(TAXA), "--channels", "1", "--format", "s16", "--raw", "-"],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL,
    )


def _fechar(captura: subprocess.Popen[bytes] | None) -> None:
    if captura is None or captura.poll() is not None:
        return
    captura.terminate()
    try:
        captura.wait(timeout=1)
    except subprocess.TimeoutExpired:
        captura.kill()
        captura.wait(timeout=1)


def _saudacao(destino: str) -> None:
    with tempfile.TemporaryDirectory() as pasta:
        arquivo = Path(pasta) / "ola.wav"
        subprocess.run(["espeak", "-v", "pt-br", "-s", "140", "-w", str(arquivo), "Estou aqui."], check=True)
        subprocess.run(["pw-play", "--target", destino, str(arquivo)], check=True)


def _voz_dir() -> Path:
    override = os.environ.get("MOAH_VOICE_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    return Path.home() / ".local" / "share" / "moah" / "voz"


def _estado(
    fase: str,
    microfone: str,
    pico: float = 0,
    acertos: int = 0,
    eco: bool = False,
    texto: str | None = None,
    score: float | None = None,
    modelo: str | None = None,
    limiar: float | None = None,
    confirmarAtivacao: bool | None = None,
) -> None:
    payload: dict[str, object] = {
        "fase": fase,
        "microfone": microfone,
        "pico": round(pico, 4),
        "acertos": acertos,
        "eco": eco,
        "detectorConfirmado": False,
    }
    if score is not None:
        payload["score"] = round(score, 4)
    if modelo is not None:
        payload["modelo"] = modelo
    if limiar is not None:
        payload["limiar"] = limiar
    if confirmarAtivacao is not None:
        payload["confirmarAtivacao"] = confirmarAtivacao
    if texto is not None:
        payload["texto"] = texto
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    sys.stdout.flush()


if __name__ == "__main__":
    main()
