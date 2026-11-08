# Execução — correção de janelas do candidato

- Data e fuso: 08/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor (Auto) com Airton
- Prompt: continuação de voz / MOAH-037
- Commit do prompt: pendente
- Execução anterior relacionada: [2026-11-08-002-voz-diagnostico-candidato](2026-11-08-002-voz-diagnostico-candidato.md)
- Estado: concluída no aceite do capítulo; experimental em uso; sessão 04 fechada
- Escopo solicitado: corrigir seleção de janelas; Piper de treino separado; treinar candidato com `.pt`+ONNX; comparar com `f5d9784…` na sessão 03; isolar em 0,95; demonstrar menos falsos de fala sem perder acertos

## Ambiente sanitizado

Mesmo runtime local. Baseline preservado em `moah-candidato-f5d9784.onnx`. Piper novo em `treino/piper/`, distinto de `avaliacao/gerado`.

## Resultado

Novo candidato `49ac8909bfc0e614…` · checkpoint `moah-candidato.pt`. Limiar escolhido na 03: **0,95**.

### Isolado em 0,95 (efeito da mudança)

| Modelo | Acertos 03 | Saudação | Parecidas | Conversa | Falsos de fala | Música | Ambiente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Novo (janelas) | 8/8 | 0/9 | 3/28 | 4/12 | **7** | 8/8 | 7/8 |
| Baseline f5d9784 | 8/8 | 9/9 | 27/28 | 12/12 | **48** | 2/8 | 4/8 |
| Experimental (em uso) | 5/8 | 0/9 | 18/28 | 8/12 | 26 | 8/8 | 2/8 |

Δ acertos: 0 · Δ falsos de fala: −41. Aceite do capítulo: **aprovado**.

Áudio negativo de validação: 416,25 s. Experimental SHA `04fcd7bb…` inalterado. Sessão 04 não aberta.

Trade-off observado: música/ambiente pioraram frente ao baseline; o critério deste capítulo era só fala + acertos na 03.

## Arquivos

- Alterado: `scripts/voz/candidato.py`
- Fora do Git: `completo/moah-candidato.onnx`, `completo/moah-candidato.pt`, `completo/moah-candidato-f5d9784.onnx`, `treino/piper/`, `correcao/candidato-treino.json`, `correcao/candidato-avaliacao.json`
- Docs: `docs/operacao/voz.md`, este relatório

## Validação

```bash
/home/airtondev/hey_pran_work/hey_pran_env/bin/python scripts/voz/candidato.py avaliar
```

## Limitações e próximo passo

Candidato não promovido. Próximo capítulo, se houver: atacar falsos de música/ambiente sem reabrir a 04, ou preparar o teste final na 04 sem ajuste.

## Referência da implementação

Commit pendente.
