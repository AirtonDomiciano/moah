# Playbooks — procedimentos reproduzíveis

## Iniciar a primeira entrega

1. Abrir o repositório MOAH no Cursor e atualizar o checkout preservando alterações locais.
2. Ler AGENTS, docs/README, ADR 0001 e catálogo de prompts.
3. Executar somente [prompt 00](../../cursror-dev/00-bootstrap-typescript.md).
4. Verificar comandos e critérios do prompt com dados sintéticos.
5. Registrar resultado usando [modelo de execução](../../cursror-dev/execucoes/MODELO.md).
6. Revisar diff, atualizar estado e registrar commit quando autorizado.

## Registrar nova capacidade

Identificar objetivo → consultar domínio e regras → escrever prompt delimitado → definir aceite → implementar → validar → documentar resultado. Não criar automaticamente agente/serviço para cada ideia.

## Registrar uma decisão

Consultar ADR existente; criar nova se mudar arquitetura, com contexto, alternativas e consequências. Atualizar catálogo e radar quando afetados. Se substituir decisão, preservar a anterior com vínculo.

Playbooks de instalação, backup/restauração, diagnóstico e recuperação serão acrescentados quando houver comandos realmente testados; não fornecer procedimentos operacionais fictícios.
