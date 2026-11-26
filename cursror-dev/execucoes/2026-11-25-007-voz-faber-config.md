# Execução — Faber persistente

- Data e fuso: 25/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor, neste capítulo
- Prompt: pedido de Airton nesta conversa
- Commit do prompt: pendente
- Execução anterior relacionada: [2026-11-25-006](2026-11-25-006-voz-faber.md)
- Estado: concluída no recorte da configuração
- Escopo solicitado: gravar a Faber na configuração existente e usá-la na saudação, nas respostas e no aviso de lembrete. Se o Piper falhar, falar com espeak e mostrar `erro=`. Sem mudar ativação, captura ou STT.

## Resultado

`~/.config/moah/config.json` ficou com `voz.sintese` igual a `faber`, junto do fuso já usado pelo MOAH. O laço lê esse arquivo em `falar`. Saudação, resposta e o aviso falado do lembrete passam por essa função. Falha do Piper imprime uma linha `erro=` e segue no espeak.

## Validação

`scripts/voz/ouvir_voz.py --self-test` saiu `ok`, inclusive a troca para espeak quando a síntese Piper é forçada a falhar. O alto-falante não foi aberto.

## Referência da implementação

Commit pendente.
