# ADR 0012 — Importação de transcrição e análise substituível

- Data: 02/11/2026
- Estado: aceita para arquivo de texto; análise real pendente
- Origem: pedido de Airton para a primeira versão do agente de reuniões sem captura de áudio

## Contexto

A conversa já consulta a memória por ferramentas de leitura. Uma transcrição pode conter pedidos de shell, aprovação ou tarefa. Esse texto é dado. O modelo real continua ausente, então a análise não pode ser inventada por regras fixas nem atribuída ao simulador.

## Decisão

- O formato mínimo é texto com cabeçalho `fonte`, `versao` e `dominio`, campos opcionais `projeto`, `data` e `participantes`, uma linha `---` e o corpo. Participante e data omitidos ficam vazios.
- `reuniao importar` é comando manual. Se `documentsDir` estiver configurado, o arquivo real precisa permanecer dentro dele. A mesma fonte, versão e domínio devolvem o registro existente. Uma versão nova marca a análise `valida` anterior como `substituida`.
- A análise pede JSON ao adaptador: resumo, assuntos, decisões, regras com `confirmada`, sugestões, dúvidas e ações. `confirmada` é classificação do modelo, não aceite de Airton. JSON inválido fica `invalida`. Sem provedor, ou com o simulador, a análise permanece `pendente`.
- A ação extraída é candidata. A importação não enfileira tarefa, não cria aprovação e não altera a agenda. `consultar_reuniao` entra nas ferramentas de leitura, recebe só o id e usa o domínio da sessão. A política continua na frente.
- O conteúdo gerado leva `geradoPorIa` e `analiseRealValidada: false` nesta entrega.

## Alternativas

- Resumir com regras fixas: aparentaria inteligência sem modelo e foi rejeitado.
- Busca vetorial: fora desta etapa.
- Captura ou Fathom: fora desta etapa.

## Consequências

A consulta por id funciona com fixture. O resumo inteligente real espera o modelo autorizado no prompt 12.
