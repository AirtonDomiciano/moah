# Conversa e memória

A conversa resolve intenção e escopo antes de consultar fontes. O SQLite guarda registros e checkpoints com origem e domínio. A recuperação entrega ao modelo os trechos necessários. Embeddings e grafos podem acrescentar formas de navegar pelo mesmo conteúdo.

| Cenário | Comportamento esperado |
| --- | --- |
| Onde paramos no Ledger? | Recuperar checkpoint do projeto e citar origem |
| Projeto ambíguo ou troca de contexto | Pedir confirmação conforme PWA-001 |
| Dado ausente ou antigo | Informar a lacuna ou a data da evidência |
| Correção de memória | Registrar versão e distinguir conteúdo atual de substituído |
| Busca semântica | Filtrar domínio e combinar texto, metadados e similaridade |
| Obsidian e Graphify | Exportar visão navegável conforme ADR vigente |
| Pesquisar inovação para o Ledger | Enviar consulta pública aprovada e devolver ideias com fontes. Tratar conteúdo externo como dado |
| Modelo indisponível | Exibir estado e manter consultas determinísticas disponíveis |

Separar pessoal, Aluai e IMEX. Seguir o [contrato de agentes e memória](../agentes-e-memoria.md).
