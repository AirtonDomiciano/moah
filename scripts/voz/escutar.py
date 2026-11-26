#!/usr/bin/env python3
"""Orquestra o laço: ativação → confirmação → turno do pedido.

Responsabilidades ficam em módulos por etapa; este arquivo só monta o laço.
"""

from __future__ import annotations

import argparse
import signal
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

from ativacao_detector import aguardar_ativacao, medir_pico_detector
from audio_metricas import pipeline_ponto, salvar_wav_com_metricas
from buffer_circular import BufferCircular
from decisao_atender import atender_por_acustico, atender_por_texto
from debug_servidor import iniciar_debug
from escutar_politica import resolver_limiar_verificador, resolver_modo_confirmacao
from eventos_voz import (
    definir_console,
    emitir_configuracao,
    emitir_estado,
    emitir_tempos,
    ms_desde,
    salvar_wav_confirmacao,
    voz_dir,
)
from janela_pedido import LimitesPedido
from lembrete_sessao import EsperaLembrete, anunciar_lembrete
from oww_janela import extrair_cauda_pedido, zerar_detector
from pcm_pipewire import abrir_captura, amostras_mutas, fechar_captura, ler_quadro
from presenca_fala import aplicar_presenca, avaliar_presenca
from sintese_pipewire import parar_reproducao, saudacao
from stt_remoto import SttRemoto, transcrever_pedido_seguro
from turno_pedido import conduzir_pedido, falar_etapa
from verificador_acustico import resolver_verificador
from voz_constantes import (
    ARRANQUE_S,
    DIAGNOSTICO_MAX,
    ESPERA_S,
    PEDIDO_MAX_S,
    PICO_FALA,
    POS_CONFIRMACAO_QUADROS,
    PRE_CONFIRMACAO_QUADROS,
    QUADRO,
    SILENCIO_S,
    TAXA,
)

# Compatibilidade com testes e ferramentas que importam escutar.*
from voz_constantes import (  # noqa: F401
    CANAIS,
    FORMATO,
)

_abrir = abrir_captura
_fechar = fechar_captura
_quadro = ler_quadro
_muda = amostras_mutas
_aguardar = aguardar_ativacao
_ler = medir_pico_detector
_Stt = SttRemoto
_transcrever_seguro = transcrever_pedido_seguro
_ativacao_confirmada = lambda t, flexivel=False: atender_por_texto(t, flexivel=flexivel)[0]
_resolver_modo_confirmacao = resolver_modo_confirmacao
_resolver_limiar_verificador = resolver_limiar_verificador
_voz_dir = voz_dir
_estado = emitir_estado
_tempos = emitir_tempos
_configuracao = emitir_configuracao
_ms = ms_desde
_salvar_wav_confirmacao = salvar_wav_confirmacao
_parar_reproducao = parar_reproducao
_saudacao = saudacao
_conduzir_pedido = conduzir_pedido
_falar_etapa = falar_etapa

from sintese_pipewire import falar as _falar  # noqa: E402 — testes fazem monkeypatch


def _liberar_volta(captura, buffer, mensagem: str, pico: float, acertos: int) -> None:
    """Fecha microfone e síntese e devolve o laço à espera."""
    parar_reproducao()
    fechar_captura(captura)
    if buffer is not None:
        buffer.descartar()
    texto = " ".join(mensagem.split()) or "Falha na escuta."
    print(f"erro={texto}", flush=True)
    emitir_estado("aguardando", microfone="liberado", pico=pico, acertos=acertos)


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
    parser.add_argument("--modo-verificador", default="producao", choices=("producao", "manual", "teste"))
    parser.add_argument("--verificador", default="")
    parser.add_argument("--limiar-verificador", type=float, default=0)
    parser.add_argument("--diagnostico", default="nao")
    parser.add_argument("--gravar-diagnostico", default="nao")
    parser.add_argument("--salvar-wavs", default="nao")
    parser.add_argument("--depurar", default="nao")
    parser.add_argument("--depurar-porta", type=int, default=5678)
    parser.add_argument("--depurar-aguardar", default="sim")
    parser.add_argument("--provar-eco", action="store_true")
    args = parser.parse_args()
    if args.habilitar != "sim":
        raise SystemExit("A escuta exige --habilitar sim.")
    if args.confirmar_ativacao not in {"sim", "nao", "stt", "acustico"}:
        raise SystemExit("Use --confirmar-ativacao nao|sim|stt|acustico.")
    if args.confirmacao_flexivel not in {"sim", "nao"}:
        raise SystemExit("Use --confirmacao-flexivel sim ou nao.")
    if args.diagnostico not in {"sim", "nao"}:
        raise SystemExit("Use --diagnostico sim ou nao.")
    if args.gravar_diagnostico not in {"sim", "nao"}:
        raise SystemExit("Use --gravar-diagnostico sim ou nao.")
    if args.salvar_wavs not in {"sim", "nao"}:
        raise SystemExit("Use --salvar-wavs sim ou nao.")
    if args.depurar not in {"sim", "nao"}:
        raise SystemExit("Use --depurar sim ou nao.")
    if args.depurar_aguardar not in {"sim", "nao"}:
        raise SystemExit("Use --depurar-aguardar sim ou nao.")
    if args.depurar == "sim":
        if args.depurar_porta < 1024 or args.depurar_porta > 65535:
            raise SystemExit("Use --depurar-porta entre 1024 e 65535.")
        iniciar_debug(porta=args.depurar_porta, aguardar_cliente=args.depurar_aguardar == "sim")
    if args.limiar <= 0 or args.limiar > 1:
        raise SystemExit("O limiar precisa ser maior que 0 e no máximo 1.")
    if min(args.pedido, args.espera, args.silencio, args.pico_fala) <= 0 or args.arranque < 0:
        raise SystemExit("Informe espera, silêncio, pedido e pico de fala maiores que zero.")
    flexivel = args.confirmacao_flexivel == "sim"
    diagnostico = args.diagnostico == "sim"
    gravar = args.gravar_diagnostico == "sim"
    salvar_wavs = args.salvar_wavs == "sim"
    depurar = args.depurar == "sim"
    imprimir_pipeline = diagnostico or salvar_wavs
    definir_console(not diagnostico)
    modo_verificador = args.modo_verificador
    diagnostico_dir = voz_dir() / "diagnostico" / "confirmacao"
    diagnostico_salvos = 0
    pasta_voz = voz_dir()
    recursos_path = Path(args.recursos)
    override_verificador = Path(args.verificador).resolve() if args.verificador.strip() else None
    verificador, manifesto, status_verificador = resolver_verificador(pasta_voz, recursos_path, override_verificador)
    modo_confirmacao = resolver_modo_confirmacao(args.confirmar_ativacao, manifesto, verificador)
    limiar_verificador = resolver_limiar_verificador(args.limiar_verificador, manifesto, modo_verificador)
    if modo_confirmacao == "acustico" and modo_verificador == "teste":
        if limiar_verificador >= 1.0 or limiar_verificador <= 0:
            raise SystemExit(
                "Modo teste exige --limiar-verificador explícito ou limiarCalibrado no manifesto (modelo segue não validado)."
            )

    modelo = Path(args.modelo)
    if not modelo.is_file():
        raise SystemExit(f"Modelo ausente: {modelo}")
    stt_dir = pasta_voz / "stt" / "faster-whisper-small"
    stt_python = pasta_voz / "stt" / "venv" / "bin" / "python"
    sys.path.insert(0, str(Path(args.recursos) / "hey_pran_openwakeword_v060"))
    from openwakeword.model import Model

    detector = Model(wakeword_models=[str(modelo)], inference_framework="onnx", vad_threshold=0)
    chave = next(iter(detector.models))
    stt: SttRemoto | None = None
    stt_erro: str | None = None
    inicio = time.time()
    captura: subprocess.Popen[bytes] | None = None
    pico = 0.0
    acertos = 0
    limites = LimitesPedido(espera_s=args.espera, silencio_s=args.silencio, maximo_s=args.pedido)
    emitir_configuracao(
        modelo=modelo,
        chave=chave,
        limiar=args.limiar,
        origem=args.origem,
        destino=args.destino,
        modo_confirmacao=modo_confirmacao,
        diagnostico=diagnostico,
        gravar=gravar,
        salvar_wavs=salvar_wavs,
        depurar=depurar,
        limites=limites,
        pico_fala=args.pico_fala,
        arranque=args.arranque,
        verificador=verificador,
        manifesto=manifesto,
        status_verificador=status_verificador,
        limiar_verificador=limiar_verificador,
        modo_verificador=modo_verificador,
        voz_dir_path=pasta_voz,
    )
    if diagnostico:
        print(f"diagnostico modelo={modelo} chave={chave} carregado=sim vad=0", flush=True)

    def obter_stt() -> SttRemoto | None:
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
            stt = SttRemoto(stt_python, stt_dir)
        except Exception as exc:
            stt_erro = str(exc).strip() or "Falha ao carregar STT."
            print(stt_erro, flush=True)
            return None
        return stt

    def encerrar(_signum: int, _frame: object) -> None:
        parar_reproducao()
        fechar_captura(captura)
        if stt is not None:
            stt.close()
        emitir_estado("desligado", microfone="liberado", pico=pico, acertos=acertos)
        raise SystemExit(0)

    signal.signal(signal.SIGINT, encerrar)
    signal.signal(signal.SIGTERM, encerrar)
    try:
        if args.provar_eco:
            emitir_estado("aguardando", microfone="retido", modelo=str(modelo), limiar=args.limiar)
            captura = abrir_captura(args.origem)
            saudacao(args.destino)
            pico = medir_pico_detector(detector, chave, captura, args.limiar, 4)
            fechar_captura(captura)
            captura = None
            emitir_estado("desligado", microfone="liberado", pico=pico, eco=True)
            return
        emitir_estado(
            "aguardando",
            microfone="retido",
            modelo=str(modelo),
            limiar=args.limiar,
            confirmarAtivacao=modo_confirmacao != "nao",
            modoConfirmacao=modo_confirmacao,
        )
        espera_lembrete = EsperaLembrete()
        while args.duracao <= 0 or time.time() - inicio < args.duracao:
            buffer = None
            try:
                captura = abrir_captura(args.origem)
                zerar_detector(detector)
                t_espera = time.perf_counter()
                usar_buffer = modo_confirmacao == "acustico"
                buffer = BufferCircular(PRE_CONFIRMACAO_QUADROS) if usar_buffer else None
                detectou, score, parcial, trecho, _pos = aguardar_ativacao(
                    detector,
                    chave,
                    captura,
                    args.limiar,
                    inicio,
                    args.duracao,
                    guardar=modo_confirmacao == "stt",
                    diagnostico=diagnostico,
                    arranque_s=args.arranque,
                    buffer=buffer,
                    lembrete=espera_lembrete.consultar,
                )
                cauda_pedido = np.zeros(0, dtype=np.int16)
                espera_ms = ms_desde(t_espera)
                pico = max(pico, parcial)
                if not detectou:
                    fechar_captura(captura)
                    captura = None
                    if buffer is not None:
                        buffer.descartar()
                    if espera_lembrete.item is not None:
                        anunciar_lembrete(args.destino, espera_lembrete.item)
                        espera_lembrete.item = None
                        continue
                    break
                if usar_buffer and buffer is not None:
                    buffer.iniciar_candidato()
                    for _ in range(POS_CONFIRMACAO_QUADROS):
                        quadro = ler_quadro(captura)
                        if quadro is None:
                            break
                        buffer.anexar_pos(quadro)
                    trecho = buffer.concluir()
                    pipeline_ponto(
                        "detector_candidato_trecho",
                        amostras=trecho,
                        imprimir=imprimir_pipeline,
                        scoreDetector=round(score, 4),
                        limiarDetector=args.limiar,
                        modoConfirmacao=modo_confirmacao,
                    )
                fechar_captura(captura)
                captura = None
                if diagnostico:
                    print(
                        f"diagnostico ativacao etapa=detector score={score:.4f} limiar={args.limiar:.4f}",
                        flush=True,
                    )
                tempos = {"esperaAtivacaoMs": espera_ms}
                score_verificador: float | None = None
                confirmado = modo_confirmacao == "nao"
                motivo_verificacao = ""
                if modo_confirmacao == "stt":
                    emitir_estado(
                        "verificando",
                        microfone="liberado",
                        pico=pico,
                        score=score,
                        acertos=acertos,
                        etapa="stt",
                    )
                    wav_diag: Path | None = None
                    if gravar and diagnostico_salvos < DIAGNOSTICO_MAX and not amostras_mutas(trecho):
                        diagnostico_salvos += 1
                        wav_diag = salvar_wav_confirmacao(diagnostico_dir, diagnostico_salvos, trecho)
                    if salvar_wavs and trecho.size:
                        caminho_conf, meta_conf = salvar_wav_com_metricas(
                            pasta_voz,
                            "confirmacao-stt",
                            "chamada",
                            trecho,
                            extras={"etapaStt": "confirmacao", "quadrosConfirmacao": len(trecho) // QUADRO},
                        )
                        print(
                            f"diagnostico stt etapa=confirmacao wav={caminho_conf} "
                            f"metricas={meta_conf.get('metricas')}",
                            flush=True,
                        )
                    trabalhador = obter_stt()
                    t_confirma = time.perf_counter()
                    reconhecido = "" if trabalhador is None else transcrever_pedido_seguro(trabalhador, trecho)
                    tempos["confirmacaoMs"] = ms_desde(t_confirma)
                    aceito_nome, _norm = atender_por_texto(reconhecido, flexivel=flexivel)
                    print(
                        f"diagnostico stt etapa=confirmacao texto={reconhecido!r} "
                        f"normalizado={_norm!r} aceito={aceito_nome} flexivel={flexivel}",
                        flush=True,
                    )
                    if wav_diag is not None:
                        print(f"diagnostico wav legado={wav_diag}", flush=True)
                    confirmado = trabalhador is not None and aceito_nome
                    motivo_verificacao = "stt_aceito" if confirmado else "stt_rejeitado"
                    if not confirmado:
                        emitir_tempos(tempos)
                        emitir_estado(
                            "aguardando",
                            microfone="liberado",
                            pico=pico,
                            acertos=acertos,
                            texto=reconhecido,
                            confirmarAtivacao=True,
                            motivoRejeicao=motivo_verificacao,
                        )
                        del trecho
                        continue
                    del trecho
                elif modo_confirmacao == "acustico":
                    if verificador is None:
                        print(
                            "Verificador acústico ausente ou inválido; candidato descartado. "
                            f"status={status_verificador}",
                            flush=True,
                        )
                        if buffer is not None:
                            buffer.descartar()
                        emitir_tempos(tempos)
                        emitir_estado(
                            "aguardando",
                            microfone="liberado",
                            pico=pico,
                            acertos=acertos,
                            motivoRejeicao="verificador_ausente",
                        )
                        continue
                    emitir_estado(
                        "verificando",
                        microfone="liberado",
                        pico=pico,
                        score=score,
                        acertos=acertos,
                        etapa="acustico",
                    )
                    if modo_verificador == "manual":
                        permitir = False
                        motivo_bloqueio = "modo_manual"
                    elif modo_verificador == "teste":
                        permitir = True
                        motivo_bloqueio = ""
                    else:
                        permitir = bool(manifesto and manifesto.validado)
                        motivo_bloqueio = "modelo_nao_validado"
                    if salvar_wavs:
                        caminho_ver, meta_ver = salvar_wav_com_metricas(
                            pasta_voz,
                            "verificador",
                            "candidato",
                            trecho,
                            extras={
                                "scoreDetector": score,
                                "limiarVerificador": limiar_verificador,
                                "modoVerificador": modo_verificador,
                            },
                        )
                        print(f"diagnostico wav verificador={caminho_ver} meta={meta_ver.get('metricas')}", flush=True)
                    pipeline_ponto(
                        "verificador_entrada",
                        amostras=trecho,
                        imprimir=imprimir_pipeline,
                        limiar=limiar_verificador,
                        modoVerificador=modo_verificador,
                    )
                    # Pico e STT, se houver, leem este mesmo `trecho`. O score é o máximo
                    # das janelas de 1,28 s (com 1 s de silêncio na frente), não o pico.
                    presenca = avaliar_presenca(trecho)
                    t_confirma = time.perf_counter()
                    resultado = verificador.verificar(
                        trecho,
                        limiar_verificador,
                        permitir=permitir,
                        motivo_bloqueio=motivo_bloqueio,
                    )
                    tempos["confirmacaoMs"] = ms_desde(t_confirma)
                    score_verificador = resultado.score
                    aceito_verificador = atender_por_acustico(resultado)
                    confirmado_agora, motivo_verificacao = aplicar_presenca(
                        presenca,
                        aceito_verificador,
                        resultado.motivo,
                    )
                    vad_txt = "ausente" if presenca.vad_max is None else f"{presenca.vad_max:.2f}"
                    pipeline_ponto(
                        "verificador_decisao",
                        imprimir=imprimir_pipeline,
                        score=round(resultado.score, 4),
                        limiar=resultado.limiar,
                        motivo=motivo_verificacao,
                        aceito=confirmado_agora,
                        vad=None if presenca.vad_max is None else round(presenca.vad_max, 4),
                        energiaMs=presenca.energia_ms,
                    )
                    if diagnostico:
                        print(
                            "diagnostico verificacao "
                            f"score={resultado.score:.4f} limiar={resultado.limiar:.4f} "
                            f"motivo={motivo_verificacao} latenciaMs={resultado.latencia_ms} "
                            f"modoVerificador={modo_verificador} validado={manifesto.validado if manifesto else False} "
                            f"vad={vad_txt}",
                            flush=True,
                        )
                    if gravar and diagnostico_salvos < DIAGNOSTICO_MAX and not amostras_mutas(trecho):
                        diagnostico_salvos += 1
                        salvar_wav_confirmacao(diagnostico_dir, diagnostico_salvos, trecho)
                    cauda_pedido = extrair_cauda_pedido(
                        trecho,
                        resultado.indice_janela,
                        fim_janela_s=resultado.fim_janela_s,
                    )
                    del trecho
                    confirmado = confirmado_agora
                    if not confirmado:
                        emitir_tempos(tempos)
                        emitir_estado(
                            "aguardando",
                            microfone="liberado",
                            pico=pico,
                            acertos=acertos,
                            score=score,
                            scoreVerificador=score_verificador,
                            motivoRejeicao=motivo_verificacao,
                        )
                        continue
                acertos += 1
                emitir_estado(
                    "confirmada",
                    microfone="liberado",
                    pico=pico,
                    acertos=acertos,
                    score=score,
                    scoreVerificador=score_verificador,
                    detectorConfirmado=True,
                )
                conduzir_pedido(
                    destino=args.destino,
                    abrir=lambda: abrir_captura(args.origem),
                    limites=limites,
                    pico_fala=args.pico_fala,
                    obter_stt=obter_stt,
                    pico=pico,
                    acertos=acertos,
                    score=score,
                    tempos=tempos,
                    modelo=str(modelo),
                    limiar=args.limiar,
                    pre_cauda=cauda_pedido,
                    voz_dir=pasta_voz,
                    salvar_wavs=salvar_wavs,
                    imprimir_pipeline=imprimir_pipeline,
                )
            except Exception as exc:
                _liberar_volta(
                    captura,
                    buffer,
                    str(exc).strip() or "Falha na escuta.",
                    pico,
                    acertos,
                )
                captura = None
                time.sleep(0.4)
        emitir_estado("desligado", microfone="liberado", pico=pico, acertos=acertos)
    finally:
        parar_reproducao()
        fechar_captura(captura)
        if stt is not None:
            stt.close()


if __name__ == "__main__":
    main()