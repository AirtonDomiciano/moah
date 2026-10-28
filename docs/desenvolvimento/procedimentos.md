# Playbooks — procedimentos reproduzíveis

## Iniciar a primeira entrega

1. Abrir o repositório MOAH no Cursor e atualizar o checkout preservando alterações locais.
2. Ler AGENTS, docs/README, ADR 0001 e catálogo de prompts.
3. Executar somente [prompt 00](../../cursror-dev/00-bootstrap-typescript.md).
4. Verificar comandos e critérios do prompt com dados sintéticos.
5. Registrar resultado usando [modelo de execução](../../cursror-dev/execucoes/MODELO.md).
6. Revisar diff, atualizar estado e registrar commit quando autorizado.

## Executar a CLI de memória

Comandos verificados em 28/10/2026, a partir da raiz do repositório, com Node 22.23.3:

```bash
npm install
npm run typecheck
npm run build
npm test
npm run moah -- ajuda
```

A gramática e um exemplo sintético estão no [README](../../README.md#cli-de-memória-de-trabalho). Para não usar o diretório real do usuário, defina `MOAH_DATA_DIR` e `MOAH_CONFIG_DIR` em pastas temporárias. Não altere `HOME` para isso.

## Registrar nova capacidade

Identificar objetivo → consultar domínio e regras → escrever prompt delimitado → definir aceite → implementar → validar → documentar resultado. Não criar automaticamente agente/serviço para cada ideia.

## Registrar uma decisão

Consultar ADR existente; criar nova se mudar arquitetura, com contexto, alternativas e consequências. Atualizar catálogo e radar quando afetados. Se substituir decisão, preservar a anterior com vínculo.

A execução local da CLI está na seção acima. Backup, restauração, diagnóstico e recuperação continuam sem procedimento: ainda não há comandos desses fluxos testados.
