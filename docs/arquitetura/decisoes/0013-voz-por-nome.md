# ADR 0013 — Voz por ativação do nome, sem detector confirmado

- Data: 03/11/2026
- Estado: contrato testado com fixtures; captura e saudação medidas no headset em 03/11/2026; a palavra falada continua sem detector
- Origem: pedido de Airton para a primeira interface em que “MOAH” inicia a conversa

## Contexto

A conversa de texto já consulta a memória em modo somente leitura. No Debian desta máquina há dispositivos de captura e o binário `espeak`, mas não há motor de ativação, STT ou modelo de “MOAH” instalado no Python do sistema. Um modelo existente reconhece o treinamento de “hey pran”, não este nome.

## Decisão

- Seis contratos separados: detector do nome, fim de fala, transcrição, conversa já existente, fala e painel de estado. O detector não carrega o LLM. A conversa continua a de leitura.
- A escuta só começa com habilitação explícita. Desligar libera o microfone e não religa sozinho. O nome não autoriza executar ações.
- O áudio ambiente não é salvo. O buffer do pedido é limitado e descartado. Durante a saudação e a resposta, o microfone não reativa o nome, para a fala do próprio MOAH não virar pedido.
- “Estou aqui.” é a saudação. Silêncio até o limite volta à espera. A duração da escuta também tem limite. “MOAH, pare”, como pedido transcrito, não consulta o modelo.
- A interrupção por voz enquanto a resposta toca não é oferecida como pronta. O painel tem um controle de parar. Isso só muda depois de um teste de eco no hardware.
- `moah voz microfone` permanece recusado enquanto `confirmedOnHardware` for falso. A simulação precisa ser marcada e não é apresentada como reconhecimento.

## Alternativas

- Usar o modelo “hey pran” como se ouvisse “MOAH”: rejeitado. Não houve teste com essa palavra.
- Baixar Vosk, Whisper ou um modelo pronto de wake word: não autorizado nesta entrega.
- Interromper a fala pelo microfone agora: o eco nas caixas ainda não foi medido.

## Consequências

O módulo 08 continua planejado. No mesmo dia, `moah voz hardware --habilitar sim --microfone jbl` abriu o microfone do JBL Quantum 360, tocou “Estou aqui.” no alto-falante desse headset e liberou o dispositivo. Os classificadores prontos do openWakeWord não incluem “MOAH”; o treino não foi iniciado. A próxima prova útil continua sendo um modelo dessa pronúncia, executado enquanto Airton fala o nome.
