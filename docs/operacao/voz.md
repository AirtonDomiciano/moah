# Voz por ativação do nome

A escuta fica desligada até uma habilitação explícita. Depois disso, o laço aguarda o nome, responde e volta a esperar, sem um botão para cada pergunta. O painel mostra o estado e oferece desligar a escuta, o que libera o microfone e não volta a ouvir sozinho.

Nesta entrega o detector que confirmaria a palavra falada “MOAH” não está instalado nem testado. `moah voz microfone` recusa abrir o dispositivo. O roteiro abaixo é uma simulação marcada e não reconhece áudio.

```bash
moah voz estado
moah voz simular --roteiro /caminho/roteiro.json
```

```json
{
  "simulacao": true,
  "transcricao": "Onde paramos no Ledger?",
  "resposta": "Resposta sintética.",
  "passos": [
    { "habilitar": "disponivel" },
    { "amostra": { "origin": "microfone", "kind": "nome" } },
    { "playback": true },
    { "amostra": { "origin": "microfone", "kind": "fala" } },
    { "amostra": { "origin": "microfone", "kind": "fim" } }
  ]
}
```

## Componentes

| Peça | Contrato | Estado nesta máquina |
| --- | --- | --- |
| Detector do nome | `WakeDetector` | Fixture nos testes. Nenhum motor confirmou “MOAH” |
| Fim de fala | limite de silêncio e duração máxima no laço | Testado com relógio injetado |
| Transcrição | função que recebe o buffer temporário | Fixture. Sem STT instalado |
| Conversa | `rememberAsk` chama `converse` | Somente leitura. O roteiro simulado não usa essa consulta |
| Fala | texto “Estou aqui.” e a resposta | Registrada no estado. Áudio não foi reproduzido |
| Painel | `voicePanel` e `ui/src/voice-panel.ts` | Estado visível. React ainda não foi instalado nem aberto no navegador |

O buffer da solicitação tem tamanho limitado e é descartado ao fim do turno. Não há gravação de áudio ambiente. Durante a saudação e a resposta, amostras do microfone e do próprio assistente não reiniciam a ativação. “MOAH, pare”, quando é o pedido transcrito, encerra sem consultar o modelo. Enquanto o MOAH está falando, essa frase não interrompe: o controle visível “Parar resposta” faz isso. A interrupção por voz durante a fala fica pendente até um teste de eco com microfone e caixas reais.

## O que a fixture cobre

Reconhecimento rotulado de “MOAH”, ruído, música, silêncio depois da ativação, áudio marcado como do assistente, microfone indisponível, cancelamento, desligamento e detector com o modelo sem ser chamado. Isso não mede consumo de CPU nem confirma a palavra falada.

## O que não foi comprovado no hardware

Nenhuma captura foi aberta. `arecord -l` lista ALC897, a câmera Redragon e o JBL Quantum 360, mas nenhum desses dispositivos foi lido. `espeak` e `speech-dispatcher` existem e não foram usados para tocar “Estou aqui.”. Não há medição de consumo em repouso nem durante uma solicitação real.

## Detector ainda não escolhido como funcional

A inspeção de 03/11/2026 não encontrou, no Python do sistema, openWakeWord, Porcupine, Vosk, Whisper nem Sherpa. Há um modelo local já treinado para “hey pran”, em ONNX e TFLite, fora deste repositório. Ele não é um detector de “MOAH” e não foi executado aqui. O código do openWakeWord visto nessa árvore está em Apache 2.0; os modelos pré-treinados incluídos no projeto usam CC BY-NC-SA 4.0 e cobrem frases comuns, não este nome. Um Porcupine personalizado exigiria a plataforma da Picovoice e uma licença, e a pasta local não traz essa prova.

“MOAH” precisa de um modelo próprio e de exemplos da voz falando o nome, com negativos de ruído, música e da própria resposta. Nada disso foi baixado nem treinado nesta entrega. A proposta, se for autorizada, é treinar esse modelo com openWakeWord na máquina, sem enviar áudio para um serviço externo, e só então repetir o teste com microfone e caixas.

Decisão: [ADR 0013](../arquitetura/decisoes/0013-voz-por-nome.md).
