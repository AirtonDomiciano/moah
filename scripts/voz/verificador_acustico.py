"""Segundo estágio: classificador ONNX em embeddings, independente do detector openWakeWord."""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import onnxruntime as ort

from oww_janela import pontuar_trecho, zerar_extrator

MANIFESTO_NOME = "verificador.json"
MODELO_PADRAO = "moah-verificador.onnx"


@dataclass(frozen=True)
class ManifestoVerificador:
    modelo: str
    sha256: str
    limiar: float
    validado: bool
    papel: str
    treino: str | None = None

    @staticmethod
    def carregar(pasta: Path) -> ManifestoVerificador | None:
        arquivo = pasta / MANIFESTO_NOME
        if not arquivo.is_file():
            return None
        payload = json.loads(arquivo.read_text(encoding="utf8"))
        if payload.get("papel") != "verificador-segundo-estagio":
            return None
        modelo = str(payload.get("modelo") or "")
        if not modelo:
            return None
        limiar_raw = payload.get("limiarOperacional")
        if limiar_raw is None:
            limiar_raw = payload.get("limiar")
        limiar = float(limiar_raw) if limiar_raw is not None else 0.0
        if limiar_raw is not None and (limiar <= 0 or limiar > 1):
            return None
        return ManifestoVerificador(
            modelo=modelo,
            sha256=str(payload.get("sha256") or ""),
            limiar=limiar,
            validado=bool(payload.get("validado")),
            papel=str(payload.get("papel")),
            treino=payload.get("treino"),
        )


@dataclass
class ResultadoVerificacao:
    aceito: bool
    score: float
    limiar: float
    motivo: str
    indice_janela: int
    fim_janela_s: float
    latencia_ms: int


class VerificadorAcustico:
    """Máxima pontuação em todas as janelas do trecho; não reutiliza o ONNX do estágio 1."""

    def __init__(self, recursos: Path, modelo: Path) -> None:
        if not modelo.is_file():
            raise FileNotFoundError(f"Verificador ausente: {modelo}")
        import sys

        sys.path.insert(0, str(recursos / "hey_pran_openwakeword_v060"))
        from openwakeword.utils import AudioFeatures

        self._modelo = modelo
        self._sha = hashlib.sha256(modelo.read_bytes()).hexdigest()
        self._extrator = AudioFeatures(inference_framework="onnx", device="cpu")
        self._sessao = ort.InferenceSession(modelo.as_posix(), providers=["CPUExecutionProvider"])

    @property
    def sha256(self) -> str:
        return self._sha

    @property
    def caminho(self) -> str:
        return self._modelo.as_posix()

    def pontuar(self, audio: np.ndarray) -> tuple[float, int, float]:
        if audio.size < 1280:
            return 0.0, -1, 0.0
        zerar_extrator(self._extrator)
        return pontuar_trecho(self._sessao, self._extrator, audio)

    def verificar(
        self,
        audio: np.ndarray,
        limiar: float,
        *,
        permitir: bool,
    ) -> ResultadoVerificacao:
        import time

        t0 = time.perf_counter()
        score, indice, fim_s = self.pontuar(audio)
        latencia = int((time.perf_counter() - t0) * 1000)
        if audio.size < 1280:
            return ResultadoVerificacao(False, score, limiar, "trecho_curto", indice, fim_s, latencia)
        if not permitir:
            return ResultadoVerificacao(False, score, limiar, "modo_manual", indice, fim_s, latencia)
        if score >= limiar:
            return ResultadoVerificacao(True, score, limiar, "acima_limiar", indice, fim_s, latencia)
        if score >= limiar * 0.85:
            return ResultadoVerificacao(False, score, limiar, "incerteza", indice, fim_s, latencia)
        return ResultadoVerificacao(False, score, limiar, "abaixo_limiar", indice, fim_s, latencia)


def resolver_verificador(
    voz_dir: Path,
    recursos: Path,
    override: Path | None,
) -> tuple[VerificadorAcustico | None, ManifestoVerificador | None, str]:
    manifesto = ManifestoVerificador.carregar(voz_dir / "correcao")
    modelo: Path | None = None
    if override is not None:
        modelo = override
    elif manifesto is not None:
        candidato = Path(manifesto.modelo)
        if candidato.is_file():
            modelo = candidato
        elif (voz_dir / "completo" / MODELO_PADRAO).is_file():
            modelo = voz_dir / "completo" / MODELO_PADRAO
    elif (voz_dir / "completo" / MODELO_PADRAO).is_file():
        modelo = voz_dir / "completo" / MODELO_PADRAO
    if modelo is None or not modelo.is_file():
        return None, manifesto, "ausente"
    try:
        verificador = VerificadorAcustico(recursos, modelo)
    except Exception as exc:
        return None, manifesto, str(exc).strip() or "falha_ao_carregar"
    if manifesto and manifesto.sha256 and manifesto.sha256 != verificador.sha256:
        return verificador, manifesto, "sha256_diverge"
    return verificador, manifesto, "ok"