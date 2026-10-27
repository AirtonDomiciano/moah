# Arquitetura proposta

## Responsabilidades

| Camada | Responsabilidade |
| --- | --- |
| Serviço local | Ciclo de vida, fila, configuração, saúde e reinício |
| Conectores | Gmail, calendário e futuras fontes, com permissões delimitadas |
| Agenda | Estado persistente, horários, revisões e cancelamentos |
| Notificações | Entrega, deduplicação, tentativas e confirmação |
| Inferência local | Interpretação e resumo usando GPU quando necessário |
| Memória | Decisões, preferências e proveniência, separadas por contexto |
| Orquestração | Delegação, estados de tarefa e limites por agente |
| Interface | Consulta de estado e controle por Airton |
| Voz / sala | Adaptadores futuros para PRAN e interface virtual |

## Fluxo da agenda

Sincronizar fonte → normalizar evento e fuso → persistir versão → calcular alertas → entregar e registrar resultado. Atualizações e cancelamentos invalidam alertas antigos. Inferência pode produzir um resumo, mas não controla o relógio.

Sem internet, usar o cache com indicação de última sincronização. Após reinício, recuperar tarefas persistidas e aplicar política explícita para alertas vencidos; não disparar indiscriminadamente toda a fila.

## GPU e disponibilidade

Identificar hardware e consumo antes de escolher modelo, quantização ou runtime. Carregar sob demanda ou manter carregado conforme configuração; limitar concorrência e contexto. Oferecer modo jogo para descarregar ou suspender inferência. Continuar agenda e notificações durante falha do modelo.

PC desligado ou suspenso não garante avisos locais. Alertas com máquina desligada exigem outro dispositivo ou serviço sempre disponível; isso é uma evolução, não capacidade atual.

## Dados e autoridade

Separar dados pessoais, Imex e Aluai. Cada tarefa carrega contexto e permissões. Memória guarda origem e data; sugestões e conteúdo externo não viram decisões automaticamente. Conectores começam em leitura. Envio, aceite, exclusão e alteração externa exigem autorização específica registrada.

## Operação proposta

Configuração sem segredos versionada; credenciais fora do Git. Logs com redação de dados sensíveis. Estado persistente com migrações e backup. Saúde distingue serviço ativo, conectores atualizados, modelo disponível e notificação entregue.

Não há tecnologia escolhida nem daemon instalado neste momento.
