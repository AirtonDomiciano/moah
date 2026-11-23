# Diagnóstico 0/8 do verificador — 23/11/2026

## Causa principal do “0/8” no manifesto

O `calibrar_verificador.py` anterior registrava `acertosSessao03: 0` no ramo “nenhum limiar com **8/8**”, não “score 0 em todas as tomadas”. Os scores reais na sessão 03 com `fluxo_escuta` + ONNX foram medidos de novo:

| Arquivo | duração (s) | pico RMS (s) | score máx | ≥0,95 |
| --- | --- | --- | --- | --- |
| tomada-01 | 3,977 | 1,85 | 0,999 | sim |
| tomada-02 | 3,977 | 1,75 | 0,999 | sim |
| tomada-03 | 3,945 | 1,90 | 0,999 | sim |
| tomada-04 | 3,945 | 1,80 | 0,999 | sim |
| tomada-05 | 3,924 | 1,95 | 0,999 | sim |
| tomada-06 | 3,924 | 1,95 | 0,999 | sim |
| tomada-07 | 3,924 | 1,70 | 0,806 | não |
| tomada-08 | 3,945 | 1,75 | 0,120 | não |

**6/8 em 0,95**; **7/8 em 0,80**. Alinhado com `candidato-avaliacao.json` (`acertosSessao03: 6`).

## Correções aplicadas

- `calibrar_verificador.py`: leitura `sessao` + `aprovadaAcusticamente`; varredura completa; `limiarOperacional: null` sem 8/8; `limiarCalibrado` = melhor parcial.
- `extrair_cauda_pedido`: cauda desde o **fim da janela vencedora** (não +350 ms fixos).
- `coletar.py`: sessão **05** para coleta nova sem tocar 01–04.

## Identidade do modelo

- `moah-verificador.onnx` = cópia de `moah-candidato-fundo.onnx` (SHA `749fb6fa…`).
- Gerado por `scripts/voz/candidato.py treinar` (papel `candidato-fundo`); classificador MLP 16×96→Sigmoid; independente de `moah-experimental.onnx` (wake).
- `moah-candidato-49ac8909.onnx` é outro artefato (SHA distinto).

## Equivalência treino × inferência

- PCM int16 mono 16 kHz; pad 1 s antes do fluxo; quadro 1280; `get_features(16)[0]` → (16,96) float32.
- Treino positivo: janelas que **cobrem** a fala; inferência: **máximo** sobre janelas (mesmo critério que `candidato.py avaliar` com openWakeWord.Model no mesmo ONNX).
- Saída: probabilidade (Sigmoid); 1 = MOAH/moa/moá, 0 = negativo.

## Validação

- `scripts/voz/diagnosticar_verificador_03.py` (stdout JSON).
- `scripts/voz/test_pedido_preservado.py` (cauda 2,4 s em cenário “moá + pedido”).
- `calibrar_verificador.py` → `correcao/verificador.json` com `validado: false`, `limiarOperacional: null`.

Comando diagnóstico:

```bash
PY=$(jq -r .python ~/.local/share/moah/voz/runtime.json)
$PY scripts/voz/diagnosticar_verificador_03.py
```