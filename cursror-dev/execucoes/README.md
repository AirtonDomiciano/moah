# Histórico de execução dos prompts

Esta pasta preserva relatórios sanitizados de execução. Preparar um prompt não significa executá-lo. Neste momento não há execução do prompt 00 registrada.

Para cada execução, criar YYYY-MM-DD-NNN-prompt-ID.md usando MODELO.md. Incluir prompt/versão e commit de origem, escopo, ambiente, resultado e comandos realmente executados. Repetições recebem relatório novo vinculado ao anterior.

Prompt usado → relatório de execução → ADRs relevantes → commit da implementação formam a trilha de trabalho. Se não houver commit, indicar pendente. Não inventar resultados ou copiar dados privados. Falha e execução parcial são estados válidos e devem ter próximo passo.

Manter o texto original do prompt referenciado. Mudanças futuras incrementam versão e explicam o motivo; o commit de origem permite reconstruir a versão executada.
