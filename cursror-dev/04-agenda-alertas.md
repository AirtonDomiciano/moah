# Módulo 04 — Agenda e notificações

Estado: planejado. Dependências em [README](README.md).

## Prompt para o Cursor

Você está no repositório MOAH de Airton. Leia AGENTS.md, docs/contexto-e-decisoes.md, docs/arquitetura.md e cursror-dev/README.md. Execute somente este módulo.

### Objetivo

Entregar o primeiro fluxo útil: lembrar calls mesmo sem IA disponível.

### Trabalho

Persistir eventos, versões e alertas. Tornar antecedências configuráveis; 15 e 5 minutos são proposta. Usar America/Sao_Paulo como configuração inicial. Tratar recorrência, cancelamento, reagendamento, conflito, horário silencioso e retomada após suspensão. Criar canal desktop inicial se adequado, com contrato para outros canais. Diferenciar tentativa, entrega e confirmação pelo usuário. Definir política de alertas vencidos e falha de entrega.

### Critérios de aceite

Relógio controlado nos testes prova aviso no momento certo, invalidação de alerta após mudança, ausência de aviso após cancelamento e deduplicação após reinício. Modelo desligado não bloqueia alerta. Documentar que PC desligado não entrega aviso local.

### Entrega

Implementar apenas após inspecionar o ambiente e o código existente. Adicionar testes de comportamento apropriados, documentação de configuração e execução, exemplos sem segredos e registro dos resultados reais. Informar dependências faltantes e decisões propostas. Não marcar integrações simuladas como prontas. Não avançar automaticamente para o próximo módulo.
