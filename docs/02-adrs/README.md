# Registro de decisões arquiteturais (ADRs)

Decisões de desenvolvimento do MOAH ficam nesta pasta; ideias e preferências continuam em docs/contexto-e-decisoes.md e ideias.md. Não guardar memória privada do runtime aqui.

| ADR | Decisão | Estado |
| --- | --- | --- |
| [0001](0001-node-typescript-e-entrega-inicial.md) | Node.js/TypeScript e primeiro recorte pela CLI | Aceita; recorte da CLI implementado no prompt 00 |
| [0002](0002-base-conhecimento-engenharia.md) | Base de conhecimento por categorias | Aceita |
| [0003](0003-persistencia-sqlite-cli.md) | Node 22, npm e SQLite da CLI | Aceita para o recorte do prompt 00 |

## Processo

Numerar sequencialmente: NNNN-titulo.md. Registrar data, estado (proposta, aceita, substituída), contexto, decisão, alternativas, consequências e validação. Distinguir pedido do usuário de escolha técnica do implementador. Mudança importante ganha nova ADR apontando a substituída; não apagar história.

Escolhas rotineiras não precisam virar ADR. Versões exatas e comandos verificados vão também nos manifests e relatórios de execução. Propostas anteriores de Python permanecem como histórico, superadas pela ADR 0001 para o núcleo do MOAH.
