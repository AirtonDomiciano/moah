# Serviço local

O serviço reutiliza o mesmo banco da CLI. Cada reserva e cada conclusão abrem o SQLite, gravam e soltam o lock. O tratador da tarefa roda fora desse lock, então a CLI pode gravar durante o trabalho.

```bash
moah servico saude
moah servico enfileirar --tipo eco --chave exemplo-sintetico
moah servico processar
moah servico recuperar
moah servico iniciar
moah servico parar
```

`processar` executa no máximo uma tarefa e termina. `parar` grava `moah.service.stop` e remove o pid. O sinal permanece, e `processar` não reserva outra tarefa enquanto ele existir. `iniciar` apaga esse sinal. `recuperar` marca como `incerta` a tarefa que estava `executando` quando o processo caiu. Ela não vira sucesso sozinha. A mesma `--chave` devolve a tarefa já gravada. Cancelar vale para `pendente` e `executando` e não reescreve uma tarefa já concluída.

O tipo `eco` não chama shell, rede, arquivo de usuário nem agenda. A fila não promete efeito externo exatamente uma vez.

Não há porta de rede. O arquivo `moah.service.pid` no diretório de dados só indica o processo que chamou o início; esta entrega não fica em laço permanente.

## Debian

Exemplo, não instalado:

```ini
[Service]
Type=oneshot
Environment=MOAH_DATA_DIR=/caminho/privado/moah
ExecStart=/usr/bin/node /caminho/do/moah/dist/src/cli/main.js servico processar
```

Copiar essa unidade para o systemd e habilitá-la fica para uma autorização específica.

## Windows

O Agendador de Tarefas pode chamar o mesmo `servico processar`. Nenhuma tarefa foi criada. A verificação de volume por `/proc/mounts` não vale no Windows; nesse SO o comando de volume falha com diagnóstico, sem criar diretório substituto.

Decisão: [ADR 0010](../arquitetura/decisoes/0010-servico-e-fila.md).
