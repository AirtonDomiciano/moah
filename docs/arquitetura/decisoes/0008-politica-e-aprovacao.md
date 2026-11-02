# ADR 0008 — Política determinística e aprovação de uso único

- Data: 02/11/2026
- Estado: aceita para a primeira camada executável; sandbox de sistema operacional ausente
- Origem: pedido de Airton para uma governança executável sem ampliar a conversa somente leitura

## Contexto

A conversa do prompt 11 consulta três ferramentas de leitura. A pasta de segurança descrevia allow/ask/deny, aprovação vinculada à ação e executor separado, ainda sem código. Em 02/11/2026 a inspeção não encontrou motor local; essa ausência não bloqueia a política, que não depende de LLM.

## Decisão

- O núcleo fica em TypeScript puro. `evaluatePolicy` recebe uma proposta estruturada e um contexto de autoridade montado pelo código chamador. O modelo não preenche esse contexto e não escolhe o domínio.
- A decisão é `allow`, `ask` ou `deny`. Consultas já concedidas no domínio da sessão são `allow`. `eco_sintetico` é `ask` e existe só na CLI de demonstração. Ferramenta desconhecida, ferramenta bloqueada, outro domínio, parâmetro que amplia permissão e filho acima do conjunto do supervisor são `deny`. Um sim genérico não muda `deny` nem `ask`.
- A aprovação nasce sempre `pendente` no SQLite já usado pela CLI, pela migração 2. Concede, nega e revoga são comandos manuais. A ação canônica e o fingerprint SHA-256 amarram ferramenta, domínio, alvo e parâmetros. A linha é consumida por um único `UPDATE` condicional.
- O executor da demonstração não tem efeito no computador. A pausa persistente bloqueia despacho novo e não alega desfazer o que já ocorreu.
- A auditoria grava o mínimo: proposta, decisão, decisão humana, tentativa, consumo e resultado. Não é apresentada como log inviolável.
- As três consultas da conversa passam pela política e continuam chamando os casos de uso existentes. Escrever memória, terminal e conectores seguem fora da lista do modelo.

## Alternativas

- Framework de agentes ou motor genérico de regras: rejeitado para este recorte.
- Criar a aprovação já como `aprovada` a partir do texto do modelo: rejeitado.
- Banco novo, separado do `moah.sqlite`: rejeitado. A migração versionada já existia.
- Tratar a allowlist como sandbox do SO: rejeitado. O pedido pede para não declarar essa proteção.
- Baixar o modelo local para provar a política: rejeitado. Continua dependente da autorização do prompt 12.

## Consequências

Dá para demonstrar o ciclo com dados sintéticos e relógio injetado. A conversa não ganha ferramenta de efeito. O próximo passo de execução real continua sendo uma ferramenta pequena, com alvo resolvido no sistema operacional, depois que Airton autorizar esse escopo. A validação com Ollama continua aguardando download.

Validação: testes de negação, expiração, revogação, fingerprint, consumo concorrente, pausa, reinício e conversa somente leitura. Não houve teste de caminho, junction, ACL ou processo real.
