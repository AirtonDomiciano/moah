# ADR 0007 — Motor local para validar a conversa

- Data: 29/10/2026
- Estado: escolha registrada; download não executado, aguardando autorização de Airton
- Origem: pedido de Airton para validar a conversa do prompt 11 com um LLM local real

Esta decisão não substitui a [ADR 0005](0005-conversa-texto-e-provedor.md). O contrato HTTP e o simulador continuam. O módulo 02, com fila e política de GPU, continua planejado.

## Contexto

A inspeção de 29/10/2026, sem alterar o driver, encontrou:

- Node.js 22.23.3 e npm 10.9.9.
- NVIDIA GeForce RTX 5070, 12227 MiB, driver 615.71.10. No momento da leitura, 10480 MiB estavam livres.
- 31 GiB de RAM, cerca de 20 GiB disponíveis, sem swap.
- 60 GiB livres em `/` e 34 GiB livres em `/media/projetos`.
- Nenhum binário de Ollama, llama.cpp, LM Studio ou vLLM. Nenhuma porta local de inferência aberta. O cache do Hugging Face tinha 212 KiB e nenhum peso GGUF.

O adaptador já fala `{baseUrl}/chat/completions` com ferramentas. A documentação oficial do Ollama, consultada em 29/10/2026, descreve esse endpoint, inclusive `tools` e `tool_choice`, em `http://127.0.0.1:11434/v1`. A mesma documentação lista a RTX 5070 na compute capability 12.0 e exige driver NVIDIA 550 ou mais novo; o driver 615.71.10 já atende. O contexto padrão do servidor é 4096 tokens, ajustável por `OLLAMA_CONTEXT_LENGTH`. O diretório dos pesos é `OLLAMA_MODELS`.

## Decisão

- Motor: Ollama local, versão de referência v0.40.13, servindo só em 127.0.0.1. A conversa continua no adaptador existente. Uma falha do endpoint permanece falha; o simulador não entra no lugar.
- Candidato de modelo, ainda não baixado: `qwen3.5:9b` da biblioteca oficial do Ollama. A ficha publica quantização Q4_K_M, 8,95 bilhões de parâmetros, pacote de 7,6 GB (pesos de linguagem de 6,6 GB e projetor visual BF16 de 922 MB) e janela máxima de 256K. Para esta GPU, a validação deve usar o contexto padrão de 4096, não os 256K.
- Destino proposto dos pesos: `/media/projetos/models/ollama`, configurável por `llm.modelsDir` e `MOAH_LLM_MODELS_DIR`, e aplicado ao processo do Ollama como `OLLAMA_MODELS`. O diretório fica fora do Git. O modelo não recebe esse caminho nem lê arquivos por conta própria.
- O simulador segue como provedor padrão da CLI e como o único provedor dos testes automáticos. A avaliação real é `npm run validar-llm`, que recusa o simulador.

## Alternativas

- llama.cpp: também oferece HTTP compatível, mas não está instalado. Ficaria um segundo adaptador de operação para o mesmo contrato.
- `qwen3.5:4b` (3,3–4,0 GB) ou um GGUF só de texto, como o Q4_K_M de cerca de 5,7 GB publicado por terceiros: ficam de reserva se o pacote de 7,6 GB não couber na VRAM medida desta máquina.
- API em nuvem: rejeitada. A memória de trabalho sairia do computador.

## Consequências

O arquivo comprimido do Ollama v0.40.13 mede 1,42 GiB. Somado ao pacote de 7,6 GB, o download previsto fica em torno de 9 GB. Os dois volumes têm espaço. Nada disso foi baixado nesta decisão. A instalação do binário pede escrita em `/usr` e não deve trocar o driver. A medição de tempo, RAM e VRAM só existe depois da autorização e da execução real.
