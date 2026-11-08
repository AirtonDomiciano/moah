# Execução — diagnóstico dos falsos do candidato

- Data e fuso: 08/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor (Auto) com Airton
- Prompt: continuação de voz / MOAH-037
- Commit do prompt: pendente
- Execução anterior relacionada: [2026-11-08-001-voz-candidato](2026-11-08-001-voz-candidato.md)
- Estado: concluída no diagnóstico; sem treino novo e sem promoção
- Escopo solicitado: reproduzir a avaliação de `f5d9784…`, registrar instante do pico em falsos de saudação/parecidas/conversa, comparar com janelas dos negativos de treino, conferir PyTorch×ONNX na mesma janela, entregar evidência e correção proposta; preservar sessão 04 e detector em uso

## Ambiente sanitizado

Mesmo runtime local do candidato. Sem `.pt` nativo; pesos PyTorch reconstruídos do ONNX. Sessão 04 ausente.

## Resultado

Reprodução no limiar 0,95: sessão 03 **8/8**; saudação **9/9**; parecidas **27/28**; conversa **12/12**. Experimental intacto (`04fcd7bb…`).

### Instante do pico (amostras)

| Categoria | Arquivo | Instante | Score no pico | Score no alinhamento de treino | Δ Torch−ONNX |
| --- | --- | --- | --- | --- | --- |
| saudacao | 0.wav | 1,68 s | 0,9992 | 0,0008 | ≤1e-6 |
| saudacao | 1.wav | 1,76 s | 0,9992 | 0,0008 | 0 |
| saudacao | 2.wav | 1,84 s | 0,9992 | 0,0008 | 0 |
| parecidas | 0.wav | 1,44 s | 0,9992 | 0,0581 | 0 |
| parecidas | 1.wav | 1,44 s | 0,9992 | 0,0006 | 0 |
| conversa | 1.wav | 1,60 s | 0,9992 | 0,0008 | ≤1e-6 |
| conversa | 10.wav | 1,44 s | 0,9992 | 0,0008 | 0 |

Negativos de treino (espeak / `negative_train`), no mesmo `_janela`: scores ~0,0007–0,009. Cosseno entre janela do pico falso e o vizinho de treino mais próximo: ~0,67–0,89.

### Diagnóstico

Não é divergência PyTorch×ONNX. O treino só viu a janela final; o falso dispara numa janela intermediária do fluxo com pad. No alinhamento de treino o mesmo clipe já é rejeitado.

### Correção proposta (não executada)

Várias janelas deslizantes nos negativos (e positivos) de fala; negativos Piper em pasta de treino separada; salvar `.pt`; reavaliar só na 03. Não promover; não abrir a 04; não “só subir limiar”.

## Arquivos

- Novo: `scripts/voz/diagnosticar-candidato.py`
- Evidência fora do Git: `voz/correcao/candidato-diagnostico.json`
- Relatório: este arquivo

## Validação

```bash
/home/airtondev/hey_pran_work/hey_pran_env/bin/python scripts/voz/diagnosticar-candidato.py
```

Saída 0. Sessão 04 não aberta. Detector em uso não alterado.

## Limitações e próximo passo

Capítulo encerra no diagnóstico. A correção de treino fica para uma rodada seguinte, se Airton autorizar.

## Referência da implementação

Commit pendente.
