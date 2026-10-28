# Base de conhecimento de engenharia do MOAH

Inspirada na estrutura imex-arch descrita por Airton em 28/10/2026, adaptada ao MOAH. Fonte: descrição fornecida pelo usuário; não é cópia nem inspeção do repositório interno da empresa.

## Navegação

| Área | Pergunta | Conteúdo do MOAH |
| --- | --- | --- |
| [_catalog](_catalog/README.md) | Onde está a informação? | Mapa temático e fontes canônicas |
| [00-governance](00-governance/README.md) | Como trabalhamos? | Processo de desenvolvimento e rastreabilidade |
| [01-tech-radar](01-tech-radar/README.md) | O que usamos ou avaliamos? | Estado das tecnologias e critérios |
| [02-adrs](02-adrs/README.md) | Por que decidimos assim? | Decisões e alternativas |
| [03-guidelines](03-guidelines/README.md) | Como implementar? | Padrões para núcleo, agentes e testes |
| [04-anti-patterns](04-anti-patterns/README.md) | O que evitar? | Erros arquiteturais recorrentes |
| [05-guardrails](05-guardrails/README.md) | Quais limites são obrigatórios? | Dados, autoridade e recursos |
| [06-playbooks](06-playbooks/README.md) | Como executar uma tarefa? | Procedimentos reproduzíveis |
| [07-lessons-learned](07-lessons-learned/README.md) | O que aprendemos? | Problema, evidência e correção |
| [08-metrics](08-metrics/README.md) | Como medir evolução? | Indicadores e método de medição |
| [09-domain-knowledge](09-domain-knowledge/README.md) | Como o MOAH funciona? | Domínio pessoal e coordenação de agentes |

[AGENTS.md](AGENTS.md) orienta a navegação dos agentes. A autoridade geral do repositório está em [../AGENTS.md](../AGENTS.md).

## Documentos existentes e fonte única

[Visão](visao-produto.md), [arquitetura](arquitetura.md), [contratos](contratos-agentes.md), [processos e exemplos](processos-e-exemplos.md), [contexto histórico](contexto-e-decisoes.md) e [roadmap](roadmap.md) permanecem nos caminhos atuais para preservar links. O catálogo aponta para eles; não duplicar conteúdo integral em cada categoria. Movimentos futuros precisam atualizar referências e histórico.

Prompts executáveis permanecem em [cursror-dev](../cursror-dev/README.md); relatórios ficam em [execucoes](../cursror-dev/execucoes/README.md). A grafia existente é preservada.

## Ciclo de trabalho

Consultar contexto → delimitar tarefa → verificar regras e decisões → implementar → validar → registrar execução → atualizar decisão, lição e métricas quando houver evidência.

Não é uma sequência rígida entre pastas. Conhecimento de domínio informa decisões desde o início; métricas e lições retroalimentam as demais áreas.

## Documentação pública e memória privada

Esta base explica a engenharia do MOAH. A memória que ele usa sobre reuniões, estudos e trabalho pertence ao runtime privado. Usar exemplos sintéticos aqui; não publicar histórico real de inglês, caixa postal, decisões empresariais, tokens ou dados pessoais. Só estruturar uma pasta não implementa uma capacidade.
