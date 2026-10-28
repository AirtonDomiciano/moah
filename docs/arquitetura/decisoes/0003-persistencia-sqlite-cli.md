# ADR 0003 — Persistência SQLite da CLI e runtime Node 22

Data: 28/10/2026. Estado: aceita para o recorte do prompt 00. Não conclui os módulos 01 e 05.

## Contexto

O prompt 00 pede uma CLI local em Node.js com TypeScript strict, persistência SQLite e inspeção do driver no Node disponível. A ADR 0001 tinha deixado versão, gerenciador e driver para essa inspeção.

No ambiente da execução havia Node 22.23.3 (npm 10.9.9) instalado. O calendário oficial em [nodejs/Release](https://github.com/nodejs/Release) lista 22.x como Maintenance LTS até 2027-04-30. Node 24 segue em LTS e Node 26 entrou em LTS no próprio dia 28/10/2026; nenhum dos dois estava instalado nem foi exercitado.

`node:sqlite` respondeu neste Node com `DatabaseSync`, SQLite 3.51.3 e a opção `timeout`. A documentação da linha 22 ainda classifica o módulo como experimental: [SQLite em Node.js 22](https://nodejs.org/docs/latest-v22.x/api/sqlite.html). A opção de timeout existe desde 22.16.0.

## Decisão

Fixar a CLI em Node.js `>=22.16.0 <23`, TypeScript strict e npm, com `package-lock.json`. O binário verificado foi 22.23.3; a máquina não foi atualizada para o patch 22.23.4 publicado em 21/10/2026.

Usar `node:sqlite` / `DatabaseSync` como driver. Abrir o arquivo em WAL, com `busy_timeout` de 5 segundos, chaves estrangeiras e migração versionada em `schema_migrations`. Gravações de registro e conclusão de ação entram em `BEGIN IMMEDIATE` e sofrem `ROLLBACK` se a operação falha.

Serializar invocações com um lock exclusivo ao lado do banco (`moah.sqlite.lock`), espera máxima de 5 segundos e descarte de lock cujo processo não existe mais. Isso cobre a corrida observada ao criar o arquivo: duas aberturas simultâneas falhavam com `database is locked` sem esperar o timeout.

Guardar instantes em ISO 8601 UTC e apresentá-los no fuso de `config.json`, padrão `America/Sao_Paulo`. Dados em diretório XDG de dados; configuração em XDG de config. `MOAH_DATA_DIR` e `MOAH_CONFIG_DIR` injetam diretórios sem alterar `HOME`.

## Alternativas

- Node 26, LTS a partir de 28/10/2026: não estava instalado. A API de SQLite dessa linha renomeia `DatabaseSync` para `Database`. Fica fora do requisito fixado até haver uma execução própria.
- `better-sqlite3`: API estável e madura, com compilação nativa. Não foi necessário porque o módulo embutido abriu, gravou e leu o banco neste Node.
- JSON por arquivo: rejeitado. Duas invocações substituiriam o snapshot inteiro.
- pnpm: não estava instalado. Yarn 1.22 estava presente; npm acompanha o Node verificado e produz o lockfile usado aqui.
- Serviço ou fila nesta entrega: continuam fora do recorte.

## Consequências

A CLI depende de uma API experimental na linha 22. Uma mudança incompatível do `node:sqlite` exige outra ADR e pode migrar o repositório para `better-sqlite3` sem alterar os casos de uso. Node 24 e 26 não estão no `engines`.

O lock impede perda de registros entre processos, à custa de serializar também as leituras. Acima de 5 segundos de espera, o comando falha e o banco anterior permanece.

O esquema versão 1 não tem edição nem exclusão. Correção de memória continua pendente.

## Validação

Testes automatizados e a demonstração com diretório temporário estão no [relatório de 28/10/2026](../../../cursror-dev/execucoes/2026-10-28-001-prompt-00.md). A primeira tentativa de duas gravações paralelas falhou com `database is locked`; o lock e o teste que exige os dois textos passaram na execução final.
