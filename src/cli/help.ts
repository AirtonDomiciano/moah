export const HELP = `Uso:
  moah [--json] <comando> [opções]

Comandos:
  moah registrar atividade --dominio <pessoal|imex|aluai> --texto <texto> [opções]
  moah registrar reuniao --dominio <pessoal|imex|aluai> --texto <texto> [opções]
  moah listar dia [--data AAAA-MM-DD] [--dominio <domínio>] [--projeto <nome>]
  moah pendencias [--dominio <domínio>] [--projeto <nome>] [--estado pendente|concluida|todas]
  moah concluir <id-da-acao>
  moah checkpoint --dominio <domínio> --resumo <texto> [--projeto <nome>] [--proximo <texto>]
  moah onde-paramos --dominio <domínio> [--projeto <nome>]
  moah resumo [--data AAAA-MM-DD] [--dominio <domínio>] [--projeto <nome>]
  moah ajuda

Opções comuns de registro:
  --projeto <nome>
  --quando <instante>       omissão: instante do relógio nesta invocação
  --decisao <texto>         repetível; só o texto informado
  --acao <especificação>    repetível
  --proximo <texto>
  --ref <referência>        repetível
  --origem user_report
  --agente manual

Especificação de --acao:
  descricao
  descricao ;; responsavel=Nome
  descricao ;; responsavel=Nome ;; prazo=AAAA-MM-DD

Instantes aceitos:
  AAAA-MM-DD                         00:00:00 no fuso configurado
  AAAA-MM-DDTHH:mm[:ss]              interpretado no fuso configurado
  AAAA-MM-DDTHH:mm:ssZ               UTC
  AAAA-MM-DDTHH:mm:ss±HH:MM          deslocamento explícito
  Textos como "sexta" ou "amanhã" são rejeitados, sem registro parcial.

Saída:
  Texto legível por padrão. --json escreve somente JSON na saída padrão.
  Erros vão para a saída de erro, com código diferente de zero e sem stack trace.

Códigos de saída:
  0  sucesso, inclusive consulta vazia
  1  uso, validação ou ação já concluída
  2  identificador inexistente
  3  falha de persistência

Arquivos:
  Dados: $MOAH_DATA_DIR, ou $XDG_DATA_HOME/moah, ou ~/.local/share/moah
  Configuração: $MOAH_CONFIG_DIR, ou $XDG_CONFIG_HOME/moah, ou ~/.config/moah
  config.json: { "timezone": "America/Sao_Paulo" }
  Banco: moah.sqlite no diretório de dados

Uma reunião registrada aqui é relato do usuário, não presença inferida da agenda.
O resumo do dia agrupa os registros desse dia civil e mostra o estado atual das ações.
`;
