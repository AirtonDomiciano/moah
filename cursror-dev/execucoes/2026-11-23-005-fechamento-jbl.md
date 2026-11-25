# Fechamento do laço no JBL — 23/11/2026

- Data e fuso: 23/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor, a partir do relato de Airton
- Estado: capítulo de presença e captura encerrado no relato; verificador não promovido
- Escopo: registrar o que o JBL mostrou, o caminho real até a produção e o próximo experimento sem misturar conjuntos

## O que Airton relatou

O teste no JBL funcionou depois dos ajustes de presença de fala e de captura do pedido. O comando desse teste é o modo teste, que não grava `validado`:

```bash
npm run moah -- voz escutar --habilitar sim --microfone jbl \
  --confirmar-ativacao acustico --modo-verificador teste --limiar-verificador 0.95 \
  --diagnostico sim
```

Houve uma fala duplicada. Ficou como MOAH-040, para ver se persiste. Este capítulo não investiga a causa e não trata a duplicação como corrigida.

Não há tabela de chamadas, scores nem contagem de ciclos neste relatório. O relato não valida o verificador, não fecha as vinte chamadas e não autoriza produção.

## O que o código já faz com o manifesto

Conferido em `calibrar_verificador.py`, `treinar_verificador.py`, `voice-validate.ts` e `candidato.py`. Nada disso foi executado neste fechamento, para não reescrever `verificador.json`.

- O limiar sai da sessão 03 (tomadas `aprovadaAcusticamente`) e dos negativos em `avaliacao/gerado/{saudacao,parecidas,conversa}` mais `avaliacao/reservados.txt`.
- A varredura é 0,35 a 0,95, passo 0,05. `limiarOperacional` só é preenchido se algum limiar acerta 8/8. O melhor parcial vai para `limiarCalibrado` (hoje 0,8, com 7/8).
- `--marcar-validado sim` grava `validado: true` só quando existe esse 8/8. Sem 8/8, o mesmo comando deixa `validado: false`.
- `moah voz validar --sessao 04` recusa antes de abrir a pasta. O calibrador não lê a 04.
- `candidato.py` recusa treinar se a sessão 04 já tiver WAV.
- Produção (`--confirmar-ativacao acustico` sem `--modo-verificador teste`) exige `validado: true` e `limiarOperacional`. Hoje os dois faltam. Tomada 07 ~0,81 e tomada 08 ~0,12.

## Conjuntos

| Conjunto | Arquivos | Pode escolher o limiar |
| --- | --- | --- |
| Ajuste | Sessão 03 e os negativos já em `gerado` e `reservados.txt` | Sim. Não regravar e não usar como prova final |
| Treino | Sessões 01 e 02. A 05 só depois da revisão do rótulo | Não. Também não é a prova final |
| Prova final | Sessão 04 e `coleta/prova-*.wav` | Não. Gravar a 04 só com o limiar congelado e sem outro treino planejado |

Os prefixos da prova final são `prova-silencio`, `prova-ruido`, `prova-frase`, `prova-boa` e `prova-voz-moah`. Não copiar esses WAV para a sessão 03, `avaliacao/gerado` ou `reservados.txt`.

## Aceite

- Sair do modo teste: 8/8 na sessão 03, menos falsos nesse conjunto de ajuste, revisão humana, e só então `--marcar-validado sim`.
- Prova final: anotar os acertos da sessão 04 no limiar já congelado; nos `prova-*`, nenhuma chamada confirmada. Um erro não volta para o calibrador.
- MOAH-040: nova ocorrência fica registrada; uma ocorrência antiga não conta como correção.
