"""Saudação → captura do pedido → STT → execução (um turno por confirmação)."""

from __future__ import annotations

import subprocess
import time
from pathlib import Path

import numpy as np

from audio_metricas import pipeline_ponto, salvar_wav_com_metricas
from eventos_voz import console_enxuto, emitir_estado, emitir_linha, emitir_tempos, ms_desde
from janela_pedido import JanelaPedido, LimitesPedido, decidir
from pcm_pipewire import fechar_captura, ler_quadro, tem_fala
from pedido_cli import consultar_pedido
from presenca_fala import avaliar_presenca
from sintese_pipewire import falar_seguro
from stt_remoto import transcrever_pedido


def _audio_tem_fala(amostras: np.ndarray) -> bool:
    """Presença de fala no pedido. Reusa o critério do clipe de confirmação."""
    return bool(amostras.size) and avaliar_presenca(amostras).fala


def capturar_pedido(
    captura: subprocess.Popen[bytes],
    limites: LimitesPedido,
    pico_fala: float,
    *,
    pre_cauda: np.ndarray | None = None,
) -> tuple[np.ndarray, str]:
    inicio = time.monotonic()
    janela = JanelaPedido(inicio=inicio)
    blocos: list[np.ndarray] = []
    # A cauda é anterior à saudação e permanece no áudio. Pico (fim da chamada
    # ou ruído) não inicia o pedido; só presença de fala arma o silêncio.
    if pre_cauda is not None and pre_cauda.size:
        blocos.append(pre_cauda.copy())
        if _audio_tem_fala(pre_cauda):
            janela.viu_fala = True
            janela.ultimo_fala = inicio
    vivo = np.zeros(0, dtype=np.int16)
    motivo = "interrupcao"
    while True:
        quadro = ler_quadro(captura)
        agora = time.monotonic()
        if quadro is None:
            break
        copia = quadro.copy()
        blocos.append(copia)
        vivo = np.concatenate((vivo, copia))
        fala = tem_fala(copia, pico_fala)
        if fala and not janela.viu_fala:
            fala = _audio_tem_fala(vivo)
        decisao = decidir(janela, agora, fala, limites)
        if decisao is not None:
            motivo = decisao
            break
    if not blocos:
        return np.zeros(0, dtype=np.int16), motivo
    return np.concatenate(blocos), motivo


def ouvir_texto(obter_stt, amostras: np.ndarray, tempos: dict[str, int]) -> tuple[str, str | None]:
    trabalhador = obter_stt()
    if trabalhador is None:
        tempos["transcricaoMs"] = 0
        return "", "A transcrição não está disponível."
    t0 = time.perf_counter()
    try:
        return transcrever_pedido(trabalhador, amostras), None
    except Exception as exc:
        return "", str(exc).strip() or "Falha na transcrição."
    finally:
        tempos["transcricaoMs"] = ms_desde(t0)


def _aviso(mensagem: str) -> None:
    if console_enxuto():
        emitir_linha("erro", mensagem)
    else:
        print(mensagem, flush=True)


def falar_etapa(
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
    emitir_estado(
        "falando" if fase == "falando" else fase,
        microfone="liberado",
        pico=pico,
        acertos=acertos,
        texto=transcricao,
    )
    t0 = time.perf_counter()
    erro = falar_seguro(destino, fala)
    tempos[chave] = ms_desde(t0)
    if erro is not None:
        _aviso(f"Falha na síntese: {erro}")


def conduzir_pedido(
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
    pre_cauda: np.ndarray | None = None,
    voz_dir: Path | None = None,
    salvar_wavs: bool = False,
    imprimir_pipeline: bool = False,
) -> None:
    captura: subprocess.Popen[bytes] | None = None
    texto = ""
    try:
        emitir_estado(
            "saudacao",
            microfone="liberado",
            pico=pico,
            score=score,
            acertos=acertos,
            modelo=modelo,
            limiar=limiar,
        )
        pipeline_ponto("saudacao_inicio", imprimir=imprimir_pipeline, destino=destino)
        t_saudacao = time.perf_counter()
        erro_saudacao = falar_seguro(destino, "Estou aqui.")
        tempos["saudacaoMs"] = ms_desde(t_saudacao)
        if erro_saudacao is not None:
            _aviso(f"Falha na saudação: {erro_saudacao}")
            emitir_tempos(tempos)
            emitir_estado("aguardando", microfone="liberado", pico=pico, acertos=acertos, score=score)
            return
        pipeline_ponto("captura_pedido_reaberta", imprimir=imprimir_pipeline, origem="microfone")
        emitir_estado("ouvindo", microfone="retido", pico=pico, acertos=acertos, score=score)
        captura = abrir()
        t_pedido = time.perf_counter()
        amostras, motivo = capturar_pedido(captura, limites, pico_fala, pre_cauda=pre_cauda)
        tempos["escutaMs"] = ms_desde(t_pedido)
        fechar_captura(captura)
        captura = None
        tem_pedido = _audio_tem_fala(amostras)
        if not console_enxuto():
            print(
                f"pedido motivo={motivo} amostras={amostras.size} "
                f"presenca={'fala' if tem_pedido else 'sem_fala'}",
                flush=True,
            )
        pipeline_ponto(
            "pedido_capturado",
            amostras=amostras,
            imprimir=imprimir_pipeline,
            motivoEncerramento=motivo,
            limites={
                "esperaS": limites.espera_s,
                "silencioS": limites.silencio_s,
                "maximoS": limites.maximo_s,
                "picoFala": pico_fala,
            },
            caudaPreAmostras=int(pre_cauda.size) if pre_cauda is not None else 0,
        )
        if salvar_wavs and voz_dir is not None:
            caminho_ped, meta_ped = salvar_wav_com_metricas(
                voz_dir,
                "pedido-stt",
                "pedido",
                amostras,
                extras={
                    "motivoEncerramento": motivo,
                    "caudaPreAmostras": int(pre_cauda.size) if pre_cauda is not None else 0,
                },
            )
            print(f"diagnostico wav pedido-stt={caminho_ped} meta={meta_ped.get('metricas')}", flush=True)
        if not tem_pedido:
            if console_enxuto():
                emitir_linha("resultado", "Não ouvi o pedido.")
            falar_etapa(destino, "Não ouvi o pedido.", "falando", tempos, "falaMs", pico, acertos)
            emitir_tempos(tempos)
            emitir_estado("aguardando", microfone="liberado", pico=pico, acertos=acertos)
            return
        emitir_estado("transcrevendo", microfone="liberado", pico=pico, acertos=acertos, score=score)
        pipeline_ponto("stt_entrada", amostras=amostras, imprimir=imprimir_pipeline)
        texto, erro_stt = ouvir_texto(obter_stt, amostras, tempos)
        pipeline_ponto("stt_saida", imprimir=imprimir_pipeline, texto=texto, erro=erro_stt)
        if not console_enxuto():
            print(
                f"diagnostico stt etapa=pedido texto={texto!r} erro={erro_stt!r} "
                f"encaminhaConsulta={'sim' if texto.strip() and erro_stt is None else 'nao'}",
                flush=True,
            )
        del amostras
        if texto and console_enxuto():
            emitir_linha("pedido", texto)
        elif texto:
            print(texto, flush=True)
        if erro_stt is not None:
            _aviso(erro_stt)
            if console_enxuto():
                emitir_linha("resultado", "Não consegui transcrever.")
            falar_etapa(destino, "Não consegui transcrever.", "falando", tempos, "falaMs", pico, acertos)
        elif not texto.strip():
            if console_enxuto():
                emitir_linha("resultado", "Não ouvi o pedido.")
            falar_etapa(destino, "Não ouvi o pedido.", "falando", tempos, "falaMs", pico, acertos)
        else:
            pipeline_ponto("execucao_entrada", imprimir=imprimir_pipeline, texto=texto)
            emitir_estado("executando", microfone="liberado", pico=pico, acertos=acertos, texto=texto, score=score)
            t_exec = time.perf_counter()
            falar, erro_consulta = consultar_pedido(texto)
            tempos["execucaoMs"] = ms_desde(t_exec)
            if erro_consulta is not None:
                _aviso(erro_consulta)
                if not falar:
                    falar = "Não consegui consultar o pedido."
                    if console_enxuto():
                        emitir_linha("resultado", falar)
            if falar:
                falar_etapa(
                    destino,
                    falar,
                    "falando",
                    tempos,
                    "falaMs",
                    pico,
                    acertos,
                    transcricao=texto,
                )
        emitir_tempos(tempos)
        emitir_estado("aguardando", microfone="liberado", pico=pico, acertos=acertos, texto=texto or None)
    finally:
        fechar_captura(captura)