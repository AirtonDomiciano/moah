# Política de permissões

Proposta inicial conservadora e configurável por Airton através de canal confiável. A IA não edita a política em vigor.

O runtime de 02/11/2026 aplica só o recorte abaixo. A tabela seguinte continua sendo a regra desejada para ferramentas que ainda não existem.

| Capacidade | Regra inicial |
| --- | --- |
| Conversar, explicar e produzir rascunho | Permitido sem efeito externo |
| Consultar memória do domínio e fontes cadastradas | Permitido dentro do acesso concedido |
| Ler nova pasta, conta ou domínio | Aprovação específica antes do acesso |
| Criar/alterar arquivos por ferramenta de IA | Apresentar plano, alvos e diff quando aplicável; aprovação antes de aplicar |
| Executar comando ou script | Mostrar executável, argumentos, pasta e efeitos; aprovação específica e executor restrito |
| Instalar dependência, programa ou baixar modelo | Informar origem, destino, tamanho quando disponível e efeito; aprovação |
| Enviar mensagem, publicar em Azure ou fazer push | Aprovar conteúdo, destino e escopo |
| Excluir dados, encerrar processo ou parar serviço | Confirmação específica, consequências e recuperação quando possível |
| Capturar áudio/tela ou gravar reunião | Ativação explícita, indicador visível e parada disponível |
| Enviar conteúdo a modelo/API externa | Aprovação do tipo de dado, destino e escopo, respeitando política empresarial |
| Elevar privilégios, alterar ACL/política ou acessar credenciais genéricas | Bloqueado para o fluxo autônomo; configuração manual fora da IA |

Registrar nota por comando manual explícito da CLI é diferente de autorizar novas escritas sugeridas pelo modelo. Preservar o comportamento atual e seus limites.

No código atual, as três consultas da conversa recebem `allow` dentro do domínio da sessão. `eco_sintetico` recebe `ask` apenas quando a CLI de demonstração a concede. Shell, escrita, rede, instalação, Git, Azure, agenda, registro e conclusão, se pedidos como ferramenta do modelo, recebem `deny`. O comando manual `moah registrar` e `moah concluir` não passou a ser ferramenta do modelo.

## Escopo e delegação

Permissão inclui identidade do solicitante, domínio, conta, ferramenta, ação, recursos e prazo. “Pode ler o projeto” não autoriza gravar, enviar seu conteúdo à internet ou ler sua pasta irmã.

Filhos recebem no máximo a interseção entre suas permissões e a delegação do supervisor. Alterar nome do agente ou encadear delegações não amplia acesso. Uma capacidade não cadastrada é negada por padrão.

## Exemplos

- “Analisa a US”: consulta, sem publicação.
- “Publique este relatório na US X”: pode autorizar exatamente esse conteúdo/alvo por canal confiável, sem nova pergunta redundante.
- “Libera memória”: primeiro diagnosticar e propor; não matar processos por interpretação livre.
- “Instale o necessário”: apresentar os pacotes e efeitos antes de executar.
- “Leia tudo do SSD”: pedir delimitação de fontes e domínios, não liberar disco inteiro automaticamente.
