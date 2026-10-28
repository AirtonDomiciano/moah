# Guidelines — como implementar

- Núcleo TypeScript strict; validar entradas em runtime, não confiar apenas nos tipos.
- Separar interface, casos de uso, domínio e adaptadores sem criar camadas vazias.
- ID, domínio, origem e data em registros. Datas explícitas no primeiro CLI; fuso configurável.
- Persistir fora do Git em diretórios XDG; usar migrações e transações.
- Ferramentas recebem parâmetros estruturados; execução local não concatena texto livre no shell.
- Agentes guardam detalhes e devolvem resumo com referências; consultar aprofundamento seletivo.
- Testar comportamentos: reinício, isolamento, falha parcial, cancelamento e duplicação.
- Erros claros e saídas estruturadas para integração futura; sucesso só com evidência compatível.
- Logs e fixtures sanitizados; injetar diretórios temporários nos testes.
- Não multiplicar modelos por agente automaticamente; controlar contexto e fila.

Referências: [contratos](../arquitetura/agentes-e-memoria.md), [arquitetura](../arquitetura/visao-geral.md) e [prompt 00](../../cursror-dev/00-bootstrap-typescript.md). A escolha de bibliotecas deve respeitar a ADR e ser validada no ambiente.
