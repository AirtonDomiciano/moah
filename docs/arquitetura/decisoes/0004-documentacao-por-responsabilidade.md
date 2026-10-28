# ADR 0004 — Documentação por responsabilidade

Data: 28/10/2026. Estado: aceita. Substitui a organização da ADR 0002.

## Contexto

Airton pediu uma estrutura fácil de ler, com responsabilidades separadas. A adaptação em muitas categorias do imex-arch ficou maior que o necessário para o estágio do MOAH.

## Decisão

Organizar docs em quatro áreas:
- Produto: objetivos, exemplos, conceitos e roadmap.
- Arquitetura: componentes, contratos, tecnologias e decisões.
- Desenvolvimento: processo, padrões, limites e procedimentos.
- Operação: execução, métricas e lições.

docs/README.md é o índice único. Remover o catálogo separado e as pastas numeradas. Mover conteúdo relevante e atualizar referências em documentos, prompts e contratos. Preservar histórico de decisões e evidências, sem mudar resultados registrados.

Prompts continuam em cursror-dev; relatórios em execucoes. Não mudar código nem runtime nesta reorganização.

## Consequências

Menos categorias para navegar, sem misturar responsabilidades. Links externos para caminhos antigos podem precisar de atualização; o Git preserva versões anteriores. Referências internas devem ser verificadas. Conteúdo histórico pode descrever a organização antiga, identificado como decisão substituída.
