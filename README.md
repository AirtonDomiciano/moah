# MOAH — agente diretor pessoal

MOAH será o agente principal de Airton: organizar compromissos, preservar contexto e coordenar agentes especializados, apoiando sua entrada como Tech Leader.

**Estado em 28/10/2026:** planejamento documentado; nenhum módulo deste repositório está implementado ou integrado. A existência de um prompt ou de um SKILL.md não significa que o recurso funciona.

## Visão aprovada na conversa

- Funcionar continuamente no computador local, usando a GPU para inferência quando necessário.
- Acompanhar Gmail, calendário e calls; evitar perder compromissos como a call das 8h mencionada em 27/10.
- MOAH como diretor, com CTOs separados para Imex e Aluai e agentes especializados abaixo deles.
- Integrar futuramente o agente de inglês PRAN, preservando seu projeto próprio.
- Preservar memória e decisões entre Airton, ChatGPT e Cursor.
- Registrar novas ideias em Markdown versionado e transformá-las em responsabilidades e prompts.
- Explorar futuramente uma sala virtual, possivelmente com Meta Quest 3.

## Visão detalhada — atualização de 28/10/2026

Uma experiência de conversa semelhante à Alexa/Gemini, com responsabilidade por tarefas e continuidade no computador: Airton como CEO; MOAH como Diretor Geral; CTOs IMEX e ALUAI; especialistas que mantêm detalhes e prestam contas por resumos.

- [Visão do produto e identidade](docs/visao-produto.md).
- [Contratos de agentes, memória e relatórios](docs/contratos-agentes.md).
- [Processos e exemplos completos de conversa](docs/processos-e-exemplos.md).
- [Roadmap e critérios de evolução](docs/roadmap.md).

Inclui início do dia, retomada de trabalho, inglês e adiamentos, review/Azure, projetos no Cursor, diagnóstico do PC e música. Hardware informado: Debian 13 e RTX 5070 de 12 GB; CPU/RAM e escolhas de runtime ainda pendentes. Nenhuma dessas integrações está implementada neste repositório.

## Comece aqui

1. [Contexto e origem das ideias](docs/contexto-e-decisoes.md).
2. [Arquitetura proposta](docs/arquitetura.md).
3. [Backlog e perguntas abertas](ideias.md).
4. [Prompts de desenvolvimento por módulo](cursror-dev/README.md).
5. [Instruções para contribuidores e agentes](AGENTS.md).
6. [Contratos de responsabilidades do MOAH](skills/README.md).

A pasta `cursror-dev` mantém a grafia solicitada por Airton. Cada módulo contém um prompt para o Cursor executar individualmente.

## Primeiro resultado utilizável

Primeira entrega: CLI local para registrar atividades, reuniões relatadas, decisões, pendências e checkpoints, com persistência e consulta após reinício. Início pelo [prompt 00](cursror-dev/00-bootstrap-typescript.md).

Depois, evoluir para serviço contínuo, calendário, convites e lembretes persistentes. Lembretes devem funcionar mesmo com o modelo descarregado ou indisponível.

O núcleo será em Node.js com TypeScript, conforme [ADR 0001](docs/02-adrs/0001-node-typescript-e-entrega-inicial.md). Modelo de IA, motor de inferência e bibliotecas ainda dependem de inspeção e validação. O launcher e especialistas podem continuar em outras linguagens. Não iniciar todos os módulos ao mesmo tempo.

Organização: [prompts](cursror-dev/README.md), [histórico de execuções](cursror-dev/execucoes/README.md) e [decisões arquiteturais](docs/02-adrs/README.md).

## Base de engenharia

A [documentação de engenharia](docs/README.md) segue categorias inspiradas na estrutura fornecida do imex-arch, adaptadas ao MOAH. Começar pelo [catálogo](docs/_catalog/README.md). A memória privada do runtime não pertence ao Git público.
