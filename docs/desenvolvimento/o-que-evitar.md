# Anti-padrões — práticas a evitar

| Prática | Problema | Alternativa |
| --- | --- | --- |
| Colocar todo histórico no prompt do diretor | Consumo, ruído e mistura de áreas | Resumos e consulta por referência |
| Carregar um modelo por cargo | Pressão desnecessária na VRAM | Sessões separadas e fila |
| Dizer “concluído” após mock ou envio do pedido | Resultado sem comprovação | Estado explícito e evidências |
| Reexecutar publicação após timeout | Comentários duplicados | Reconciliação e idempotência |
| Confundir reunião agendada com presença | Histórico falso | Fonte de participação ou relato identificado |
| Deixar o modelo controlar relógios | Lembretes dependem de inferência | Agendamento determinístico |
| Salvar snapshots concorrentes sem controle | Perda de favoritos/memória | Transações ou dono único do estado |
| Criar pastas/agentes sem contratos ou uso | Complexidade sem entrega | Primeiro fluxo pequeno validado |
| Copiar regra em vários documentos | Contradição futura | Fonte canônica e catálogo |
| Registrar aulas reais no Git público | Exposição de dados | Memória privada do runtime |

São riscos de projeto, não incidentes comprovados do MOAH. Só registrar lição aprendida de incidente quando houver evidência.
