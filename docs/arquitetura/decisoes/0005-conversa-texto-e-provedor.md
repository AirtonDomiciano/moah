# ADR 0005 — Conversa por texto e provedor de modelo

- Data: 29/10/2026
- Estado: aceita para o contrato e o simulador; validação com modelo real pendente
- Origem: pedido de Airton para consultar a memória de trabalho em linguagem natural

## Contexto

A CLI do prompt 00 já persiste atividades, reuniões, pendências e checkpoints em SQLite. Esta entrega acrescenta uma conversa de leitura sobre esses registros. O módulo 02, de inferência local com GPU e fila, continua planejado.

Em 29/10/2026 a inspeção desta máquina não encontrou motor para reutilizar: `ollama`, `llama-server` e `llama-cli` ausentes no PATH; nenhuma variável `OLLAMA_`, `OPENAI_`, `MOAH_LLM` ou `LMSTUDIO`; conexão recusada em `127.0.0.1` nas portas 11434, 8080, 1234, 8000 e 3000; `docker ps` sem contêineres em execução. Nenhum modelo foi baixado e nenhum driver foi alterado.

## Decisão

- O contrato `LlmProvider` expõe uma conclusão com mensagens, ferramentas e cancelamento.
- O único adaptador de rede desta entrega fala o formato HTTP de chat completions em `{baseUrl}/chat/completions`. Endereço, modelo e timeout são configuráveis. A chave, se existir, vem só de `MOAH_LLM_API_KEY` e não entra em arquivo, log ou mensagem de erro.
- O provedor padrão é o simulador `moah-simulator`. Ele se identifica na resposta. Uma falha do adaptador HTTP não cai em silêncio para o simulador.
- A coordenação oferece três ferramentas: pendências, resumo de data explícita e último checkpoint. O domínio e o projeto da sessão ficam fora dos argumentos que o modelo pode escolher. As ferramentas chamam os casos de uso já existentes e devolvem no máximo 20 itens, com texto cortado.
- A conversa não grava, não conclui e não persiste o diálogo. Os comandos da CLI anteriores não exigem modelo.

## Alternativas

- Instalar Ollama, llama.cpp ou pesos de modelo nesta entrega: rejeitado. Exigiria download ou mudança de ambiente sem medição.
- Enviar a memória a uma API externa: rejeitado. Não havia chave configurada, e o conteúdo sairia da máquina.
- Banco vetorial, framework multiagente ou microserviço: rejeitado para este recorte.
- Deixar o modelo executar SQL, shell ou leitura livre de arquivos: rejeitado.

## Consequências

A conversa pode ser testada sem modelo. Trocar o motor é configurar o adaptador HTTP, sem reescrever as ferramentas. A qualidade das respostas reais continua desconhecida até uma execução com modelo disponível e relatório próprio. Ollama e llama.cpp seguem em avaliação no radar. O módulo 02 não fica concluído.

Validação desta decisão: testes do simulador, do adaptador com respostas falsas e de um endereço local fechado. Não houve demonstração com modelo real.
