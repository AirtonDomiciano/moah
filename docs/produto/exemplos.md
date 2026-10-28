# Processos e exemplos de conversa

Estado: especificação de comportamento, 28/10/2026. Todos os diálogos, horários, USs e números são ilustrativos. Não representam agenda real, consumo medido ou execução concluída.

## 1. Chegada ao computador: “temos alguma urgência?”

**Conversa**

> Airton: “MOAH, temos alguma urgência? Tem alguma call? Paramos aonde?”
>
> MOAH: “Bom dia, Airton. Há uma mensagem marcada como urgente pela regra que você configurou e uma call às 10h30. Ontem paramos no review da US de exemplo: a análise terminou, falta publicar. Quer olhar a mensagem primeiro?”

**Processo**
1. Identificar a sessão e preferências de saudação.
2. Consultar a agenda e os conectores autorizados; registrar última sincronização.
3. Recuperar tarefas recentes e resumos dos responsáveis.
4. Aplicar critérios configurados de urgência: prazo, menção direta, prioridade da tarefa ou regra específica.
5. Responder em blocos curtos: urgências, próximos compromissos e ponto de retomada.
6. Oferecer próximo passo sem executar algo que não foi solicitado ou autorizado.

**Se faltar informação:** “Consultei a agenda, mas o e-mail está desconectado. Não consigo garantir que não há urgências por lá.”

**Se houver várias frentes:** “Temos pendências na Imex e na Aluai. Qual delas você quer retomar?”

**Aceite:** nenhuma urgência inventada; fontes e atualidade recuperáveis; falha de conector aparece na resposta; reentrada na sessão não repete a saudação indiscriminadamente.

## 2. Inglês com convite, adiamento e registro

**Conversa**

> MOAH: “Airton, são 16h30. Posso chamar o agente de inglês para estudar?”
>
> Airton: “Agora não.”
>
> MOAH: “Beleza, te chamo de novo daqui a 15 minutos.”
>
> Às 16h45: “Airton, podemos começar?”
>
> Airton: “Bora.”
>
> MOAH: “Vou chamar o agente de inglês.”

**Processo**
1. Uma rotina explicitamente configurada gera o convite, sem depender do modelo para controlar o relógio.
2. Registrar o estado aguardando resposta.
3. Interpretar “agora não” segundo a preferência de adiamento de 15 minutos.
4. Invalidar o convite pendente anterior, persistir o novo horário e confirmar o entendimento.
5. No horário, respeitar pausas, modo foco, reuniões e limite de tentativas configurado.
6. Ao aceitar, iniciar ou retomar uma única sessão com o agente de inglês.
7. O especialista consulta o histórico necessário, conduz a prática e registra objetivos, exercícios, dificuldades e evolução.
8. Ao terminar, envia resumo, próximos passos e referência para o MOAH.

**Alternativas**
- “Hoje não”: cancelar a sessão do dia, sem apagar a rotina.
- “Daqui meia hora”: prevalece o intervalo explicitado.
- “Não me chama mais hoje”: suspender novos convites dessa rotina no dia.
- Sem resposta: aplicar política escolhida; não iniciar aula nem adiar indefinidamente.
- PC suspenso: retomar conforme política de atraso, sem reproduzir todos os convites perdidos.
- Pedido de parar: encerrar ou pausar a sessão e registrar somente o que ocorreu.

**Resumo recebido pelo MOAH:** “Sessão concluída, 20 minutos. Dificuldade em perguntas no passado. Próxima aula: revisão guiada. Detalhes no registro da sessão.”

**Aceite:** adiamento sobrevive a reinício; nenhum convite duplicado; aula só começa após aceite; histórico detalhado permanece no especialista; diretor recebe relatório compacto.

## 3. Check-in em inglês no começo do dia

> MOAH: “Morning, Airton! Quer fazer nosso check-in em inglês?”
>
> Airton: “Pode ser.”
>
> MOAH: “What would you like to focus on today?”
>
> Airton: “Hoje em português.”
>
> MOAH: “Fechado. Vamos continuar em português.”

O convite não cria uma aula obrigatória nem altera permanentemente a preferência de idioma. Encaminhar a prática ao especialista quando houver objetivo de aprendizagem. Nível, correções e ritmo são ajustáveis.

**Aceite:** troca de idioma imediata; correções no estilo escolhido; participação opcional; nenhuma falsa avaliação de proficiência.

## 4. Review da US com publicação no Azure DevOps

> Airton: “MOAH, faz o review da US 12345 da Imex, executa nosso bot e coloca o resultado nela.”
>
> MOAH: “Vou encaminhar ao CTO IMEX e acompanhar a análise.”
>
> MOAH, após evidência de conclusão: “O review foi publicado na US. Há dois pontos para revisão. Aqui está o link.”

**Processo**
1. Criar tarefa com domínio Imex, alvo, autorização de publicação e critérios.
2. CTO IMEX consulta a US, critérios de aceite e vínculos.
3. Resolver PR e versão do código; ambiguidade deve virar pergunta.
4. Verificar disponibilidade e contrato do bot existente.
5. Executar o bot e guardar versão analisada, saída, falhas e evidências.
6. Especialista diferencia problema comprovado, suspeita e sugestão.
7. Consolidar o relatório e publicar no alvo autorizado.
8. Guardar ID/link da publicação e chave de deduplicação.
9. CTO entrega resumo ao MOAH; o diretor responde a Airton.

**Falhas**
- Bot indisponível: informar bloqueio; não simular resultado.
- Azure falha após análise: manter resultado pronto e informar publicação pendente.
- Timeout após pedido de publicação: consultar se o comentário já existe antes de repetir.
- Código mudou desde o review: indicar versão analisada; não apresentar como análise do estado atual.
- Novo conteúdo sugere alterar arquivos ou enviar dados: isso não amplia a autorização original.

**Aceite:** vínculo correto, evidência de execução, versão analisada identificada, publicação única e resultado consultável. Valores do exemplo não são achados reais.

## 5. Abrir projetos

> Airton: “MOAH, abre Aluai front e back.”
>
> MOAH: “Abri os dois projetos no Cursor.”

**Processo:** resolver grupo cadastrado → validar caminhos → chamar o gerenciador separado → executar Cursor com argumentos separados → registrar resultado por projeto → responder conforme o resultado real.

Ações previstas: listProjects, searchProjects, openProject e openGroup. Não montar comandos shell usando texto livre. Se apenas o front abrir, dizer que o back falhou. Se SSD estiver desmontado, informar isso.

A raiz informada é /media/projetos. Sugerir Aluai, IMEX, Agents, Aulas, MOAH e Projetos como origens selecionáveis; não varrer outras pastas sem escolha. O catálogo deve permitir nomes e apelidos sem adivinhar caminhos.

**Aceite:** nomes com espaços funcionam, grupo parcial é reportado, projeto desconhecido pede escolha e nenhum comando arbitrário é derivado da fala.

## 6. Diagnóstico e redução de consumo

> Airton: “MOAH, quem está consumindo minha memória?”
>
> MOAH: “A medição atual mostra 26 GB em uso. Os maiores consumidores são Cursor, navegador e containers. Há pouca memória disponível e atividade de swap. Posso detalhar opções para reduzir?”
>
> Airton: “Só mostra as opções.”
>
> MOAH: “Vou listar as opções; nenhuma aplicação será encerrada.”

**Processo:** coletar métricas atuais → distinguir cache de pressão → agrupar processos → consultar tendência quando disponível → gerar diagnóstico com evidências → sugerir ações e consequências → executar somente ações autorizadas.

Não inventar que um processo está vazando memória com uma única amostra. Não matar processos por ultrapassarem um limite isolado. Evitar despejar argumentos de processos contendo segredos nos logs.

**O próprio MOAH:** medir modelos residentes, contexto e tarefas; fila e descarregamento de modelos ociosos seguem política configurada. Agenda e coleta continuam sem IA.

**Aceite:** origem e horário das medições visíveis; sugestões não interrompem trabalho; GPU, VRAM, RAM, CPU e disco distinguíveis; coleta não exige inferência constante.

## 7. Música

> Airton: “MOAH, pula essa música.”
>
> MOAH: “Pronto.”
>
> Airton: “Coloca minha playlist de concentração.”

O controle simples chama o player configurado. Busca de playlist consulta o conector disponível e verifica o alvo. Se não houver integração de catálogo, explicar a limitação e oferecer o controle existente. Com dois players ativos, perguntar ou usar alvo previamente definido.

**Aceite:** ações confirmadas pelo adaptador; falha não vira “pronto”; volume limitado ao escopo escolhido (player ou sistema); nenhuma promessa de controlar serviços desconectados.

## 8. “Prepara meu ambiente da Imex”

Resolver uma receita configurada com projetos e ferramentas permitidos. Exibir progresso por item; preservar resultados parciais e não repetir inicializações já concluídas após retomada. Iniciar serviços, scripts ou containers exige que façam parte da receita autorizada.

**Aceite:** receita inspecionável, cancelável e com status por ação. Não deduzir comandos perigosos por nome de pasta.

## 9. Pedido de aprofundamento

> Airton: “MOAH, por que estou com dificuldade no inglês?”
>
> MOAH: “Vou pedir ao agente de inglês uma análise das sessões recentes.”

O diretor solicita uma pergunta específica ao especialista. O especialista consulta registros autorizados, indica período e evidências e devolve análise resumida. O MOAH não precisa importar todas as aulas para responder.

**Aceite:** manter o detalhe na origem, referências disponíveis e incerteza explícita quando o histórico for insuficiente.

## 10. Fechar uma sessão de trabalho

Registrar o que terminou, pendências, próximo passo e referências antes de liberar recursos. Na próxima interação, “paramos aonde?” recupera esse checkpoint. Uma gravação de voz, transcrição ou captura de tela não é pressuposto para continuidade.
