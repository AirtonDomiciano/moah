# Voz por ativação do nome

A escuta fica desligada até uma habilitação explícita. Depois disso, o laço aguarda o nome, responde e volta a esperar, sem um botão para cada pergunta. O painel mostra o estado e oferece desligar a escuta, o que libera o microfone e não volta a ouvir sozinho.

Nesta entrega o arquivo ONNX existe fora do Git, mas a palavra falada por Airton não foi confirmada. `moah voz microfone` continua recusado. A escuta nomeada exige `--habilitar sim` e o modelo completo.

```bash
moah voz estado
moah voz simular --roteiro /caminho/roteiro.json
moah voz hardware --habilitar sim --microfone jbl
moah voz escutar --habilitar sim --microfone jbl
moah voz coletar --iniciar sim --microfone jbl --vezes 8 --segundos 2
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
| Detector do nome | ONNX local, contrato `WakeDetector` | Modelo fora do Git. A voz de Airton não foi confirmada |
| Fim de fala | limite de silêncio e duração máxima no laço | Testado com relógio injetado |
| Transcrição | função que recebe o buffer temporário | Fixture. Sem STT instalado |
| Conversa | `rememberAsk` chama `converse` | Somente leitura. O roteiro simulado não usa essa consulta |
| Fala | texto “Estou aqui.” e a resposta | A saudação foi tocada no headset. A resposta da memória ainda não |
| Painel | `voicePanel` e `ui/src/voice-panel.ts` | Estado visível. React ainda não foi instalado nem aberto no navegador |

O buffer da solicitação tem tamanho limitado e é descartado ao fim do turno. Não há gravação de áudio ambiente. Durante a saudação e a resposta, amostras do microfone e do próprio assistente não reiniciam a ativação. “MOAH, pare”, quando é o pedido transcrito, encerra sem consultar o modelo. Enquanto o MOAH está falando, essa frase não interrompe: o controle visível “Parar resposta” faz isso. A interrupção por voz durante a fala fica pendente até um teste de eco com microfone e caixas reais.

## O que a fixture cobre

Reconhecimento rotulado de “MOAH”, ruído, música, silêncio depois da ativação, áudio marcado como do assistente, microfone indisponível, cancelamento, desligamento e detector com o modelo sem ser chamado. Isso não mede consumo de CPU nem confirma a palavra falada.

## Prova de hardware — 03/11/2026

`moah voz hardware --habilitar sim --microfone jbl` abre um dispositivo nomeado, grava cerca de um segundo, apaga o arquivo e só então toca “Estou aqui.”. Sem `--habilitar sim` o comando recusa antes de abrir o microfone. `moah voz microfone` continua recusado. O comando `escutar` usa o modelo treinado e também exige `--habilitar sim`; ele ainda não está confirmado.

A origem escolhida foi o microfone do JBL Quantum 360, id 62, porque a origem padrão do PipeWire era a câmera Redragon. A saudação saiu no alto-falante do mesmo headset, id 61, e não no HDMI que está como destino padrão. A captura devolveu 12942 quadros a 16 kHz e pico 540. O processo de gravação encerrou antes da fala. Depois do comando, `wpctl status` não mostrava `pw-record` nem `pw-play`. Os arquivos temporários foram apagados e não entraram no Git.

Esse pico não é a palavra “MOAH”. O Spotify tocava no HDMI durante a prova, então o nível pode incluir ruído da sala. A saudação não reativou um detector porque não havia detector aberto; o que ficou comprovado é que o microfone já estava fechado quando o áudio saiu.

## O que o PRAN permite reaproveitar

O projeto real está em `english-agent`, fora deste repositório. A detecção usa openWakeWord em ONNX, 16 kHz, mono, PCM 16 bits, quadros de 1280 amostras, em CPU. A transcrição e o diálogo usam outro caminho, hoje com serviço externo, e a síntese pode ser `espeak` ou outro provedor. O arquivo `hey_pran.onnx` reconhece outra frase e não foi usado como detector de “MOAH”. O treino local reaproveita o Piper em licença MIT, o código openWakeWord em Apache 2.0 e os negativos já presentes: características de fala em float16 no formato `(amostra, 16, 96)`, ruído e música em WAV 16 kHz mono PCM, e respostas de sala no mesmo formato. AudioSet e ACAV100M vêm de vídeo da internet e não têm licença única de redistribuição; a FMA é Creative Commons por faixa, sem um arquivo de licença nesta pasta; as respostas de sala também não trazem licença local. Nada disso foi copiado para o Git. O módulo 08 não foi implementado.

O `silero_vad.onnx` da release v0.5.1 do openWakeWord não foi baixado. A inferência usa `vad_threshold` 0, o mesmo caminho do PRAN, então o arquivo não era necessário. A licença de origem do Silero VAD é MIT.

## Treino

A saída fica em `MOAH_VOICE_DIR` ou em `~/.local/share/moah/voz`. A amostra de 8 clipes e 100 passos levou 19,8 s depois que os clipes já existiam. O maior processo chegou a cerca de 1,1 GB e a memória disponível permaneceu em cerca de 21 GB. A VRAM ficou na linha de base da área de trabalho, 977 MiB. Uma tentativa anterior, com 40 passos, falhou em 14,2 s porque o aquecimento da segunda sequência dividiu por zero. O treino completo, com 1000 clipes e 10000 passos, levou 434 s. O maior processo chegou a 2,6 GB, a memória disponível mínima foi 18,8 GB e a VRAM máxima foi 1004 MiB. O arquivo de 17 GB foi lido por fatias mapeadas, não carregado inteiro. O disco livre passou de 63,7 GB para 63,6 GB.

O modelo exportado por esse treino oficial responde cerca de 0,001 para positivos e negativos. Uma segunda passagem, só sobre as características já gravadas e sem usar a pasta de avaliação, separou o recorte interno: 165 de 200 positivos e 19 de 200 negativos acima de 0,5. Esse é o ONNX usado na escuta. O oficial foi preservado ao lado, como `moah-oficial.onnx`.

## Avaliação que não ajustou o modelo

| Grupo | Acima de 0,5 | Pico |
| --- | --- | --- |
| Saudação, inclusive “Estou aqui.” | 0 de 9 | 0,0005 |
| Frases de conversa | 0 de 12 | 0,0197 |
| Palavras parecidas | 3 de 28 | 0,9965 |
| Música reservada | 8 de 8 | 0,9988 |
| Ambiente reservado | 6 de 8 | 0,9987 |

No JBL, oito segundos de escuta sem a voz de Airton produziram um disparo em 0,80. A saudação tocou com o microfone já fechado e o processo voltou a esperar. Em outra prova, com o microfone aberto durante “Estou aqui.”, o pico foi 0,24 e não houve disparo. Ao encerrar, `wpctl` não mostrava captura. Em cinco segundos sem disparo, o processo ficou em cerca de 213 MB e a VRAM permaneceu em 985 MiB, porque o ONNX roda na CPU.

Isso não é o aceite. Airton ainda não falou “MOAH”. Música e ambiente atravessam o limiar 0,5. STT e a conversa de leitura continuam para a etapa seguinte.

A coleta, que grava só depois do início explícito e não envia o áudio, é:

```bash
npm run moah -- voz coletar --iniciar sim --microfone jbl --vezes 8 --segundos 2
```

A escuta, que não deve ser tratada como aceite enquanto os falsos disparos permanecerem, é:

```bash
npm run moah -- voz escutar --habilitar sim --microfone jbl
```

`Ctrl+C` encerra a captura.

Decisão: [ADR 0013](../arquitetura/decisoes/0013-voz-por-nome.md).
