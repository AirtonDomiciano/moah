# Módulo 05 — Memória, decisões e continuidade

Estado: planejado. Dependências em [README](README.md).

## Prompt para o Cursor

Você está no repositório MOAH de Airton. Leia AGENTS.md, docs/contexto-e-decisoes.md, docs/arquitetura.md e cursror-dev/README.md. Execute somente este módulo.

### Objetivo

Criar armazenamento de contexto compartilhável entre MOAH, Airton, ChatGPT e Cursor.

### Trabalho

Definir registros de ideia, decisão, tarefa, resumo e preferência com ID, origem, data, contexto e revisão. Separar pessoal, Imex e Aluai. Oferecer importação/exportação Markdown e busca inicial simples; embeddings são opcionais após demonstrar necessidade. Não presumir acesso automático às conversas do ChatGPT ou Cursor. Registrar importações explícitas e revisão. Avaliar claude-mem apenas como referência futura, sem dependência ou cópia automática. Prever correção, exclusão e backup.

### Critérios de aceite

Recuperar decisão com origem; corrigir sem manter versão antiga como atual; isolar empresas; exportar e reimportar sem duplicar; impedir segredos em exportação pública. Explicar exatamente como cada ferramenta fornece contexto.

### Entrega

Implementar apenas após inspecionar o ambiente e o código existente. Adicionar testes de comportamento apropriados, documentação de configuração e execução, exemplos sem segredos e registro dos resultados reais. Informar dependências faltantes e decisões propostas. Não marcar integrações simuladas como prontas. Não avançar automaticamente para o próximo módulo.

### Refinamento de 28/10/2026

Implementar memória executiva, por área, por especialista e estado operacional conforme ../docs/contratos-agentes.md. Especialista mantém detalhes; diretor recebe resumo com referências e atualidade. Suportar consulta seletiva, atualização e invalidação de resumo antigo. Sessão de inglês registra estudo útil, não exige gravação de áudio. Checkpoints sustentam “paramos aonde?”. Validar correção e remoção de dados derivados conforme política de retenção.
