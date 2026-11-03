# Registro de decisões arquiteturais (ADRs)

Decisões de desenvolvimento do MOAH ficam nesta pasta; ideias e preferências continuam em docs/produto/historico.md e ideias.md. Não guardar memória privada do runtime aqui.

| ADR | Decisão | Estado |
| --- | --- | --- |
| [0001](0001-node-typescript-e-entrega-inicial.md) | Node.js/TypeScript e primeiro recorte pela CLI | Aceita; recorte da CLI implementado no prompt 00 |
| [0002](0002-base-conhecimento-engenharia.md) | Base de conhecimento por categorias | Substituída pela ADR 0004 |
| [0003](0003-persistencia-sqlite-cli.md) | Node 22, npm e SQLite da CLI | Aceita para o recorte do prompt 00 |
| [0004](0004-documentacao-por-responsabilidade.md) | Documentação em quatro responsabilidades | Aceita; substitui a organização da ADR 0002 |
| [0005](0005-conversa-texto-e-provedor.md) | Conversa por texto, adaptador HTTP e simulador | Aceita para o contrato; modelo real pendente |
| [0006](0006-obsidian-e-graphify.md) | Obsidian e Graphify | Direção aceita; integração não implementada |
| [0007](0007-ollama-qwen35-9b.md) | Ollama local e candidato qwen3.5:9b | Escolha registrada; download aguardando autorização |
| [0008](0008-politica-e-aprovacao.md) | Política allow/ask/deny e aprovação de uso único | Aceita no recorte do prompt 14; sem sandbox |
| [0009](0009-volume-e-backup-sqlite.md) | Volume configurável e backup consistente | Aceita no recorte local; migração real não executada |
| [0010](0010-servico-e-fila.md) | Fila persistente e serviço de um processo | Aceita; unidade permanente não instalada |
| [0011](0011-agenda-sintetica.md) | Agenda e lembretes sem modelo | Aceita para fixture; conector real pendente |
| [0012](0012-importacao-de-reuniao.md) | Importação de transcrição em texto | Aceita para fixture; análise real pendente |

## Processo

Numerar sequencialmente: NNNN-titulo.md. Registrar data, estado (proposta, aceita, substituída), contexto, decisão, alternativas, consequências e validação. Distinguir pedido do usuário de escolha técnica do implementador. Mudança importante ganha nova ADR apontando a substituída; não apagar história.

Escolhas rotineiras não precisam virar ADR. Versões exatas e comandos verificados vão também nos manifests e relatórios de execução. Propostas anteriores de Python permanecem como histórico, superadas pela ADR 0001 para o núcleo do MOAH.

## Organização atual

[ADR 0004](0004-documentacao-por-responsabilidade.md) simplifica a documentação em quatro responsabilidades e substitui a organização da ADR 0002. ADRs 0001 e 0003 continuam preservadas nos arquivos desta pasta.

## Conhecimento visual

[ADR 0006 — Obsidian e Graphify](0006-obsidian-e-graphify.md): direção aceita, integração pendente. SQLite mantém estado; Obsidian visualiza notas; Graphify terá prova de conceito.
