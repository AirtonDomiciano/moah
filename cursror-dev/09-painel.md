# Módulo 09 — Painel operacional

Estado: planejado. Dependências em [README](README.md).

## Prompt para o Cursor

Você está no repositório MOAH de Airton. Leia AGENTS.md, docs/contexto-e-decisoes.md, docs/arquitetura.md e cursror-dev/README.md. Execute somente este módulo.

### Objetivo

Criar interface simples para acompanhar e controlar o MOAH.

### Trabalho

Mostrar próximas reuniões, alertas, última sincronização, tarefas por agente, contexto ativo, saúde e uso de inferência. Permitir modo jogo, pausa de conectores e consulta de memória com origem. Usar API do serviço; não duplicar regras de agenda no frontend. Priorizar localhost; acesso por rede exige autenticação e configuração explícita. Não exibir tokens ou dados de outras empresas no contexto selecionado.

### Critérios de aceite

Painel diferencia conector desatualizado de serviço ativo; modo jogo reflete estado real; falha de API tem feedback; mudança de contexto não vaza tarefas. Validar fluxo principal em navegador se houver ambiente.

### Entrega

Implementar apenas após inspecionar o ambiente e o código existente. Adicionar testes de comportamento apropriados, documentação de configuração e execução, exemplos sem segredos e registro dos resultados reais. Informar dependências faltantes e decisões propostas. Não marcar integrações simuladas como prontas. Não avançar automaticamente para o próximo módulo.
