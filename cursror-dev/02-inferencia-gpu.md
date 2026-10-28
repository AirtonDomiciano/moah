# Módulo 02 — Inferência local e uso da GPU

Estado: planejado. Dependências em [README](README.md).

## Prompt para o Cursor

Você está no repositório MOAH de Airton. Leia AGENTS.md, docs/produto/historico.md, docs/arquitetura/visao-geral.md e cursror-dev/README.md. Execute somente este módulo.

### Objetivo

Implementar adaptador de inferência local independente do restante do MOAH.

### Trabalho

Inventariar GPU, VRAM, RAM e drivers sem pressupor modelo. Comparar opções locais adequadas e registrar decisão antes de baixar pesos grandes. Criar interface para runtime, timeout, cancelamento, limite de concorrência e contexto. Implementar carregamento/descarregamento quando suportado e modo jogo explícito. Não alterar drivers nem treinar modelos. Usar mock nos testes.

### Critérios de aceite

Informar backend e disponibilidade sem inventar aceleração; serviço e agenda sobrevivem à falha da inferência; modo jogo libera recursos conforme capacidades medidas; medir latência e memória em uma solicitação real quando o ambiente permitir.

### Entrega

Implementar apenas após inspecionar o ambiente e o código existente. Adicionar testes de comportamento apropriados, documentação de configuração e execução, exemplos sem segredos e registro dos resultados reais. Informar dependências faltantes e decisões propostas. Não marcar integrações simuladas como prontas. Não avançar automaticamente para o próximo módulo.

### Refinamento de 28/10/2026

Hardware informado: RTX 5070 de 12 GB no Debian 13. Confirmar capacidade observada no ambiente; CPU/RAM ainda não informadas. Implementar orçamento de contexto e fila compartilhada entre papéis lógicos. Vários agentes não exigem modelos residentes diferentes. Coleta de métricas e agenda não devem depender da GPU. Incluir diagnóstico do próprio MOAH e descarregamento conforme política configurada; detalhamento em ../docs/arquitetura/agentes-e-memoria.md e ../docs/produto/roadmap.md.
