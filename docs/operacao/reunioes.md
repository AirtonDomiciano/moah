# Importação de reunião

A primeira versão lê um arquivo de texto autorizado. Não captura áudio e não depende do Fathom.

```text
fonte: reuniao-sintetica
versao: 1
dominio: pessoal
projeto: moah
data: 2026-11-02
participantes: Ana; Bruno

---
Texto da transcrição.
```

`projeto`, `data` e `participantes` podem faltar. O importador não inventa esses campos. Quebra de linha CRLF ou CR é normalizada antes da leitura.

```bash
moah reuniao importar --arquivo /caminho/transcricao.txt
moah reuniao ver --id reu_... --dominio pessoal
```

Com `storage.documentsDir`, o caminho real do arquivo precisa ficar dentro desse diretório. A mesma fonte e versão no mesmo domínio não gera outra análise. Uma versão nova conserva a anterior e marca a análise válida antiga como substituída.

A análise pede JSON ao adaptador de LLM. Sem modelo real, ou com o simulador, o estado fica `pendente`. Um teste pode injetar uma resposta controlada; isso não é a avaliação do prompt 12. JSON inválido fica `invalida`. O resumo válido é marcado como gerado por IA e `analiseRealValidada` permanece falso. Regra com `confirmada: false` é proposta relatada, não decisão de Airton. Ação extraída aparece como candidata e não vira tarefa, aprovação ou comando.

`consultar_reuniao` só aceita o id. O domínio é o da sessão. Outro domínio não recebe o texto. O conteúdo recuperado continua sendo dado, não instrução.

Decisão: [ADR 0012](../arquitetura/decisoes/0012-importacao-de-reuniao.md).
