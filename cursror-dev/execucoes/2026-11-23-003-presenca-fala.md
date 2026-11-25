# Presença de fala antes da confirmação — 23/11/2026

- Data e fuso: 23/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor, a partir do log de escuta em modo manual
- Prompt: pedido nesta conversa (sem arquivo de prompt versionado)
- Commit do prompt: não se aplica
- Execução anterior relacionada: [2026-11-23-002](2026-11-23-002-verificador-diagnostico.md)
- Estado: concluída no recorte automático; headset não regravado
- Escopo solicitado: rejeitar silêncio e ruído antes de confirmar a chamada, preservando fala em volume baixo, sem exigir transcrição e sem marcar o verificador como validado

## Ambiente sanitizado

Python do `runtime.json` (venv do openWakeWord). Silero v6 já empacotado com o faster-whisper desse venv. O `silero_vad.onnx` do openWakeWord continua ausente; o detector segue com `vad_threshold` 0.

## O que o log comparava

Pico, score e texto saem do mesmo buffer de confirmação (~3,36 s: ~2,0 s antes do disparo e ~1,2 s depois). Não são a mesma janela. O pico é o máximo do clipe inteiro, depois de remover o deslocamento DC. O score é o máximo das janelas de 1,28 s, com 1 s de zeros na frente do fluxo do verificador. A transcrição, quando existia, lia o clipe inteiro e não decidia o aceite.

Os exemplos de pico 145 e 182 com texto vazio não foram gravados (`--salvar-wavs` não estava ligado). Dois candidatos gravados no mesmo dia, com pico 261 e 704 e VAD máximo 0,04–0,05, caem na mesma região e são rejeitados. Um terceiro, pico 2609 e VAD sustentado por 352 ms, é tratado como fala: a presença não substitui o verificador.

## Critério

Medido no clipe, não num corte de pico:

- VAD em 0,50 por pelo menos 160 ms, ou em 0,35 por pelo menos 160 ms. O blip sem fala mais longo em 0,35 foi 64 ms; a fala curta mantida (tomada 07 e chamada a cerca de 30 dB abaixo, sobre o piso de um candidato quieto) sustentou 256 ms.
- Ou RMS de 80 ms acima de 4× o percentil 20 do próprio clipe por pelo menos 320 ms, e VAD máximo ≥ 0,35. Estalos medidos duraram até 160 ms; as tomadas da sessão 03, a partir de 480 ms. Sem o modelo, só essa duração de energia decide.
- Ruído estacionário acompanha o piso, então a razão não chega a 4×. Não há redução de ruído nem ganho.

## Validação

`scripts/voz/test_presenca_fala.py` saiu 0.

| Grupo | Resultado |
| --- | --- |
| Silêncio digital, ruído gaussiano (pico ~180 e ~4000), estalo de 10 ms | `sem_fala` |
| Sessão 03, oito tomadas, inclusive a 07 | fala |
| Conversa gerada, doze clipes | fala |
| Cinco WAVs estacionários de música/ambiente reservados | `sem_fala` |
| Tomada 01 misturada ao candidato quieto de 23/11, ganhos 0,50, 0,06 e 0,03 | fala |
| O mesmo mix no ganho 0,02 | `sem_fala` |
| Decisão dos modos, sem modelo | `sem_fala` bloqueia mesmo com score aceito; `modo_manual`, `modelo_nao_validado` e `abaixo_limiar` permanecem quando há fala |

O manifesto não foi editado. `validado` continua falso.

## Limitações e próximo passo

Clipes de ambiente ou música em que o Silero aponta fala continuam passando desta porta; quem recusa o nome é o verificador. O ganho 0,02 sobre o piso real do candidato quieto já não se separa do ruído. O log ao vivo de pico 145/182 não tem WAV. Falta repetir a escuta no JBL e ver `sem_fala` numa linha por candidato, sem saudação no modo manual.

## Referência da implementação

Commit pendente. Arquivos: `scripts/voz/presenca_fala.py`, `scripts/voz/escutar.py`, `scripts/voz/test_presenca_fala.py`, `tests/voice-presence.test.ts`.
