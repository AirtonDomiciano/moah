# Prompt 15 — Rotina inicial de Tech Lead

Data: 02/11/2026. Versão: 1.0. Estado: executado no recorte local. A avaliação com modelo real e o conector de agenda real permanecem bloqueados. Relatório: [execucoes/2026-11-02-003-prompt-15.md](execucoes/2026-11-02-003-prompt-15.md).

Origem: pedido de Airton para chegar à primeira versão útil da rotina de Tech Lead: conversa, memória, serviço, agenda e importação de reuniões.

## Prompt para o Cursor

Trabalhar até concluir o escopo possível. Executar por etapas, validar cada uma e preservar o trabalho anterior. Não entregar só um plano. Não fazer commit nem push. Não ampliar para voz, Graphify, Obsidian, busca vetorial, painel web ou CTOs completos. Não instalar, baixar modelos, alterar drivers, elevar privilégios ou conectar contas.

Etapa 1. Confirmar no commit `a0f4f01` a revalidação da política antes da execução, a aprovação vinculada ao agente confiável, a rejeição de fingerprints antigos, a pausa, a revogação e o consumo único. Não refatorar a segurança sem necessidade. Ferramentas novas passam pela política. Documento e transcrição não concedem autoridade.

Etapa 2. Retomar o prompt 12. Identificar o sistema, a GPU, a RAM, o disco, os motores e os modelos. Se houver modelo local utilizável, configurar o adaptador e avaliar com registros sintéticos. Se o download exigir aprovação, registrar origem, tamanho, destino e comandos e deixar a operação pendente. Sem fallback silencioso para o simulador. A conversa continua sem escrita livre e sem terminal.

Etapa 3. Consolidar `MOAH_DATA_DIR` e a configuração de banco, documentos, artefatos, modelos e backup. O SSD final é configurável. A pasta existir não confirma o volume. Verificar montagem e UUID. Não migrar dados reais sozinho. Backup e restauração compatíveis com SQLite, testados em diretório temporário. Avisar quando o backup estiver no mesmo dispositivo.

Etapa 4. Serviço local sobre os casos de uso existentes: início e parada, saúde, fila persistente, tentativas, erro, cancelamento, checkpoint, recuperação e prevenção de processamento duplicado. Não segurar o lock do banco durante a tarefa. Não prometer execução única de efeito externo. Documentar a inicialização do SO observado sem instalar serviço permanente.

Etapa 5. Contratos separados de fonte, sincronização, armazenamento, agendamento e entrega. Validar primeiro com agenda sintética. Fuso, versão, alteração, cancelamento, deduplicação, lembrete, adiamento, horário silencioso e vencimento após reinício. O relógio não depende do LLM. Evento não comprova participação. Sem aceitar convite, alterar evento externo ou enviar mensagem.

Etapa 6. Importar transcrição de texto por arquivo autorizado. Persistir fonte, versão, domínio, projeto, data conhecida, texto e participantes só quando identificados. Extrair estrutura validada com adaptador substituível. Sem modelo real, usar resposta controlada e marcar a análise real como pendente. Deduplicar por fonte e versão. Correção invalida o resumo anterior. Não criar tarefa operacional a partir do texto. Consultar o resumo pelo id, sem busca vetorial.

Cobrir persistência, volume ausente, concorrência, reinício, pausa, cancelamento, agenda, lembrete sem modelo, importação repetida, isolamento de domínio, saída inválida, instrução dentro da transcrição e ausência de efeito externo. Registrar ADR, guia, execução e roadmap pelo que realmente funciona.
