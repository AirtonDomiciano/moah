# Armazenamento

O código fica no repositório. Os dados privados ficam fora do Git.

| Dado | Onde |
| --- | --- |
| Banco e estado operacional | `$MOAH_DATA_DIR/moah.sqlite`, ou `$XDG_DATA_HOME/moah`, ou `~/.local/share/moah` |
| Documentos e transcrições | `storage.documentsDir`, absoluto |
| Artefatos derivados | `storage.derivedDir`, absoluto; a análise atual também fica no banco |
| Modelos | `llm.modelsDir` ou `MOAH_LLM_MODELS_DIR` |
| Backup | o diretório passado em `armazenamento backup --destino`, ou `storage.backupDir` como documentação do destino |

`storage.volume` pede `mount` e, quando conhecido, `uuid`. `moah armazenamento verificar` compara `/proc/mounts` e `/dev/disk/by-uuid` no Linux. UUID diferente ou volume desmontado produz diagnóstico e não cria outra árvore. Em outro sistema a verificação informa que `/proc/mounts` não se aplica.

```bash
moah armazenamento verificar
moah armazenamento backup --destino /caminho/absoluto
moah armazenamento restaurar --arquivo /caminho/moah-backup.sqlite --destino /diretorio/vazio
moah armazenamento previa --destino /diretorio/vazio
moah armazenamento migrar --destino /diretorio/vazio --confirmar sim
```

A migração não apaga a origem e não altera `MOAH_DATA_DIR`. Se o destino está no mesmo dispositivo, a mensagem avisa que a cópia não protege contra perda física do SSD. Nenhum dado real foi migrado nesta entrega.

Decisão: [ADR 0009](../arquitetura/decisoes/0009-volume-e-backup-sqlite.md).
