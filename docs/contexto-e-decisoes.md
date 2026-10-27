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

GPU e VRAM disponíveis, RAM, modelo local adequado, método de entrega de alertas, acesso remoto, agenda principal, horários silenciosos, autorização por ferramenta e interfaces reais dos agentes existentes.

O fuso inicial proposto é America/Sao_Paulo, configurável. Nunca deduzir uma reunião recorrente das 8h a partir do exemplo mencionado.
