# Módulo 06 — Diretor e agentes por empresa

Estado: planejado. Dependências em [README](README.md).

## Prompt para o Cursor

Você está no repositório MOAH de Airton. Leia AGENTS.md, docs/contexto-e-decisoes.md, docs/arquitetura.md e cursror-dev/README.md. Execute somente este módulo.

### Objetivo

Implementar coordenação explícita entre MOAH diretor, CTO Imex, CTO Aluai e auxiliares.

### Trabalho

Definir contrato de tarefa: ID, contexto, objetivo, permissão, entradas, responsável, estado e resultado. Criar registro de agentes, roteamento, timeout e cancelamento. Estados devem cobrir pendente, em execução, bloqueada, concluída e falha. Inicialmente simular CTOs; não inventar serviços existentes. Manter PRAN como auxiliar especializado sem forçar subordinação a uma empresa. Reduzir chamadas simultâneas na GPU.

### Critérios de aceite

Tarefa Imex não consulta memória Aluai; falha do auxiliar chega ao diretor com diagnóstico; resultado depende de evidência; reinício não reexecuta ação externa; conteúdo de e-mail não concede permissão de ferramenta.

### Entrega

Implementar apenas após inspecionar o ambiente e o código existente. Adicionar testes de comportamento apropriados, documentação de configuração e execução, exemplos sem segredos e registro dos resultados reais. Informar dependências faltantes e decisões propostas. Não marcar integrações simuladas como prontas. Não avançar automaticamente para o próximo módulo.
