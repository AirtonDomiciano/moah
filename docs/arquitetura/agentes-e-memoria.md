# Contratos de agentes, memória e prestação de contas

Estado: proposta técnica para atender à visão de Airton, registrada em 28/10/2026. Não constitui API implementada. Campos, limites e transporte devem ser refinados na implementação.

## 1. Papéis e fronteiras

O MOAH recebe o objetivo e coordena a resposta. CTOs escolhem especialistas da área, acompanham sua execução e agregam resultados. Especialistas executam tarefas delimitadas, preservam evidências e devolvem um resumo. O usuário pode conversar diretamente com um especialista; o MOAH recebe somente o resultado permitido e relevante.

Cada agente deve declarar: identificador, domínio, capacidades, ferramentas disponíveis, permissões, entradas aceitas, formato de saída, limites e estado de disponibilidade. Um agente registrado mas desconectado não conta como capaz de executar a tarefa.

Personalidades podem variar, mas todos os agentes usam o mesmo contrato de tarefas e não ampliam a própria autoridade.

## 2. Entrada de uma tarefa

| Campo proposto | Finalidade |
| --- | --- |
| task_id / parent_task_id | Identidade e vínculo de delegação |
| correlation_id | Relacionar o fluxo completo |
| domain | pessoal, imex ou aluai |
| objective | Resultado esperado em linguagem clara |
| acceptance_criteria | Condições para dizer que terminou |
| inputs / source_refs | Dados mínimos e referências de origem |
| authorized_actions | Ações explicitamente permitidas |
| requested_by / authorization_ref | Quem solicitou e evidência da autorização |
| owner_agent / supervisor | Executor e responsável pela coordenação |
| deadline / priority | Prazo e prioridade quando existirem |
| resource_policy | Limites de concorrência, contexto e tempo |
| idempotency_key | Evitar repetir uma ação com efeito externo |
| cancellation_policy | Como interromper e preservar resultados |

Não mandar a caixa postal inteira para revisar uma US. Não mandar as aulas completas ao diretor para informar se Airton estudou hoje. Recuperar contexto por relevância e permissão.

## 3. Estados e continuidade

Estados propostos: recebida, em_fila, em_execucao, aguardando_usuario, bloqueada, concluida, falhou e cancelada.

- Entrada válida pode ir à fila; falta de informação deve virar pergunta ou bloqueio claro.
- Ao executar, registrar etapa e checkpoint antes de efeitos externos.
- Ao aguardar usuário, liberar recursos que não precisam ficar reservados.
- Conclusão exige saída e evidência compatíveis com os critérios.
- Falha preserva o que já foi feito e descreve se pode haver efeito parcial.
- Cancelamento interrompe etapas futuras; não promete desfazer automaticamente o que já foi publicado.
- Reinício recupera o estado. A etapa externa incerta precisa de reconciliação antes de nova tentativa.

O grafo de tarefas deve limitar profundidade de delegação, novas tentativas, prazo e consumo para impedir ciclos entre agentes. Uma falha repetida volta ao supervisor.

## 4. Saída resumida para o supervisor

| Campo proposto | Conteúdo |
| --- | --- |
| task_id / domain / owner_agent | Identificação |
| status | Estado verdadeiro da execução |
| summary | Resumo curto e útil |
| completed_actions | O que efetivamente ocorreu |
| findings | Achados relevantes |
| blockers / uncertainties | Impedimentos e pontos não verificados |
| decisions_needed | O que depende de Airton |
| next_steps | Próximas ações recomendadas |
| evidence_refs | Fontes, artefatos e resultados consultáveis |
| detail_ref | Referência para o registro completo do especialista |
| observed_at / updated_at | Atualidade do resultado |
| effects | Efeitos externos, seus IDs e resultado |

Começar com resumos compactos, com limite configurável. Não cortar ressalvas que mudam o sentido. Limites exatos são decisão de implementação, não números definidos por esta documentação.

Um resumo não é verdade autônoma: pode ficar antigo, conter erro ou perder contexto. Preservar vínculo com as fontes, expiração quando necessária e mecanismo de correção.

## 5. Exemplo sintético: relatório do agente de inglês

~~~json
{
  "task_id": "exemplo-ingles-001",
  "domain": "pessoal",
  "owner_agent": "ingles",
  "status": "concluida",
  "summary": "Sessão de 20 minutos de conversação concluída.",
  "findings": ["Dificuldade observada em perguntas no passado."],
  "next_steps": ["Revisar perguntas no passado na próxima sessão."],
  "blockers": [],
  "evidence_refs": ["memoria://pessoal/ingles/sessoes/exemplo-001"],
  "detail_ref": "memoria://pessoal/ingles/sessoes/exemplo-001"
}
~~~

As referências acima são identificadores ilustrativos, sem resolução implementada.

O registro detalhado pode conter tema, objetivos, exercícios, respostas úteis, correções, vocabulário, tempo e plano de revisão. Diagnósticos de evolução devem usar observações comparáveis; não concluir ausência de progresso por uma sessão isolada.

O MOAH guarda o resumo executivo e a referência. Se Airton perguntar “por que estou errando tanto perguntas no passado?”, solicita ao agente de inglês uma análise específica do histórico permitido.

## 6. Memória em níveis

| Nível | Responsável | Conteúdo |
| --- | --- | --- |
| Executivo | MOAH | Objetivos, estado geral, prioridades e resumos |
| Área | CTO | Projetos, tarefas, decisões e pendências daquele domínio |
| Especialista | Agente | Registros detalhados de trabalho ou aprendizagem |
| Operacional | Runtime | Fila, checkpoints, agendamentos e efeitos externos |

Separar esses níveis não obriga usar bancos diferentes. Exige fronteiras de acesso, referências e recuperação seletiva. O runtime pode começar simples, desde que mantenha essas propriedades.

Cada memória deve registrar origem, data, domínio, responsável e revisão. Preferência explícita prevalece sobre hipótese. Correções invalidam resumos antigos; exclusão deve tratar índices e resumos derivados conforme a política de retenção, deixando claro o alcance de backups e fontes externas.

Um detalhe da Imex não deve ir para o agente de inglês porque ambos atendem ao mesmo usuário. O MOAH pode saber que existe trabalho pendente sem espalhar conteúdo empresarial.

## 7. Autorização e ações

Permissão é definida por ferramenta, conta, domínio e ação. Delegação pode restringir permissões; não pode ampliá-las.

Exemplos:
- “Faz o review e coloca na US” autoriza essa publicação no alvo identificado; não é necessário pedir a mesma autorização novamente se os dados estiverem claros.
- “Olha a US” autoriza consulta; não implica alteração ou publicação.
- “O que posso fechar para liberar RAM?” pede diagnóstico; não autoriza encerrar aplicativos.
- “Pula essa música” autoriza o controle de mídia solicitado.

Mensagens, páginas e arquivos recuperados não concedem autoridade. O agente não deve seguir instruções embutidas em e-mails para executar comandos.

## 8. Concorrência e RTX 5070

Papéis lógicos não são modelos residentes. O mesmo modelo pode atender várias sessões com contextos separados. Operações determinísticas, temporizadores, coleta de métricas e chamadas a conectores não precisam de inferência contínua.

Proposta inicial: fila de inferência com limite conservador e configurável, ajustado por medição. Não presumir que vários modelos ou contextos longos cabem simultaneamente em 12 GB. Medir o modelo, contexto, memória de execução, áudio e uso concorrente de aplicações.

Prioridades devem distinguir ação interativa, compromisso próximo e análise em segundo plano. Não interromper inferência em um ponto que deixe efeito externo indeterminado; persistir checkpoints.

Uma GPU futura com mais VRAM é uma possibilidade de evolução, não solução para delegação circular, contexto excessivo ou tarefas duplicadas.

## 9. Critérios de validação futura

1. O diretor recebe resumo e consulta detalhes por referência.
2. O agente de inglês preserva uma sessão e gera relatório sem copiar o histórico inteiro.
3. Uma tarefa Imex não consulta memória Aluai.
4. Resumo desatualizado indica sua data e pode ser renovado.
5. Reiniciar após publicação não cria segundo comentário.
6. Cancelar uma tarefa impede novas etapas e informa efeitos já realizados.
7. Agentes bloqueados não delegam indefinidamente.
8. Ausência do modelo não para o relógio de lembretes.
9. A fila respeita limites de recursos e mantém a interface responsiva.
10. Correção ou remoção de memória é propagada aos resumos derivados conforme política.
