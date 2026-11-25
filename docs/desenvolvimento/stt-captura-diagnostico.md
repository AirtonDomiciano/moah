# STT e captura — o que foi comprovado (nov/2026)

## Duas transcrições diferentes

| Etapa | Onde | Áudio | WAV com `--salvar-wavs sim` | Vira pedido? |
| --- | --- | --- | --- | --- |
| **Confirmação do nome** | `escutar.py` → STT no `trecho` (~1,6 s, 20 quadros) | Só com `--confirmar-ativacao stt` | `diagnostico/wavs/confirmacao-stt/chamada-*.wav` | Só se `atender_por_texto` aceitar → aí chama `conduzir_pedido` |
| **Pedido** | `turno_pedido.py` → após “Estou aqui.” | Mic reaberto + `pre_cauda` (se acústico) | `diagnostico/wavs/pedido-stt/pedido-*.wav` | Texto vai para `pedido_cli.consultar_pedido` |

**Comprovado:** frases como `Legendas pela comunidade de Amara.org` nos seus testes são **etapa=p pedido** (retranscrição offline dos WAV salvos). **Não** passam em `atender_por_texto` (só `MOAH`/`MOA` no modo estrito).

Se “Legendas” apareceu no fluxo, a ativação (detector/acústico/STT) já tinha aceitado; o STT do **pedido** alucinou — não há encaminhamento do texto de confirmação como pedido.

## Formato de entrada (inalterado)

- `pw-record`: 16 kHz, mono, PCM s16, quadro 1280 amostras
- STT: `int16` → `float32 / 32768` → worker faster-whisper (`stt/venv`)

## Reprocessar WAV

```bash
# Pedido (como na escuta)
/home/airtondev/hey_pran_work/hey_pran_env/bin/python \
  /media/projetos/Agents/moah/scripts/voz/reproduzir_wav.py \
  --etapa stt --contexto pedido \
  --wav ~/.local/share/moah/voz/diagnostico/wavs/pedido-stt/pedido-....wav

# Confirmação (testa também atender_por_texto)
/home/airtondev/hey_pran_work/hey_pran_env/bin/python \
  /media/projetos/Agents/moah/scripts/voz/reproduzir_wav.py \
  --etapa stt --contexto confirmacao \
  --wav ~/.local/share/moah/voz/diagnostico/wavs/confirmacao-stt/chamada-....wav
```

Ouvir:

```bash
pw-play --target 61 ~/.local/share/moah/voz/diagnostico/wavs/pedido-stt/pedido-....wav
```

Métricas: `.json` ao lado do `.wav` ou saída de `reproduzir_wav.py`.

## Evidência local (retranscrição nov/2026)

Varredura em `pedido-stt/*.wav`:

- **Alucinação “Legendas…”** em clipes **curtos** (~1,2–1,6 s), pico **&lt; 450**, RMS baixo — áudio fraco/sem fala clara; Whisper “preenche”.
- **“Que horas são?”** em `pedido-20261123-115516.wav` (pico ~10786, 3,28 s) — captura e STT coerentes.
- **Vários WAV com fala ausente no texto** (pico 200–1000, duração 3–7 s, `mudo: false`) — limiar de mudo não barra; Whisper devolve `""` ou lixo.

**Causa no turno, 23/11/2026:** a cauda com pico marcava o pedido como iniciado e o silêncio de 0,7 s fechava o clipe (~1,16 s no teste relatado) antes da pergunta. O Whisper preenchia esse áudio e o texto ia à consulta. A correção não filtra a frase: sem presença de fala não há STT. Detalhe em [2026-11-23-004](../../cursror-dev/execucoes/2026-11-23-004-turno-pedido.md).

**Hipótese:** `Broken pipe` no STT ao depurar = processo Whisper morto/pausado no debugger, não prova de hardware ruim.

## Breakpoints

| Antes STT | Depois STT |
| --- | --- |
| Confirmação: `escutar.py` antes de `transcrever_pedido_seguro(trabalhador, trecho)` | mesma função → inspecionar `reconhecido`; log `diagnostico stt etapa=confirmacao` |
| Pedido: `turno_pedido.ouvir_texto` / linha antes de `transcrever_pedido` | `turno_pedido` após `ouvir_texto`; log `diagnostico stt etapa=pedido` |

## Gerar nova evidência

```bash
npm run moah -- voz escutar --habilitar sim --microfone jbl \
  --confirmar-ativacao acustico --modo-verificador teste --limiar-verificador 0.95 \
  --diagnostico sim --salvar-wavs sim
```

Fale **só após** “Estou aqui.”; compare `pedido-*.wav` + retranscrição. Com `--confirmar-ativacao stt`, surgem também `confirmacao-stt/chamada-*.wav`.

Sem `--depurar` durante captura ao vivo para não distorcer tempos/buffer.