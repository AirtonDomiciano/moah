# Radar tecnológico do MOAH

Estado em 28/10/2026. “Adotar” é direção aceita, não implantação comprovada.

| Tecnologia/prática | Estado | Motivo / condição |
| --- | --- | --- |
| Node.js + TypeScript | Adotar no núcleo | Ecossistema JS de Airton e contratos tipados; ADR 0001 |
| CLI antes de voz/IA | Adotar na primeira entrega | Validar memória e continuidade |
| SQLite | Avaliar como preferência inicial | Validar driver, versão e concorrência |
| Modelo local substituível | Direção de arquitetura | Não acoplar memória ao modelo |
| Qwen3.5-9B | Candidato | Sem benchmark real na máquina |
| Qwen3-Coder | Candidato para código | Avaliar memória e qualidade |
| Ollama / llama.cpp | Avaliar | Motores alternativos, sem escolha fechada |
| systemd de usuário | Avaliar na fase de serviço | Sem instalação automática |
| Launcher Python/PyQt6 | Projeto separado existente | Integrar por contrato; sem reescrita obrigatória |
| Framework multiagente | Adiar | Demonstrar necessidade antes de adicionar |
| Treinar modelo do zero | Fora do plano inicial | Não atende ao primeiro objetivo |

Para promover uma tecnologia, registrar problema, alternativas, versão, custo operacional e evidência. Radar não substitui ADR nem prova compatibilidade. CPU/RAM do host e orçamento de recursos permanecem pendentes.
