# Radar tecnológico do MOAH

Estado em 28/10/2026, com a linha da conversa revisada em 29/10/2026. “Adotar” na CLI indica escolha verificada. O restante continua direção, sem implantação comprovada.

| Tecnologia/prática | Estado | Motivo / condição |
| --- | --- | --- |
| Node.js 22.x + TypeScript | Adotar no núcleo | Linha 22.16+ verificada no prompt 00 com Node 22.23.3; ADR 0003. Node 24/26 não exercitados |
| npm | Adotar na CLI | Gerenciador presente com o Node verificado; lockfile no repositório |
| CLI antes de voz/IA | Adotado na primeira entrega | Comandos de memória testados no prompt 00 e continuam sem modelo |
| Contrato HTTP de conversa | Adotado no prompt 11 | Chat completions configurável e simulador padrão. Modelo real ainda não validado nesta máquina. ADR 0005 |
| SQLite via node:sqlite | Adotar na CLI | DatabaseSync e SQLite 3.51.3 no Node 22.23.3; módulo ainda experimental na documentação 22.x. WAL, migração e lock entre processos |
| Modelo local substituível | Direção de arquitetura | Não acoplar memória ao modelo |
| Qwen3.5-9B | Candidato | Sem benchmark real na máquina |
| Qwen3-Coder | Candidato para código | Avaliar memória e qualidade |
| Ollama / llama.cpp | Avaliar | Em 29/10/2026 os binários não estavam no PATH e as portas locais habituais recusaram conexão |
| systemd de usuário | Avaliar na fase de serviço | Sem instalação automática |
| Launcher Python/PyQt6 | Projeto separado existente | Integrar por contrato; sem reescrita obrigatória |
| Framework multiagente | Adiar | Demonstrar necessidade antes de adicionar |
| Treinar modelo do zero | Fora do plano inicial | Não atende ao primeiro objetivo |

Para promover uma tecnologia, registrar problema, alternativas, versão, custo operacional e evidência. Radar não substitui ADR nem prova compatibilidade. CPU/RAM do host e orçamento de recursos permanecem pendentes.

## Conhecimento visual — 29/10/2026

Obsidian: adotar como interface de notas e grafo, integração ainda planejada. Graphify: direção aprovada para uso complementar, condicionada a prova de conceito de privacidade, compatibilidade e recursos. SQLite permanece fonte operacional. [ADR 0006](decisoes/0006-obsidian-e-graphify.md).
