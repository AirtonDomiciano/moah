# Execução — candidato ONNX das sessões 01–03

- Data e fuso: 08/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor (Auto) com Airton
- Prompt: continuação do módulo de voz / MOAH-037 (sem prompt numerado novo)
- Commit do prompt: pendente
- Execução anterior relacionada: [2026-11-03-008-validacao-acustica](2026-11-03-008-validacao-acustica.md)
- Estado: concluída no recorte do candidato; aceite falado pendente
- Escopo solicitado: treinar candidato com tomadas aprovadas e conferidas de ouvido das sessões 01 e 02; negativos com “Estou aqui”, parecidas e conversa; validar e escolher limiar só na sessão 03; reservar a 04; salvar separado do modelo em uso; comparar e entregar comando de validação; encerrar o capítulo

## Ambiente sanitizado

Debian 13; Python do treino local PRAN; openWakeWord ONNX em CPU; dados em `~/.local/share/moah/voz` fora do Git. Sessão 04 ausente.

## Resultado

- Validação acústica: 26 aprovadas, 2 reprovadas (`sessao-01/tomada-08`, `sessao-01/tomada-09`). Sessão 03 completa (8/8).
- Treino: 18 positivos reais das sessões 01 e 02, 162 variações, 40 sintéticos de treino, 239 negativos (sem `avaliacao/gerado`). Arquivo `completo/moah-candidato.onnx`, SHA-256 `f5d9784039677d9d14ebef5eb62311884543d8abad2056090257dd172edec0ce`.
- Modelo em uso inalterado: `moah-experimental.onnx`, SHA-256 `04fcd7bb45fffa4a82fdcb266fd9e795691ee53228195334d1ef6fbc6b587bdf`.
- Limiar escolhido na sessão 03: 0,95 (máximo de acertos; desempate por menos falsos).
- Áudio negativo de validação: 416,25 s (saudação 17,96; parecidas 46,59; conversa 31,83; música 239,87; ambiente 80,00).

| Modelo | Limiar | Acertos 03 | Saudação | Parecidas | Conversa | Música | Ambiente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Candidato | 0,95 | 8/8 | 9/9 | 27/28 | 12/12 | 2/8 | 4/8 |
| Experimental | 0,95 | 5/8 | 0/9 | 18/28 | 8/12 | 8/8 | 2/8 |
| Experimental | 0,5 | 7/8 | 0/9 | 23/28 | 9/12 | 8/8 | 7/8 |

O candidato não foi promovido. A escuta continua no experimental.

## Arquivos e decisões

- Novo: `scripts/voz/candidato.py`
- Relatórios fora do Git: `voz/correcao/candidato-treino.json`, `voz/correcao/candidato-avaliacao.json`, `voz/correcao/validacao-acustica.json`
- Docs: `docs/operacao/voz.md`, `ideias.md` (MOAH-037)
- ADR consultada: [0013](../../docs/arquitetura/decisoes/0013-voz-por-nome.md)

## Validação

```bash
/home/airtondev/hey_pran_work/hey_pran_env/bin/python scripts/voz/candidato.py avaliar
```

Treino já executado nesta rodada; saída 0. Sessão 04 não aberta.

## Limitações e próximo passo

O candidato memoriza a palavra nas sessões novas e ainda confunde saudação e fala parecida. Próximo passo fora deste capítulo: decidir se coleta mais negativos reais de fala ou se prepara a sessão 04 como teste final, sem usá-la para ajuste.

## Referência da implementação

Commit pendente.
