#!/usr/bin/env python3
"""Escuta o microfone nomeado, responde à pronúncia e transcreve o pedido.

Não grava o ambiente. Fecha a captura antes da saudação e da resposta. Descarta
o buffer do pedido após a transcrição. O STT roda no venv separado sob
MOAH_VOICE_DIR/stt. O pedido transcrito passa por `moah voz pedido`: só
ferramentas cadastradas via política; capacidade ausente é falada e o laço
volta a aguardar.
"""

from __future__ import annotations

import argparse
import hashlib
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

from janela_pedido import JanelaPedido, LimitesPedido, decidir

TAXA = 16_000
QUADRO = 1280
CANAIS = 1
FORMATO = "s16"
PEDIDO_MAX_S = 8.0
ESPERA_S = 4.0
SILENCIO_S = 0.7
PICO_FALA = 200.0
PICO_MUDO = 50.0
ARRANQUE_S = 1.7
DIAGNOSTICO_S = 1.0
# ~1,6 s imediatamente antes/incluindo o quadro do disparo (janela curta em memória).
CONFIRMACAO_QUADROS = 20
DIAGNOSTICO_MAX = 3
ATIVACOES = frozenset({"MOAH", "MOA"})
ATIVACOES_FLEXIVEIS = frozenset({"MUA", "MULA", "BOA"})
FRASES_FLEXIVEIS = frozenset({"HEY MOA", "HEY MOAH"})

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
    parser.add_argument("--pedido", type=float, default=PEDIDO_MAX_S)
    parser.add_argument("--espera", type=float, default=ESPERA_S)
    parser.add_argument("--silencio", type=float, default=SILENCIO_S)
    parser.add_argument("--pico-fala", type=float, default=PICO_FALA)
    parser.add_argument("--arranque", type=float, default=ARRANQUE_S)
    parser.add_argument("--confirmar-ativacao", default="nao")
    parser.add_argument("--confirmacao-flexivel", default="nao")
    parser.add_argument("--diagnostico", default="nao")
    parser.add_argument("--gravar-diagnostico", default="nao")
    parser.add_argument("--provar-eco", action="store_true")
    args = parser.parse_args()
    if args.habilitar != "sim":
        raise SystemExit("A escuta exige --habilitar sim.")
    if args.confirmar_ativacao not in {"sim", "nao"}:
        raise SystemExit("Use --confirmar-ativacao sim ou nao.")
    if args.confirmacao_flexivel not in {"sim", "nao"}:
        raise SystemExit("Use --confirmacao-flexivel sim ou nao.")
    if args.diagnostico not in {"sim", "nao"}:
        raise SystemExit("Use --diagnostico sim ou nao.")
    if args.gravar_diagnostico not in {"sim", "nao"}:
        raise SystemExit("Use --gravar-diagnostico sim ou nao.")
    if args.limiar <= 0 or args.limiar > 1:
        raise SystemExit("O limiar precisa ser maior que 0 e no máximo 1.")
    if min(args.pedido, args.espera, args.silencio, args.pico_fala) <= 0 or args.arranque < 0:
        raise SystemExit("Informe espera, silêncio, pedido e pico de fala maiores que zero.")
    confirmar = args.confirmar_ativacao == "sim"
    flexivel = args.confirmacao_flexivel == "sim"
    diagnostico = args.diagnostico == "sim"
    gravar = args.gravar_diagnostico == "sim"
    diagnostico_dir = _voz_dir() / "diagnostico" / "confirmacao"
    diagnostico_salvos = 0

    modelo = Path(args.modelo)
    if not modelo.is_file():
        raise SystemExit(f"Modelo ausente: {modelo}")
    stt_dir = _voz_dir() / "stt" / "faster-whisper-small"
    stt_python = _voz_dir() / "stt" / "venv" / "bin" / "python"
    sys.path.insert(0, str(Path(args.recursos) / "hey_pran_openwakeword_v060"))
    from openwakeword.model import Model

    detector = Model(wakeword_models=[str(modelo)], inference_framework="onnx", vad_threshold=0)
    chave = next(iter(detector.models))
    stt: _Stt | None = None
    stt_erro: str | None = None
    inicio = time.time()
    captura: subprocess.Popen[bytes] | None = None
    pico = 0.0
    acertos = 0
    limites = LimitesPedido(espera_s=args.espera, silencio_s=args.silencio, maximo_s=args.pedido)
    _configuracao(
        modelo=modelo,
        chave=chave,
        limiar=args.limiar,
        origem=args.origem,
        destino=args.destino,
        confirmar=confirmar,
        diagnostico=diagnostico,
        gravar=gravar,
        limites=limites,
        pico_fala=args.pico_fala,
        arranque=args.arranque,
    )
    if diagnostico:
        print(f"diagnostico modelo={modelo} chave={chave} carregado=sim vad=0", flush=True)

    def obter_stt() -> _Stt | None:
        nonlocal stt, stt_erro
        if stt is not None:
            return stt
        if stt_erro is not None:
            return None
        if not (stt_dir / "model.bin").is_file() or not stt_python.is_file():
            stt_erro = f"Modelo STT ausente em {stt_dir}."
            print(stt_erro, flush=True)
            return None
        try:
            stt = _Stt(stt_python, stt_dir)
        except Exception as exc:
            stt_erro = str(exc).strip() or "Falha ao carregar STT."
            print(stt_erro, flush=True)
            return None
        return stt

    def encerrar(_signum: int, _frame: object) -> None:
        _parar_reproducao()
        _fechar(captura)
        if stt is not None:
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
            t_espera = time.perf_counter()
            detectou, score, parcial, trecho = _aguardar(
                detector,
                chave,
                captura,
                args.limiar,
                inicio,
                args.duracao,
                guardar=confirmar,
                diagnostico=diagnostico,
                arranque_s=args.arranque,
            )
            espera_ms = _ms(t_espera)
            pico = max(pico, parcial)
            _fechar(captura)
            captura = None
            if not detectou:
                break
            if diagnostico:
                print(f"diagnostico ativacao score={score:.4f} limiar={args.limiar:.4f}", flush=True)
            tempos = {"esperaAtivacaoMs": espera_ms}
            if confirmar:
                _estado(
                    "transcrevendo",
                    microfone="liberado",
                    pico=pico,
                    score=score,
                    acertos=acertos,
                    modelo=str(modelo),
                    limiar=args.limiar,
                )
                wav_diag: Path | None = None
                if gravar and diagnostico_salvos < DIAGNOSTICO_MAX and not _muda(trecho):
                    diagnostico_salvos += 1
                    wav_diag = _salvar_wav_confirmacao(diagnostico_dir, diagnostico_salvos, trecho)
                trabalhador = obter_stt()
                t_confirma = time.perf_counter()
                reconhecido = "" if trabalhador is None else _transcrever_seguro(trabalhador, trecho)
                tempos["confirmacaoMs"] = _ms(t_confirma)
                del trecho
                if wav_diag is not None:
                    print(f"{reconhecido}\n{wav_diag}", flush=True)
                else:
                    print(reconhecido, flush=True)
                if trabalhador is None or not _ativacao_confirmada(reconhecido, flexivel=flexivel):
                    _tempos(tempos)
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
            _conduzir_pedido(
                destino=args.destino,
                abrir=lambda: _abrir(args.origem),
                limites=limites,
                pico_fala=args.pico_fala,
                obter_stt=obter_stt,
                pico=pico,
                acertos=acertos,
                score=score,
                tempos=tempos,
                modelo=str(modelo),
                limiar=args.limiar,
            )
        _estado("desligado", microfone="liberado", pico=pico, acertos=acertos)
    finally:
        _parar_reproducao()
        _fechar(captura)
        if stt is not None:
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
            raise RuntimeError(f"Falha ao carregar STT: {erro.strip() or 'sem READY'}")

    def transcribe(self, audio: np.ndarray) -> str:
        if self._proc.stdin is None or self._proc.stdout is None:
            raise RuntimeError("STT encerrado.")
        payload = len(audio).to_bytes(8, "little") + audio.astype(np.float32, copy=False).tobytes()
        self._proc.stdin.write(payload)
        self._proc.stdin.flush()
        linha = self._proc.stdout.readline()
        if not linha:
            erro = self._proc.stderr.read().decode("utf-8", "replace") if self._proc.stderr else ""
            raise RuntimeError(f"STT encerrou durante a transcrição: {erro.strip()}")
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
    diagnostico: bool = False,
    arranque_s: float = 0.0,
) -> tuple[bool, float, float, np.ndarray]:
    """Retorna (detectou, score do disparo, pico local, trecho PCM curto).

    Com guardar=True, só aceita disparo depois que a captura atual preencheu a
    janela de confirmação (~1,6 s). Os primeiros arranque_s são medidos e não
    disparam: o fluxo do openWakeWord pode pontuar alto ao abrir o microfone.
    """
    pico = 0.0
    recentes: deque[np.ndarray] = deque(maxlen=CONFIRMACAO_QUADROS if guardar else 0)
    vazio = np.zeros(0, dtype=np.int16)
    aberto = time.monotonic()
    ultimo_relato = aberto
    primeiro = True
    rms_max = 0.0
    pico_audio = 0
    dc_ultimo = 0.0
    score_max = 0.0
    score_ultimo = 0.0
    quadros = 0
    while duracao <= 0 or time.time() - inicio < duracao:
        quadro = _quadro(captura)
        if quadro is None:
            if diagnostico:
                _diag(
                    f"audio=interrompido rms={rms_max:.0f} pico={pico_audio} "
                    f"score={score_max:.4f} limiar={limiar:.4f} quadros={quadros}"
                )
            return False, 0.0, pico, vazio
        if guardar:
            recentes.append(quadro.copy())
        nivel = _medir(quadro)
        rms_max = max(rms_max, nivel[0])
        pico_audio = max(pico_audio, nivel[1])
        dc_ultimo = nivel[2]
        score = float(detector.predict(quadro).get(chave, 0.0))
        pico = max(pico, score)
        score_max = max(score_max, score)
        score_ultimo = score
        quadros += 1
        agora = time.monotonic()
        if diagnostico and (primeiro or agora - ultimo_relato >= DIAGNOSTICO_S):
            primeiro = False
            _diag(
                f"nivel rms={rms_max:.0f} pico={pico_audio} dc={dc_ultimo:.0f} "
                f"score={score_max:.4f} ultimo={score_ultimo:.4f} limiar={limiar:.4f} quadros={quadros}"
            )
            rms_max = 0.0
            pico_audio = 0
            score_max = 0.0
            quadros = 0
            ultimo_relato = agora
        if score < limiar or agora - aberto < arranque_s:
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


def _capturar_pedido(
    captura: subprocess.Popen[bytes],
    limites: LimitesPedido,
    pico_fala: float,
) -> tuple[np.ndarray, str]:
    inicio = time.monotonic()
    janela = JanelaPedido(inicio=inicio)
    blocos: list[np.ndarray] = []
    motivo = "interrupcao"
    while True:
        quadro = _quadro(captura)
        agora = time.monotonic()
        if quadro is None:
            break
        blocos.append(quadro.copy())
        decisao = decidir(janela, agora, _tem_fala(quadro, pico_fala), limites)
        if decisao is not None:
            motivo = decisao
            break
    if not blocos:
        return np.zeros(0, dtype=np.int16), motivo
    return np.concatenate(blocos), motivo


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


def _ativacao_confirmada(texto: str, flexivel: bool = False) -> bool:
    normalizado = _normalizar_ativacao(texto)
    palavras = normalizado.split()
    if 1 <= len(palavras) <= 2 and all(palavra in ATIVACOES for palavra in palavras):
        return True
    if not flexivel:
        return False
    if len(palavras) == 1 and palavras[0] in ATIVACOES_FLEXIVEIS:
        return True
    return normalizado in FRASES_FLEXIVEIS


def _consultar_pedido(texto: str) -> tuple[str | None, str | None]:
    """Encaminha o pedido ao catálogo local via `moah voz pedido`."""
    repo = Path(__file__).resolve().parents[2]
    cli = repo / "dist" / "src" / "cli" / "main.js"
    if not cli.is_file():
        return None, "Consulta indisponível: CLI não compilada."
    resultado = subprocess.run(
        [
            "node",
            "--disable-warning=ExperimentalWarning",
            str(cli),
            "voz",
            "pedido",
            "--dominio",
            "pessoal",
            "--texto",
            texto,
        ],
        capture_output=True,
        text=True,
        env=os.environ.copy(),
    )
    bruto = (resultado.stdout or "").strip()
    if resultado.returncode != 0 or not bruto:
        erro = (resultado.stderr or "").strip() or bruto or "Falha ao consultar o catálogo."
        return None, erro
    try:
        payload = json.loads(bruto)
    except json.JSONDecodeError:
        return None, bruto
    terminal = str(payload.get("terminal") or "").strip()
    if terminal:
        print(terminal, flush=True)
    falar = payload.get("speak")
    if not isinstance(falar, str) or not falar.strip():
        return None, None
    return falar.strip(), None


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
        [
            "pw-record",
            "--target",
            origem,
            "--rate",
            str(TAXA),
            "--channels",
            str(CANAIS),
            "--format",
            FORMATO,
            "--raw",
            "-",
        ],
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


_reproducao: subprocess.Popen[bytes] | None = None


def _executar(comando: list[str]) -> None:
    global _reproducao
    _reproducao = subprocess.Popen(comando, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    codigo = _reproducao.wait()
    erro = _reproducao.stderr.read().decode("utf-8", "replace").strip() if _reproducao.stderr else ""
    _reproducao = None
    if codigo != 0:
        raise subprocess.CalledProcessError(codigo, comando, stderr=erro)


def _parar_reproducao() -> None:
    global _reproducao
    if _reproducao is None or _reproducao.poll() is not None:
        _reproducao = None
        return
    _reproducao.terminate()
    try:
        _reproducao.wait(timeout=1)
    except subprocess.TimeoutExpired:
        _reproducao.kill()
        _reproducao.wait(timeout=1)
    _reproducao = None


def _falar(destino: str, texto: str) -> None:
    """Síntese espeak + reprodução pw-play no destino da saudação."""
    with tempfile.TemporaryDirectory() as pasta:
        arquivo = Path(pasta) / "fala.wav"
        _executar(["espeak", "-v", "pt-br", "-s", "140", "-w", str(arquivo), texto])
        _executar(["pw-play", "--target", destino, str(arquivo)])


def _falar_seguro(destino: str, texto: str) -> str | None:
    """Reproduz texto; retorna mensagem de erro ou None se ok."""
    try:
        _falar(destino, texto)
        return None
    except Exception as exc:
        detalhe = str(exc).strip()
        return detalhe or type(exc).__name__


def _saudacao(destino: str) -> None:
    _falar(destino, "Estou aqui.")


def _ouvir_texto(obter_stt, amostras: np.ndarray, tempos: dict[str, int]) -> tuple[str, str | None]:
    trabalhador = obter_stt()
    if trabalhador is None:
        tempos["transcricaoMs"] = 0
        return "", "A transcrição não está disponível."
    t0 = time.perf_counter()
    try:
        return _transcrever(trabalhador, amostras), None
    except Exception as exc:
        return "", str(exc).strip() or "Falha na transcrição."
    finally:
        tempos["transcricaoMs"] = _ms(t0)


def _conduzir_pedido(
    *,
    destino: str,
    abrir,
    limites: LimitesPedido,
    pico_fala: float,
    obter_stt,
    pico: float,
    acertos: int,
    score: float,
    tempos: dict[str, int],
    modelo: str | None = None,
    limiar: float | None = None,
) -> None:
    """Saudação, captura, transcrição, resposta e volta à espera. Uma captura por vez."""
    captura: subprocess.Popen[bytes] | None = None
    texto = ""
    try:
        _estado(
            "saudacao",
            microfone="liberado",
            pico=pico,
            score=score,
            acertos=acertos,
            modelo=modelo,
            limiar=limiar,
        )
        t_saudacao = time.perf_counter()
        erro_saudacao = _falar_seguro(destino, "Estou aqui.")
        tempos["saudacaoMs"] = _ms(t_saudacao)
        if erro_saudacao is not None:
            print(f"Falha na saudação: {erro_saudacao}", flush=True)
            _tempos(tempos)
            _estado("aguardando", microfone="liberado", pico=pico, acertos=acertos, score=score)
            return
        _estado("ouvindo", microfone="retido", pico=pico, acertos=acertos, score=score)
        captura = abrir()
        t_pedido = time.perf_counter()
        amostras, motivo = _capturar_pedido(captura, limites, pico_fala)
        tempos["escutaMs"] = _ms(t_pedido)
        _fechar(captura)
        captura = None
        print(f"pedido motivo={motivo} amostras={amostras.size}", flush=True)
        _estado("transcrevendo", microfone="liberado", pico=pico, acertos=acertos, score=score)
        texto, erro_stt = _ouvir_texto(obter_stt, amostras, tempos)
        del amostras
        if texto:
            print(texto, flush=True)
        if erro_stt is not None:
            print(erro_stt, flush=True)
            _falar_etapa(destino, "Não consegui transcrever.", "falando", tempos, "falaMs", pico, acertos)
        elif not texto.strip():
            _falar_etapa(destino, "Não ouvi o pedido.", "falando", tempos, "falaMs", pico, acertos)
        else:
            _estado("executando", microfone="liberado", pico=pico, acertos=acertos, texto=texto, score=score)
            t_exec = time.perf_counter()
            falar, erro_consulta = _consultar_pedido(texto)
            tempos["execucaoMs"] = _ms(t_exec)
            if erro_consulta is not None:
                print(erro_consulta, flush=True)
                if not falar:
                    falar = "Não consegui consultar o pedido."
            if falar:
                _falar_etapa(
                    destino,
                    falar,
                    "falando",
                    tempos,
                    "falaMs",
                    pico,
                    acertos,
                    transcricao=texto,
                )
        _tempos(tempos)
        _estado("aguardando", microfone="liberado", pico=pico, acertos=acertos, texto=texto or None)
    finally:
        _fechar(captura)


def _falar_etapa(
    destino: str,
    fala: str,
    fase: str,
    tempos: dict[str, int],
    chave: str,
    pico: float,
    acertos: int,
    *,
    transcricao: str | None = None,
) -> None:
    """`fala` é o que sai no alto-falante. `transcricao` é o pedido ouvido, só no evento."""
    _estado("falando" if fase == "falando" else fase, microfone="liberado", pico=pico, acertos=acertos, texto=transcricao)
    t0 = time.perf_counter()
    erro = _falar_seguro(destino, fala)
    tempos[chave] = _ms(t0)
    if erro is not None:
        print(f"Falha na síntese: {erro}", flush=True)


def _medir(quadro: np.ndarray) -> tuple[float, int, float]:
    dc = float(np.mean(quadro))
    sem = quadro.astype(np.float32) - dc
    pico = int(np.max(np.abs(sem))) if sem.size else 0
    rms = float(np.sqrt(np.mean(sem * sem))) if sem.size else 0.0
    return rms, pico, dc


def _tem_fala(quadro: np.ndarray, pico_fala: float) -> bool:
    return _medir(quadro)[1] >= pico_fala


def _ms(inicio: float) -> int:
    return int((time.perf_counter() - inicio) * 1000)


def _diag(mensagem: str) -> None:
    print(f"diagnostico {mensagem}", flush=True)


def _tempos(valores: dict[str, int]) -> None:
    json.dump({"temposMs": valores}, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    sys.stdout.flush()


def _configuracao(
    *,
    modelo: Path,
    chave: str,
    limiar: float,
    origem: str,
    destino: str,
    confirmar: bool,
    diagnostico: bool,
    gravar: bool,
    limites: LimitesPedido,
    pico_fala: float,
    arranque: float,
) -> None:
    digest = hashlib.sha256(modelo.read_bytes()).hexdigest()
    payload = {
        "configuracao": {
            "modelo": str(modelo),
            "chave": chave,
            "sha256": digest,
            "limiar": limiar,
            "taxa": TAXA,
            "canais": CANAIS,
            "formato": FORMATO,
            "quadro": QUADRO,
            "vad": 0,
            "origem": origem,
            "destino": destino,
            "confirmarAtivacao": confirmar,
            "diagnostico": diagnostico,
            "gravarDiagnostico": gravar,
            "esperaS": limites.espera_s,
            "silencioS": limites.silencio_s,
            "pedidoMaxS": limites.maximo_s,
            "picoFala": pico_fala,
            "arranqueS": arranque,
        }
    }
    json.dump(payload, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    sys.stdout.flush()


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
    etapas = {
        "aguardando": "aguardando ativação",
        "saudacao": "respondendo à ativação",
        "ouvindo": "ouvindo",
        "transcrevendo": "transcrevendo",
        "executando": "executando",
        "falando": "falando",
        "desligado": "desligado",
    }
    payload: dict[str, object] = {
        "fase": fase,
        "etapa": etapas.get(fase, fase),
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
