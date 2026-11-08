# Rotina, reuniões e interface

A agenda calcula horários sem depender do modelo. A interface exibe estado e permite controlar escuta, tarefas, fontes e aprovações. Voz e interface usam os mesmos casos de uso.

| Cenário | Comportamento esperado |
| --- | --- |
| Bom dia, temos alguma urgência? | Reunir agenda, pendências e checkpoints com origem e estado de cada fonte |
| Estudar inglês às 16h30 | Oferecer a sessão. Persistir adiamento de 15 minutos quando solicitado |
| Evento muda, some ou chega após reinício | Reconciliar versão, domínio, cancelamento e lembrete vencido |
| Silêncio ou contexto incerto | Respeitar preferências e tratar aplicativo ativo como pista |
| Importar transcrição | Guardar origem, versão e domínio. Extrair resumo, decisões, propostas e dúvidas |
| Transcrição corrigida | Substituir o resumo vigente e preservar rastreabilidade |
| Ação sugerida numa reunião | Mostrar como candidata para revisão |
| Captura futura de reunião | Usar integração com escopo explícito e separar agenda, presença e conteúdo |
| Controle na interface | Exibir estado real, origem simulada quando aplicável e controle de pausa |

A interface de desktop e os sensores podem evoluir conforme o [levantamento do Pestinha](../avaliacao-pestinha.md).
