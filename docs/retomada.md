# Ponto de retomada do MOAH

Atualizado em 23/11/2026, horário de São Paulo.

## Leia primeiro

1. Este resumo e [voz em operação](operacao/voz.md).
2. Evidências: [2026-11-23-002 verificador](../cursror-dev/execucoes/2026-11-23-002-verificador-diagnostico.md), [2026-11-22-001 fluxo](../cursror-dev/execucoes/2026-11-22-001-voz-fluxo.md).
3. Dados e ONNX ficam em `~/.local/share/moah/voz` (fora do Git): `correcao/verificador.json`, `correcao/diagnostico-verificador-sessao03.json`.

## Estado atual (código)

- CLI de memória, checkpoints, `moah voz pedido` (relógio, lembretes, Ledger) testados.
- **Pipeline acústico em dois estágios** em `scripts/voz/escutar.py`: detector `moah-experimental.onnx` → buffer → verificador MLP 16×96 (`moah-verificador.onnx`, cópia de `moah-candidato-fundo.onnx`) → saudação → pedido.
- **STT legado** só com `--confirmar-ativacao stt` (confirmação por texto no trecho curto). `--confirmar-ativacao sim` usa acústico se `validado: true`, senão STT.
- **`--arranque 1.7` não resolve falsos do detector** (score ~0,99 no 1º s quieto); a escuta zera o fluxo openWakeWord a cada volta.

## O que já foi comprovado

| Camada | O quê | Evidência |
| --- | --- | --- |
| Sem microfone | `moah voz pedido --texto "Que horas são?"` | `npm test` / uso local |
| Headset (STT) | “moa/moá” + pedido após confirmação **STT** | JBL 09/11/2026, três ciclos; [retomada antiga] confirmação `Moa` |
| Automatizado | Turno escuta, buffer, cauda do pedido | `scripts/voz/test_*`, 83 testes Node |
| Offline ONNX | Verificador na sessão 03 WAV | 6/8 ≥0,95, 7/8 ≥0,80; `diagnosticar_verificador_03.py` |

**Não comprovado no JBL:** confirmação **acústica** (2º estágio) + “que horas são?” no mesmo comando de escuta com `--confirmar-ativacao acustico`.

## Falsas ativações (estágio 1)

- Microfone quieto: pico ~**0,994** no 1º s; cai a ~0,01 no seguinte (22/11).
- Após saudação/resposta do MOAH o detector ainda pontua alto sem chamada real.
- Aceite do nome falado continua **pendente** (vinte chamadas no headset sem tabela fechada).

## Verificador (estágio 2)

- Manifesto: `validado: false`, **`limiarOperacional: null`** (não usar 0,95 em produção).
- Primeira calibração registrou **`acertosSessao03: 0`** no sentido “nenhum limiar com 8/8” — **não** “score zero em todas as tomadas”.
- Reavaliação offline (23/11): **tomada-07** ~0,81; **tomada-08** ~0,12; demais ~0,99. Melhor parcial `limiarCalibrado: 0,8` com 7/8.
- Treino verificador: sessões **01–02**; calibração **03**; **04** fechada; coleta nova **05** (`coletar.py` não sobrescreve sessão existente).

## Próximo capítulo (ordem)

1. **JBL, modo manual:** medir candidatos do detector + scores do verificador sem saudar (`motivoRejeicao=modo_manual`).
   ```bash
   npm run moah -- voz escutar --habilitar sim --microfone jbl \
     --confirmar-ativacao acustico --modo-verificador manual --diagnostico sim
   ```
   **Laço acústico completo** com modelo ainda não validado: `--modo-verificador teste --limiar-verificador 0.95` (não marca `validado`).
2. Corrigir **tomada-08** (e se necessário **07**) na sessão 03 ou expandir **sessão 05**; retreinar e recalibrar.
3. Só após **8/8 na 03**, falsos negativos aceitáveis e prova no headset: considerar `validado: true` e `limiarOperacional` no manifesto (não promover só editando JSON).
4. Repetir roteiro “que horas são?” com confirmação acústica quando o manifesto estiver apto.

Checagem sem microfone:

```bash
npm run moah -- voz pedido --dominio pessoal --texto "Que horas são?"
```

Diagnóstico offline:

```bash
PY=$(jq -r .python ~/.local/share/moah/voz/runtime.json)
$PY scripts/voz/diagnosticar_verificador_03.py
$PY scripts/voz/calibrar_verificador.py --saida ~/.local/share/moah/voz --recursos /home/airtondev/hey_pran_work
```

## Git

- Branch: `teste/lembretes-moah`
- Último commit citando voz/verificador: `7703250` (`fix(voz): diagnóstico do verificador 0/8, calibração e cauda do pedido`)
- Remoto: `origin` → `github.com/AirtonDomiciano/moah.git` (sincronia depende do último `git push` na máquina).

## Manutenção

Ao fechar capítulo: atualize este arquivo, link o relatório em `cursror-dev/execucoes/`, não versionar áudio, pesos nem credenciais.