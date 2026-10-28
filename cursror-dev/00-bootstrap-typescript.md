# Prompt 00 — Fundação TypeScript e primeiro registro de trabalho

Versão: 1.0. Data: 28/10/2026. Estado: executado em 28/10/2026. Relatório: [execucoes/2026-10-28-001-prompt-00.md](execucoes/2026-10-28-001-prompt-00.md). Origem: pedido de Airton para iniciar o MOAH em JS/TypeScript e manter prompts e decisões organizados.

Este é o ponto de entrada atual. Entrega um recorte dos módulos 01 e 05; não declara os módulos completos. Execute somente este prompt.

## Prompt para o Cursor

Você está no repositório MOAH de Airton. Implemente a primeira entrega funcional: CLI local em Node.js com TypeScript para registrar e consultar memória de trabalho persistente, sem modelo de IA.

### Leitura e inspeção

Leia AGENTS.md, README.md, docs/README.md, docs/_catalog/README.md, docs/05-guardrails/README.md, docs/02-adrs/0001-node-typescript-e-entrega-inicial.md, docs/visao-produto.md, docs/contratos-agentes.md, docs/roadmap.md e cursror-dev/README.md.

Inspecione git status, arquivos existentes e versões disponíveis de Node e gerenciador de pacotes. Preserve alterações locais e código existente. Não suponha que /media/projetos seja acessível neste ambiente. Não altere drivers, outros repositórios ou projetos em Agents. Se houver implementação posterior a este prompt, adapte a ela sem sobrescrever trabalho.

Informe abordagem e arquivos afetados e siga implementando. Pergunte apenas sobre bloqueios materiais; resolva escolhas rotineiras com justificativa curta.

### Decisões e escopo

- Node.js com TypeScript, modo strict. Usar uma versão LTS suportada e compatível, verificada nas fontes oficiais no momento da implementação; registrar e fixar requisitos.
- App CLI único, sem monorepo, microserviços ou framework de agentes nesta entrega.
- Escolher um gerenciador de pacotes e manter um lockfile.
- Persistência local SQLite como proposta preferida. Inspecionar compatibilidade do driver com o Node disponível e registrar escolha. Se houver impedimento concreto, explicar e registrar alternativa antes de consolidá-la.
- Nenhum download de modelo, servidor HTTP, microfone, conta externa ou treinamento.
- Não reescrever o launcher em Python. Integração futura por adaptador.
- Serviço systemd, fila completa, agenda e delegação permanecem para etapas seguintes; não instalar daemon nesta entrega.

### Base de conhecimento de engenharia

Respeite a organização docs/_catalog e 00-governance a 09-domain-knowledge. Consulte ADRs, guidelines e guardrails antes de implementar; registre lições e métricas apenas com evidência. Atualize o catálogo quando necessário. Não mova ou duplique os documentos canônicos sem necessidade. A base pública de engenharia não é armazenamento de memória real do MOAH.

### Estrutura sugerida

Separar CLI, casos de uso, tipos de domínio e persistência. Sugestão: src/cli, src/application, src/domain, src/infrastructure. Evitar abstrações sem uso. Testes de comportamento em tests.

Manter documentação existente; não renomear cursror-dev. Prompts ficam nela; decisões em docs/02-adrs; relatórios sanitizados de execução em cursror-dev/execucoes. Dados reais de runtime ficam fora do Git.

### Dados de trabalho

Um registro tem:
- ID estável, tipo (atividade, reuniao ou checkpoint), domínio (pessoal, imex, aluai), projeto opcional.
- Texto ou resumo fornecido pelo usuário.
- Origem explícita, inicialmente user_report; agente responsável, inicialmente manual.
- Instante de ocorrência e criação; armazenar instantes sem ambiguidade e apresentar no fuso configurado, inicialmente America/Sao_Paulo.
- Decisões e ações/pendências opcionais; cada ação tem ID, descrição, responsável quando informado, prazo explícito opcional e estado pendente/concluida.
- Próximo passo opcional e referências opcionais.

Uma reunião registrada manualmente é relato do usuário, não presença inferida da agenda. Não inventar decisões, prazos ou responsáveis. Nesta CLI aceitar datas explícitas e rejeitar datas relativas ambíguas, como “sexta”, com orientação de uso. Não desenvolver interpretação de linguagem natural agora.

### Interface de uso

Fornecer comandos documentados, por exemplo:
- registrar atividade ou reunião com domínio/projeto;
- listar registros de um dia;
- listar pendências e concluir uma pelo ID;
- salvar checkpoint com resumo e próximo passo;
- recuperar último checkpoint de um domínio/projeto;
- gerar resumo diário determinístico.

Defina uma gramática clara e documente comandos realmente executáveis, usando npm scripts ou bin do pacote. Incluir opção de saída JSON para futura integração e formato humano legível por padrão. Erros devem retornar código diferente de zero, sem stack trace desnecessário.

Não criar um chat que só aparenta entender linguagem natural. Resumo diário nesta etapa é agrupamento fiel dos registros, não inferência de IA.

### Persistência e privacidade

Usar diretórios XDG do usuário e configuração de fuso. Estado no XDG_DATA_HOME, configuração no XDG_CONFIG_HOME; fallback para diretórios do usuário quando ausentes. Não alterar HOME para testes.

Criar migração versionada do esquema. Usar transações para registro com decisões/ações. Preparar acesso coerente de múltiplas invocações, sem sobrescrever estado com snapshots antigos. Não adotar JSON por instância como fonte concorrente sem controle.

Testes devem usar diretório temporário injetado e dados sintéticos. Não gravar fixtures no diretório real do usuário. Configurar .gitignore para banco, WAL/SHM, logs, segredos, node_modules e builds. Nunca commitar notas reais da Imex/Aluai.

### Cenário de aceite

Com dados fictícios:
1. Registrar reunião Imex com decisão e uma pendência sem prazo.
2. Encerrar o processo e consultar o registro em nova invocação.
3. Consultar pendências e concluir a ação pelo ID.
4. Registrar atividade e checkpoint “review em análise; próximo passo verificar testes”.
5. Consultar “onde paramos” por domínio/projeto e obter o checkpoint.
6. Gerar resumo do dia com atividades, reuniões relatadas, decisões e pendências, indicando origem.
7. Consultar Aluai e não retornar dados Imex.
8. Entrada inválida não deve deixar registros parciais.

### Verificação necessária

Testar persistência entre processos, isolamento por domínio/filtros, transação/rollback, conclusão de pendência, checkpoint, validação e limites de dia no fuso configurado. Verificar duas gravações válidas sem perda de registros.

Rodar typecheck, build e testes apropriados. Demonstrar os comandos principais com diretório temporário, sem acessar contas ou abrir aplicações reais. Não escrever testes que só espelhem getters.

### Documentação e rastreabilidade

- Atualizar README com instalação, execução, exemplos reais de CLI e limitações.
- Criar ADR para escolhas relevantes de persistência, organização ou versões; justificar contexto e alternativas.
- Atualizar roadmap/backlog com evidências, sem marcar módulos inteiros como concluídos.
- Registrar execução em cursror-dev/execucoes conforme o modelo, com este prompt e sua versão/commit de origem, ambiente sanitizado, decisões, arquivos, testes e limitações.
- Não copiar conversas privadas, tokens, e-mails nem memória real para relatórios públicos.
- Separar “implementado”, “testado”, “simulado” e “pendente”.

### Entrega final

Implemente código, não apenas plano. Apresente o que funciona, como executar, verificações e limitações. Deixe pronto para revisão local. Não faça push, merge ou mudanças em serviços externos sem instrução específica. Não avance automaticamente para o próximo módulo.
