# Ideias e backlog

Atualizado em 29/10/2026. Os módulos 01 a 10 estão planejados. O prompt 00 entregou a CLI de memória de trabalho. O prompt 11 entrega a conversa de leitura sobre essa memória, com simulador e sem modelo real validado.

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
| MOAH-015 | Especialistas guardam detalhes; MOAH recebe resumo e referências | 05–06; contrato em docs/arquitetura/agentes-e-memoria.md |
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

Referências: [visão](docs/produto/visao.md), [processos](docs/produto/exemplos.md), [contratos](docs/arquitetura/agentes-e-memoria.md), [roadmap](docs/produto/roadmap.md) e issue #2. A prioridade inicial de serviço e agenda permanece; a ordem dos fluxos avançados ainda será escolhida.


## MOAH-025 — Parceria como referência de personalidade

- **Data:** 28/10/2026.
- **Origem:** pedido explícito de Airton: “quero meio que vc seja o MOAH”, confirmado após esclarecimento.
- **Estado:** planejado.
- **Responsabilidade:** módulos 05, 06, 08 e 09; memória, interlocução e preferências.
- **Objetivo:** levar o modo de colaboração desta conversa ao Linux: naturalidade, continuidade, iniciativa configurada, capacidade de questionar e acompanhamento de tarefas.
- **Próximos passos:** definir perfil de comportamento editável; selecionar contexto autorizado para importação; validar continuidade e personalidade sem confundir modelo, sessão e memória.
- **Referência:** [visão do produto](docs/produto/visao.md).


## Atualização de foco — 28/10/2026

Origem: pedido explícito de Airton para começar pelo MOAH por sua transição para Tech Lead. Estado: planejado.

| ID | Responsabilidade | Módulo / próximo passo |
| --- | --- | --- |
| MOAH-026 | Registro transversal de atividades, reuniões, decisões e ações por agente | Recorte manual na CLI do prompt 00, testado; memória compartilhada e correção continuam no módulo 05 |
| MOAH-027 | Primeiro ciclo útil de Tech Lead: início do dia e fechamento com checkpoint | 01, 03–07; memória e agenda antes de ampliar agentes |

Refinamentos: MOAH-015 passa a valer para todos os domínios; MOAH-016 usa checkpoints e fontes atuais; MOAH-019 é o primeiro especialista profissional proposto após a base.

Próximos passos: serviço e persistência; entrada manual de atividades e notas; consulta de pendências e retomada; agenda; fechamento do dia; mapear bot de review. A ordem técnica detalhada deve respeitar dependências sem exigir todos os módulos para registrar a primeira nota. Voz/música ficam após essa base.

MOAH é o software próprio; modelos/runtimes são substituíveis. Avaliar candidatos na máquina, sem tratar sugestão de modelo como decisão. Não iniciar treinamento do zero. Ver [roadmap](docs/produto/roadmap.md) e [visão](docs/produto/visao.md).

## MOAH-028 — Base de engenharia e trilha de desenvolvimento

- Data: 28/10/2026. Origem: pedido de Airton por prompts/decisões organizados e descrição da estrutura imex-arch.
- Estado: prompt 00 executado em 28/10/2026. A CLI de memória de trabalho está implementada e testada. Módulos 01 e 05 seguem planejados. Relatório: [execuções](cursror-dev/execucoes/2026-10-28-001-prompt-00.md).
- Núcleo: Node.js/TypeScript conforme ADR 0001. Primeira entrega: CLI com memória de trabalho persistente, recorte de 01/05.
- Estrutura: docs e categorias 00–09, ADRs em docs/arquitetura/decisoes; prompts em cursror-dev e relatórios em execucoes.
- Próximo passo: revisar o diff da CLI e decidir o commit. Serviço contínuo e agenda ficam para os módulos seguintes, um por vez.
- Agentes reunidos por Airton na pasta Agents: cadastrar individualmente caminho/capacidade, sem iniciar todos.

## MOAH-029 — Documentação simples por responsabilidade

Data: 28/10/2026. Origem: pedido de Airton. Estado: organização documental entregue. Quatro áreas em docs: produto, arquitetura, desenvolvimento e operacao. ADR 0004 substitui a organização anterior. Preservar prompts, execuções e decisões; não alterar código nesta entrega.

## MOAH-030 — Conversa por texto sobre a memória existente

- Data: 29/10/2026. Origem: pedido explícito de Airton. Estado: entregue no recorte de leitura, com simulador testado e modelo real pendente.
- Responsabilidade: perguntar sobre pendências, resumo de uma data explícita e último checkpoint, no domínio escolhido na sessão.
- Módulo: apoio ao uso da memória do prompt 00. Não conclui inferência GPU (módulo 02), serviço (01) nem memória compartilhada (05).
- Próximo passo: quando um motor local estiver configurado, apontar endereço e modelo e registrar a validação real. Voz, agenda, escrita por IA e delegação continuam fora desta entrega. Guia em [docs/operacao/conversa.md](docs/operacao/conversa.md).

## MOAH-031 — Conhecimento visual com Obsidian e Graphify

Data: 29/10/2026. Origem: pedido explícito de Airton. Estado: decisão documentada, implementação pendente. Exportar notas Markdown vinculadas e idempotentes por domínio para Obsidian; manter SQLite como fonte estruturada. Avaliar Graphify em prova de conceito isolada, com fontes selecionadas e verificação de envio a APIs. Primeira exportação unidirecional, preservando notas manuais. [ADR 0006](docs/arquitetura/decisoes/0006-obsidian-e-graphify.md).

## MOAH-032 — Validar a conversa com um modelo local

- Data: 29/10/2026. Origem: pedido explícito de Airton. Estado: escolha registrada; download do Ollama e de `qwen3.5:9b` aguardando autorização. Em 01/11/2026 o critério automático da avaliação foi corrigido; a execução com modelo real continua pendente.
- Responsabilidade: medir a conversa de leitura do prompt 11 num endpoint local, com registros sintéticos.
- O candidato Qwen3.5-9B quantizado não é obrigatório. A reserva, se a VRAM medida não comportar o pacote de 7,6 GB, é uma variante menor da mesma família.
- Próximo passo: autorizar o download para `/media/projetos/models/ollama` e executar `npm run validar-llm`. A aprovação automática não substitui a revisão humana. Obsidian, Graphify, voz, agenda e escrita por IA ficam para entregas seguintes. Relatório do critério: [prompt 13](cursror-dev/execucoes/2026-11-01-001-prompt-13.md).

## MOAH-033 — Políticas de acesso e aprovação de ações

Data: 01/11/2026. Origem: pedido explícito de Airton por regras claras, inclusive no Windows. Estado em 02/11/2026: primeira camada executável testada no prompt 14. A conversa segue somente leitura. Escrita por IA, shell, conectores, voz e sandbox do sistema operacional continuam ausentes. A inspeção do modelo local foi repetida e o download segue sem autorização. Fonte: [segurança](docs/desenvolvimento/seguranca/README.md) e [guia](docs/operacao/governanca.md). Próximo passo: autorizar o download do Ollama ou uma ferramenta com efeito real em diretório temporário. Esta decisão não configura Cursor nem permissões do SO.

## MOAH-034 — Rotina local de Tech Lead

Data: 02/11/2026. Origem: pedido explícito de Airton. Estado: recorte local testado no prompt 15; modelo real e calendário real bloqueados. Entregue volume com verificação de montagem e UUID, backup SQLite, fila persistente, agenda sintética e importação de transcrição em texto. A análise de reunião com modelo real e o conector de agenda permanecem pendentes. Não houve commit nesta execução. Fonte: [prompt 15](cursror-dev/15-rotina-tech-lead.md).


## MOAH-035 — Referências do Pestinha para contexto e presença no desktop

Data: 03/11/2026. Origem: pedido explícito de Airton para levantamento e separação entre agora e futuro. Responsabilidades: arquitetura, contexto do computador, interface e segurança. Estado: avaliação documentada; sem adoção de código, instalação ou captura. Proposta: estudar agora separação de camadas, adaptadores, pausa e memória isolada; priorizar validação do prompt 15, modelo real, agenda e serviço. Sensores reais, painel, avatar e personalidade ficam para etapas posteriores. Rede spiking não substitui LLM e aprendizado não muda permissões. Fonte: [levantamento](docs/arquitetura/avaliacao-pestinha.md).

## MOAH-036 — Voz ativada pelo nome MOAH

Data: 03/11/2026. Origem: pedido explícito de Airton. Estado: laço e painel testados com fixtures; captura e saudação medidas no JBL Quantum 360; reconhecimento falado pendente. A ativação não autoriza ações e a conversa segue somente leitura. O modelo “hey pran” não foi reutilizado como detector deste nome. Fonte: [voz](docs/operacao/voz.md).

## MOAH-037 — Treinar um detector da pronúncia MOAH

Data: 03/11/2026. Origem: proposta técnica depois da prova de hardware. Responsabilidade: voz. Estado: detector experimental mantido; coleta nova preparada e ainda não gravada. Quatro sessões já têm papel fixo, 36 tomadas no total, com a sessão 04 fechada para teste. Os resultados já vistos não serão o teste final. O embedding não separa “MOAH” da saudação só com mais repetições iguais.
