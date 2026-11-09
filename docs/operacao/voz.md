# Voz por ativação do nome

A escuta fica desligada até uma habilitação explícita. Depois disso, o laço aguarda o nome, responde e volta a esperar, sem um botão para cada pergunta. O painel mostra o estado e oferece desligar a escuta, o que libera o microfone e não volta a ouvir sozinho.

Nesta entrega o arquivo ONNX existe fora do Git, mas a palavra falada por Airton não foi confirmada. `moah voz microfone` continua recusado. A escuta nomeada exige `--habilitar sim` e usa o modelo experimental.

```bash
moah voz estado
moah voz simular --roteiro /caminho/roteiro.json
moah voz hardware --habilitar sim --microfone jbl
moah voz escutar --habilitar sim --microfone jbl
moah voz validar
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
| Transcrição | faster-whisper `small` local, CPU int8, idioma `pt` | Pesos em `$MOAH_VOICE_DIR/stt/faster-whisper-small`. `escutar` captura o pedido após a saudação, imprime o texto e volta a aguardar. Sem consulta à memória nem resposta falada |
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

O modelo exportado por esse treino oficial responde cerca de 0,001 para positivos e negativos, inclusive quando as características gravadas no treino entram direto no ONNX. O máximo medido em oito positivos de treino foi 0,000995. A causa está no `auto_train`: `best_val_fp` começa em 1000, acima da meta 0,2, então as sequências seguintes dobram o peso dos negativos; os checkpoints usados na média são os do fim desse peso alto. O arquivo oficial ficou em `moah-oficial.onnx`, SHA-256 `aceabf3773d1008f6da6cd74c37728d06c37bc4be19bbf427f2d636c85599a85`.

A segunda passagem, só sobre características de fala, separou o recorte interno, mas música e ambiente não eram uma classe negativa: entravam só como fundo misturado aos clipes. Esse arquivo é o experimental, `moah-experimental.onnx` e também `moah.onnx`, SHA-256 `04fcd7bb45fffa4a82fdcb266fd9e795691ee53228195334d1ef6fbc6b587bdf`. Ele não é o detector em uso.

## Avaliação que não ajustou o modelo

| Grupo | Acima de 0,5 | Pico |
| --- | --- | --- |
| Saudação, inclusive “Estou aqui.” | 0 de 9 | 0,0005 |
| Frases de conversa | 0 de 12 | 0,0197 |
| Palavras parecidas | 3 de 28 | 0,9965 |
| Música reservada | 8 de 8 | 0,9988 |
| Ambiente reservado | 6 de 8 | 0,9987 |

No JBL, oito segundos de escuta sem a voz de Airton produziram um disparo em 0,80. A saudação tocou com o microfone já fechado e o processo voltou a esperar. Em outra prova, com o microfone aberto durante “Estou aqui.”, o pico foi 0,24 e não houve disparo. Ao encerrar, `wpctl` não mostrava captura. Em cinco segundos sem disparo, o processo ficou em cerca de 213 MB e a VRAM permaneceu em 985 MiB, porque o ONNX roda na CPU.

Essa tabela é do modelo experimental, medida com outro script. A comparação nova, no mesmo script dos dois modelos, contou 7 de 8 no ambiente. Não houve ajuste de limiar depois de nenhuma das duas.

## Correção — 03/11/2026

As oito tomadas originais em `coleta/` foram lidas e não foram regravadas. Cada arquivo ficou inteiro de um lado só: `moah-01` a `moah-05` no treino, `moah-06` a `moah-08` na avaliação. Nenhuma amostra de uma gravação de avaliação entrou no treino.

Todas estão a 16 kHz, mono, PCM 16 bits, entre 1,961 s e 1,982 s, sem amostra no teto. O microfone deixa um deslocamento contínuo de cerca de −145 a −148 em todas. Sem esse deslocamento, `moah-01` e `moah-02` ficam fracas, com RMS 139 e 107; as outras seis ficam entre 315 e 765. A janela usada pelo classificador é o último 1,28 s. `moah-01` tem mais energia antes dessa janela. `moah-06` e `moah-07`, que o modelo errou, têm fala dentro dela, com RMS 380 e 300. A falha dessas duas não é corte da gravação nem arquivo corrompido. O treino novo rotula 80 janelas de música e 80 de ambiente como negativo, fora dos 16 arquivos reservados, e usa o mesmo fluxo de 1280 amostras e a janela final de 16 embeddings de 96 que a execução consulta. Numa tomada de treino, o último quadro do fluxo e a janela entregue ao classificador deram o mesmo valor, 0,9989. O limiar permaneceu 0,5 e o VAD permaneceu desligado. A avaliação não voltou para o treino.

O modelo corrigido é `moah-corrigido.onnx`, SHA-256 `1bc31a0d8cd56bad3ed3414506b0aad11bc374239c452f04ea8ebdc7effedad6`. A escuta aponta para ele e continua sem confirmação.

| Grupo | Corrigido, acima de 0,5 | Pico | Experimental no mesmo limiar |
| --- | --- | --- | --- |
| Tomadas reais separadas | 1 de 3 (`moah-08`, 0,63; `moah-06` 0,05; `moah-07` 0,03) | 0,6349 | 2 de 3 (`moah-07` e `moah-08`; `moah-06` 0,02) |
| Palavras parecidas | 0 de 28 | 0,0041 | 23 de 28 |
| Saudação, inclusive “Estou aqui.” | 0 de 9 | 0,0218 | 0 de 9 |
| Frases de conversa | 0 de 12 | 0,0063 | 9 de 12 |
| Música reservada, 239,9 s | 1 de 8, 15 acionamentos/hora | 0,6092 | 8 de 8, 855/hora |
| Ambiente reservado, 80 s | 1 de 8, 45 acionamentos/hora | 0,8283 | 7 de 8, 405/hora |

As cinco tomadas usadas no treino passaram de 0,998. Isso mostra memória dessas cinco gravações, não uma voz nova. Subir o limiar não recupera `moah-06` nem `moah-07`, porque os dois ficam abaixo de 0,05, e apagaria o único acerto separado, que chegou a 0,63. O VAD não foi ligado.

Sessenta segundos de silêncio produziram um pico de 0,98 entre 1,52 s e 1,60 s, na entrada do fluxo, e depois o pico foi 0,0015. A taxa de 60 acionamentos/hora nesse minuto descreve esse arranque, não o silêncio contínuo.

A escuta voltou ao modelo experimental, `moah-experimental.onnx`. Os modelos corrigidos ficam ao lado e não são o detector em uso.

## Coleta por sessão

As oito tomadas já gravadas permanecem. A coleta nova entra em `coleta/sessoes/` e recusa a sessão se já houver arquivo. Cada sessão tem 4 segundos, com silêncio antes e depois da palavra, contagem visual e reprodução opcional. Um aviso de possível corte olha só o envelope; energia e silêncio não comprovam a palavra.

O papel de cada sessão foi marcado antes de existir áudio: 01 e 02 treinam, 03 valida, 04 é o teste fechado. São 36 tomadas. Os números já vistos, inclusive `moah-06` a `moah-08` e os clipes atuais de saudação, parecidas, música e ambiente, não serão o teste final do próximo modelo.

A sessão 01 já está em `coleta/sessoes/sessao-01/`, com dez tomadas de 3,80 s a 3,95 s, 16 kHz, mono, PCM 16 bits, sem saturação. O deslocamento do microfone continua perto de −143. Nenhuma borda alta em `tomada-01` a `tomada-07` nem em `tomada-10`. `tomada-08` fica com RMS 52 e o maior bloco de 50 ms em 80, nível baixo. `tomada-09` tem o maior bloco nos primeiros 0,05 s, possível corte no início. Esses avisos não dizem se a palavra está completa. Os arquivos não foram regravados.

A validação acústica é outra etapa, em TypeScript, e não importa PyTorch, não treina e não abre modelo. O comando lê as sessões 01, 02 e 03. A sessão 04 continua fechada: `moah voz validar --sessao 04` para antes de abrir a pasta. A duração esperada vem do manifesto, 4 s, com tolerância de 0,25 s por causa da parada da captura. Uma tomada de 2 s só passa quando a duração esperada é 2 s. O RMS 250, a borda de 150 ms e o teto de 16 bits continuam os mesmos da coleta. Aprovar o envelope não afirma que a palavra esteja completa nem que a fala seja “MOAH”.

```bash
npm run moah -- voz validar
```

Na leitura de 03/11/2026, as sessões 01 e 02 tinham dez tomadas e a 03 tinha duas das oito. Vinte passaram no envelope e duas da sessão 01 não: `tomada-08` ficou com o maior bloco de 50 ms em 80, e `tomada-09` teve atividade nos primeiros 150 ms. Nenhuma saturou. Os SHA-256 conferidos antes e depois são os mesmos. O ganho de captura não estava nos arquivos; Airton informou 85%. O manifesto guarda esse informe com valor medido vazio. O registro completo fica em `voz/correcao/validacao-acustica.json`, fora do Git.

Em 08/11/2026 a sessão 03 ficou completa com oito tomadas aprovadas no envelope. Nas sessões 01 e 02, 18 tomadas passaram e as mesmas duas da 01 continuam reprovadas. Airton conferiu de ouvido as aprovadas de 01 e 02. O script `scripts/voz/candidato.py` treinou `moah-candidato.onnx` só com essas 18, usando o quadro da fala, e manteve `moah-experimental.onnx` como detector em uso. Negativos de treino: “Estou aqui” via espeak, palavras parecidas e conversa geradas no treino, mais música/ambiente não reservados. Os WAV de `avaliacao/gerado` e a sessão 03 não entraram no treino. A sessão 04 não foi aberta.

A sessão 03 escolheu o limiar 0,95 (máximo de acertos, depois menos falsos). Comparação no mesmo conjunto negativo (416,25 s):

| Modelo | Limiar | Acertos sessão 03 | Saudação | Parecidas | Conversa | Música | Ambiente |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Candidato | 0,95 | 8 de 8 | 9 de 9 | 27 de 28 | 12 de 12 | 2 de 8 | 4 de 8 |
| Experimental (em uso) | 0,95 | 5 de 8 | 0 de 9 | 18 de 28 | 8 de 12 | 8 de 8 | 2 de 8 |
| Experimental (em uso) | 0,5 | 7 de 8 | 0 de 9 | 23 de 28 | 9 de 12 | 8 de 8 | 7 de 8 |

O diagnóstico de 08/11/2026 mostrou que o treino só rotulava a janela final; o falso disparava numa janela intermediária. A correção seguinte extrai janelas com o mesmo pad/passo da escuta: positivos só quando a janela cobre a palavra; negativos de fala com intermediárias e transição; Piper em `treino/piper/`, separado de `avaliacao/gerado`. O candidato novo (`49ac8909…`, com `.pt`) manteve 8/8 na sessão 03 e, no limiar 0,95, reduziu falsos de fala de 48 para 7 frente a `f5d9784…` (saudação 9→0). Música/ambiente pioraram nesse candidato; ele não foi promovido. Experimental e sessão 04 intactos.

```bash
/home/airtondev/hey_pran_work/hey_pran_env/bin/python scripts/voz/candidato.py avaliar
```

No embedding, com a janela medida um segundo depois do pico, `moah-03` e `moah-04` ficam em cosseno 0,67. A saudação fica a 0,67 e 0,62. A distância entre a palavra e a saudação é da mesma ordem da distância entre duas falas da palavra. O último treino tinha muitas janelas de música e duas saudações negativas. Mais repetições iguais de “MOAH” não separam essas classes sozinhas. Num arquivo de 4 s, o quadro final pode ser só o silêncio; o treino das sessões usa o quadro da fala.

Isso não é o aceite. A sessão 04 continua reservada para o teste final. O STT offline entra no `escutar` após “Estou aqui.”; a conversa de leitura falada continua para a etapa seguinte.

## Tomadas originais — 03/11/2026

Os oito WAV foram medidos de novo e os hashes não mudaram. A coleta agora recusa um nome que já existe, em vez de gravar por cima. A divisão continua por arquivo inteiro: `moah-01` a `moah-05` no grupo de treino, `moah-06` a `moah-08` na avaliação. As variações foram geradas depois dessa divisão e só a partir de trechos completos do próprio grupo.

A regra, aplicada antes do treino, exige um trecho com RMS de 50 ms acima de 250, duração de pelo menos 0,40 s, começo depois de 0,08 s, fim pelo menos 0,08 s antes do final e silêncio nas duas bordas. Nenhuma tomada satura. `moah-01`, `moah-02` e `moah-05` não têm esse trecho. `moah-03` tem de 0,30 s a 1,20 s e `moah-04` de 0,90 s a 1,35 s. Na avaliação, `moah-06` e `moah-07` têm trecho completo; `moah-08` encosta energia nas bordas e não passou na regra.

O treino seguinte usou só as regiões completas de `moah-03` e `moah-04`, com ganho e deslocamento dentro da janela, mais clipes sintéticos. Música e ambiente não reservados, palavras parecidas, a saudação e os quadros de silêncio do arranque entraram como negativo. O arquivo anterior ficou em `moah-corrigido-v1.onnx`. O novo é `moah-corrigido.onnx`, SHA-256 `b55bd331aa7161b4252ed35253bb884fa79b896518f972f054d55be606d12c57`. Limiar 0,5, VAD desligado. A avaliação não voltou para o treino.

| Grupo | Novo corrigido | Pico |
| --- | --- | --- |
| Tomadas reais separadas | 2 de 3 (`moah-06` e `moah-08`; `moah-07` em 0,02) | 0,9993 |
| Música reservada, 239,9 s | 0 de 8, 0 acionamentos/hora | 0,172 |
| Ambiente reservado, 80 s | 0 de 8, 0 acionamentos/hora | 0,341 |
| Silêncio de 60 s | 0 acionamentos | 0,0011 |
| Saudação | 8 de 9 | 0,9993 |
| Palavras parecidas | 20 de 28 | 0,9992 |
| Frases de conversa | 8 de 12 | 0,9987 |

Música, ambiente e silêncio contínuo ficaram abaixo do limiar. A saudação e as palavras parecidas passaram a disparar. Subir o limiar não recupera `moah-07`. Duas tomadas reais completas não bastam para separar “MOAH” de outra fala. O modelo experimental não foi substituído.

A escuta, que não deve ser tratada como aceite, é:

```bash
npm run moah -- voz escutar --habilitar sim --microfone jbl
```

`Ctrl+C` encerra a captura.

Decisão: [ADR 0013](../arquitetura/decisoes/0013-voz-por-nome.md).
