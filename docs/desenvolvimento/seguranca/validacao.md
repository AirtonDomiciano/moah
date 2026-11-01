# Critérios de validação da segurança

Estado: cenários a implementar, não testes executados.

## Acesso

- Negar ferramenta não cadastrada e leitura fora do domínio.
- Negar pasta irmã com nome parecido, traversal e escape por link/junction.
- Negar alvo que muda entre prévia e execução.
- SSD indisponível não cria fonte alternativa.
- Agente filho não herda acesso extra nem tokens de outras áreas.

## Aprovação

- Ação pendente não executa sem consentimento.
- Autorização exata já válida não gera perguntas repetidas.
- Alterar destino, conteúdo ou argumentos exige nova decisão.
- Negação, expiração e revogação impedem execução.
- Duas tentativas simultâneas não consomem a mesma autorização duas vezes.
- Timeout externo provoca reconciliação, não publicação duplicada.
- Conteúdo “aprovado” em documento/áudio recuperado não concede autoridade.

## Operação

- Pausa impede novos despachos e informa efeitos já realizados.
- Timeout e cancelamento preservam diagnóstico.
- API de modelo indisponível não amplia permissões.
- Logs, relatórios e fixtures não contêm segredos.
- Instalação e subprocessos respeitam privilégio mínimo e ambiente delimitado.
- A CLI manual e leitura atual mantêm comportamento testado.

## Entrega futura

Começar pelo motor puro de decisão allow/ask/deny e aprovações com executor falso. Depois implementar uma ferramenta pequena em diretório temporário e validar no SO alvo. Não testar exclusão, administração ou publicação em recursos reais para comprovar a política.

Só declarar controle implementado com código, testes de negação, execução relevante e limitações documentadas. Esta especificação sozinha não protege a máquina.
