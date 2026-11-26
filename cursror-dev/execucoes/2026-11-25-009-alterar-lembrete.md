# Execução — alterar lembrete local

- Data e fuso: 25/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor, neste capítulo
- Prompt: pedido de Airton nesta conversa
- Commit do prompt: pendente
- Execução anterior relacionada: [2026-11-25-008](2026-11-25-008-lembrete-voz.md)
- Estado: concluída no recorte automático; o JBL fica para Airton
- Escopo solicitado: alterar o lembrete pendente pelo texto, no mesmo item da fila, com prazo contado a partir da alteração. Sem criar outro e sem disparo no prazo antigo.

## Resultado

Não havia alteração de lembrete local. “Alterar o lembrete…” caía em `isReminderRequest` e respondia “Ainda não consigo criar lembretes.” Agora a frase localiza o pendente do domínio, grava o novo `fireAt` no mesmo job e confirma pela voz. Vários correspondentes pedem esclarecimento. Ausente e já entregue têm falas próprias. Cancelar responde “Ainda não consigo cancelar lembretes.”

## Validação

`npm test`: 90 testes, 0 falhas. O caso “beber água daqui a 2 minutos” seguido de “para 30 segundos” mantém um único job pendente, com disparo em 30 segundos. O microfone não foi aberto.

## Referência da implementação

Commit pendente.
