# Depuração do pipeline de voz (Debian + Cursor)

Atualizado em 23/11/2026.

## Como o Node chega ao Python

`moah voz escutar` (`src/cli/voz.ts`) chama `runVoiceScript` (`src/infrastructure/wake-command.ts`):

1. Lê `$MOAH_VOICE_DIR/runtime.json` (padrão `~/.local/share/moah/voz/runtime.json`).
2. Usa o campo **`python`** desse arquivo — tipicamente o venv do treino openWakeWord (`hey_pran_env`), **não** o venv do STT.
3. Executa: `{python} scripts/voz/escutar.py` com `stdio: inherit`.

O STT (faster-whisper) é um **subprocesso separado** iniciado por `escutar.py` com `$MOAH_VOICE_DIR/stt/venv/bin/python`. Breakpoints no STT exigem depurar esse processo à parte ou usar `reproduzir_wav.py --etapa stt`.

## Pré-requisito: debugpy no interpretador certo

```bash
/home/airtondev/hey_pran_work/hey_pran_env/bin/python -m pip install -r /media/projetos/Agents/moah/scripts/voz/requirements-debug.txt
```

Confirme o caminho em `~/.local/share/moah/voz/runtime.json` → `"python"`.

## Ordem: iniciar escuta e conectar o debugger

### 1. Terminal — escuta com depuração (localhost, desligado por padrão sem `--depurar`)

```bash
cd /media/projetos/Agents/moah
npm run build
npm run moah -- voz escutar --habilitar sim --microfone jbl \
  --confirmar-ativacao acustico --modo-verificador teste --limiar-verificador 0.95 \
  --diagnostico sim --salvar-wavs sim \
  --depurar sim --depurar-porta 5678 --depurar-aguardar sim
```

Com `--depurar-aguardar sim` (padrão), o processo **para** após a linha `depuracao aguardando conexão do Cursor` até você anexar.

### 2. Cursor — anexar

Run and Debug → **MOAH voz: anexar debugpy (escutar.py)** → Start.

Quando aparecer `depuracao cliente conectado`, fale no headset.

### 3. Sem esperar (útil se o debugger já estiver em modo listen)

```bash
npm run moah -- voz escutar ... --depurar sim --depurar-aguardar nao
```

Anexe o debugger **antes** de disparar o nome.

## WAVs para ouvir (fora do Git)

Só com `--salvar-wavs sim`:

| Pasta | Conteúdo |
| --- | --- |
| `~/.local/share/moah/voz/diagnostico/wavs/verificador/` | Trecho candidato enviado ao verificador ONNX (`candidato-*.wav` + `.json`) |
| `~/.local/share/moah/voz/diagnostico/wavs/confirmacao-stt/` | STT do nome (`--confirmar-ativacao stt`) |
| `~/.local/share/moah/voz/diagnostico/wavs/pedido-stt/` | PCM do pedido após saudação (`.json` com métricas) |

[stt-captura-diagnostico.md](stt-captura-diagnostico.md) — confirmação vs pedido, reprocessar WAV.

Ouvir no Debian:

```bash
pw-play --target 61 ~/.local/share/moah/voz/diagnostico/wavs/pedido-stt/pedido-YYYYMMDD-HHMMSS.wav
```

(Substitua `61` pelo sink JBL de `moah voz hardware`.)

## Reproduzir WAV offline (mesmo código, sem microfone)

Interpretador: `runtime.json` → `python`.

```bash
cd /media/projetos/Agents/moah/scripts/voz
/home/airtondev/hey_pran_work/hey_pran_env/bin/python reproduzir_wav.py \
  --etapa verificador --wav ~/.local/share/moah/voz/diagnostico/wavs/verificador/candidato-....wav \
  --limiar-verificador 0.95 --modo-verificador teste

/home/airtondev/hey_pran_work/hey_pran_env/bin/python reproduzir_wav.py \
  --etapa stt --wav ~/.local/share/moah/voz/diagnostico/wavs/pedido-stt/pedido-....wav
```

Use as configurações **MOAH voz: reproduzir WAV** no `launch.json` com breakpoints em `reproduzir_wav.py` ou em `escutar._transcrever`.

## Módulos (responsabilidade única)

| Arquivo | Papel |
| --- | --- |
| `escutar.py` | Orquestra o laço (CLI + confirmação) |
| `turno_pedido.py` | **Saudação → captura → STT → execução** |
| `ativacao_detector.py` | Espera openWakeWord |
| `pcm_pipewire.py` | `pw-record` quadro a quadro |
| `stt_remoto.py` | Worker Whisper |
| `sintese_pipewire.py` | `espeak` + `pw-play` |
| `verificador_acustico.py` | 2º estágio ONNX |
| `presenca_fala.py` | VAD e energia do clipe, antes de confirmar |

## Breakpoints recomendados

| Etapa | Função / linha | Notas |
| --- | --- | --- |
| Quadro do microfone | `pcm_pipewire.ler_quadro` | **Evite** ao vivo: buffer do `pw-record` enche. |
| Disparo detector | `ativacao_detector.aguardar_ativacao` | |
| Trecho verificador | `escutar.py` após `buffer.concluir()` | Variável `trecho`. |
| Verificador | `escutar.py` → `verificador.verificar` | |
| **Onde a voz some no pedido** | `turno_pedido.capturar_pedido` | `motivo`, `amostras` |
| Após captura | `turno_pedido.conduzir_pedido` após `capturar_pedido` | |
| Entrada STT | `stt_remoto.transcrever_pedido` | `amostras_mutas` pode zerar texto. |
| Execução | `pedido_cli.consultar_pedido` | Texto para a CLI Node. |

**Depois de `_fechar(captura)`** é seguro pausar: o áudio do turno já está em `amostras` ou `trecho`.

Linhas auxiliares: `scripts/voz/audio_metricas.py` (`resumo_audio`, `pipeline_ponto`); saída `pipeline {...}` só com `--diagnostico` ou `--salvar-wavs sim`. `--depurar` só abre o debugpy.

## “Legendas pela comunidade Amara.org”

Causa fechada em 23/11/2026 no turno do pedido, sem filtro de texto. A cauda anterior à saudação, se passava do pico de fala, marcava o pedido como já iniciado. O silêncio de 0,7 s então encerrava a captura antes da pergunta. Um clipe de cerca de 1,16 s (cauda mais o silêncio) ia ao Whisper, que preenche silêncio com essa frase, e o texto seguia para a consulta. Agora a cauda só arma o silêncio quando `avaliar_presenca` vê fala, e sem fala não há STT nem consulta. A linha fica `pedido motivo=espera … presenca=sem_fala`.

Se um WAV antigo ainda precisar de leitura: `"mudo": true` ou RMS baixo, `motivoEncerramento=silencio` e duração perto de 0,7 s mais a cauda confirmam esse caminho. `reproduzir_wav.py --etapa stt` só relê o arquivo; não é o fluxo corrigido.

## Comportamento padrão preservado

Sem `--depurar`, `--salvar-wavs` e `--gravar-diagnostico`, o laço não grava WAV extra nem abre porta debugpy. Limiares inalterados.

No modo acústico, sem `--diagnostico`, cada candidato imprime uma linha. Sem fala o motivo é `sem_fala` e a transcrição não roda. Com fala, o motivo segue o modo (`modo_manual`, limiar ou `modelo_nao_validado`) e o texto só entra na mesma linha se o worker STT responder.