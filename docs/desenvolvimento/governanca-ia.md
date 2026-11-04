# Governança do trabalho com IA

O MOAH usa GitHub Issues como backlog. Cada rodada segue **uma issue, um capítulo e uma validação de fechamento**. Um capítulo é um recorte com comportamento verificável.

1. **Codex define o recorte.** O prompt aponta para a issue, informa objetivo, referências necessárias, critério de aceite e nome sugerido do commit. Quando a regra já estiver documentada, referencie a fonte.
2. **Cursor implementa.** Abra uma conversa nova por capítulo e carregue apenas o contexto necessário. Faça a menor mudança que cumpra o aceite e rode as checagens focadas durante a implementação. Registre descobertas fora do escopo no backlog. Ao terminar, informe arquivos alterados, resultado e comandos de validação. Encerre a rodada.
3. **Airton valida no terminal.** Ao fechar o capítulo, execute `npm run typecheck` e `npm test` quando houver alteração de código. Se o aceite depender de hardware, faça também a prova manual correspondente. Em caso de falha, envie ao Cursor o comando e o trecho relevante do erro para uma correção focada.
4. **Airton publica e Codex revisa.** Com o aceite verificado, vincule a issue ao commit ou PR e envie o link para revisão. O Codex revisa o diff novo e consulta contexto adicional quando necessário. Depois da revisão, siga para o próximo capítulo.

Para medir o consumo, registre a issue e os horários de início e fim dos próximos três capítulos. Evite sobrepor sessões nesse período e compare com o extrato do Cursor.

```text
Execute apenas o capítulo <X> da issue <link>.
Objetivo: <resultado esperado>.
Referências: <arquivos ou regras relevantes>.
Aceite: <comportamento observável>.
Faça a menor mudança necessária e rode checagens focadas.
Informe arquivos alterados, resultado e comandos para validação.
Pare ao concluir o capítulo.
Commit sugerido: <nome>.
```

Para permissões e ações do assistente em execução, consulte a [governança de segurança do MOAH](seguranca/README.md).
