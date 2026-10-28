# MOAH — visão de produto e experiência pessoal

Atualizado em 28/10/2026. Origem: pedidos explícitos de Airton nesta conversa e issues [#1](https://github.com/AirtonDomiciano/moah/issues/1) e [#2](https://github.com/AirtonDomiciano/moah/issues/2). Estado: planejamento; os exemplos descrevem comportamentos desejados, não funcionalidades existentes.

## 1. Identidade

MOAH será o assistente pessoal de Airton no Linux: uma experiência de conversa semelhante à Alexa ou ao Gemini, com mais responsabilidade sobre tarefas, continuidade, coordenação de agentes e ferramentas do computador.

Airton quer sentar no PC, conversar naturalmente e receber ajuda para entender seu dia, retomar trabalhos e executar fluxos completos. O MOAH deve saber encaminhar pedidos, acompanhar resultados e voltar com uma resposta verificável. Sua utilidade não depende de exigir que Airton abra manualmente cada sistema.

A expressão “Jarvis” representa essa experiência integrada; não implica capacidade ilimitada, acesso a qualquer conta ou compreensão perfeita. O MOAH deverá explicar o que sabe, o que consultou e o que falta.

## 2. Organização desejada por Airton

| Papel | Responsabilidade | Contexto principal |
| --- | --- | --- |
| Airton — CEO | Define objetivos, prioridades, preferências e autoridade | Visão pessoal e profissional |
| MOAH — Diretor Geral | Conversa, encaminha, acompanha, integra resumos e entrega resultados | Visão executiva |
| CTO IMEX | Coordena trabalhos e especialistas da Imex | Contexto Imex |
| CTO ALUAI | Coordena trabalhos e especialistas da Aluai | Contexto Aluai |
| Especialistas | Executam tarefas e mantêm os registros detalhados | Domínio delimitado |

Agentes pessoais, como inglês, diagnóstico do PC e mídia, podem se reportar diretamente ao MOAH. Não precisam passar por um CTO empresarial.

O organograma representa responsabilidades. Não obriga criar processos, serviços ou modelos diferentes para cada cargo. Tarefas simples podem usar ferramentas diretamente, sem uma cadeia desnecessária de chamadas de IA. O responsável e a rastreabilidade continuam explícitos.

## 3. Princípio central: detalhes nos especialistas, resumos no diretor

Pedido explícito de Airton: o agente de inglês registra tudo que foi estudado e entrega somente um resumo ao MOAH. Todos os outros agentes devem seguir esse padrão em seus domínios.

Cada especialista mantém o histórico relevante do próprio trabalho, com origem, resultados e pendências. O MOAH recebe status, conclusão, bloqueios, decisões necessárias e próximos passos. Se precisar aprofundar, solicita um detalhe específico usando referências.

Exemplo:
- Inglês guarda exercícios, vocabulário, dificuldades, correções e evolução.
- CTO IMEX guarda detalhes das tarefas e referências de US/PRs dentro do contexto autorizado.
- Diagnóstico guarda medições e evidências técnicas conforme retenção configurada.
- MOAH recebe o suficiente para coordenar e responder a Airton.

“Registrar tudo” significa preservar os registros úteis de estudo e trabalho conforme a política escolhida, não gravar áudio e telas indiscriminadamente. O formato e a retenção são configuráveis.

Ver [contrato de agentes e memória](contratos-agentes.md).

## 4. Capacidades e exemplos

### Começar o dia e retomar trabalho

Airton: “Temos alguma urgência? Tem alguma call? Paramos aonde?”

O MOAH deverá consultar fontes autorizadas, informar a atualização das fontes e recuperar o último estado relevante. Separar urgências verificadas de itens que apenas parecem importantes. Se houver várias tarefas em aberto, listar as principais ou perguntar qual área retomar.

Não reconstruir o passado por suposição. Se só houver uma nota antiga, informar a data. Se o e-mail estiver desconectado, não dizer que não há urgências.

### Cumprimento e inglês no cotidiano

Quando habilitado, iniciar com “Bom dia, Airton”, resumindo o necessário. Definir se a saudação ocorre no login, na primeira interação ou em outro evento disponível. Evitar repetir a cada desbloqueio.

Oferecer check-in em inglês: “Morning, Airton! Quer conversar em inglês hoje?” O usuário pode voltar ao português. Nível, intensidade das correções e duração devem ser preferências revisáveis.

### Estudos e proatividade

O MOAH pode propor uma sessão às 16h30. Se Airton disser “agora não”, anunciar novo convite em 15 minutos e persistir o adiamento. Ao aceitar, delegar ao agente de inglês, que conduz a sessão e atualiza seu histórico.

A regra de adiamento deve ser configurada; a conversa fornece o comportamento desejado, não cria uma rotina real. “Hoje não” cancela a sessão daquele dia, se essa regra estiver habilitada. Definir limites para insistência, horários silenciosos e tratamento de reuniões.

### Trabalho completo: review de uma US

Airton pede review de uma US e publicação no Azure DevOps. O MOAH encaminha ao CTO IMEX, que identifica os vínculos, aciona o bot existente, analisa evidências e registra o resultado na US quando essa ação tiver sido solicitada.

A forma real de execução do bot e as conexões Azure ainda precisam ser levantadas. Não afirmar que o bot rodou se foi usado um mock.

### Projetos e ambiente

Buscar projetos no SSD e abri-los no Cursor; abrir grupos como Aluai front e back. O gerenciador será separado e exporá ações reutilizáveis pelo MOAH, conforme a issue #1.

Abrir um ambiente pode incluir ferramentas configuradas, mas não iniciar serviços ou executar scripts desconhecidos por associação ao nome de um projeto.

### Diagnóstico do PC

Responder “quem está consumindo minha RAM?” com medições atuais, agrupando processos por aplicativo. Explicar memória disponível, cache e swap. Sugerir ações e pedir autorização antes de encerrar programas ou parar serviços.

Alertas proativos dependem de condições configuradas e sinais relevantes. Não alertar só porque o número “RAM usada” é alto. Incluir o próprio MOAH na análise.

### Música e volume

Entender “pula essa música”, “pausa”, “baixa o volume” e “coloca minha playlist de concentração”. Usar controles do player ou conector autorizado. Busca de catálogo e playlists depende da integração real e da conta; não prometer suporte universal.

Quando vários players estiverem ativos, resolver o alvo pelo contexto ou perguntar. Guardar a escolha quando autorizado.

## 5. Personalização

A solução deve se adaptar ao jeito de Airton: linguagem informal, tamanho das respostas, voz, iniciativa, horários, áreas, ferramentas e autonomia. Preferências devem ser visíveis e editáveis; inferências não substituem decisões explícitas.

O projeto também pode ser usado como portfólio de engenharia e evolução profissional. Documentar decisões e resultados reais; não publicar conteúdo privado das empresas para demonstrar integrações.

## 6. Definição de sucesso

- Airton consegue conversar por texto e, depois, por voz com continuidade.
- O MOAH distingue ferramentas disponíveis de integrações apenas planejadas.
- Especialistas registram detalhes e entregam resumos rastreáveis.
- O diretor consegue pedir aprofundamento sem carregar todo o histórico.
- Uma tarefa longa mostra progresso, falha, bloqueio ou conclusão com evidência.
- Rotinas continuam agendadas sem manter um modelo carregado.
- Imex, Aluai e contexto pessoal ficam separados por padrão.
- A execução respeita recursos do PC e o trabalho em andamento.
- O usuário pode cancelar tarefas, corrigir memória e ajustar iniciativa.

## 7. Estado e limites atuais

Esta atualização entrega documentação. Não instala serviço, não ativa microfone, não conecta contas, não agenda aulas e não executa bots. Os diálogos são ilustrativos. Nomes de US, horários e medições nos exemplos são fictícios.

Ambiente informado: Debian 13, RTX 5070 de 12 GB, raiz /media/projetos, Cursor em /usr/bin/cursor. A abertura com cursor -n foi validada pelo usuário. CPU e RAM total não foram informadas. Uma RTX 5080 de 16 GB foi mencionada como possibilidade futura, não como requisito ou compra definida.

Ver [arquitetura](arquitetura.md), [processos e exemplos](processos-e-exemplos.md), [roadmap](roadmap.md) e [backlog](../ideias.md).
