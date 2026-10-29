# ADR 0006 — Obsidian e Graphify no conhecimento do MOAH

Data: 29/10/2026. Estado: direção aceita por Airton; integração planejada e não validada.

## Contexto

Airton quer visualizar o conhecimento do MOAH, suas fontes e conexões no SSD. Pediu registrar o uso de Obsidian e Graphify, preservando arquitetura compreensível e responsabilidades separadas.

## Decisão

- SQLite continua sendo a fonte dos registros estruturados, tarefas e estado operacional.
- Obsidian será a interface de leitura e navegação de notas Markdown vinculadas, geradas a partir dos registros autorizados.
- Graphify será uma ferramenta complementar para mapear relações de código e documentos. Sua adoção é direção desejada, condicionada à prova de conceito de compatibilidade, privacidade, custo e integração.
- Não substituir a busca/consulta atual nem o SQLite pelo grafo.
- Não depender de Obsidian aberto para o MOAH funcionar.
- O grafo representa conhecimento registrado e relações; não mostra o raciocínio interno do modelo.

Referência de Graphify a confirmar antes da instalação: https://github.com/Graphify-Labs/graphify. Obsidian: https://help.obsidian.md/plugins/graph. Não fixar versão sem inspeção.

## Fluxo inicial

Registro persistido → exportador explícito → notas Markdown com links → leitura no Obsidian.
Graphify poderá consultar fontes selecionadas por adaptador separado, após validação.

Primeiro fluxo de exportação é unidirecional. Edições no Obsidian não alteram o banco automaticamente. Reimportação e conflitos exigem decisão futura. Conteúdo manual deve ficar separado de notas geradas; não sobrescrever notas editadas silenciosamente.

## Identidade e isolamento

Notas geradas terão ID estável do registro, domínio, origem, datas, versão e referências. Exportar novamente atualiza a mesma nota sem duplicar. Preservar evidências de decisões e diferenciar regra relatada, proposta e confirmada.

Separar pessoal, IMEX e Aluai por permissões e escopo de exportação. Preferir vaults separados por domínio inicialmente; ligações entre áreas somente quando autorizadas. Não usar tags como controle de acesso.

Diretório privado de dados/vault no SSD deve ser configurável e ficar fora do repositório. O caminho final e política de retenção ainda serão definidos. Verificar disponibilidade do volume antes de gravar; não criar fallback silencioso quando SSD estiver indisponível.

## Privacidade e recursos

Não apontar Graphify automaticamente para todo o SSD. Selecionar fontes e excluir segredos, dados não autorizados e diretórios irrelevantes. Verificar quais etapas usam modelo/API: processamento de documentos não deve ser presumido inteiramente local. Envio externo exige autorização compatível com os dados e regras da empresa.

Índices e grafos derivados devem ser reconstruíveis. Registrar versão e origem; correção/exclusão da fonte precisa ser refletida na projeção. Backup privado em outro dispositivo, não apenas outra pasta no mesmo SSD.

## Etapas e aceite

1. Exportar fixtures de reuniões, decisões, projetos e pendências em Markdown com links.
2. Repetir exportação sem duplicar ou perder conteúdo manual.
3. Abrir vault no Obsidian e verificar navegação/grafo.
4. Validar isolamento por domínio e comportamento com SSD ausente.
5. Fazer prova de conceito isolada do Graphify, registrando versão, entradas, saídas, uso de API e recursos.
6. Só então habilitar consulta ao grafo pelo MOAH.

Esta ADR não instala ferramentas nem exporta dados reais. Integração com modelo real do prompt 11 continua pendente conforme seu relatório.
