# Voz e ciclo de modelos

O adaptador de captura fornece áudio. O detector emite uma ativação. A sessão controla a saudação, abre a janela do pedido e encerra a captura por silêncio, limite ou cancelamento. STT transforma o pedido em texto e TTS reproduz a resposta.

| Cenário | Comportamento esperado |
| --- | --- |
| Usuário chama MOAH | Detectar localmente, falar “Estou aqui” e abrir a janela do pedido |
| Música, conversa ou saudação toca | Medir falsos disparos e impedir que a própria saída reative a sessão |
| Pedido fica em silêncio | Encerrar por timeout e voltar à espera |
| Microfone indisponível ou desligado | Exibir estado e liberar captura |
| Usuário interrompe | Cancelar o estágio ativo e descartar resposta atrasada. Interrupção falada durante TTS depende de prova de eco |
| STT ou TTS falha | Identificar a etapa e oferecer retomada controlada |
| Novo candidato | Treinar nas sessões 01/02, ajustar na 03 e congelar configuração antes da 04 |
| Candidato reprova | Registrar métricas por categoria e manter a versão em uso |
| Promoção e retorno | Registrar hash, limiar, janela e versão. Permitir voltar ao modelo anterior |

Referência operacional em [Voz](../../operacao/voz.md).

## Evolução planejada: chamada e pedido contínuos

Pedido explícito de Airton em 23/11/2026; estado: planejado, sem afirmar validação do fluxo completo. Registro: [MOAH-038](../../../ideias.md#moah-038--chamada-e-pedido-na-mesma-frase).

Quando houver chamada e pedido na mesma frase, a sessão deverá preservar o áudio completo do pedido e responder diretamente, sem exigir repetição após a saudação. A chamada isolada mantém “Estou aqui” e a espera por um novo pedido. Preservar palavras nas transições de captura, evitar processamento duplicado e separar o nome do conteúdo sem substituições indiscriminadas.

Exemplo futuro: “Moah, quais são nossas reuniões hoje?” → transcrição do pedido → consulta de calendário pelo catálogo e política → resposta falada com os eventos retornados. O adaptador de voz não consulta calendários diretamente: a consulta pertence ao conector autorizado, respeitando domínio e fuso. A integração real de agenda permanece pendente; este contrato não autoriza conexão de contas ou alteração de eventos.
