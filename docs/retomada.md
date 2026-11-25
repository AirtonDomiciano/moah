# Ponto de retomada do MOAH

Atualizado em 25/11/2026, horário de São Paulo.

## Leia primeiro

1. Este resumo e [voz em operação](operacao/voz.md).
2. Evidências: [2026-11-23-005 fechamento JBL](../cursror-dev/execucoes/2026-11-23-005-fechamento-jbl.md), [2026-11-23-004 turno](../cursror-dev/execucoes/2026-11-23-004-turno-pedido.md), [2026-11-23-002 verificador](../cursror-dev/execucoes/2026-11-23-002-verificador-diagnostico.md).
3. Dados e ONNX ficam em `~/.local/share/moah/voz` (fora do Git): `correcao/verificador.json`, `correcao/diagnostico-verificador-sessao03.json`.

## Estado atual (código)

- CLI de memória, checkpoints, `moah voz pedido` (relógio, lembretes, Ledger) testados.
- **Pipeline acústico em dois estágios** em `scripts/voz/escutar.py`: detector `moah-experimental.onnx` → buffer → presença de fala no clipe → verificador MLP 16×96 (`moah-verificador.onnx`, cópia de `moah-candidato-fundo.onnx`) → saudação → pedido.
- Sem fala no clipe de confirmação o motivo é `sem_fala` e não há saudação (`manual`, `teste` e `producao`). Com fala, os três modos seguem como antes. A transcrição não decide o aceite acústico. O verificador continua `validado: false`.
- **Turno do pedido:** a cauda anterior à saudação continua no áudio, mas o pico não arma o silêncio. Só a presença de fala inicia essa contagem. Sem fala a linha é `presenca=sem_fala` e não há STT nem consulta. Evidência automática: [2026-11-23-004](../cursror-dev/execucoes/2026-11-23-004-turno-pedido.md).
- **JBL, 23/11, modo teste:** Airton relatou que o laço funcionou depois desses ajustes. Comando abaixo. Uma fala duplicada ficou em aberto como MOAH-040; não foi investigada nem corrigida. Isso não valida o verificador nem a tabela de chamadas.
- **STT legado** só com `--confirmar-ativacao stt` (confirmação por texto no trecho curto). `--confirmar-ativacao sim` usa acústico se `validado: true`, senão STT.
- **`--arranque 1.7` não resolve falsos do detector** (score ~0,99 no 1º s quieto); a escuta zera o fluxo openWakeWord a cada volta.

## O que já foi comprovado

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
- Reavaliação offline (23/11): **tomada-07** ~0,81; **tomada-08** ~0,12; demais ~0,99. Melhor parcial `limiarCalibrado: 0,8` com 7/8.
- Treino verificador: sessões **01–02**; calibração **03**; **04** fechada; coleta nova **05** (`coletar.py` não sobrescreve sessão existente).

## Próximo capítulo

Sair do modo teste só pelo calibrador, no conjunto que ele já lê. A prova final é outro conjunto e não redefine o limiar. Detalhe e comandos: [voz em operação](operacao/voz.md).

1. Medir no JBL, sem saudar e sem gravar em 03, `gerado` ou `reservados.txt`: chamada real, silêncio, ruído, frase comum, “boa” em conversa, voz do MOAH no alto-falante.
   ```bash
   npm run moah -- voz escutar --habilitar sim --microfone jbl \
     --confirmar-ativacao acustico --modo-verificador manual --diagnostico sim
   ```
2. Se ainda faltar tomada para o treino, gravar na **sessão 05** e revisar o rótulo antes de retreinar. Não usar a 05 como prova final.
3. Recalibrar **sem** `--marcar-validado sim`. Aceite do limiar operacional: 8/8 na sessão 03 e, entre esses limiares, o de menos falsos nos negativos de ajuste. Sem 8/8, `limiarOperacional` continua `null`.
4. Só então, depois da revisão humana desses falsos: `treinar_verificador.py calibrar --marcar-validado sim`. Sem 8/8 o comando não liga `validado`. Não editar o JSON.
5. Com o limiar congelado e sem outro treino planejado, gravar a **sessão 04** (8×4 s, “moá”) e os prefixos `prova-silencio`, `prova-ruido`, `prova-frase`, `prova-boa`, `prova-voz-moah`. `candidato.py` passa a recusar treino quando a 04 tiver WAV. Um erro nessa prova não volta para o calibrador.

Comando do capítulo que Airton relatou como funcional:

```bash
npm run moah -- voz escutar --habilitar sim --microfone jbl \
  --confirmar-ativacao acustico --modo-verificador teste --limiar-verificador 0.95 \
  --diagnostico sim
```

## Entrega preparada para `main`

A branch `teste/lembretes-moah` incorpora `origin/main` até `d8894ae`. Os registros exclusivos da `main` permanecem: [MOAH-038](../ideias.md#moah-038--chamada-e-pedido-na-mesma-frase), [MOAH-039](../ideias.md#moah-039--manter-a-voz-de-quem-iniciou-o-pedido) e [MOAH-040](../ideias.md#moah-040--acompanhar-relato-de-fala-duplicada). MOAH-038 e MOAH-039 continuam planejados. MOAH-040 continua observação, sem correção.

O que esta branch acrescenta, sem promover o verificador:

- Lembretes locais por voz (`me lembro de` / `me lembre`) e aviso falado quando a ferramenta está indisponível ou o prazo não serve.
- Pipeline acústico em dois estágios, presença de fala e turno do pedido. Evidências: [2026-11-23-003](../cursror-dev/execucoes/2026-11-23-003-presenca-fala.md), [2026-11-23-004](../cursror-dev/execucoes/2026-11-23-004-turno-pedido.md), [2026-11-23-005](../cursror-dev/execucoes/2026-11-23-005-fechamento-jbl.md).

`validado` permanece `false`. O modo produção continua recusando confirmação acústica sem `validado: true` e `limiarOperacional` (`modelo_nao_validado`). O modo teste não grava o manifesto.

Verificação desta rodada, em 25/11/2026, Node 22.23.3 e Python 3.10.21 do ambiente de voz: `npm run typecheck`, `npm test` (84 testes, 0 falhas) e os scripts `test_turno_escuta.py`, `test_presenca_fala.py`, `test_confirmacao_acustica.py`, `test_pedido_preservado.py`, `test_confirmacao_texto.py`. Isso não fecha 8/8 na sessão 03, a tabela de chamadas nem a sessão 04.

## Git

- Branch: `teste/lembretes-moah`, com merge de `origin/main` (`d8894ae`).
- `main` local segue em `3efb008`; o remoto `origin/main` está em `d8894ae`.
- Remoto: `origin` → `github.com/AirtonDomiciano/moah.git`.
- Áudio, ONNX, credenciais e memória real ficam fora do Git. Bytecode `__pycache__` não entra neste merge.

## Manutenção

Ao fechar capítulo: atualize este arquivo, link o relatório em `cursror-dev/execucoes/`, não versionar áudio, pesos nem credenciais.