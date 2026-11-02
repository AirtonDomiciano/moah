# Conversa por texto

A conversa consulta a memória de trabalho já gravada pela CLI. Ela lê pendências, o resumo de uma data explícita e o último checkpoint. Não grava fatos, não conclui ações e não guarda o diálogo.

Decisão: [ADR 0005](../arquitetura/decisoes/0005-conversa-texto-e-provedor.md). Execução: [relatório do prompt 11](../../cursror-dev/execucoes/2026-10-29-001-prompt-11.md).

## Caminho de uma mensagem

1. `moah conversar` exige `--dominio pessoal`, `imex` ou `aluai`. `--projeto`, quando informado, fica fixo na sessão.
2. A configuração resolve o provedor: `config.json`, depois as variáveis `MOAH_LLM_*`, depois `--provedor`. Sem nada disso, usa o simulador.
3. A coordenação monta um pedido curto: instrução da sessão, até seis turnos anteriores só com o texto final, e a pergunta atual. O banco não vai inteiro.
4. O provedor devolve texto ou chamadas de ferramenta. As ferramentas aceitas são `consultar_pendencias`, `consultar_resumo` e `consultar_checkpoint`. `eco_sintetico` e os comandos de governança não entram nessa lista.
5. Cada chamada passa pela política com o domínio da sessão, definido pelo comando e não pelo modelo. Consulta concedida segue; ferramenta desconhecida ou bloqueada é negada e registrada na auditoria. A validação seguinte recusa chave estranha, outro projeto e data que não seja `AAAA-MM-DD`. A data `hoje`, `sexta` ou `amanhã` não é interpretada.
6. A ferramenta chama `listPending`, `summarizeDay` ou `findCheckpoint`. O resultado leva no máximo 20 itens, texto cortado em 400 caracteres e o aviso de que o conteúdo é dado, não instrução.
7. Há no máximo três chamadas por pergunta, salvo `llm.maxToolCalls` ou `MOAH_LLM_MAX_TOOL_CALLS` entre 1 e 8. O timeout padrão é 30 segundos, configurável de 100 a 120000.
8. A saída separa `Dados consultados` da `Resposta do modelo` e mostra os IDs usados. Se não houver registro, a consulta diz isso.
9. No terminal interativo, o histórico fica na memória até o processo sair. `/sair` encerra. `--texto` faz uma pergunta e termina. A conversa não é gravada.

Os comandos `registrar`, `listar`, `pendencias`, `concluir`, `checkpoint`, `onde-paramos` e `resumo` continuam iguais e não chamam modelo.

## Trocar e configurar o modelo

O adaptador real desta entrega é um cliente HTTP no formato de chat completions. Exemplo de `config.json`, com um endereço ilustrativo; nesta máquina esse endereço não estava em execução em 29/10/2026:

```json
{
  "timezone": "America/Sao_Paulo",
  "llm": {
    "provider": "openai-compatible",
    "baseUrl": "http://127.0.0.1:11434/v1",
    "model": "nome-do-modelo-local",
    "timeoutMs": 30000,
    "maxToolCalls": 3
  }
}
```

A URL precisa ser `http` ou `https`, sem usuário nem senha. Para uma chamada pontual:

```bash
moah conversar --dominio pessoal --provedor openai-compatible --texto "quais são as pendências?"
```

Variáveis, quando precisam sobrepor o arquivo: `MOAH_LLM_PROVIDER`, `MOAH_LLM_BASE_URL`, `MOAH_LLM_MODEL`, `MOAH_LLM_TIMEOUT_MS` e `MOAH_LLM_MAX_TOOL_CALLS`. `MOAH_LLM_API_KEY` só entra no cabeçalho `Authorization`. Não coloque a chave em `config.json`.

Para voltar ao simulador: `--provedor simulator` ou `"provider": "simulator"`.

`llm.modelsDir` ou `MOAH_LLM_MODELS_DIR` guardam o diretório absoluto dos pesos. Esse valor configura o motor; o adaptador HTTP não abre esses arquivos e o modelo não escolhe o caminho.

## Modelo local

A escolha registrada na [ADR 0007](../arquitetura/decisoes/0007-ollama-qwen35-9b.md) é o Ollama em `http://127.0.0.1:11434/v1`, com o candidato `qwen3.5:9b` (Q4_K_M, pacote de 7,6 GB). Em 29/10/2026 o motor e o modelo ainda não foram baixados.

Quando o binário existir, o servidor desta validação sobe no usuário, sem serviço permanente:

```bash
OLLAMA_MODELS=/media/projetos/models/ollama OLLAMA_HOST=127.0.0.1:11434 OLLAMA_CONTEXT_LENGTH=4096 ollama serve
```

O contexto 4096 é o padrão documentado pelo Ollama. A janela máxima de 256K do Qwen3.5 não deve ser usada nesta GPU de 12 GiB até uma medição própria.

A configuração correspondente da CLI:

```bash
export MOAH_LLM_PROVIDER=openai-compatible
export MOAH_LLM_BASE_URL=http://127.0.0.1:11434/v1
export MOAH_LLM_MODEL=qwen3.5:9b
export MOAH_LLM_MODELS_DIR=/media/projetos/models/ollama
export MOAH_LLM_TIMEOUT_MS=120000
```

A primeira carga pode passar de 30 segundos. Se o endpoint recusar ou estourar o tempo, a CLI termina com código 3 e a mensagem curta do adaptador. Ela não muda para o simulador.

Parar o servidor: encerrar o processo `ollama serve` dessa sessão. `ollama stop qwen3.5:9b` descarrega o modelo da memória e deixa o servidor no ar.

Os testes de `npm test` usam o simulador e respostas HTTP falsas. A avaliação com o modelo real é separada:

```bash
npm run validar-llm
```

Esse comando exige `MOAH_LLM_PROVIDER=openai-compatible`, cria registros sintéticos num diretório temporário e apaga esse diretório ao terminar. Sem o provedor real, ele para e não chama o simulador. A validação com modelo real continua pendente até a autorização de download do prompt 12.

O relatório marca `humanReviewRequired`. A aprovação automática separa a ferramenta chamada, as referências devolvidas e o texto final. Um identificador presente só nas linhas da ferramenta não aprova a resposta. Esclarecimento vazio ou irrelevante e ausência sem consulta são reprovados. O comando compara registros, decisões, ações, checkpoints e referências antes e depois, pelo conteúdo lógico, e confere o código e o JSON da releitura antes de usá-la.

Durante cada chamada, a VRAM do computador é amostrada a cada 250 ms. O maior valor é o máximo observado, não um pico garantido. `MemAvailable` antes e depois é a memória livre do host, não o consumo exclusivo do MOAH ou do modelo. Essa aprovação não substitui a leitura humana da resposta. O ajuste está no [relatório do prompt 13](../../cursror-dev/execucoes/2026-11-01-001-prompt-13.md).

## Diagnosticar

| Situação | O que aparece | Código |
| --- | --- | --- |
| Falta domínio, data ou projeto da sessão | Pergunta na resposta, sem consulta inválida | 0, ou 1 se a própria CLI rejeitar o comando |
| Modelo sem endereço ou nome | Mensagem pedindo `baseUrl` e `model` | 1 |
| Conexão recusada ou falha de rede | `Modelo indisponível. Verifique o endereço configurado.` | 3 |
| HTTP de erro | `O modelo respondeu HTTP <status>.` O corpo não é impresso | 3 |
| Tempo esgotado | `Tempo esgotado ao consultar o modelo.` | 3 |
| Cancelamento com Ctrl+C durante o pedido | `Consulta ao modelo cancelada.` | 1 na pergunta única; o terminal interativo continua |
| Limite de ferramentas | A resposta marca o limite e para novas chamadas | 0 |

A saída de erro não inclui texto de registro, prompt enviado nem credencial. O sucesso não escreve diagnóstico na saída de erro. Em JSON, `simulated: true` identifica o simulador. Uma resposta do simulador não valida o modelo real.
