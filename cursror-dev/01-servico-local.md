# Módulo 01 — Base e serviço contínuo

Estado: planejado. Dependências em [README](README.md).

## Prompt para o Cursor

Você está no repositório MOAH de Airton. Leia AGENTS.md, docs/contexto-e-decisoes.md, docs/arquitetura.md e cursror-dev/README.md. Execute somente este módulo.

### Objetivo

Criar a fundação local do MOAH sem conectores reais nem dependência de modelo.

### Trabalho

Inspecionar Debian, Python e recursos disponíveis. Propor stack mínima; Python e SQLite são candidatos. Separar configuração, estado, tarefas e logs. Criar início e parada limpos, saúde, migrações e fila persistente. Fornecer exemplo de serviço systemd sem instalar automaticamente no host. Documentar fuso configurável, diretórios privados e backup.

### Critérios de aceite

Reiniciar e recuperar tarefa pendente sem duplicação; configuração inválida tem diagnóstico; parada limpa; logs não expõem segredos. Demonstrar instalação e remoção do serviço com comandos revisados.

### Entrega

Implementar apenas após inspecionar o ambiente e o código existente. Adicionar testes de comportamento apropriados, documentação de configuração e execução, exemplos sem segredos e registro dos resultados reais. Informar dependências faltantes e decisões propostas. Não marcar integrações simuladas como prontas. Não avançar automaticamente para o próximo módulo.
