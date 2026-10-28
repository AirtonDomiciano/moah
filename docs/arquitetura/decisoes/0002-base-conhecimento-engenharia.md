# ADR 0002 — Base de conhecimento de engenharia por categorias

Data: 28/10/2026. Estado: substituída pela ADR 0004 para organização documental; histórico preservado.

## Contexto

Airton forneceu a estrutura docs do imex-arch e pediu extrair uma organização semelhante para o MOAH, mantendo prompts e decisões rastreáveis.

## Decisão

Adotar catálogo, governança, radar, ADRs, guidelines, anti-padrões, guardrails, playbooks, lições, métricas e domínio com README e orientação de agentes. Conteúdo inicial proporcional ao estágio do projeto; sem replicar subpastas empresariais ou métricas que não existem.

ADRs em docs/arquitetura/decisoes. Prompts existentes em cursror-dev, com relatórios em execucoes. Preservar caminhos dos documentos anteriores, indexando-os como fontes canônicas. Criar docs/README e docs/AGENTS para navegação.

## Alternativas e consequências

Uma pasta única seria mais simples, mas dificultaria distinguir regras, decisões e procedimentos. Copiar integralmente imex-arch incluiria conceitos não pertinentes e possível conteúdo privado. Esta adaptação usa exclusivamente a descrição fornecida e os requisitos do MOAH.

Mais categorias exigem catálogo atualizado. Não duplicar documentos nem criar arquivos vazios. Memória de reuniões/estudo não vai para esta base pública.

## Validação

Verificar links internos, coexistência com documentos existentes e instruções do prompt 00. Registro de estrutura não é resultado de execução do Cursor.

Organização vigente: [ADR 0004](0004-documentacao-por-responsabilidade.md).
