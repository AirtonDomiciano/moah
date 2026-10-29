# Prompts de desenvolvimento para o Cursor

Usar um módulo por vez. Os arquivos contêm prompts completos para copiar ao Cursor com este repositório aberto. A grafia da pasta segue o pedido original.

## Ordem e dependências

| Módulo | Responsabilidade | Depende de |
| --- | --- | --- |
| [01](01-servico-local.md) | Base e execução contínua | — |
| [02](02-inferencia-gpu.md) | Modelo local e GPU | 01 |
| [03](03-gmail-calendario.md) | Conectores de leitura | 01 |
| [04](04-agenda-alertas.md) | Agenda e notificações | 03 |
| [05](05-memoria-compartilhada.md) | Memória e decisões | 01 |
| [06](06-diretor-e-ctos.md) | Orquestração e empresas | 05 |
| [07](07-rotina-tech-leader.md) | Apoio à liderança | 04, 05, 06 |
| [08](08-pran-e-voz.md) | Agente de inglês e voz | 02, 06 |
| [09](09-painel.md) | Estado e controle | 04, 06 |
| [10](10-sala-virtual.md) | Estudo de interface virtual | 09 |

02 e 03 são independentes depois de 01. O ponto de entrada atual é o prompt 00 abaixo: um recorte explícito de 01/05 para memória de trabalho. Depois retomar fundação contínua e agenda; não implementar todos os módulos juntos. Não é necessário modelo para testar alertas.

## Instruções comuns a todos os prompts

Ler AGENTS.md e docs/ antes de começar. Inspecionar o código e o ambiente. Tratar tecnologias descritas como propostas até validar sua adequação. Executar apenas o módulo solicitado e preservar o restante. Não usar credenciais reais em fixtures, logs ou commits.

Antes de mudanças, informar abordagem e arquivos afetados. Implementar, validar comportamentos essenciais, atualizar documentação com evidência e limitações e entregar resumo com instruções de execução. Não publicar alterações em outros projetos ou executar ações externas sem autorização específica.

Nenhum módulo de 01 a 10 está concluído. O prompt 00 entregou a CLI de memória de trabalho; o relatório está em [execuções](execucoes/2026-10-28-001-prompt-00.md). O prompt 11 acrescenta a conversa de leitura sobre essa memória, com simulador; o relatório está em [execuções](execucoes/2026-10-29-001-prompt-11.md). O módulo 02 continua planejado.

## Especificações ampliadas de 28/10/2026

Antes do módulo afetado, consultar [visão](../docs/produto/visao.md), [contratos](../docs/arquitetura/agentes-e-memoria.md), [processos](../docs/produto/exemplos.md) e [roadmap](../docs/produto/roadmap.md).

Os prompts 02, 04, 05, 06, 07, 08 e 09 foram refinados para a visão atual. Launcher, bot de review/Azure, diagnóstico e mídia são extensões: seus adaptadores reais ainda devem ser levantados. Não tratá-los como entregas obrigatórias de um único módulo. Preservar a sequência de fundação/agenda; escolher uma integração por vez.

## Comece pelo prompt 00

[00 — Fundação TypeScript e primeiro registro de trabalho](00-bootstrap-typescript.md), versão 1.0: executado em 28/10/2026. Entrega CLI local e memória persistente. Relatório em [execuções](execucoes/2026-10-28-001-prompt-00.md). Direção em [ADR 0001](../docs/arquitetura/decisoes/0001-node-typescript-e-entrega-inicial.md) e [ADR 0003](../docs/arquitetura/decisoes/0003-persistencia-sqlite-cli.md).

[11 — Conversa por texto sobre a memória de trabalho](11-conversa-texto.md), versão 1.0: executado em 29/10/2026. Consulta pendências, resumo de data explícita e último checkpoint. O simulador está validado; o modelo real, não. Relatório em [execuções](execucoes/2026-10-29-001-prompt-11.md). Decisão em [ADR 0005](../docs/arquitetura/decisoes/0005-conversa-texto-e-provedor.md).

## Organização de prompts e decisões

- Prompts completos e versionados: esta pasta.
- Relatórios de cada execução: [execucoes](execucoes/README.md).
- Decisões arquiteturais: [docs/arquitetura/decisoes](../docs/arquitetura/decisoes/README.md).
- Ideias e contexto: ../ideias.md e ../docs/produto/historico.md.

Identificar cada prompt por número, versão, data, escopo e estado. Registrar execução real com commit de origem e resultados; não marcar “executado” só porque o arquivo foi publicado. Não renomear esta pasta nem duplicar prompts em outro catálogo.
