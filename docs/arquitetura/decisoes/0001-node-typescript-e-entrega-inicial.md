# ADR 0001 — Núcleo em Node.js com TypeScript e primeira entrega CLI

Data: 28/10/2026. Estado: aceita. O recorte da CLI foi implementado no prompt 00; ver [ADR 0003](0003-persistencia-sqlite-cli.md). Os módulos 01 e 05 não estão concluídos.

## Contexto e origem

Airton quer desenvolver no ecossistema JavaScript por sua experiência e pós em JS, e pediu um prompt inicial com histórico organizado de prompts e decisões. A documentação anterior apresentava Python como candidato, sem decisão definitiva.

O valor inicial é continuidade para sua rotina de Tech Lead: registrar o que fez, reuniões relatadas, decisões, ações e ponto de retomada. Voz e IA não precisam bloquear esse primeiro resultado.

## Decisão

Usar Node.js com TypeScript no núcleo do MOAH. A escolha de TypeScript implementa a direção JS discutida, acrescentando contratos explícitos. Versão LTS, bibliotecas e driver dependem da inspeção e verificação atual pelo implementador.

Começar com CLI local e memória de trabalho persistente: registros, pendências, checkpoint e resumo diário determinístico. SQLite é a proposta preferida, a ser validada e documentada. Não implementar tudo do serviço contínuo ou do módulo de memória de uma vez.

O prompt 00 entrega um recorte dos módulos 01 e 05. Depois, retomar serviço contínuo, agenda e demais dependências conforme roadmap. A sequência anterior que exigia concluir 01–04 antes de qualquer memória é refinada por este recorte explícito.

Manter cursror-dev como catálogo de prompts; execucoes como histórico de execuções; docs/arquitetura/decisoes como ADRs. Nenhuma execução retroativa será inventada.

## Alternativas

- Python no núcleo: proposta anterior, não escolhida para esta fase.
- JavaScript sem tipos: possível, mas TypeScript facilita contratos entre áreas e ferramentas.
- Chat com modelo como primeira entrega: adiado para validar registros e continuidade sem depender de inferência.
- Treinamento de modelo próprio do zero: fora do plano inicial.

## Consequências

Tipos e validação em runtime precisam coexistir; TypeScript não valida argumentos da CLI sozinho. Serviço e integrações ainda precisam ser implementados. IA será um adaptador substituível, não o armazenamento da memória.

Launcher e especialistas em Python ou outras linguagens podem permanecer nos seus projetos. Agents será o diretório de projetos de agentes mantido por Airton; localização configurável, não importação automática nem execução de todas as pastas. O caminho absoluto dessa pasta deve ser confirmado na implementação.

## Validação

Direção registrada por pedido do usuário. A execução do prompt 00, em 28/10/2026, implementou o recorte da CLI e registrou versão, driver e testes na ADR 0003 e no relatório de execução. Esta ADR não passa a declarar o serviço contínuo nem o módulo de memória como prontos.
