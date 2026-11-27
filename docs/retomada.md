# Ponto de retomada do MOAH

Atualizado em 27/11/2026, horário de São Paulo.

## Leia primeiro

1. A classificação do primeiro módulo, nesta página.
2. [Voz em operação](operacao/voz.md), para o laço e os limites do verificador.
3. Evidências acústicas, históricas quanto ao estado do Git: [2026-11-25-003 candidato 05](../cursror-dev/execucoes/2026-11-25-003-candidato-05.md), [2026-11-25-002 sessão 05](../cursror-dev/execucoes/2026-11-25-002-sessao-05.md), [2026-11-25-001 calibração](../cursror-dev/execucoes/2026-11-25-001-verificador-calibracao.md).
4. Dados e ONNX ficam em `~/.local/share/moah/voz` (fora do Git): `correcao/verificador.json`, `correcao/diagnostico-verificador-sessao03.json`.

## Primeiro módulo — rotina com voz

Escopo deste levantamento: assistente de rotina da Imex com voz, agenda Google, lembretes, pendências e checkpoints. Nesta rodada não houve implementação. O laço diário `moah voz uso` encaminha o pedido com `--dominio pessoal` (`scripts/voz/pedido_cli.py`). A CLI aceita `imex` em registro, pendência, checkpoint e `moah voz pedido --dominio imex`. A agenda Google omite calendário da Imex até `google.calendarios.imex` existir na configuração; o padrão é `primary` só em `pessoal`.

Teste automático e relato no JBL são evidências diferentes. O JBL de 09/11/2026 é o caminho antigo de confirmação por STT. O JBL de 23/11/2026 é o relato do laço acústico em modo teste. Nenhum dos dois fecha horas, lembrete, agenda, pendência ou checkpoint falados.

| Capacidade | Classe | Teste automático | Relato no JBL |
| --- | --- | --- | --- |
| Registro manual, pendências e checkpoint na CLI, com isolamento Imex | implementada e validada | `tests/cli.acceptance.test.ts`, `tests/conversation.test.ts` (consulta de texto no simulador) | não há |
| Checkpoint falado (“Onde paramos?”) | implementada, aguardando validação real | `tests/voice-request.test.ts`, domínio `pessoal`, projeto Ledger sintético. [2026-11-25-004](../cursror-dev/execucoes/2026-11-25-004-uso-diario.md) rodou o texto em diretório temporário e declara que isso não é headset | não há |
| Pendências faladas | parcial | a intenção existe em `src/application/voice-request.ts` (`consultar_pendencias`). Não há teste desse caminho de voz | não há |
| Lembrete local: criar, alterar, cancelar, recorrência e entrega só se a fala terminar | implementada, aguardando validação real | `tests/voice-request.test.ts`; `scripts/voz/lembrete_sessao.py` nos relatos [008](../cursror-dev/execucoes/2026-11-25-008-lembrete-voz.md), [009](../cursror-dev/execucoes/2026-11-25-009-alterar-lembrete.md) e [010](../cursror-dev/execucoes/2026-11-25-010-lembrete-recorrente.md). O microfone não foi aberto | o 008 deixa a prova de dois minutos para Airton; não há relato posterior |
| Agenda Google só leitura por voz | implementada, aguardando validação real | `tests/agenda.test.ts` com HTTP simulado. [2026-11-25-011](../cursror-dev/execucoes/2026-11-25-011-agenda-google.md) registra que a API real não foi chamada | não há |
| Laço falado `moah voz uso` (nome, pedido, resposta) | parcial | turno, buffer, cauda e presença em `scripts/voz/test_*.py` e testes Node de voz. Isso não promove o ONNX | 23/11, modo teste: Airton relatou que o laço funcionou. Uma fala duplicada ficou em [MOAH-040](../ideias.md). Sem tabela de chamadas |
| Rotina Imex falada (agenda, pendências e checkpoint no mesmo domínio) | planejada | o laço fixa `pessoal`. Pergunta que cita outro domínio é recusada. Pergunta mista de pendência, resumo e checkpoint é recusada | não há |
| Início do dia que junta agenda, pendências e checkpoint | planejada | não há um pedido que reúna as três fontes | não há |

A agenda sintética (`moah agenda`, ADR 0011) é outra fonte. Ela tem teste em `tests/rotina.test.ts` e não lê o Google.

Os relatos [004](../cursror-dev/execucoes/2026-11-25-004-uso-diario.md) a [011](../cursror-dev/execucoes/2026-11-25-011-agenda-google.md) dizem “commit pendente”. Esse texto é o estado da hora em que foram escritos. O código que descrevem está publicado em `540e70a`, `74a8182` e `d518735`.

### Lacunas para fechar o módulo

1. Abrir o laço no domínio `imex`, com calendário desse domínio na configuração, e registrar uma consulta falada de agenda, pendência e checkpoint sem imprimir o conteúdo privado.
2. Completar o uso real da agenda: `moah conta google conectar` com o cliente já ajustado em `d518735`, uma listagem do dia e a fala correspondente. O teste atual não substitui essa chamada.
3. Anunciar no JBL um lembrete vencido, uma alteração, um cancelamento e um ciclo “a cada”, com `voz uso` aberto, e guardar só o resultado (`entregue` ou `erro=`), sem o texto do lembrete se ele for privado.
4. Cobrir com teste a frase de pendências na voz e a consulta `voz pedido --dominio imex`.
5. Decidir o pedido único de início do dia. Hoje a voz recusa a mistura de pendências, resumo e checkpoint.
6. Fechar o aceite acústico à parte: `validado` segue `false`, o modo produção recusa a confirmação acústica, e MOAH-040 continua observação. O módulo de rotina pode ser usado em modo teste enquanto isso, e o modo teste não é aceite do verificador.

## Estado atual (código)

- CLI de memória e checkpoint na CLI estão cobertos por teste automático, inclusive no domínio `imex`. `moah voz pedido` cobre relógio, lembretes e o checkpoint Ledger em teste automático, no domínio `pessoal`. O headset desses pedidos continua em aberto.
- **Pipeline acústico em dois estágios** em `scripts/voz/escutar.py`: detector `moah-experimental.onnx` → buffer → presença de fala no clipe → verificador MLP 16×96 (`moah-verificador.onnx`, cópia de `moah-candidato-fundo.onnx`) → saudação → pedido.
- Sem fala no clipe de confirmação o motivo é `sem_fala` e não há saudação (`manual`, `teste` e `producao`). Com fala, os três modos seguem como antes. A transcrição não decide o aceite acústico. O verificador continua `validado: false`.
- **Turno do pedido:** a cauda anterior à saudação continua no áudio, mas o pico não arma o silêncio. Só a presença de fala inicia essa contagem. Sem fala a linha é `presenca=sem_fala` e não há STT nem consulta. Evidência automática: [2026-11-23-004](../cursror-dev/execucoes/2026-11-23-004-turno-pedido.md).
- **JBL, 23/11, modo teste:** Airton relatou que o laço funcionou depois desses ajustes. Comando abaixo. Uma fala duplicada ficou em aberto como MOAH-040; não foi investigada nem corrigida. Isso não valida o verificador nem a tabela de chamadas.
- **STT legado** só com `--confirmar-ativacao stt` (confirmação por texto no trecho curto). `--confirmar-ativacao sim` usa acústico se `validado: true`, senão STT.
- **`--arranque 1.7` não resolve falsos do detector** (score ~0,99 no 1º s quieto); a escuta zera o fluxo openWakeWord a cada volta.

## O que já foi comprovado — capítulo acústico

Esta tabela é a evidência histórica da ativação. Ela não classifica agenda, lembrete, pendência nem checkpoint. Essa classificação está na seção do primeiro módulo.

| Camada | O quê | Evidência |
| --- | --- | --- |
| Sem microfone | `moah voz pedido --texto "Que horas são?"` | `npm test` / uso local |
| Headset (STT) | “moa/moá” + pedido após confirmação **STT** | JBL 09/11/2026, três ciclos; [retomada antiga] confirmação `Moa` |
| Automatizado | Turno, buffer, cauda, presença de fala | `scripts/voz/test_*`; não promove o ONNX |
| Offline ONNX | Verificador na sessão 03 | 6/8 ≥0,95, 7/8 ≥0,80; sem 8/8 |
| Headset, modo teste | Laço presença + pedido, relato de Airton em 23/11 | Uma fala duplicada (MOAH-040). Sem tabela de chamadas e sem `validado` |

**Ainda aberto:** 8/8 na sessão 03, `limiarOperacional`, modo produção, sessão 04 e os negativos `prova-*`. MOAH-040 só se a duplicação voltar.

## Falsas ativações (estágio 1)

- Microfone quieto: pico ~**0,994** no 1º s; cai a ~0,01 no seguinte (22/11).
- Após saudação/resposta do MOAH o detector ainda pontua alto sem chamada real.
- Aceite do nome falado continua **pendente** (vinte chamadas no headset sem tabela fechada).

## Verificador (estágio 2)

- Manifesto: `validado: false`, **`limiarOperacional: null`** (não usar 0,95 em produção).
- Primeira calibração registrou **`acertosSessao03: 0`** no sentido “nenhum limiar com 8/8” — **não** “score zero em todas as tomadas”.
- Reavaliação offline (25/11, mesmo SHA `749fb6fa…`): tomadas 01–06 ~0,999; **tomada-07** 0,806 na janela que cobre a fala; **tomada-08** 0,120 numa janela que não cobre a fala (janelas que cobrem ficam ≤0,049). Features do fluxo de treino e de inferência coincidem. O slot fixo [1 s, 3 s] não é o caminho usado na calibração. Melhor parcial `limiarCalibrado: 0,8` com 7/8 e 22/65 falsos. Em 0,95: 6/8 e 13/65 (parecidas 4/28, música 6/8, ambiente 3/8; saudação e conversa 0). Detalhe: [2026-11-25-001](../cursror-dev/execucoes/2026-11-25-001-verificador-calibracao.md).
- Candidato `moah-candidato-05.onnx` (SHA `168b9fc27a4bf565`), treinado em 25/11 com sessões **01, 02 e 05** e os negativos `neg-boa`, `neg-sala`, `neg-musica`. Não foi copiado para `moah-verificador.onnx` (`749fb6fa…`) nem para `moah-experimental.onnx` (`04fcd7bb…`). `validado` segue `false`.

## Próximo capítulo — ativação

As lacunas do primeiro módulo estão na seção acima. Este capítulo continua o trabalho acústico. Calibração e treino ficam pausados. O candidato 05 não entra no verificador em uso e `validado` continua `false`. O uso diário no Debian é o laço do JBL, agora sem repetir as flags:

```bash
npm run moah -- voz uso
```

Isso fixa detector 0,5, confirmação acústica, modo teste e limiar 0,95, com console `estado=`, `pedido=`, `resultado=` e `erro=`. O comando longo com `--diagnostico sim` continua disponível para medir o detector. Detalhe: [2026-11-25-004](../cursror-dev/execucoes/2026-11-25-004-uso-diario.md).

A fala do laço é a Piper Faber, gravada em `~/.config/moah/config.json` (`voz.sintese`). Se o Piper falhar, o laço usa espeak e imprime `erro=`. O lembrete local vencido é anunciado só com `voz uso` aberto, fora do turno do pedido. Lembrete “a cada” repete no mesmo job enquanto `voz uso` está aberto. A consulta de voz da agenda Google é só leitura, com OAuth local. Gmail, Discord, WhatsApp e envio de mensagens continuam nas próximas etapas ([MOAH-042](../ideias.md)). Detalhe: [2026-11-25-011](../cursror-dev/execucoes/2026-11-25-011-agenda-google.md).

O candidato 05, no verificador isolado, marca 8/8 na sessão 03 em 0,80 e em 0,95 (tomada 08 sobe de 0,120 para 0,9999). No pipeline completo o detector experimental não dispara na tomada 08, então a confirmação fica 7/8. Nos negativos de ajuste, em 0,95, as parecidas sobem de 4/28 para 9/28 no modelo isolado e de 3/28 para 6/28 no pipeline. Saudação e conversa continuam em 0. Música isolada passa de 6/8 para 7/8; no pipeline cai de 2/8 para 0/8. Ambiente isolado passa de 3/8 para 2/8; no pipeline permanece 1/8. Detalhe: [2026-11-25-003](../cursror-dev/execucoes/2026-11-25-003-candidato-05.md). O aumento de parecidas impede o aceite do limiar. A sessão 04 e os `prova-*` continuam fora.

## Git

- Em 27/11/2026, antes deste registro, `origin/main` estava em `d518735` (`fix(google): ajusta conexão com cliente OAuth existente`). A árvore não tinha outras alterações além desta documentação. A nota de 25/11 que fixava `5901269` e “não havia diff” é histórica; ela foi escrita antes de `540e70a`, `74a8182` e `d518735`.
- [MOAH-038](../ideias.md#moah-038--chamada-e-pedido-na-mesma-frase) e [MOAH-039](../ideias.md#moah-039--manter-a-voz-de-quem-iniciou-o-pedido) continuam planejados. [MOAH-040](../ideias.md#moah-040--acompanhar-relato-de-fala-duplicada) continua observação.
- `validado` permanece `false`. O modo produção recusa confirmação acústica sem `validado: true` e `limiarOperacional`. O modo teste não grava o manifesto.
- Áudio, ONNX, credenciais e memória real ficam fora do Git.

## Manutenção

Ao fechar capítulo: atualize este arquivo, link o relatório em `cursror-dev/execucoes/`, não versionar áudio, pesos nem credenciais.