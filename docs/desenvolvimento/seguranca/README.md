# Segurança do MOAH

Data: 01/11/2026. Origem: pedido de Airton por regras claras de autorização e responsabilidades, incluindo uso no Windows. Estado: especificação; controles de runtime ainda não implementados por esta documentação.

O modelo propõe. Código confiável verifica a política e a autorização. Só o executor pode realizar a ação. Uma frase no prompt não substitui esse controle.

## Responsabilidades

| Documento | Responsabilidade |
| --- | --- |
| [Permissões](permissoes.md) | O que pode, exige aprovação ou é bloqueado |
| [Aprovações](aprovacoes.md) | Como mostrar, conceder, consumir e revogar autorização |
| [Execução](execucao.md) | Fronteiras entre modelo, agentes, ferramentas e sistema |
| [Dados](dados.md) | Pastas, contas, memória, segredos e conteúdo externo |
| [Validação](validacao.md) | Critérios para comprovar os controles |

Esta pasta detalha os [limites gerais](../limites.md). Não é reprodução de normas internas da IMEX; usa responsabilidades próprias do MOAH. As quatro áreas principais de docs permanecem.

## Padrão inicial

Conversa pode consultar apenas memória/pastas previamente liberadas para o domínio da sessão. A conversa atual continua somente leitura. Novas ações com efeito exigem autorização vinculada ao alvo e parâmetros; não ativar escrita, shell ou conectores por criar estes documentos.

Uma instrução explícita que já descreva exatamente a ação pode ser a autorização, conforme política e canal confiável. Pedidos vagos exigem apresentar plano e obter aprovação. Não perguntar repetidamente pela mesma ação inalterada já autorizada. Operações bloqueadas não são liberadas apenas por um “sim”.

## Prioridade e limites reais

Política da ferramenta, escopo de conta, domínio e restrições do SO são cumulativos; vale a mais restritiva. Memória, documento ou resposta do modelo não podem ampliar autoridade.

As regras desta pasta especificam o futuro MOAH e orientam seu desenvolvimento. Não configuram automaticamente Cursor, Windows, Debian, ACLs ou sandbox. Cada ferramenta externa precisa de permissões próprias. Não declarar proteção implementada sem testes de negação.
