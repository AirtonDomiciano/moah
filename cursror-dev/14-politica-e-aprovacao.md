# Prompt 14 — Política, aprovação e modelo local

Data: 02/11/2026. Versão: 1.0. Estado: executado em 02/11/2026. A frente do modelo local permanece bloqueada. Relatório: [execucoes/2026-11-02-001-prompt-14.md](execucoes/2026-11-02-001-prompt-14.md).

Origem: pedido de Airton para preparar a conversa com um modelo local e construir a primeira camada executável de governança, preservando a conversa somente leitura.

## Prompt para o Cursor

Trabalhar até concluir o escopo ou encontrar um bloqueio real.

Frente A. Retomar o prompt 12. Inspecionar motor, modelos, endpoint, GPU, RAM, disco e configuração. Se houver motor e modelo utilizáveis, rodar a avaliação real com dados sintéticos. Se a continuação exigir instalar programa, baixar modelo, alterar driver, elevar privilégio ou acessar dado externo, não executar; registrar o bloqueio e a proposta. Não trocar o modelo real pelo simulador.

Frente B. Implementar um núcleo determinístico allow/ask/deny, independente de LLM, interface e sistema operacional. A proposta identifica ação, ferramenta, agente, domínio, alvo e parâmetros. A autoridade vem do código confiável. Negar ferramenta desconhecida, domínio indevido e ampliação de permissão. Permitir só consultas já concedidas. Pedir aprovação para ação com efeito. Um sim genérico não libera ação bloqueada. Um filho não ultrapassa o supervisor.

Persistir aprovações no banco existente, com migração nova. Estados: pendente, aprovada, negada, expirada, revogada e consumida. Fingerprint canônico. Consumo único e atômico. A aprovação não nasce aprovada por texto do modelo, arquivo ou transcrição. Sem voz e sem permissão global permanente.

Demonstrar o ciclo com uma ferramenta falsa, sem efeito no computador, e com pausa persistente do executor. A decisão manual fica na CLI, fora das ferramentas do LLM. Auditar proposta, decisão, aprovação, tentativa, consumo e resultado, sem tratar o registro como log inviolável.

Fazer as consultas da conversa passarem pela política sem mudar o comportamento atual. Manter escrita, terminal e conectores desabilitados. Cobrir os testes pedidos com relógio e diretórios temporários. Rodar typecheck, build e testes. Registrar o prompt, a ADR, o guia e o relatório. Não fazer commit, push, download nem implementar voz, agenda, Obsidian, Graphify, painel, serviço ou sandbox.
