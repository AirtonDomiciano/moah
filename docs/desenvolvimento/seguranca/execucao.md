# Fronteiras de execução

Arquitetura proposta, não instalada: modelo → proposta estruturada → motor de políticas → aprovação → executor → resultado/auditoria.

## Componentes

| Componente | Pode fazer | Não pode fazer |
| --- | --- | --- |
| Modelo | Interpretar e propor ferramentas | Conceder permissão ou executar diretamente |
| Coordenador | Delimitar domínio e delegar | Ampliar política ou contornar negação |
| Motor de políticas | Autorizar, pedir aprovação ou negar | Confiar em afirmação do modelo |
| Serviço de aprovação | Registrar escolha do usuário | Aceitar consentimento de fonte recuperada |
| Executor | Rodar ação validada e autorizada | Mudar parâmetros após aprovação |
| Auditoria | Registrar estado e evidências sanitizadas | Guardar tokens ou histórico privado indiscriminado |

## Execução restrita

Ferramentas tipadas e cadastradas são preferidas a terminal livre. Executável e argumentos separados, sem concatenar fala em shell. Scripts, gerenciadores de pacotes e hooks também podem executar código; aprovação de comando não garante isolamento.

Aplicar timeout, limite de saída, recursos e cancelamento. Subprocessos recebem ambiente mínimo; não herdar tokens de outros conectores. Executar no diretório aprovado e conferir alvo novamente.

## Windows e Debian

Executar com usuário sem administração/root. Permissões reais devem ser limitadas por conta, ACL e mecanismos de isolamento adequados ao ambiente. Não configurar caminhos universais de escrita no disco.

No Windows, considerar letras de unidade, caminhos UNC, equivalência de maiúsculas e junctions/reparse points. No Debian, links simbólicos e pontos de montagem. Um teste de prefixo de string não delimita acesso com segurança. Resolver caminho e rejeitar escapes, mudanças de alvo e formas não suportadas.

NTFS compartilhado não deve ser presumido com as mesmas permissões efetivas de um volume Linux. Verificar o filesystem real. Se SSD estiver ausente, falhar claramente, sem criar outro banco silenciosamente.

Uma allowlist na aplicação não é sandbox contra código arbitrário. O executor deve ter privilégios compatíveis com o dano possível, e integrações que exigem acesso amplo permanecem desabilitadas até avaliar isolamento.

## Estado atual

Não mudar o cliente LLM ou ativar ferramentas de escrita por esta especificação. Implementar controles testáveis antes de expor capacidades adicionais à conversa.
