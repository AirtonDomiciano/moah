# Diagnóstico e calibração do verificador — 25/11/2026

- Data e fuso: 25/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor
- Prompt: pedido desta conversa (diagnóstico da sessão 03, tomadas 07 e 08, calibração sem promover)
- Commit do código medido: `5901269` (merge do PR #9 em `main`)
- Execução anterior relacionada: [2026-11-23-002 verificador](2026-11-23-002-verificador-diagnostico.md), [2026-11-23-005 fechamento JBL](2026-11-23-005-fechamento-jbl.md)
- Estado: parcial; 8/8 continua ausente e o verificador não foi promovido
- Escopo: diagnóstico existente, janelas das tomadas 07 e 08, calibração sem `--marcar-validado sim`. Sessão 04 não foi aberta. `validado` manual não foi editado. O fluxo de escuta do JBL não foi alterado.

## Ambiente sanitizado

Python do `runtime.json` (ambiente de voz) e openWakeWord local. Áudio e ONNX ficam em `~/.local/share/moah/voz`, fora do Git. Modelo medido: `moah-verificador.onnx`, SHA `749fb6fa317da625`, igual a `moah-candidato-fundo.onnx` e a `moah-candidato.onnx`. `moah-candidato-49ac8909.onnx` permanece outro artefato (`49ac8909…`). `moah-experimental.onnx` não foi substituído.

## Resultado

O fast-forward de `main` local (`3efb008` → `5901269`) concluiu o merge do PR #9. Não havia alteração rastreada local; o bytecode em `scripts/voz/__pycache__/` continua fora do Git.

`diagnosticar_verificador_03.py` repetiu o quadro de 23/11. Score máximo no fluxo da escuta:

| Tomada | Score | Alinhamento fixo [1 s, 3 s] |
| --- | --- | --- |
| 01–06 | 0,999 | 0,62 a 0,999 (a 03 cai a 0,003) |
| 07 | 0,806 | 0,0003 |
| 08 | 0,120 | 0,0004 |

Acertos na sessão 03: 7/8 de 0,35 a 0,80; 6/8 de 0,85 a 0,95. Nenhum limiar da varredura chega a 8/8.

Tomadas 07 e 08: PCM 16 kHz, mono, 16 bits, sem saturação, atividade no miolo (07 em 1,4–2,0 s, pico 19370; 08 em 1,35–2,05 s, pico 17922). Mais fortes que as tomadas 01–06. As features de `oww_janela.fluxo_escuta` e de `candidato._fluxo_escuta` coincidem (diferença absoluta 0). O calibrador usa o máximo desse fluxo, o mesmo critério do treino. O slot fixo [1 s, 3 s] não é o caminho de treino e subestima tomadas que o fluxo acerta (03 e 07).

Na 07, a janela vencedora cobre a fala (índice 38, RMS alto, 0,806). Na 08, as janelas que cobrem a palavra ficam em no máximo 0,049; o 0,120 está numa janela de início, RMS 139, que não cobre a região de fala. Não é um deslocamento de janela escondendo um score alto.

Calibração (`calibrar_verificador.py`, sem `--marcar-validado`): `validado: false`, `limiarOperacional: null`, `limiarCalibrado: 0.8` (7/8 e 22 falsos em 65). Manifesto em `correcao/verificador.json`, fora do Git.

Falsos positivos no conjunto de ajuste (65 clipes: saudação 9, parecidas 28, conversa 12, música 8, ambiente 8):

| Limiar | Acertos 03 | Falsos | Saudação | Parecidas | Conversa | Música | Ambiente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 0,35 | 7/8 | 30 | 0/9 | 18/28 | 0/12 | 7/8 | 5/8 |
| 0,50 | 7/8 | 27 | 0/9 | 16/28 | 0/12 | 7/8 | 4/8 |
| 0,80 | 7/8 | 22 | 0/9 | 11/28 | 0/12 | 7/8 | 4/8 |
| 0,95 | 6/8 | 13 | 0/9 | 4/28 | 0/12 | 6/8 | 3/8 |

Baixar o limiar não produz 8/8: a tomada 08 permanece abaixo de 0,35. O limiar não foi reduzido.

`coleta/sessoes/sessao-04/tomada-01.wav` já existia (6302 bytes, não é uma tomada de 4 s). Não foi reproduzido, apagado nem completado. `candidato.py` recusa treinar enquanto houver WAV nessa pasta. A sessão 05 não existe.

## Validação

```bash
git pull --ff-only origin main
PY=$(jq -r .python ~/.local/share/moah/voz/runtime.json)
$PY scripts/voz/diagnosticar_verificador_03.py
$PY scripts/voz/calibrar_verificador.py --saida ~/.local/share/moah/voz --recursos /home/airtondev/hey_pran_work
```

A separação dos falsos por grupo reutilizou `VerificadorAcustico.pontuar` nos mesmos diretórios que o calibrador lê. Não houve `npm test` nesta rodada: nenhum código de escuta foi alterado.

## Limitações e próximo passo

O conjunto atual não calibra um limiar operacional. A sessão 05 entra no treino só depois da revisão dos rótulos, e o `candidato.py` hoje só lê as sessões 01 e 02. Negativos novos em `coleta/` com prefixo próprio não entram na calibração nem no treino até um capítulo ligar essa leitura. Não gravar a sessão 04 nem copiar clipes para `avaliacao/gerado`, `reservados.txt` ou a sessão 03.

## Referência da implementação

Sem commit deste capítulo. O código medido é `5901269`.
