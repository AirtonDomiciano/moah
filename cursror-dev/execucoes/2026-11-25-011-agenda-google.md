# Execução — agenda Google por voz

- Data e fuso: 25/11/2026, America/Sao_Paulo
- Responsável/ferramenta: Cursor, neste capítulo
- Prompt: pedido de Airton nesta conversa
- Commit do prompt: pendente
- Execução anterior relacionada: [2026-11-25-010](2026-11-25-010-lembrete-recorrente.md)
- Estado: concluída no recorte local; a conta real fica para Airton conectar
- Escopo solicitado: leitura da agenda Google por voz, OAuth de aplicativo local, tokens fora do Git. Sem Gmail, Discord, WhatsApp nem envio.

## Resultado

`moah conta google conectar` usa o fluxo oficial de aplicativo de computador: navegador, redirect `http://127.0.0.1` e PKCE S256. O escopo é só `calendar.events.readonly`. O token fica em `contas/google.json` no diretório de dados, modo 0600. `desconectar` apaga o arquivo e tenta revogar o refresh token.

“Quais são minhas reuniões hoje?” resolve a data no código, passa por `consultar_agenda` na política da voz e fala só os horários e títulos devolvidos. Sem conta, sem calendário do domínio, lista vazia e falha de rede têm falas diferentes. O simulador não inventa eventos. Se houver um provedor real e a data não for hoje, amanhã, ontem ou AAAA-MM-DD, o modelo só pode devolver a data da ferramenta.

## Validação

`npm test` neste capítulo. Não houve chamada à API Google real nem abertura de microfone.

## Referência da implementação

Commit pendente. Documentação consultada: OAuth para aplicativos de computador e Calendar API `events.list`.
