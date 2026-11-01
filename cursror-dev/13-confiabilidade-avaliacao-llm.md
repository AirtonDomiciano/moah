# Prompt 13 — Tornar confiável a avaliação do LLM local

Data: 01/11/2026. Versão: 1.0. Estado: executado em 01/11/2026. Relatório: [execucoes/2026-11-01-001-prompt-13.md](execucoes/2026-11-01-001-prompt-13.md).
Origem: revisão do diff do commit 152232b342abd3ea78ba96cea404486994de0c2b.

## Prompt para o Cursor

Leia AGENTS.md. Revise primeiro somente o commit 152232b e as funções afetadas; consulte contexto adicional apenas se necessário. Preserve alterações locais e reaproveite a implementação.

Corrija a avaliação antes de interpretar sua aprovação como evidência de qualidade:

1. Em src/application/llm-eval.ts, o cenário esclarecimento pode passar com resposta vazia ou afirmação irrelevante quando não há chamadas. Ausência também pode passar sem consulta. Exigir evidências estruturadas da situação e resposta de esclarecimento apropriada. Não aceitar qualquer texto apenas por não inventar uma data.
2. Em validate-local.ts, corpus mistura answer e linhas das ferramentas. A presença de um ID nas linhas não demonstra fidelidade da resposta final. Separar avaliação da consulta, referências e resposta final; registrar limites da avaliação automática e revisão humana necessária. Usar casos negativos para resposta final que contradiz os dados.
3. recordsUnchanged verifica só se uma pendência continua pendente. Comparar o estado lógico completo antes/depois da conversa: registros, decisões, ações, checkpoints e referências. Não comparar apenas bytes do arquivo SQLite por causa de WAL.
4. gpuDuring é amostrado depois de spawnSync retornar: não mede pico durante inferência. Implementar amostragem concorrente se justificável, ou renomear para amostras após chamadas e declarar pico não medido. Não apresentar RAM antes/depois como consumo exclusivo do MOAH/modelo.
5. Verificar código de saída e JSON antes de ler a consulta final de pendências, preservando diagnóstico em caso de falha.

Adicionar testes de comportamento que falham nos casos acima. Rodar typecheck/build/testes relevantes com simulador/fixtures, sem baixar modelo, instalar motor ou alterar drivers.

Manter a validação real como pendente. Respeitar autorização de download do prompt 12. Atualizar guia e criar relatório de execução sanitizado. Não reescrever resultados históricos como se fossem testes novos. A ADR do Ollama agora é 0007; a 0006 é Obsidian/Graphify. O backlog do LLM agora é MOAH-032.

Entregar mudanças e evidências para revisão. Não fazer commit/push nem avançar para outros módulos sem instrução.
