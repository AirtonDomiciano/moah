"""Ativa debugpy só quando solicitado (127.0.0.1, desligado por padrão na escuta)."""

from __future__ import annotations


def iniciar_debug(*, porta: int = 5678, aguardar_cliente: bool = True) -> None:
    try:
        import debugpy
    except ImportError as exc:
        raise SystemExit(
            "debugpy ausente no interpretador do runtime.json. "
            "Instale no mesmo Python usado pelo treino: "
            "python -m pip install -r scripts/voz/requirements-debug.txt"
        ) from exc
    endereco = ("127.0.0.1", porta)
    debugpy.listen(endereco)
    print(
        f"depuracao endereco=127.0.0.1 porta={porta} aguardarCliente={'sim' if aguardar_cliente else 'nao'}",
        flush=True,
    )
    if aguardar_cliente:
        print("depuracao aguardando conexão do Cursor (Attach debugpy)...", flush=True)
        debugpy.wait_for_client()
        print("depuracao cliente conectado", flush=True)