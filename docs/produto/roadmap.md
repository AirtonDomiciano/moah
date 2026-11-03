# Roadmap e critérios de evolução

Atualizado em 28/10/2026. Todas as frentes abaixo estão planejadas. Este roteiro amplia a visão sem substituir o primeiro resultado útil de agenda previsto no README.

## Sequência de implementação

| Etapa | Entrega observável | Referência |
| --- | --- | --- |
| Fundação | Serviço, persistência, retomada e estado de saúde | Módulo 01 |
| Execução local | Modelo avaliado na máquina, fila e limites medidos | Módulo 02 |
| Agenda útil | Conectores de leitura e alertas persistentes sem IA | Módulos 03–04 |
| Continuidade | Memórias por domínio e checkpoints de trabalho | Módulo 05 |
| Coordenação | Tarefas, CTOs, especialistas e relatórios resumidos | Módulo 06 |
| Rotina profissional | Visão do dia e acompanhamento de trabalho | Módulo 07 |
| Inglês e conversa | Adaptador do PRAN, voz e relatório de estudo | Módulo 08 |
| Controle | Painel de estado, tarefas, fontes e preferências | Módulo 09 |
| Novas ferramentas | Projetos, review/Azure, diagnóstico e mídia | Extensões abaixo |
| Interface virtual | Exploração após o básico estar utilizável | Módulo 10 |

Não implementar todos os módulos simultaneamente. Primeiro estabilizar o serviço e a agenda; demonstrar uma delegação completa antes de aumentar o número de agentes. A prioridade profissional refinada em 28/10/2026 está descrita ao final deste documento.

## Extensões e dependências

- **Projetos:** catálogo separado e integração com o MOAH, issue #1; depende do contrato de ferramentas e tarefas.
- **Review/Azure:** levantar a interface do bot, autenticação e vínculo US/PR; depende de coordenação, persistência e deduplicação.
- **Rotinas proativas:** ampliar agenda com convites e respostas; depende de persistência, preferências e canal de interação. Agente de inglês só inicia após aceite.
- **Diagnóstico do PC:** coleta pode ser desenvolvida sem IA; análise natural depende do roteamento e do modelo.
- **Mídia:** identificar player e serviço usados antes de escolher adaptador.
- **Resumo de início do dia:** depende de fontes verificáveis e checkpoints; saudação pode ser habilitada separadamente.

## Cenários que devem orientar a validação

Consultar [processos-e-exemplos.md](exemplos.md) e [contratos-agentes.md](../arquitetura/agentes-e-memoria.md). Testar falhas e retomadas, não só o caminho feliz:
- agenda alterada/cancelada e PC suspenso;
- modelo indisponível ou VRAM insuficiente;
- bot ou conector desconectado;
- publicação com resultado incerto;
- tarefa cancelada ou aguardando usuário;
- resumo antigo ou memória corrigida;
- tentativa de acesso entre empresas;
- dois players ativos;
- SSD desmontado.

## Decisões pendentes

CPU e RAM total; espaço disponível; modelo/runtime e quantização; orçamento de recursos; acesso a e-mail/agenda corporativos e política da empresa; interface do bot de review; contrato real do PRAN; player de música; preferências de proatividade; retenção e backup de memória; limites de autonomia por ferramenta.

Não escolher tecnologia apenas pelo nome da GPU. A RTX 5070 de 12 GB é o alvo atual e exige medição do conjunto real. Upgrade futuro não é pré-requisito definido.

## Evidência para mudar estado

Um item só passa de planejado para implementado após código, execução e validação documentados. Integração simulada deve permanecer identificada. Registrar comando de execução, versão, resultado e limitação, sem segredos ou dados empresariais no repositório público.


## Prioridade refinada com Airton — 28/10/2026

Começar pelo MOAH como apoio à entrada de Airton em Tech Lead. O primeiro ciclo útil combina memória de trabalho, agenda, início/fechamento do dia e retomada. A base de serviço e persistência continua obrigatória; não é necessário implementar voz, música ou toda a hierarquia para obter valor inicial.

Sequência de produto:
1. Registrar atividades, decisões, bloqueios e próximos passos por projeto, inclusive por entrada manual.
2. Consultar agenda e pendências no início do dia, com estado das fontes.
3. Consolidar o dia e recuperar o checkpoint na próxima sessão.
4. Integrar o primeiro especialista profissional: bot de review associado a US, depois de levantar sua interface.

Essa prioridade resolve a escolha antes aberta entre review e inglês como primeiro fluxo profissional avançado: review é a proposta de sequência registrada; o inglês permanece no roadmap. A ordem técnica deve respeitar 01, persistência de 05 e dependências de agenda 03–04, entregando partes utilizáveis progressivamente. Inferência 02 é avaliada em paralelo lógico à fundação, sem tornar o relógio dependente do modelo.

Validar entrada manual → confirmação → persistência → resumo diário → retomada após reinício. Distinguir reunião agendada, presença confirmada e conteúdo disponível. Não registrar participação ou decisões por inferência a partir do título da call.

Software próprio sobre modelo existente e substituível é o plano inicial. Não treinar do zero; candidatos de modelo ainda dependem de avaliação real. O objetivo de todos os agentes é produzir registros e resumos rastreáveis, consumidos seletivamente pelo MOAH.

## Evidência do prompt 00 — 28/10/2026

A CLI de memória de trabalho foi implementada e testada. Isso cobre o recorte explícito de registro manual, persistência, resumo do dia e retomada por checkpoint. Não marca a fundação contínua (módulo 01) nem a memória compartilhada (módulo 05) como concluídas: não há serviço, agenda, conectores nem edição de memória.

Evidência: [relatório](../../cursror-dev/execucoes/2026-10-28-001-prompt-00.md) e [ADR 0003](../arquitetura/decisoes/0003-persistencia-sqlite-cli.md). Comandos de verificação e a falha corrigida de criação concorrente estão nesse relatório. Agenda, início do dia com fontes externas e o bot de review continuam planejados.

## Evidência do prompt 11 — 29/10/2026

A CLI responde em texto sobre pendências, o resumo de uma data explícita e o último checkpoint. A consulta reutiliza o SQLite e os casos de uso do prompt 00, é somente leitura e separa os dados consultados da resposta do modelo. O provedor padrão é um simulador identificado. O adaptador HTTP configurável foi testado com falhas controladas. Não houve modelo local disponível, então a integração real permanece pendente.

Isso não conclui o módulo 02 nem acrescenta voz, agenda, escrita de registros por IA ou delegação. Evidência: [relatório](../../cursror-dev/execucoes/2026-10-29-001-prompt-11.md), [ADR 0005](../arquitetura/decisoes/0005-conversa-texto-e-provedor.md) e [guia da conversa](../operacao/conversa.md).

## Evidência do prompt 12 — 29/10/2026

A máquina foi inspecionada e o Ollama foi escolhido como motor local do adaptador HTTP. O candidato `qwen3.5:9b` em Q4_K_M, pacote de 7,6 GB, ainda não foi baixado: a autorização foi pedida antes do download. Os testes automáticos continuam no simulador. A avaliação real fica em `npm run validar-llm` e só vale depois que o endpoint responder. Evidência: [relatório](../../cursror-dev/execucoes/2026-10-29-002-prompt-12.md) e [ADR 0007](../arquitetura/decisoes/0007-ollama-qwen35-9b.md).

## Evidência do prompt 13 — 01/11/2026

O critério de `npm run validar-llm` foi corrigido antes de qualquer execução com modelo. A aprovação automática agora separa consulta, referências e resposta final, compara o estado lógico dos registros e declara que a VRAM observada e a RAM do host não são medidas exclusivas do modelo. A revisão humana continua necessária. Nenhum modelo foi baixado e a validação real permanece pendente. Evidência: [relatório](../../cursror-dev/execucoes/2026-11-01-001-prompt-13.md).

## Evidência do prompt 14 — 02/11/2026

A primeira camada de política, aprovação de uso único, auditoria e executor falso foi implementada e testada. A conversa permanece somente leitura. A inspeção do mesmo dia não encontrou motor local, então a avaliação real não rodou e nenhum modelo foi baixado. Esta evidência não significa que o Debian ou o Windows estejam isolados. Guia: [governanca](../operacao/governanca.md). Relatório: [prompt 14](../../cursror-dev/execucoes/2026-11-02-001-prompt-14.md). Decisão: [ADR 0008](../arquitetura/decisoes/0008-politica-e-aprovacao.md).

## Evidência do prompt 15 — 02/11/2026

A rotina local ganhou volume verificável, cópia consistente do SQLite, fila que solta o lock durante a tarefa, agenda sintética com lembrete sem modelo e importação de transcrição em texto. A consulta `consultar_reuniao` passa pela política e não executa o texto importado. A inspeção do mesmo dia não encontrou motor local; nenhum modelo foi baixado e a avaliação real não rodou. Nenhum calendário externo foi autenticado e nenhum serviço permanente foi instalado.

Isso não conclui os módulos 01, 02, 03, 04 ou 07. Cobre o recorte testado com fixture. Evidência: [relatório](../../cursror-dev/execucoes/2026-11-02-003-prompt-15.md). Decisões: [0009](../arquitetura/decisoes/0009-volume-e-backup-sqlite.md), [0010](../arquitetura/decisoes/0010-servico-e-fila.md), [0011](../arquitetura/decisoes/0011-agenda-sintetica.md) e [0012](../arquitetura/decisoes/0012-importacao-de-reuniao.md).

## Evidência do prompt 16 — 03/11/2026

O laço de voz espera o nome, responde e volta a esperar, com a conversa de leitura já existente. A prova é de fixtures rotuladas. Nenhum detector foi confirmado com a palavra falada “MOAH”, e o microfone não foi aberto. O módulo 08 continua planejado. Evidência: [relatório](../../cursror-dev/execucoes/2026-11-03-001-prompt-16.md) e [ADR 0013](../arquitetura/decisoes/0013-voz-por-nome.md).

## Referência externa — Pestinha, 03/11/2026

O [levantamento](../arquitetura/avaliacao-pestinha.md) separa estudos imediatos e exploração futura. A prioridade permanece validar o recorte do prompt 15 e avançar para modelo real, agenda de leitura e rotina supervisionada. Contexto real do desktop, painel, avatar e personalidade são propostas futuras, sem implementação ou permissão de coleta concedida por este registro. Nenhuma tecnologia vigente foi substituída.
