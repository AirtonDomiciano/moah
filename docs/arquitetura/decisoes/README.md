# Registro de decisões arquiteturais (ADRs)

Decisões de desenvolvimento do MOAH ficam nesta pasta; ideias e preferências continuam em docs/produto/historico.md e ideias.md. Não guardar memória privada do runtime aqui.

| ADR | Decisão | Estado |
| --- | --- | --- |
| [0001](0001-node-typescript-e-entrega-inicial.md) | Node.js/TypeScript e primeiro recorte pela CLI | Aceita; recorte da CLI implementado no prompt 00 |
| [0002](0002-base-conhecimento-engenharia.md) | Base de conhecimento por categorias | Substituída pela ADR 0004 |
| [0003](0003-persistencia-sqlite-cli.md) | Node 22, npm e SQLite da CLI | Aceita para o recorte do prompt 00 |
| [0004](0004-documentacao-por-responsabilidade.md) | Documentação em quatro responsabilidades | Aceita; substitui a organização da ADR 0002 |
| [0005](0005-conversa-texto-e-provedor.md) | Conversa por texto, adaptador HTTP e simulador | Aceita para o contrato; modelo real pendente |

## Processo

Numerar sequencialmente: NNNN-titulo.md. Registrar data, estado (proposta, aceita, substituída), contexto, decisão, alternativas, consequências e validação. Distinguir pedido do usuário de escolha técnica do implementador. Mudança importante ganha nova ADR apontando a substituída; não apagar história.

Escolhas rotineiras não precisam virar ADR. Versões exatas e comandos verificados vão também nos manifests e relatórios de execução. Propostas anteriores de Python permanecem como histórico, superadas pela ADR 0001 para o núcleo do MOAH.

## Organização atual

[ADR 0004](0004-documentacao-por-responsabilidade.md) simplifica a documentação em quatro responsabilidades e substitui a organização da ADR 0002. ADRs 0001 e 0003 continuam preservadas nos arquivos desta pasta.

## Conhecimento visual

[ADR 0006 — Obsidian e Graphify](0006-obsidian-e-graphify.md): direção aceita, integração pendente. SQLite mantém estado; Obsidian visualiza notas; Graphify terá prova de conceito.
