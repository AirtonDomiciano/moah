# MOAH — agente diretor pessoal

MOAH será o agente principal de Airton: organizar compromissos, preservar contexto e coordenar agentes especializados, apoiando sua entrada como Tech Leader.

**Estado em 27/10/2026:** planejamento documentado; nenhum módulo deste repositório está implementado ou integrado. A existência de um prompt ou de um SKILL.md não significa que o recurso funciona.

## Visão aprovada na conversa

- Funcionar continuamente no computador local, usando a GPU para inferência quando necessário.
- Acompanhar Gmail, calendário e calls; evitar perder compromissos como a call das 8h mencionada em 27/10.
- MOAH como diretor, com CTOs separados para Imex e Aluai e agentes especializados abaixo deles.
- Integrar futuramente o agente de inglês PRAN, preservando seu projeto próprio.
- Preservar memória e decisões entre Airton, ChatGPT e Cursor.
- Registrar novas ideias em Markdown versionado e transformá-las em responsabilidades e prompts.
- Explorar futuramente uma sala virtual, possivelmente com Meta Quest 3.

## Comece aqui

1. [Contexto e origem das ideias](docs/contexto-e-decisoes.md).
2. [Arquitetura proposta](docs/arquitetura.md).
3. [Backlog e perguntas abertas](ideias.md).
4. [Prompts de desenvolvimento por módulo](cursror-dev/README.md).
5. [Instruções para contribuidores e agentes](AGENTS.md).
6. [Contratos de responsabilidades do MOAH](skills/README.md).

A pasta `cursror-dev` mantém a grafia solicitada por Airton. Cada módulo contém um prompt para o Cursor executar individualmente.

## Primeiro resultado utilizável

Serviço local que inicia com o sistema, sincroniza o calendário, acompanha convites do Gmail e emite lembretes persistentes. Lembretes devem funcionar mesmo com o modelo descarregado ou indisponível.

Modelo, runtime e bibliotecas ainda serão escolhidos após inspeção do ambiente real. Python é uma proposta, não uma decisão definitiva. Não iniciar todos os módulos ao mesmo tempo.
