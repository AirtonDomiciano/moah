"""Lembrete local vencido durante a escuta. Não abre microfone."""

from __future__ import annotations

import json
import os
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path

from eventos_voz import console_enxuto, emitir_estado, emitir_linha
from sintese_pipewire import falar_seguro


class EsperaLembrete:
    """Consulta a fila no máximo uma vez por segundo, só na espera da ativação."""

    def __init__(self) -> None:
        self.item: dict[str, str] | None = None
        self._ultimo = 0.0

    def consultar(self) -> bool:
        import time

        agora = time.monotonic()
        if agora - self._ultimo < 1:
            return False
        self._ultimo = agora
        achado = proximo_vencido()
        if achado is None:
            return False
        self.item = achado
        return True


def frase_lembrete(texto: str) -> str:
    corpo = " ".join(texto.split()).strip(" .")
    if not corpo:
        corpo = "lembrete"
    return f"Está na hora de {corpo}."


def diretorio_dados() -> Path:
    override = os.environ.get("MOAH_DATA_DIR", "").strip()
    if override:
        return Path(override).expanduser().resolve()
    xdg = os.environ.get("XDG_DATA_HOME", "").strip()
    if xdg:
        return Path(xdg).expanduser().resolve() / "moah"
    return Path.home() / ".local" / "share" / "moah"


def proximo_vencido(agora: datetime | None = None, banco: Path | None = None) -> dict[str, str] | None:
    caminho = banco or (diretorio_dados() / "moah.sqlite")
    if not caminho.is_file():
        return None
    instante = agora or datetime.now(timezone.utc)
    vencidos: list[tuple[str, str, str]] = []
    uri = f"file:{caminho}?mode=ro"
    with sqlite3.connect(uri, uri=True) as conexao:
        linhas = conexao.execute(
            "SELECT id, payload_json FROM jobs WHERE kind = ? AND state = 'pendente'",
            ("lembrete_local",),
        )
        for identificador, bruto in linhas:
            try:
                payload = json.loads(bruto)
            except json.JSONDecodeError:
                continue
            texto = str(payload.get("texto") or "").strip()
            disparo = str(payload.get("fireAt") or "")
            prazo = _instante(disparo)
            if prazo is None or prazo > instante:
                continue
            vencidos.append((disparo, str(identificador), texto))
    if not vencidos:
        return None
    vencidos.sort()
    _disparo, identificador, texto = vencidos[0]
    return {"id": identificador, "texto": texto}


def registrar_resultado(identificador: str, entregue: bool, erro: str | None = None) -> bool:
    repo = Path(__file__).resolve().parents[2]
    cli = repo / "dist" / "src" / "cli" / "main.js"
    if not cli.is_file():
        print("erro=Não registrei o lembrete: CLI não compilada.", flush=True)
        return False
    comando = [
        "node",
        "--disable-warning=ExperimentalWarning",
        str(cli),
        "voz",
        "lembrete",
        "--id",
        identificador,
        "--resultado",
        "entregue" if entregue else "falha",
    ]
    if not entregue:
        comando.extend(["--erro", erro or "Falha na reprodução."])
    resultado = subprocess.run(comando, capture_output=True, text=True, env=os.environ.copy())
    if resultado.returncode != 0:
        detalhe = (resultado.stderr or resultado.stdout or "Falha ao registrar o lembrete.").strip()
        print(f"erro={detalhe}", flush=True)
        return False
    return True


def anunciar_lembrete(destino: str, item: dict[str, str], falar=falar_seguro, registrar=registrar_resultado) -> bool:
    texto = frase_lembrete(item.get("texto") or "")
    emitir_estado("falando", microfone="liberado")
    erro = falar(destino, texto)
    if erro:
        print(f"erro={erro}", flush=True)
        registrar(item["id"], False, erro)
        emitir_estado("aguardando", microfone="liberado")
        return False
    if console_enxuto():
        emitir_linha("resultado", texto)
    else:
        print(texto, flush=True)
    if not registrar(item["id"], True, None):
        emitir_estado("aguardando", microfone="liberado")
        return False
    emitir_estado("aguardando", microfone="liberado")
    return True


def _instante(valor: str) -> datetime | None:
    texto = valor.strip()
    if not texto:
        return None
    if texto.endswith("Z"):
        texto = f"{texto[:-1]}+00:00"
    try:
        instante = datetime.fromisoformat(texto)
    except ValueError:
        return None
    if instante.tzinfo is None:
        instante = instante.replace(tzinfo=timezone.utc)
    return instante.astimezone(timezone.utc)


def _self_test() -> None:
    assert frase_lembrete("beber água") == "Está na hora de beber água."
    assert frase_lembrete("  ") == "Está na hora de lembrete."
    agora = datetime(2026, 11, 25, 18, 0, tzinfo=timezone.utc)
    import tempfile

    with tempfile.TemporaryDirectory() as pasta:
        banco = Path(pasta) / "moah.sqlite"
        with sqlite3.connect(banco) as conexao:
            conexao.execute(
                """CREATE TABLE jobs (
                    id TEXT PRIMARY KEY, kind TEXT, state TEXT, payload_json TEXT,
                    attempts INTEGER, max_attempts INTEGER, error TEXT, checkpoint_json TEXT,
                    idempotency_key TEXT, created_at TEXT, updated_at TEXT, started_at TEXT, finished_at TEXT
                )"""
            )
            def gravar(identificador: str, estado: str, disparo: str, texto: str) -> None:
                conexao.execute(
                    "INSERT INTO jobs VALUES (?, 'lembrete_local', ?, ?, 0, 8, NULL, NULL, NULL, ?, ?, NULL, NULL)",
                    (identificador, estado, json.dumps({"texto": texto, "fireAt": disparo}), disparo, disparo),
                )

            gravar("job_futuro", "pendente", "2026-11-25T18:05:00.000Z", "depois")
            gravar("job_feito", "concluida", "2026-11-25T17:00:00.000Z", "já falado")
            gravar("job_falha", "falha", "2026-11-25T17:00:00.000Z", "não saiu")
            gravar("job_vence", "pendente", "2026-11-25T17:58:00.000Z", "beber água")
        achado = proximo_vencido(agora, banco)
        assert achado == {"id": "job_vence", "texto": "beber água"}
        falas: list[str] = []
        registros: list[tuple[str, bool, str | None]] = []

        def ouvir(_destino: str, fala: str) -> str | None:
            falas.append(fala)
            return None

        def registrar(identificador: str, entregue: bool, erro: str | None = None) -> bool:
            registros.append((identificador, entregue, erro))
            return True

        assert anunciar_lembrete("jbl", achado, ouvir, registrar)
        assert falas == ["Está na hora de beber água."]
        assert registros == [("job_vence", True, None)]
        registros.clear()

        def mudo(_destino: str, _fala: str) -> str:
            return "pw-play caiu"

        assert anunciar_lembrete("jbl", achado, mudo, registrar) is False
        assert registros == [("job_vence", False, "pw-play caiu")]
    print("ok")


if __name__ == "__main__":
    _self_test()
