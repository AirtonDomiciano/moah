# Ideias e backlog

Atualizado em 28/10/2026. Todos os módulos estão planejados.

| ID | Responsabilidade | Prioridade / destino |
| --- | --- | --- |
| MOAH-001 | Serviço local contínuo e retomada após reinício | MVP, módulo 01 |
| MOAH-002 | Inferência local usando GPU; política para jogos | MVP, módulo 02 |
| MOAH-003 | Gmail e calendário com acesso inicial de leitura | MVP, módulo 03 |
| MOAH-004 | Avisos de calls, mudanças e conflitos | MVP, módulo 04 |
| MOAH-005 | Memória compartilhada entre ferramentas | Módulo 05 |
| MOAH-006 | Diretor e CTOs Imex / Aluai | Módulo 06 |
| MOAH-007 | Rotina organizada de Tech Leader | Módulo 07 |
| MOAH-008 | Integração PRAN, voz substituível e wake word existente | Módulo 08 |
| MOAH-009 | Painel de estado e controle | Módulo 09 |
| MOAH-010 | Sala virtual e possível Meta Quest 3 | Módulo 10, exploração |
| MOAH-011 | Avaliar Notion como fonte de conhecimento | Após módulo 05 |
| MOAH-012 | Avaliar ideias do claude-mem sem assumir compatibilidade | Após módulo 05 |
| MOAH-013 | Registrar e versionar novas ideias continuamente | Processo em AGENTS.md |

## Decisões abertas

- RTX 5070 de 12 GB informada; qual CPU, RAM total e limite de uso durante jogos?
- Qual modelo/runtime oferece qualidade suficiente na máquina?
- Qual conta e calendário serão usados? Não registrar endereço privado aqui.
- Qual canal deve receber lembretes e qual antecedência? Sugestão inicial configurável: 15 e 5 minutos.
- Quais ações o MOAH poderá executar automaticamente?
- Onde serão mantidas memórias privadas e seus backups?
- Quais interfaces existem no PRAN e nos agentes de empresa?
- Como alertar se o computador estiver desligado?

## Regra de atualização

Para cada nova ideia, acrescentar ID, data, origem, estado, módulo responsável e próximos passos. Atualizar itens existentes quando a ideia refinar uma responsabilidade já documentada. Não marcar um recurso como pronto só porque seu prompt foi escrito.


## Registro de 28/10/2026

Origem de todos os itens: pedidos explícitos de Airton na conversa de definição do MOAH. Estado: planejado. Propostas de implementação detalhadas nos documentos vinculados; nenhuma tarefa foi executada por registrar a ideia.

| ID | Responsabilidade | Módulo / próximo passo |
| --- | --- | --- |
| MOAH-014 | Launcher separado, busca no SSD e grupos no Cursor | Extensão de ferramentas; catálogo e contrato da issue #1 |
| MOAH-015 | Especialistas guardam detalhes; MOAH recebe resumo e referências | 05–06; contrato em docs/contratos-agentes.md |
| MOAH-016 | Início do dia: saudação, urgências, calls e ponto de retomada | 04–07–09; definir fontes e evento de saudação |
| MOAH-017 | Convite proativo ao inglês, adiamento e cancelamento | 04–08; persistir estados e preferências |
| MOAH-018 | Histórico detalhado de estudo e resumo de evolução | 05–08; verificar interface real do PRAN |
| MOAH-019 | Review de US, bot existente e publicação no Azure | 06–07 + extensão; mapear bot e autorização |
| MOAH-020 | Agente de diagnóstico e consumo do PC/MOAH | 02–09 + extensão; coletor leve e sugestões |
| MOAH-021 | Controle de música, player, playlists e volume | Extensão; identificar serviço e adaptador |
| MOAH-022 | Personalidade, iniciativa e autonomia configuráveis | 05–06–09; preferências explícitas |
| MOAH-023 | Retomada, deduplicação e relatórios de tarefas longas | 01–06; persistir checkpoints e efeitos |
| MOAH-024 | Check-in opcional em inglês no cotidiano | 08; idioma e correções ajustáveis |

Evolução de MOAH-006: hierarquia CEO/Diretor/CTOs/especialistas detalhada. Evolução de MOAH-002: hardware agora conhecido, RTX 5070 de 12 GB; controlar contexto e simultaneidade em vez de presumir que agentes separados reduzem VRAM.

Referências: [visão](docs/visao-produto.md), [processos](docs/processos-e-exemplos.md), [contratos](docs/contratos-agentes.md), [roadmap](docs/roadmap.md) e issue #2. A prioridade inicial de serviço e agenda permanece; a ordem dos fluxos avançados ainda será escolhida.


## MOAH-025 — Parceria como referência de personalidade

- **Data:** 28/10/2026.
- **Origem:** pedido explícito de Airton: “quero meio que vc seja o MOAH”, confirmado após esclarecimento.
- **Estado:** planejado.
- **Responsabilidade:** módulos 05, 06, 08 e 09; memória, interlocução e preferências.
- **Objetivo:** levar o modo de colaboração desta conversa ao Linux: naturalidade, continuidade, iniciativa configurada, capacidade de questionar e acompanhamento de tarefas.
- **Próximos passos:** definir perfil de comportamento editável; selecionar contexto autorizado para importação; validar continuidade e personalidade sem confundir modelo, sessão e memória.
- **Referência:** [visão do produto](docs/visao-produto.md).
