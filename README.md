# MOAH — agente diretor pessoal

MOAH será o agente principal de Airton: organizar compromissos, preservar contexto e coordenar agentes especializados, apoiando sua entrada como Tech Leader.

**Estado em 28/10/2026:** o [prompt 00](cursror-dev/00-bootstrap-typescript.md) entregou uma CLI local de memória de trabalho, testada neste repositório. Os módulos 01 a 10 continuam planejados. A existência de um prompt ou de um SKILL.md não significa que o recurso funciona.

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

- [Visão do produto e identidade](docs/produto/visao.md).
- [Contratos de agentes, memória e relatórios](docs/arquitetura/agentes-e-memoria.md).
- [Processos e exemplos completos de conversa](docs/produto/exemplos.md).
- [Roadmap e critérios de evolução](docs/produto/roadmap.md).

Inclui início do dia, retomada de trabalho, inglês e adiamentos, review/Azure, projetos no Cursor, diagnóstico do PC e música. Hardware informado: Debian 13 e RTX 5070 de 12 GB; CPU/RAM e escolhas de runtime ainda pendentes. Nenhuma dessas integrações está implementada neste repositório.

## Comece aqui

1. [Contexto e origem das ideias](docs/produto/historico.md).
2. [Arquitetura proposta](docs/arquitetura/visao-geral.md).
3. [Backlog e perguntas abertas](ideias.md).
4. [Prompts de desenvolvimento por módulo](cursror-dev/README.md).
5. [Instruções para contribuidores e agentes](AGENTS.md).
6. [Contratos de responsabilidades do MOAH](skills/README.md).

A pasta `cursror-dev` mantém a grafia solicitada por Airton. Cada módulo contém um prompt para o Cursor executar individualmente.

## Primeiro resultado utilizável

A CLI local registra atividades, reuniões relatadas, decisões, pendências e checkpoints, e consulta esses dados depois que o processo termina. Entrega do [prompt 00](cursror-dev/00-bootstrap-typescript.md); relatório em [execuções](cursror-dev/execucoes/2026-10-28-001-prompt-00.md). Escolhas de runtime e SQLite: [ADR 0001](docs/arquitetura/decisoes/0001-node-typescript-e-entrega-inicial.md) e [ADR 0003](docs/arquitetura/decisoes/0003-persistencia-sqlite-cli.md).

Serviço contínuo, calendário, convites e lembretes ficam para as etapas seguintes. Lembretes, quando existirem, devem funcionar mesmo com o modelo descarregado. A conversa de leitura usa um provedor configurável e, por padrão, um simulador; os demais comandos não chamam modelo. O launcher e os especialistas podem continuar em outras linguagens.

Organização: [prompts](cursror-dev/README.md), [histórico de execuções](cursror-dev/execucoes/README.md) e [decisões arquiteturais](docs/arquitetura/decisoes/README.md).

## CLI de memória de trabalho

Requer Node.js `>=22.16.0 <23`. A verificação desta entrega usou Node 22.23.3, npm 10.9.9, TypeScript 5.9.3 e o SQLite 3.51.3 embutido no Node.

```bash
npm install
npm run typecheck
npm run build
npm test
npm run moah -- ajuda
```

O banco fica fora do Git: `$MOAH_DATA_DIR`, ou `$XDG_DATA_HOME/moah`, ou `~/.local/share/moah`, no arquivo `moah.sqlite`. O fuso padrão é `America/Sao_Paulo`. Para mudá-lo, grave `config.json` em `$MOAH_CONFIG_DIR`, `$XDG_CONFIG_HOME/moah` ou `~/.config/moah`:

```json
{ "timezone": "America/Sao_Paulo" }
```

Exemplo sintético executado em 28/10/2026, com diretórios temporários e saída humana:

```bash
npm run moah -- registrar reuniao \
  --dominio imex \
  --projeto financeiro \
  --quando 2026-10-28T09:00 \
  --texto "Reunião sintética do financeiro" \
  --decisao "Manter o registro manual" \
  --acao "Mapear casos de teste"
```

```text
Registro rec_ef5fa6d3-df87-487d-a4b5-b9c1692398de
Tipo: reunião
Domínio: imex
Projeto: financeiro
Quando: 2026-10-28 09:00:00 (-03:00)
Origem: user_report
Agente: manual
Texto: Reunião sintética do financeiro
Decisões:
  - Manter o registro manual
Ações:
  - act_295a0dff-3e57-4844-b696-0629536e370e [pendente] Mapear casos de teste; sem prazo
```

Outros comandos da mesma gramática, também exercitados com dados sintéticos: `listar dia`, `pendencias`, `concluir <id>`, `checkpoint`, `onde-paramos` e `resumo`. `--json` escreve só JSON na saída padrão. `--quando sexta` termina com código 1, mensagem na saída de erro e nenhum registro novo.

`moah conversar --dominio pessoal --texto "quais são as pendências?"` consulta esses registros em linguagem natural. Sem configuração de modelo, a resposta vem do simulador e informa que a validação real está pendente. O caminho da mensagem, a troca do modelo e os erros estão em [docs/operacao/conversa.md](docs/operacao/conversa.md). Entrega do [prompt 11](cursror-dev/11-conversa-texto.md); decisão na [ADR 0005](docs/arquitetura/decisoes/0005-conversa-texto-e-provedor.md).

Uma ação com responsável e prazo usa `descricao ;; responsavel=Nome ;; prazo=AAAA-MM-DD`.

### Limitações desta CLI

- A linguagem natural cobre pendências, resumo de uma data explícita e último checkpoint. A conversa não edita, não apaga e não conclui registros.
- Reunião registrada é relato do usuário. Não há leitura de agenda nem inferência de presença.
- O resumo do dia agrupa os registros daquele dia civil e mostra o estado atual das ações.
- Origem aceita: `user_report`. Agente aceito: `manual`.
- Sem serviço, fila, servidor HTTP, microfone ou conta externa. O cliente de modelo é opcional; o padrão é o simulador, e nenhum modelo real foi validado em 29/10/2026.
- Em Node 22, `node:sqlite` ainda é experimental na documentação da linha. O aviso é suprimido na CLI.
- Duas invocações simultâneas esperam um lock de até 5 segundos. Se o banco continuar ocupado, a segunda falha sem substituir o arquivo.

## Documentação por responsabilidade

- [Produto](docs/produto/README.md): visão, exemplos e roadmap.
- [Arquitetura](docs/arquitetura/README.md): componentes, agentes e decisões.
- [Desenvolvimento](docs/desenvolvimento/README.md): processo, padrões e limites.
- [Operação](docs/operacao/README.md): execução, métricas e lições.

Índice em [docs/README.md](docs/README.md). Prompts e execuções continuam em cursror-dev. Memória privada fica fora do Git.
