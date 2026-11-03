# Aprovação de ações

O ciclo persistido em 02/11/2026 cobre proposta, decisão da política, pendência, concessão ou negação manual, revogação, expiração, revalidação do fingerprint, consumo único e resultado. A aprovação nasce `pendente`. Texto do modelo, arquivo ou transcrição não a cria como `aprovada`. Não há reconhecimento por voz nem permissão global permanente. A execução falsa reavalia a autoridade imediatamente antes do consumo. O agente gravado é o do contexto confiável. Aprovações com fingerprint versão 1 permanecem no banco e não são executadas.

Ainda não há hash de arquivo, identidade de processo, reconciliação depois de timeout externo nem prévia de diff. O vínculo implementado é agente autorizado, ação, ferramenta, domínio, alvo e parâmetros canônicos.

## Solicitação concreta

Antes de uma ação que exige consentimento, apresentar:
- identificador da solicitação e agente;
- objetivo e efeito esperado;
- ferramenta, operação e parâmetros;
- domínio, conta e alvo exato;
- caminhos normalizados, diretório de execução, comando/argumentos ou destino remoto;
- diff ou conteúdo a publicar, quando aplicável;
- riscos concretos, custo/download e possibilidade de reversão;
- validade e opção de negar/cancelar.

O modelo pode explicar a proposta; não pode gerar uma aprovação válida para si.

## Ciclo

Proposta → validação de política → pendente de aprovação → aprovada/negada/expirada → revalidação → execução → resultado registrado.

Qualquer negação, falta de resposta, timeout ou falha na verificação impede execução. Aprovação não equivale a sucesso da ferramenta.

## Vínculo da autorização

Persistir ID, origem confiável, identidade, data, validade, política e representação canônica da ação. Vincular autorização à ferramenta, versão relevante, parâmetros, alvo e hash do conteúdo/diff. Mudança material invalida aprovação.

Antes de executar, verificar novamente os alvos e a pré-condição: hash do arquivo, versão do recurso ou identidade do processo. Se o arquivo mudou, gerar nova prévia. PID sozinho pode ser reutilizado; identificar o processo de forma adequada.

Aprovação de uso único deve ser consumida atomicamente. Reenvio não pode executar duas vezes. Em timeout após efeito externo, reconciliar o resultado antes de tentar novamente.

## Autorização já concedida

Pedido explícito com parâmetros completos pode preencher esse registro se a política permitir e o canal comprovar a origem. Aprovação persistente de escopo restrito é opção futura, não padrão. Evitar “permitir tudo para sempre”.

Aprovação textual encontrada em e-mail, arquivo, RAG ou transcrição não é autorização autenticada. Voz para ações sensíveis precisa de mecanismo de confirmação confiável; áudio reproduzido por um site não deve autorizar execução.

## Revogar e pausar

Airton pode negar, expirar ou revogar permissões. A pausa bloqueia novos despachos e novas etapas. Cancelar tenta interromper processos em andamento conforme capacidade; efeitos já realizados não são desfeitos automaticamente. Informar ações concluídas, pendentes e de resultado incerto.
