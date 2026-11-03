# Critérios de validação da segurança

Estado em 02/11/2026: o recorte do motor, da aprovação e do executor falso foi testado no Debian, com diretório temporário. Os itens abaixo que falam de caminho, junction, SSD, timeout externo, instalação e privilégio de SO continuam sem teste.

## Acesso

- Negar ferramenta não cadastrada e leitura fora do domínio. Coberto no prompt 14.
- Negar pasta irmã com nome parecido, traversal e escape por link/junction. Ainda sem implementação.
- Negar alvo que muda entre prévia e execução. Coberto para parâmetro, alvo e domínio da ação falsa. Não cobre arquivo real.
- SSD indisponível não cria fonte alternativa. Não exercido nesta entrega.
- Agente filho não herda acesso extra nem tokens de outras áreas. A interseção de ferramentas foi testada na decisão e de novo na execução: delegação insuficiente depois da aprovação não consome a linha. Não há token de conector para herdar.

## Aprovação

- Ação pendente não executa sem consentimento. Coberto.
- Autorização exata já válida não gera perguntas repetidas. A CLI concede uma vez e a execução revalida; não há diálogo repetido no modelo.
- Alterar destino, conteúdo ou argumentos exige nova decisão. Coberto no fingerprint.
- Negação, expiração e revogação impedem execução. Coberto.
- Permissão retirada depois da aprovação, execução por outro agente e fingerprint versão 1 impedem o consumo. Coberto na revisão do commit 93607f8; a linha antiga não tem o hash recalculado.
- Duas tentativas simultâneas não consomem a mesma autorização duas vezes. Coberto com duas conexões e com duas invocações da CLI. A pausa do executor falso continua bloqueando despacho novo.
- Timeout externo provoca reconciliação, não publicação duplicada. Ainda sem ferramenta externa.
- Conteúdo “aprovado” em documento/áudio recuperado não concede autoridade. Não existe caminho de código que promova esse texto. Voz continua ausente.

## Operação

- Pausa impede novos despachos e informa que não desfaz efeito já realizado. Coberto no executor falso.
- Timeout e cancelamento da conversa preservam diagnóstico. Já coberto no prompt 11; a política não muda esse contrato.
- API de modelo indisponível não amplia permissões. O adaptador continua falhando sem cair no simulador.
- Logs, relatórios e fixtures não contêm segredos. A auditoria recusa parâmetro sensível e omite alvo que pareça segredo. O registro não é inviolável.
- Instalação e subprocessos respeitam privilégio mínimo e ambiente delimitado. Não há subprocesso nesta entrega.
- A CLI manual e leitura atual mantêm comportamento testado. A suíte anterior continuou passando.

## Entrega futura

O motor puro e o executor falso desta lista foram o prompt 14. O passo seguinte, se autorizado, é uma ferramenta pequena em diretório temporário, com caminho resolvido no SO alvo. Não testar exclusão, administração ou publicação em recursos reais para comprovar a política.

Só declarar controle implementado com código, testes de negação, execução relevante e limitações documentadas. O motor de políticas não protege a máquina.
