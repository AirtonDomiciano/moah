# Prompt 16 — Voz ativada pelo nome

Data: 03/11/2026. Versão: 1.0. Estado: contrato testado com fixtures. O detector falado de “MOAH” permanece pendente. Relatório: [execucoes/2026-11-03-001-prompt-16.md](execucoes/2026-11-03-001-prompt-16.md).

Origem: pedido de Airton para a primeira interface de voz em que o nome inicia a conversa, sem um botão a cada pergunta.

## Prompt para o Cursor

Separar detector local do nome, captura com fim de fala, transcrição, a conversa de leitura já existente, resposta falada e painel de estado. Depois de uma habilitação explícita do microfone, esperar “MOAH”, responder “Estou aqui.”, ouvir o pedido e voltar a esperar. Não capturar a saudação como pedido. Encerrar no fim da fala, no silêncio ou no limite de duração. Não reativar com o áudio do próprio assistente. “MOAH, pare” interrompe quando for o pedido transcrito. Não prometer interrupção por voz durante a fala sem teste de eco no hardware.

Não salvar áudio ambiente. Usar buffer temporário limitado. Mostrar espera, escuta e fala. Desligar a escuta libera o microfone e não religa sozinho. O nome não autoriza ações. A conversa permanece somente leitura.

Inspecionar motores, licença, português e Debian antes de escolher o detector. Não afirmar que um motor reconhece “MOAH” sem teste real. Não instalar nem baixar sem autorização. A interface React mostra o estado; a captura pode ficar num processo local. Preservar o núcleo TypeScript e contratos substituíveis.

Distinguir o que a fixture provou do que microfone, caixas e voz reais provaram.
