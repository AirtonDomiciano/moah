---
name: agenda-e-compromissos
description: Acompanhar calendário e convites, identificar mudanças e emitir lembretes quando Airton pedir organização de agenda ou houver sincronização autorizada.
---

# agenda-e-compromissos

Estado: contrato planejado, sem implementação vinculada.

Consultar fontes autorizadas e informar sua última sincronização. Correlacionar IDs de convites e eventos; não confirmar compromisso com base apenas em texto ambíguo. Preservar fuso, recorrência e versões. Agendar alertas no serviço determinístico, sem depender de inferência ativa. Invalidar avisos cancelados ou substituídos. Entregar horário, link e contexto somente a Airton. Registrar estado de entrega e falhas. Não aceitar convites, enviar e-mails ou alterar eventos sem autorização específica. Não prometer entrega com computador desligado.

## Referências

Consultar ../../docs/arquitetura.md e ../../cursror-dev/README.md para dependências e critérios de implementação.

## Refinamento do contrato — 28/10/2026

Incluir rotinas proativas configuradas: convite, resposta, adiamento, aceite e cancelamento. A regra “agora não → 15 minutos” depende da preferência explícita; persistir a nova ocorrência e invalidar a anterior. “Hoje não” cancela apenas o dia conforme regra habilitada. Não iniciar aula sem aceite. Respeitar silêncio, reuniões e limites de tentativas. Horários de exemplo não configuram rotinas reais. Consultar [processos](../../docs/processos-e-exemplos.md).
