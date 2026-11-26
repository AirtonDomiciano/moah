"""Reproduz três frases no alto-falante já usado pela escuta.

Não abre microfone. A voz do laço é a Faber; este comando só compara.
"""

from __future__ import annotations

import argparse
import sys
import tempfile
from pathlib import Path

from sintese_pipewire import MODELOS, VOZ_PADRAO, falar, falar_espeak, modelo_piper

FRASES = (
    "Estou aqui, Airton.",
    "São dezessete horas e doze minutos.",
    "Airton, está na hora de beber água.",
)
VOZES = ("espeak", *MODELOS)


def reproduzir_frases(voz: str, destino: str) -> None:
    if voz not in VOZES:
        raise SystemExit("Use --voz espeak, faber, cadu, jeff, edresson ou tugao.")
    for frase in FRASES:
        print(f"voz={voz} frase={frase}", flush=True)
        if voz == "espeak":
            falar_espeak(destino, frase)
            continue
        falar(destino, frase, voz=voz)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--voz", required=True, choices=VOZES)
    parser.add_argument("--destino", required=True)
    args = parser.parse_args()
    reproduzir_frases(args.voz, args.destino)


def _self_test() -> None:
    assert FRASES == (
        "Estou aqui, Airton.",
        "São dezessete horas e doze minutos.",
        "Airton, está na hora de beber água.",
    )
    assert VOZ_PADRAO == "faber"
    assert VOZES == ("espeak", "faber", "cadu", "jeff", "edresson", "tugao")
    assert modelo_piper("edresson").name == "pt_BR-edresson-low.onnx"
    assert modelo_piper("tugao").name == "pt_PT-tugão-medium.onnx"
    import io
    from contextlib import redirect_stdout

    import sintese_pipewire as sintese

    original_piper = sintese.sintetizar_piper
    original_espeak = sintese.falar_espeak
    chamadas: list[str] = []

    def falha(_voz: str, _texto: str, _arquivo: object) -> None:
        raise RuntimeError("modelo ausente")

    def espeak(_destino: str, texto: str) -> None:
        chamadas.append(texto)

    sintese.sintetizar_piper = falha
    sintese.falar_espeak = espeak
    try:
        saida = io.StringIO()
        with redirect_stdout(saida):
            sintese.falar("destino", "Estou aqui.", voz="faber")
    finally:
        sintese.sintetizar_piper = original_piper
        sintese.falar_espeak = original_espeak
    assert chamadas == ["Estou aqui."]
    assert "erro=Piper falhou (faber)" in saida.getvalue()
    import json
    import os

    pasta = tempfile.mkdtemp()
    anterior = os.environ.get("MOAH_CONFIG_DIR")
    os.environ["MOAH_CONFIG_DIR"] = pasta
    try:
        Path(pasta, "config.json").write_text(
            json.dumps({"timezone": "America/Sao_Paulo", "voz": {"sintese": "faber"}}),
            encoding="utf-8",
        )
        assert sintese.voz_configurada() == "faber"
    finally:
        if anterior is None:
            os.environ.pop("MOAH_CONFIG_DIR", None)
        else:
            os.environ["MOAH_CONFIG_DIR"] = anterior
        Path(pasta, "config.json").unlink(missing_ok=True)
        Path(pasta).rmdir()
    print("ok")


if __name__ == "__main__":
    if len(sys.argv) == 2 and sys.argv[1] == "--self-test":
        _self_test()
    else:
        main()
