# Contexto e decisões — 27/10/2026

## Origem e limites da consolidação

Consolidação da conversa atual e dos trechos de conversas anteriores disponibilizados no contexto. Uma busca complementar de histórico foi tentada, mas estava indisponível. Portanto, este documento não é uma exportação integral de todas as conversas.

Nenhum segredo, senha ou conteúdo privado de Gmail foi copiado para este repositório público.

## Pedidos e ideias de Airton

| Tema | O que foi discutido | Estado |
| --- | --- | --- |
| Rotina de Tech Leader | Criar fluxo organizado para demandas, compromissos e acompanhamento | Objetivo |
| Agenda | MOAH responsável por acompanhar Gmail e calls; call das 8h como motivação | Prioridade inicial |
| Execução local | Usar a própria placa de vídeo e manter o agente funcionando continuamente | Requisito |
| Hierarquia | Airton acima do MOAH diretor; CTO Imex e CTO Aluai; agentes subordinados | Visão |
| Inglês | Agente de inglês como auxiliar especializado | Integração futura |
| Memória | Conversas entre Airton, ChatGPT e Cursor com continuidade; interesse no claude-mem | Ideia a especificar |
| Conhecimento | Notion citado como possível lugar de organização e consulta futura | Integração candidata |
| Interface | Sala virtual com agentes; interesse em Meta Quest 3 | Exploração futura |
| Evolução | Registrar ideias em Markdown no GitHub e organizar prompts para Cursor | Autorizado |
| Sequência anterior | Airton cogitou terminar o agente de inglês antes de desenvolver o MOAH | Discussão anterior; não bloqueia documentação atual |

## PRAN: progresso mencionado fora deste repositório

Airton relatou possuir `hey_pran.onnx` e `hey_pran.tflite`, resultantes do treinamento da palavra de ativação “hey pran”. Isso não comprova que os arquivos estejam neste repositório ou que a integração esteja pronta. A voz sintetizada é uma camada diferente da detecção da palavra de ativação; a arquitetura deverá permitir sua substituição independente.

## Propostas técnicas desta documentação

Não são decisões já aprovadas de tecnologia: serviço Python, armazenamento SQLite inicial, runtime local com API, notificações desktop e execução via systemd no Debian. Confirmar adequação no módulo correspondente.

Usar a GPU sob demanda; um serviço de agenda não precisa de inferência contínua. Considerar política de descarregamento e modo jogo. Modelo carregado pode ocupar VRAM mesmo ocioso.

## Pendências materiais

RAM e CPU disponíveis, modelo local adequado, método de entrega de alertas, acesso remoto, agenda principal, horários silenciosos, autorização por ferramenta e interfaces reais dos agentes existentes.

O fuso inicial proposto é America/Sao_Paulo, configurável. Nunca deduzir uma reunião recorrente das 8h a partir do exemplo mencionado.


## Atualização de 28/10/2026 — pedidos explícitos

- Airton quer um assistente pessoal semelhante à Alexa/Gemini com responsabilidade por tarefas na máquina, incluindo conversa natural e voz.
- Hierarquia: Airton CEO → MOAH Diretor Geral → CTO IMEX / CTO ALUAI → especialistas. Especialistas pessoais podem responder diretamente ao diretor.
- Todos os especialistas devem manter o detalhe e enviar resumos ao MOAH. Inglês deve registrar o estudo e a evolução e prestar contas por resumo.
- Início de sessão: cumprimento opcional e resposta a “temos alguma urgência?”, “tem alguma call?” e “paramos aonde?”.
- Inglês no cotidiano e convite proativo, com exemplo de 16h30 e adiamento de 15 minutos após “agora não”.
- Trabalho completo: executar bot de review de uma US e publicar o resultado no Azure quando solicitado.
- Gerenciador de projetos separado do MOAH, integrado por ações reutilizáveis.
- Agente de diagnóstico do PC para consumo e sugestões, incluindo recursos do próprio MOAH.
- Controle de música, player e volume por linguagem natural.
- Personalização ao jeito de Airton e possível uso como portfólio profissional.

### Ambiente confirmado pelo usuário

Debian 13; RTX 5070 com 12 GB; raiz /media/projetos; Cursor em /usr/bin/cursor. Abertura com cursor -n validada pelo usuário. CPU e RAM total permanecem desconhecidas. RTX 5080 de 16 GB é uma possibilidade futura mencionada, não decisão de aquisição.

### Propostas técnicas e pendências

Contratos de relatório, estados de tarefa, referências de memória, fila de inferência e critérios de validação são propostas documentadas para implementar os pedidos. Não há stack definitiva, integração pronta ou benchmark. A rotina de inglês não foi agendada; horários de conversa são exemplos.

Documentação detalhada: [visão](visao-produto.md), [contratos](contratos-agentes.md), [processos](processos-e-exemplos.md) e [roadmap](roadmap.md). Esta atualização complementa o registro anterior; não é uma exportação integral de chats.


## Referência de parceria — 28/10/2026

Pedido explícito de Airton: “Pra ser bem sincero quero meio que vc seja o MOAH.” Confirmação posterior: quer levar nosso modo de conversar e colaborar ao PC, com continuidade e execução por agentes.

Decisão de produto: usar esta parceria como referência de tom, personalidade e comportamento; MOAH como interlocutor principal, capaz de sugerir, questionar e acompanhar tarefas. A continuidade será construída com memória e integrações autorizadas, sem presumir transferência automática da conversa ou acesso a todo o histórico. Modelo/provedor ainda não escolhidos.

Detalhamento e critérios de aceite em [visão do produto](visao-produto.md#8-referência-de-personalidade-e-parceria--pedido-explícito). Registrar a preferência não executa importação de chats.


## Prioridade e registros transversais — 28/10/2026

Airton confirmou que quer iniciar pelo MOAH para apoiar sua entrada como Tech Lead e pediu registrar estas decisões.

- Aplicar o padrão do inglês em todas as áreas: o especialista guarda o histórico detalhado e reporta resumo com referências ao diretor.
- Registrar o que foi feito, calls com participação confirmada, decisões, responsabilidades e próximos passos.
- Não confundir presença em reunião com evento da agenda; entrada manual é válida, identificada como relato.
- Primeira experiência: início do dia, pendências e retomada; memória de trabalho e fechamento do dia; depois primeiro especialista com bot de review/US.
- Construir software próprio sobre modelo substituível. Não iniciar treinamento de modelo do zero.
- Qwen3.5-9B e Qwen3-Coder foram sugestões de avaliação, não escolhas aprovadas ou benchmarks.
- Serviço e persistência continuam como fundação, agenda funciona sem IA. Voz/música e outros agentes não bloqueiam a primeira entrega.

A sequência é uma orientação de produto, não autorização para executar integrações corporativas reais. A prioridade inicial de agenda é ampliada com memória de trabalho e continuidade profissional. Ver [visão](visao-produto.md) e [roadmap](roadmap.md).
