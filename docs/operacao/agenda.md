# Agenda e lembretes

A fonte, a sincronização, o armazenamento, o agendamento e o registro de entrega são separados. Nesta versão a fonte é um arquivo JSON sintético:

```json
{
  "sintetica": true,
  "eventos": [
    {
      "externalId": "evt-sintetico",
      "version": "1",
      "domain": "pessoal",
      "title": "Evento de teste",
      "startsAt": "2026-11-02T15:00:00.000Z",
      "endsAt": "2026-11-02T16:00:00.000Z",
      "status": "confirmado",
      "reminderAt": "2026-11-02T15:00:00.000Z"
    }
  ]
}
```

```bash
moah agenda sincronizar --arquivo /caminho/agenda-sintetica.json
moah agenda listar
moah agenda tick
moah agenda adiar --lembrete <id> --ate <instante ISO>
```

O fuso vem de `timezone`. O silêncio padrão é 22:00–07:00 e pode ser trocado por `agenda.quietStart` e `agenda.quietEnd`. O tick não carrega modelo.

Uma versão igual não regrava o evento. Versão nova atualiza título e horário e cancela o lembrete aberto anterior. Evento que desaparece do arquivo fica `cancelado`. O primeiro tick depois de o horário já ter passado, sem execução anterior cobrindo esse instante, grava `vencido`. Durante o silêncio o lembrete continua `agendado`. `entregue` é um registro local, distinto da tentativa e da confirmação de que alguém viu. Com o PC desligado esse registro não nasce.

Ter o evento na agenda não comprova participação. Não há comando para aceitar convite, mudar o evento na origem ou enviar mensagem. Nenhum provedor real foi autenticado.

Decisão: [ADR 0011](../arquitetura/decisoes/0011-agenda-sintetica.md).
