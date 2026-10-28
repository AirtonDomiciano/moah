# Governança — como trabalhamos

## Desenvolvimento por entregas

Uma entrega pequena por vez, com objetivo, escopo e critérios de aceite. Ler o catálogo e os documentos relevantes; não carregar toda a base em cada tarefa. Inspecionar o código/ambiente e preservar alterações existentes.

Trilha: prompt versionado → implementação → verificação → relatório → atualização de estado. Decisão importante ganha ADR; incidente real ganha lição com evidência. Não inventar histórico de prompts que não foi preservado.

## Fonte e estado

Distinguir pedido de Airton, proposta técnica, decisão aceita, código implementado e comportamento validado. Versões de bibliotecas são verificadas na implementação. A documentação não instala serviços.

## Git e revisão

Commits pequenos e descritivos. Registrar branch/commit/PR quando existirem. Não impor fluxo de equipe fictício nem regras de publicação não definidas. Antes de publicar, verificar remoto e autorização. Alteração de arquitetura exige consultar ADRs.

## Documentação

Manter uma fonte canônica e links no catálogo. Atualizar prompt/módulo/contrato afetado, sem copiar a mesma regra para todos os arquivos. Dados reais de runtime não pertencem a relatórios públicos.

Procedimento inicial: [playbook](procedimentos.md). Decisões: [ADRs](../arquitetura/decisoes/README.md).
