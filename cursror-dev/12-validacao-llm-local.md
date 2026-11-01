# Prompt 12 — Validação da conversa com um LLM local

Versão: 1.0. Data: 29/10/2026. Estado: aguardando autorização para baixar o motor e o modelo. Relatório: [execucoes/2026-10-29-002-prompt-12.md](execucoes/2026-10-29-002-prompt-12.md).

Reutiliza a conversa do [prompt 11](11-conversa-texto.md). Não conclui o módulo 02 e não inclui Obsidian, Graphify, voz, agenda ou escrita por IA.

## Prompt para o Cursor

Implemente a validação do MOAH com um LLM local real, reutilizando a conversa entregue no prompt 11.

Leia AGENTS.md, a ADR 0005, docs/operacao/conversa.md, o relatório do prompt 11 e o adaptador existente.

Inspecione Node, drivers NVIDIA, GPU, RAM, espaço livre, motores e modelos já instalados. Não altere drivers nem recrie a implementação atual.

Escolha um motor local compatível com o adaptador HTTP. Reutilize um existente, se adequado. Consulte a documentação oficial atual e registre a escolha em ADR.

Avalie Qwen3.5-9B quantizado como primeiro candidato, sem tratá-lo como escolha obrigatória. Antes de baixar, informe tamanho, destino e espaço disponível. Aguarde autorização para o download. O diretório dos modelos deve ser configurável.

Configure o MOAH para usar o endpoint e o modelo reais. Preserve o simulador como opção explícita de testes. Se o modelo real falhar, informe a falha; não substitua silenciosamente pela simulação.

Valide com registros sintéticos em diretório temporário: pendências, último checkpoint, resumo de data explícita, ausência de registros, pedido de esclarecimento, domínio escolhido e conversa que não altera registros.

Meça tempo de resposta, RAM e VRAM, modelo, quantização e contexto. Diferencie testes automatizados de avaliação real. Execute typecheck, build e testes relevantes. Documente configuração, execução, parada e diagnóstico. Registre o prompt e os resultados em cursror-dev/execucoes.

Não faça commit ou push.
