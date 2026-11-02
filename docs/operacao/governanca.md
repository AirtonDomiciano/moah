# Governança — política, aprovação e executor falso

A conversa continua só de leitura. Uma ação com efeito passa por código confiável, não por uma frase do modelo. Esta camada não é sandbox do Debian nem do Windows.

Decisão: [ADR 0008](../arquitetura/decisoes/0008-politica-e-aprovacao.md). Regras: [segurança](../desenvolvimento/seguranca/README.md).

## Onde a proposta entra

`moah governanca propor` monta a proposta com ferramenta, domínio, alvo e `--param chave=valor`. A autoridade da demonstração concede só `eco_sintetico` no domínio informado no comando.

Na conversa, a proposta da consulta é montada pela coordenação. O domínio é o `--dominio` da sessão. O modelo não escolhe domínio, não vê `eco_sintetico` e não recebe comando de aprovação.

## Quem decide

O motor de políticas devolve `allow`, `ask` ou `deny`. Consulta concedida no domínio da sessão pode seguir. A ferramenta falsa pede aprovação. Ferramenta desconhecida, domínio diferente, ampliação de permissão ou filho acima do supervisor são negados. Um sim genérico não desbloqueia nada.

A decisão de conceder, negar ou revogar é um comando seu, fora das ferramentas do modelo:

```bash
moah governanca conceder <id>
moah governanca negar <id>
moah governanca revogar <id>
```

## Onde a autorização fica

No mesmo `moah.sqlite` da memória de trabalho, tabelas `approvals` e `audit_events`, migração 2. Cada aprovação nasce `pendente`. A representação canônica junta ação, ferramenta, domínio, alvo e parâmetros ordenados; o fingerprint é o SHA-256 disso. Mudar parâmetro, alvo ou domínio impede o consumo.

Estados: `pendente`, `aprovada`, `negada`, `expirada`, `revogada`, `consumida`. A validade padrão é 15 minutos. O consumo é um `UPDATE` condicional: duas tentativas não executam a mesma autorização duas vezes.

## Quem executa

Só `moah governanca executar`, e só a ferramenta `eco_sintetico`. Ela devolve um resultado falso e não abre shell, não grava arquivo arbitrário, não usa rede e não altera Git, Azure ou agenda. Antes de consumir, a política e o fingerprint são conferidos de novo.

```bash
moah governanca propor --dominio pessoal --alvo nota-sintetica --param texto=eco
moah governanca conceder <id>
moah governanca executar --aprovacao <id> --dominio pessoal --alvo nota-sintetica --param texto=eco
moah governanca auditoria
```

`registrar`, `concluir` e os outros comandos manuais continuam no contrato anterior. Eles não passam por esta aprovação e não foram entregues ao modelo.

## Como pausar

```bash
moah governanca pausar
moah governanca pausa
moah governanca retomar
```

A pausa fica no banco. Enquanto estiver ativa, uma nova execução falsa é bloqueada e a aprovação não é consumida. Isso não desfaz efeito que já tenha ocorrido. Nesta entrega o executor falso não produz efeito no computador.

## Como investigar uma negação

`moah governanca auditoria` lista proposta, decisão, aprovação, negação, revogação, tentativa, consumo e resultado. O detalhe traz a versão da política e o motivo curto. Parâmetros sensíveis são recusados antes de gravar. O alvo que pareça segredo sai como `[omitido]`.

`moah governanca ver <id>` mostra o estado atual. Expirada, negada, revogada ou consumida não executa. Se o motivo disser que a ação não coincide, o parâmetro, o alvo ou o domínio mudou depois da aprovação.

A auditoria é um registro local. Ela não é um log inviolável.

## O que ainda não existe

- Sandbox, ACL, controle de caminho, junction ou link simbólico.
- Voz, wake word e autorização lida de arquivo, e-mail ou transcrição.
- Permissão global permanente.
- Escrita de memória pela IA, terminal, conectores, agenda, Azure ou Git como ferramentas.
- Cancelamento de efeito já realizado.
- Reconciliação de timeout com sistema externo.
- Prova de que o modelo local segue a política: em 02/11/2026 não havia motor instalado.
