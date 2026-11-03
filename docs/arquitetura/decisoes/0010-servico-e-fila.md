# ADR 0010 — Serviço local e fila persistente

- Data: 02/11/2026
- Estado: aceita para a fila local de um processo; serviço permanente não instalado
- Origem: pedido de Airton para um serviço com retomada, sem lock exclusivo durante espera ou inferência

## Contexto

A CLI já serializa o SQLite com um lock de arquivo em volta de cada operação curta. Um serviço que segurasse esse lock enquanto espera rede ou modelo impediria a CLI. Efeito externo, quando existir, pode ficar incerto depois de uma queda.

## Decisão

- A migração 4 grava `jobs` com id, tipo, estado, tentativas, erro, checkpoint e chave de idempotência. Estados: `pendente`, `executando`, `concluida`, `falha`, `cancelada` e `incerta`.
- O worker reserva a tarefa com `UPDATE` condicional e solta o lock antes do tratador. Dois workers não levam a mesma linha `pendente`. A chave repetida devolve a tarefa existente.
- No início, toda tarefa `executando` passa a `incerta`. Não é promovida a sucesso. Cancelar `pendente` ou `executando` não reescreve uma conclusão posterior.
- O comando `servico processar` executa uma tarefa e termina. `servico parar` grava o pedido e remove o pid. Não há servidor de rede. O único tipo aceito na CLI é `eco`, sem shell nem arquivo.
- A unidade systemd de exemplo fica na documentação e não é instalada. O Agendador de Tarefas do Windows também não é criado.

## Alternativas

- Fila só em memória: perde a tarefa no reinício.
- Exatamente uma vez para efeito externo: não é garantível depois de queda entre o efeito e o registro.

## Consequências

A fila não executa inferência nem conector. Ela demonstra recuperação e concorrência com a CLI. Efeito externo futuro precisa de idempotência e reconciliação da tarefa `incerta`.
