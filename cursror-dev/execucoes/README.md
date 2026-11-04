# Histórico de execução dos prompts

Esta pasta preserva relatórios sanitizados de execução. Preparar um prompt não significa executá-lo.

| Relatório | Prompt | Estado |
| --- | --- | --- |
| [2026-10-28-001-prompt-00](2026-10-28-001-prompt-00.md) | 00, versão 1.0 | Concluída no recorte da CLI |
| [2026-10-29-001-prompt-11](2026-10-29-001-prompt-11.md) | 11, versão 1.0 | Concluída com simulador; modelo real pendente |
| [2026-10-29-002-prompt-12](2026-10-29-002-prompt-12.md) | 12, versão 1.0 | Parcial; download aguardando autorização |
| [2026-11-01-001-prompt-13](2026-11-01-001-prompt-13.md) | 13, versão 1.0 | Concluída no critério automático; modelo real pendente |
| [2026-11-02-001-prompt-14](2026-11-02-001-prompt-14.md) | 14, versão 1.0 | Política testada; modelo real ainda bloqueado |
| [2026-11-02-002-revisao-93607f8](2026-11-02-002-revisao-93607f8.md) | 14, revisão de 93607f8 | Correção local validada; sem commit |
| [2026-11-02-003-prompt-15](2026-11-02-003-prompt-15.md) | 15, versão 1.0 | Recorte local testado; modelo e agenda reais bloqueados |
| [2026-11-03-001-prompt-16](2026-11-03-001-prompt-16.md) | 16, versão 1.0 | Laço de voz testado com fixture; nome falado pendente |
| [2026-11-03-002-voz-hardware](2026-11-03-002-voz-hardware.md) | 16, continuação | Headset medido; detector de MOAH ainda ausente |
| [2026-11-03-003-voz-pran](2026-11-03-003-voz-pran.md) | 08 consultado; 16 continuado | Treino local feito; aceite falado pendente |
| [2026-11-03-004-voz-correcao](2026-11-03-004-voz-correcao.md) | continuação de 16 | Diagnóstico e correção medidos; 1 de 3 tomadas reais; aceite pendente |
| [2026-11-03-005-voz-tomadas](2026-11-03-005-voz-tomadas.md) | continuação de 16 | Oito WAV preservados; música reservada em 0; saudação em 8 de 9 |

Para cada execução, criar YYYY-MM-DD-NNN-prompt-ID.md usando MODELO.md. Incluir prompt/versão e commit de origem, escopo, ambiente, resultado e comandos realmente executados. Repetições recebem relatório novo vinculado ao anterior.

Prompt usado → relatório de execução → ADRs relevantes → commit da implementação formam a trilha de trabalho. Se não houver commit, indicar pendente. Não inventar resultados ou copiar dados privados. Falha e execução parcial são estados válidos e devem ter próximo passo.

Manter o texto original do prompt referenciado. Mudanças futuras incrementam versão e explicam o motivo; o commit de origem permite reconstruir a versão executada.
