# Execução — validação acústica das sessões

- Data e fuso: 03/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor, a pedido de Airton
- Prompt: validação acústica independente das sessões de voz, sem treino
- Commit do prompt: não há commit
- Execução anterior relacionada: [2026-11-03-007-sessao-01](2026-11-03-007-sessao-01.md)
- Estado: concluída no recorte pedido; a sessão 03 está incompleta e o detector continua experimental
- Escopo solicitado: validar formato, duração, saturação, atividade e bordas nas sessões 01 a 03, sem abrir a 04, sem treinar e sem alterar os WAV

## Ambiente

Node.js v22.23.3. `npm test` compilou e passou 74 testes. Nenhum pacote foi instalado. PyTorch não foi importado nem executado. `corrigir-tomadas.py` não rodou.

## Resultado

O comando `npm run moah -- voz validar` leu 22 WAV: dez da sessão 01, dez da 02 e duas da 03. A 03 está planejada com oito tomadas. A sessão 04 não foi aberta. Os papéis saíram do manifesto: 01 e 02 treino, 03 validação.

A duração esperada é 4 s, com tolerância de 0,25 s. Os critérios de RMS 250, borda de 150 ms e teto de 16 bits são os da coleta. Vinte tomadas passaram nesse envelope. Duas da sessão 01 não passaram:

- `sessao-01/tomada-08.wav`: nenhum bloco de 50 ms alcança RMS 250. O maior foi 80,1 aos 3,80 s. SHA-256 `002e33a3905d7a314f85d9d66099b221f0271bc47b0cef232111ac852a1d8dfe`.
- `sessao-01/tomada-09.wav`: atividade acústica nos primeiros 150 ms, RMS 394,7 aos 0,05 s. SHA-256 `ade6b501c0087adc53668ab3b1002ed52994aa9d41e10d2e867563eb2d32d12e`.

Nenhuma tomada saturou. O formato das 22 é 16 kHz, mono, PCM 16 bits. A duração medida ficou entre 3,796 s e 3,982 s. Cada tomada traz o aviso de que RMS e silêncio não comprovam a palavra completa nem que a fala seja “MOAH”. `palavraCompleta` permanece `nao-avaliada`.

Os SHA-256 foram conferidos antes da validação e de novo depois das duas execuções do comando. Os 22 arquivos continuam iguais. O modelo experimental permanece `04fcd7bb45fffa4a82fdcb266fd9e795691ee53228195334d1ef6fbc6b587bdf`. Não houve treino.

O ganho de captura não estava no repositório nem no manifesto. Airton informou 85%. Esse valor não foi medido. O manifesto agora guarda o informe, com `valorMedido` vazio. As sessões 01 e 02 têm deslocamento DC perto de −143. As duas tomadas da 03 têm DC perto de −2,5 e picos mais altos. A diferença foi só observada.

| Sessão | Tomada | Duração | Pico | RMS | Bordas | SHA-256 |
| --- | --- | --- | --- | --- | --- | --- |
| 01 | 01 | 3,796 s | 1670 | 254,9 | 56,5 / 65,2 | `f8338fa7335696e4c0f15f34028cde7a95d0c4fa6f72327d46a32adca94254af` |
| 01 | 02 | 3,945 s | 1577 | 201,1 | 62,6 / 70,8 | `595a10643671141ae83db10b976e0abf00403ea024fdfa91fc05c90b62252136` |
| 01 | 03 | 3,945 s | 5433 | 509,4 | 79,7 / 67,3 | `1792d4118f649414385d0d9916bc6fa1202c002a21aa5bd9e059271105c595b1` |
| 01 | 04 | 3,945 s | 2688 | 263,1 | 65,8 / 60,2 | `ee1a0c8576123a799fb2cc5b80724375819e3397a561de56c4017a5808f75d89` |
| 01 | 05 | 3,945 s | 1905 | 243,3 | 74,9 / 71,4 | `438d02e95f30f1f20b0663286b1b1aedf18c4cbaed36d930c4d813b0147cf98f` |
| 01 | 06 | 3,945 s | 1646 | 151,9 | 69,5 / 54,4 | `4d275d378c216cf15319977b03eebf3e36031f15400aff4f9cb93afbf95b80d6` |
| 01 | 07 | 3,945 s | 1928 | 152,4 | 61,5 / 68,8 | `c71b4ef25dc67e369278712c37d18419c02edd8df111861bd369f0181488446a` |
| 01 | 08 | 3,945 s | 515 | 52,3 | 51,6 / 80,1 | `002e33a3905d7a314f85d9d66099b221f0271bc47b0cef232111ac852a1d8dfe` |
| 01 | 09 | 3,945 s | 1166 | 122,1 | 394,7 / 50,5 | `ade6b501c0087adc53668ab3b1002ed52994aa9d41e10d2e867563eb2d32d12e` |
| 01 | 10 | 3,924 s | 3630 | 152,3 | 118,3 / 229,9 | `7048523b8af898f4a886b8c946e2a4425ea78b95792131e3f0a75f5432cc1691` |
| 02 | 01 | 3,982 s | 1196 | 129,8 | 57,9 / 50,4 | `601342922df0326d27f0e77d6bee4ebb40f53c2cd199eb1c898007ef5b8b48e4` |
| 02 | 02 | 3,977 s | 1579 | 147,4 | 54,5 / 63,3 | `edc8d72413c7c9eb5ee77509bfce4f2126e6e5f5b0b34fae1b5c2c0cd653b9d4` |
| 02 | 03 | 3,977 s | 1813 | 153,7 | 48,2 / 55,4 | `3197142b6740c7665557116cee657fbd807deeabbb614ef036e73bfdb987a309` |
| 02 | 04 | 3,977 s | 2399 | 262,3 | 51,5 / 123,4 | `218bce27251f06c10d758b31fd2fc1f33f7936092c9b0920a914dddcb07933d4` |
| 02 | 05 | 3,977 s | 2301 | 248,8 | 49,5 / 53,9 | `dd0090c2b08797faf905b0270b099dc2b15244c5f650d02921dccff1656c9ed4` |
| 02 | 06 | 3,977 s | 2568 | 219,7 | 63,5 / 104,6 | `7520ded2c6c4db778fc768ef59fe9c9c531fc00ab0fa1fef622a9aefdad63b63` |
| 02 | 07 | 3,977 s | 3457 | 145,9 | 65,1 / 63,3 | `09d95f0f88ecdce1c9555b3a03e2d1f2caa791948c6eef66edcc2150743bf44b` |
| 02 | 08 | 3,982 s | 1890 | 205,5 | 54,2 / 51,8 | `d88f3f2dcbdb87d69e6a119655b8009a80d1c0efd125dc420de5ad881bc1a319` |
| 02 | 09 | 3,982 s | 1801 | 155,0 | 69,7 / 49,6 | `58eda8635cb06da126fb07c2a8e32ae8ebe109fe468f1c204acd0f1b8802f0cc` |
| 02 | 10 | 3,977 s | 1564 | 154,7 | 56,8 / 46,6 | `524141cdcf9a7e7b4c6cb469c871dd483f9d5f83c1d924c61d3d75c516818f52` |
| 03 | 01 | 3,977 s | 12882 | 1033,8 | 41,2 / 35,8 | `802d17979a28834f60e1d3713837f51155fddc110985da7e0c50d3204d7e81a7` |
| 03 | 02 | 3,977 s | 7571 | 617,8 | 71,5 / 42,2 | `89672391fdbb286b3c5941cfcbdfb267abd5892e48a243b32fc4f4bc0a8ebebd` |

O registro por tomada, com métricas, avisos, motivos e hashes antes e depois, ficou em `voz/correcao/validacao-acustica.json`, fora do Git.

## Validação

Áudio sintético cobriu duração de 4 s e de 2 s, folga, silêncio, saturação, bordas e preservação dos bytes. O comando com `--sessao 04` sai com código 1 e não inclui o arquivo reservado. `npm test`: 74 testes passaram.

## Limitações e próximo passo

A aprovação acústica não identifica a palavra. A sessão 03 ainda tem seis tomadas por gravar. A sessão 04 continua reservada. O módulo 08 permanece planejado. STT não começou.

## Referência da implementação

Commit pendente. Não houve push.

Comando para repetir:

```bash
npm run moah -- voz validar
```
