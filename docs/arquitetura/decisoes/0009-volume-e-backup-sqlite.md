# ADR 0009 — Volume configurável e cópia consistente do SQLite

- Data: 02/11/2026
- Estado: aceita para o recorte local; nenhum dado real foi migrado
- Origem: pedido de Airton para separar código e dados e identificar o SSD sem tratar uma pasta existente como prova

## Contexto

O banco continua em `MOAH_DATA_DIR`, com o fallback XDG já usado pela CLI. O prompt 12 propôs `/media/projetos/models/ollama` para pesos, via `llm.modelsDir`. Nesta máquina `/media/projetos` é um volume `fuseblk`, distinto da raiz ext4. A pasta existir não diz qual disco está montado.

## Decisão

- `config.json` aceita `storage.volume` com `mount`, `uuid` e `label`, além de `documentsDir`, `derivedDir` e `backupDir`, todos absolutos. Sem `volume`, o banco segue o diretório de dados e nada é criado em outro disco.
- A verificação lê a tabela de montagem e compara o UUID do dispositivo. Falha de montagem ou UUID diferente impede backup, migração e importação que dependam desse volume. Não há diretório alternativo silencioso.
- A cópia usa `backup()` do `node:sqlite`, que tira um snapshot consistente, inclusive com WAL. A restauração só grava em diretório vazio. A migração exige prévia e `--confirmar sim`, confere a contagem e não apaga a origem nem troca `MOAH_DATA_DIR`.
- Se origem e destino têm o mesmo `dev`, a CLI avisa que a cópia não protege contra perda física do SSD.

## Alternativas

- Copiar o arquivo `moah.sqlite` com `cp`: pode pegar um WAL incompleto.
- Assumir `/media/projetos` como SSD fixo: quebra quando o volume não está montado e mistura esta máquina com outro SO.

## Consequências

A verificação de UUID usa `/proc/mounts` e `/dev/disk/by-uuid`. Em outro SO ela falha de forma explícita. Não houve migração da memória real do usuário.
