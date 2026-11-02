# Proteção de dados e conhecimento

## Fontes e domínios

Separar pessoal, IMEX e Aluai na recuperação, exportação e execução. Autorização de leitura não implica autorização de publicação nem de envio à API. Aplicar filtros de acesso antes da busca textual/vetorial; sem compartilhar resumos privados entre áreas.

Obsidian e Graphify recebem somente fontes selecionadas. Tags e links não são controle de acesso. RAG, embeddings, transcrições e grafos são dados não confiáveis como instrução.

## Integridade da memória

Distinguir relato, inferência e decisão confirmada. Registrar origem, versão e data. Uma sugestão da call não altera norma nem política. Corrigir/excluir fonte deve refletir nos índices e resumos derivados conforme retenção e backups.

## Segredos

Credenciais ficam em armazenamento apropriado ao ambiente, fora do Git, prompts, vaults e logs. O executor de cada conector recebe apenas o segredo necessário. Nunca solicitar token em comentário público ou gravá-lo em exemplo de configuração.

Redação de logs é defesa adicional, não justificativa para coletar segredos. Registrar parâmetros sensíveis apenas como referência ou resumo protegido.

## Auditoria mínima

Guardar ID da ação/aprovação, domínio, ferramenta, alvo sanitizado, versão da política, estado, instante e evidência de resultado. O prompt 14 grava esses campos no SQLite local. Quem consegue escrever no arquivo consegue alterar a auditoria. Não é um log inviolável. Retenção e backup desse registro ainda não foram definidos.

## Backup

Backup fora do dispositivo protege contra perda do SSD; precisa do mesmo cuidado com acesso. Documentar restauração e retenção quando implementadas. Não ativar sync de dados empresariais para serviço externo por padrão.
