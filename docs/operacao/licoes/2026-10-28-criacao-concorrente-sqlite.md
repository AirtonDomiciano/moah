# Duas aberturas simultâneas do SQLite falharam na criação do arquivo

- Data: 28/10/2026. Contexto: prompt 00, CLI de memória de trabalho, Node 22.23.3, `node:sqlite`.
- Sintoma: duas invocações paralelas de `registrar atividade` terminaram com `database is locked` e código 3. Um dos registros não foi gravado. A suíte acusou 1 falha em 19 testes.
- Impacto: limitado à execução de teste. Nenhum dado de usuário estava no diretório temporário.
- Evidência: saída do `node --test` antes da correção; o mesmo teste passou depois, exigindo os textos "Gravação A" e "Gravação B".
- Causa confirmada: os dois processos criavam `moah.sqlite` ao mesmo tempo. O `busy_timeout` de 5 segundos não chegou a esperar; o erro voltou em dezenas de milissegundos. Com um processo já segurando `BEGIN IMMEDIATE`, o segundo espera o timeout, como verificado num script à parte.
- Correção: lock exclusivo `moah.sqlite.lock` durante cada operação da CLI, com espera de até 5 segundos e remoção do lock se o processo dono não existe. WAL e `BEGIN IMMEDIATE` continuam no SQLite.
- Validação: `node --disable-warning=ExperimentalWarning --test dist/tests/*.test.js` em 28/10/2026, 19 testes, 0 falhas.
- Prevenção: teste de duas invocações paralelas em `tests/cli.acceptance.test.ts`. ADR [0003](../../arquitetura/decisoes/0003-persistencia-sqlite-cli.md).
