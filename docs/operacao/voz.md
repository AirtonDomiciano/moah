# Voz por ativação do nome

A escuta fica desligada até uma habilitação explícita. Depois disso, o laço aguarda o nome, responde e volta a esperar, sem um botão para cada pergunta. O painel mostra o estado e oferece desligar a escuta, o que libera o microfone e não volta a ouvir sozinho.

Nesta entrega o detector que confirmaria a palavra falada “MOAH” não está instalado nem testado. `moah voz microfone` recusa a escuta contínua. A prova abaixo abre o headset só com habilitação explícita e não reconhece a palavra.

```bash
moah voz estado
moah voz simular --roteiro /caminho/roteiro.json
moah voz hardware --habilitar sim --microfone jbl
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
| Fala | texto “Estou aqui.” e a resposta | A saudação foi tocada no headset. A resposta da memória ainda não |
| Painel | `voicePanel` e `ui/src/voice-panel.ts` | Estado visível. React ainda não foi instalado nem aberto no navegador |

O buffer da solicitação tem tamanho limitado e é descartado ao fim do turno. Não há gravação de áudio ambiente. Durante a saudação e a resposta, amostras do microfone e do próprio assistente não reiniciam a ativação. “MOAH, pare”, quando é o pedido transcrito, encerra sem consultar o modelo. Enquanto o MOAH está falando, essa frase não interrompe: o controle visível “Parar resposta” faz isso. A interrupção por voz durante a fala fica pendente até um teste de eco com microfone e caixas reais.

## O que a fixture cobre

Reconhecimento rotulado de “MOAH”, ruído, música, silêncio depois da ativação, áudio marcado como do assistente, microfone indisponível, cancelamento, desligamento e detector com o modelo sem ser chamado. Isso não mede consumo de CPU nem confirma a palavra falada.

## Prova de hardware — 03/11/2026

`moah voz hardware --habilitar sim --microfone jbl` abre um dispositivo nomeado, grava cerca de um segundo, apaga o arquivo e só então toca “Estou aqui.”. Sem `--habilitar sim` o comando recusa antes de abrir o microfone. `moah voz microfone` continua recusado: esse comando seria a escuta contínua, e ela depende de um detector confirmado.

A origem escolhida foi o microfone do JBL Quantum 360, id 62, porque a origem padrão do PipeWire era a câmera Redragon. A saudação saiu no alto-falante do mesmo headset, id 61, e não no HDMI que está como destino padrão. A captura devolveu 12942 quadros a 16 kHz e pico 540. O processo de gravação encerrou antes da fala. Depois do comando, `wpctl status` não mostrava `pw-record` nem `pw-play`. Os arquivos temporários foram apagados e não entraram no Git.

Esse pico não é a palavra “MOAH”. O Spotify tocava no HDMI durante a prova, então o nível pode incluir ruído da sala. A saudação não reativou um detector porque não havia detector aberto; o que ficou comprovado é que o microfone já estava fechado quando o áudio saiu.

## Detector

Os classificadores prontos do openWakeWord, na árvore local, são alexa, hey mycroft, hey jarvis, hey rhasspy, timer e weather. Nenhum é “MOAH”. O código está em Apache 2.0. Esses classificadores, se fossem baixados, estariam em CC BY-NC-SA 4.0 e continuariam sem cobrir este nome. Os extratores de mel e de embedding já estão no disco, cerca de 1,1 MB e 1,3 MB. `silero_vad.onnx` não está e seria baixado se o carregamento padrão fosse chamado. Não foi.

O modelo local “hey pran” também não foi executado. Ele foi treinado para outra frase. Porcupine não tem arquivo de licença nem modelo `.ppn` nesta máquina; um nome personalizado dependeria da plataforma da Picovoice e de uma chave. Vosk, Whisper e Sherpa não estão instalados e servem para transcrição, não para o aceite do nome.

A decisão desta etapa é não treinar. O aceite falado fica bloqueado até existir um classificador da pronúncia “MOAH” e Airton falar o nome no microfone.

## Plano, ainda sem autorização de download ou treino

1. Gerar positivos da frase com o gerador Piper já presente na máquina, cerca de 248 MB, apontando a saída para fora deste repositório.
2. Reusar os negativos locais já usados no treino anterior: características de fala com cerca de 17 GB, ruído com cerca de 211 MB, música com cerca de 111 MB e respostas de sala com cerca de 5,9 MB. Incluir a própria saudação “Estou aqui.” como negativo.
3. Gravar, só com nova autorização, alguns exemplos da voz de Airton dizendo “MOAH” no JBL, para medir o modelo. Esses arquivos ficam fora do Git.
4. Baixar apenas `silero_vad.onnx` da release v0.5.1 se a inferência exigir o VAD. Não baixar alexa, jarvis nem os outros classificadores prontos.
5. Só depois do aceite falado: escolher STT em português e ligar a conversa de leitura a um TTS. A interface React continua sem instalação.

## O que continua sem prova

Airton ainda não falou “MOAH” para um detector. A saudação não foi medida contra um modelo aberto, então o eco da própria fala não está validado. A pergunta sobre a memória não foi falada. O painel React não foi aberto. O módulo 08 continua planejado.

Decisão: [ADR 0013](../arquitetura/decisoes/0013-voz-por-nome.md).
