# ADR 0013 — Voz por ativação do nome, sem detector confirmado

- Data: 03/11/2026
- Estado: contrato testado com fixtures; headset e treino local medidos em 03/11/2026; a voz de Airton e o aceite continuam pendentes
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

O módulo 08 continua planejado. O projeto PRAN real separa detecção ONNX, captura, transcrição e síntese. O MOAH reaproveitou o caminho de detecção e o Piper local para um modelo de “MOAH” fora do Git. O treino oficial exportou um modelo saturado em zero. A segunda passagem ficou identificada como experimental: acerta parte da voz real e dispara em música, ambiente, palavras parecidas e conversa. A correção seguinte manteve as três tomadas finais fora do treino. Só `moah-03` e `moah-04` tinham a palavra inteira entre as de treino. No limiar 0,5 o modelo novo acerta 2 de 3 tomadas separadas e não dispara na música nem no ambiente reservados, mas a saudação dispara em 8 de 9. A voz continua sem confirmação. STT e conversa ficam para a etapa seguinte.
