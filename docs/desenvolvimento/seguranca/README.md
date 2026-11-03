# Segurança do MOAH

Data: 01/11/2026, com o estado de runtime atualizado em 02/11/2026. Origem: pedido de Airton por regras claras de autorização e responsabilidades, incluindo uso no Windows. Estado: a primeira camada executável está no prompt 14; o restante desta pasta continua especificação. Isso não configura Windows, Debian, ACL nem sandbox.

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

## Runtime em 02/11/2026

Implementado e testado, no processo da CLI:

- decisão `allow`, `ask` e `deny` sem confiar no domínio declarado pelo modelo;
- consultas `consultar_pendencias`, `consultar_resumo` e `consultar_checkpoint` permitidas só no domínio da sessão;
- negação de ferramenta desconhecida, ferramenta bloqueada, outro domínio, ampliação e filho acima do supervisor;
- aprovação de uso único para `eco_sintetico`, com validade, negação, revogação, expiração, consumo atômico e nova avaliação da autoridade imediatamente antes desse consumo; o agente vem do contexto confiável, e o fingerprint versão 1 não é reinterpretado;
- pausa persistente que bloqueia despacho novo e não desfaz efeito já feito;
- auditoria local dos eventos mínimos, editável por quem escreve no SQLite.

Ainda ausente:

- sandbox, ACL, resolução segura de caminho, junction e link;
- voz e qualquer aprovação lida de arquivo, e-mail ou transcrição;
- permissão permanente ou global;
- escrita por IA, shell, rede, instalador, Git e Azure como ferramentas;
- conector real de agenda e aceite de convite;
- prova com modelo real. A inspeção de 02/11/2026 não encontrou motor local.

O prompt 15 acrescenta `consultar_reuniao` às consultas de leitura. A transcrição importada continua sendo dado: ela não cria aprovação, tarefa ou comando. Guia: [reuniões](../../operacao/reunioes.md).

Guia operacional: [governanca](../../operacao/governanca.md). Decisão: [ADR 0008](../../arquitetura/decisoes/0008-politica-e-aprovacao.md).
