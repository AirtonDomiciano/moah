# ADR 0011 — Agenda sintética e lembretes sem modelo

- Data: 02/11/2026
- Estado: aceita para a fonte sintética; conector real pendente
- Origem: pedido de Airton para validar agenda e lembretes antes de escolher conta ou autorização

## Contexto

O pedido pede fonte, sincronização, armazenamento, agendamento e entrega separados. Nenhuma conta foi indicada nesta execução. Aceitar convite, alterar evento ou enviar mensagem ficam fora.

## Decisão

- A fonte desta versão é um JSON marcado `sintetica: true`. A identidade do evento é origem, domínio e id externo. A mesma versão não reescreve o evento. O cancelamento vale só para os domínios presentes no arquivo: um evento confirmado que some desse recorte passa a `cancelado`, junto com o lembrete aberto. Outro domínio permanece.
- O relógio usa o fuso de `config.json`. O padrão silencioso é 22:00–07:00, substituível por `agenda.quietStart` e `agenda.quietEnd`. O tick não chama LLM.
- A primeira vez que um lembrete já está no passado, sem tick anterior que o tenha atravessado, fica `vencido`. Durante o silêncio ele permanece `agendado`. Um tick posterior, com a marca anterior antes do horário, registra `entregue`.
- A entrega é uma linha em `notifications`. Tentativa, registro e confirmação de que o usuário viu são coisas diferentes. O PC desligado não gera essa linha.
- O texto de saída diz que evento não comprova participação. Não há campo de presença nem comando para aceitar ou editar o evento na origem.

## Alternativas

- Ligar Gmail ou calendário corporativo agora: exigiria conta e autorização que não foram fornecidas.
- Disparar o lembrete pelo LLM: o relógio deixaria de funcionar com o modelo desligado.

## Consequências

A agenda útil com fonte real continua planejada. Esta ADR não declara conector funcional.
