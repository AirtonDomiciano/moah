# Módulo 03 — Gmail e calendário

Estado: planejado. Dependências em [README](README.md).

## Prompt para o Cursor

Você está no repositório MOAH de Airton. Leia AGENTS.md, docs/contexto-e-decisoes.md, docs/arquitetura.md e cursror-dev/README.md. Execute somente este módulo.

### Objetivo

Criar conectores de leitura e normalização de compromissos.

### Trabalho

Definir interfaces e implementar OAuth com escopos mínimos de leitura, consentimento e revogação documentados. Guardar tokens fora do Git. Sincronizar incrementalmente com cursores persistentes, paginação, renovação de token e backoff. Calendário fornece eventos estruturados; Gmail identifica convites e contexto. Preservar IDs de origem para correlação; extração de texto não confirma reunião automaticamente. Tratar fuso, recorrência, exceções, mudança e cancelamento.

### Critérios de aceite

Com fixtures sintéticas, processar duas páginas sem perder itens; sincronizar novamente sem duplicar; tratar token revogado e limite de API; distinguir convite de evento confirmado. Nenhuma escrita, envio ou aceite é realizado.

### Entrega

Implementar apenas após inspecionar o ambiente e o código existente. Adicionar testes de comportamento apropriados, documentação de configuração e execução, exemplos sem segredos e registro dos resultados reais. Informar dependências faltantes e decisões propostas. Não marcar integrações simuladas como prontas. Não avançar automaticamente para o próximo módulo.
