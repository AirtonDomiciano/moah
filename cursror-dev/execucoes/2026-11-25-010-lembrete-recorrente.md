# Execução — lembrete recorrente

- Data e fuso: 25/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor, neste capítulo
- Prompt: pedido de Airton nesta conversa
- Commit do prompt: pendente
- Execução anterior relacionada: [2026-11-25-009](2026-11-25-009-alterar-lembrete.md)
- Estado: concluída no recorte automático; o JBL fica para Airton
- Escopo solicitado: “a cada” repete na sessão aberta; “daqui a” continua único; cancelar e alterar invalidam o ciclo anterior. Sem agendador paralelo.

## Resultado

“Lembrete de água a cada 30 segundos.” cria um job recorrente. Depois da fala, o mesmo job recebe o próximo `fireAt` a partir desse instante, sem repetir os intervalos perdidos. “Daqui a 30 segundos” não marca recorrência. Cancelar grava `cancelada`. Alterar “para a cada” substitui o intervalo e o disparo anteriores.

Pedido sem prazo responde “Diga daqui a quantos minutos ou segundos, ou a cada quanto tempo.”, e não a frase de criação indisponível.

## Validação

`npm test`: 91 testes, 0 falhas. Relógio fixo em 25/11/2026 18:00 UTC. O microfone não foi aberto.

## Referência da implementação

Commit pendente.
