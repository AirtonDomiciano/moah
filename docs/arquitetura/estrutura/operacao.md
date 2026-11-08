# Operação, dados e validação

| Cenário | Comportamento esperado |
| --- | --- |
| SSD ausente ou UUID incorreto | Diagnosticar e bloquear a operação dependente |
| Backup e migração | Usar snapshot SQLite e verificar restauração antes de trocar destino |
| Reinício ou interrupção | Recuperar estado persistido e distinguir pendência, falha e resultado incerto |
| Pausa da fila | Bloquear novas reservas e indicar situação do trabalho em andamento |
| Serviço ou integração indisponível | Exibir qual componente falhou e permitir diagnóstico |
| GPU ocupada ou memória insuficiente | Medir recursos e aplicar limites configurados |
| Consumo de tokens do Cursor | Importar metadados e agrupar por dia, projeto e atividade com confiança de atribuição |
| Teste automatizado | Usar fixtures e diretórios temporários. Cobrir limites de domínio e efeitos |
| Aceite no hardware | Registrar comando, versão, configuração, duração e resultado |
| Evolução do projeto | Fechar uma issue e um capítulo por rodada, com validação antes de publicar |

Guarde dados reais fora do Git. Consulte os [guias operacionais](../../operacao/README.md), o [fluxo de trabalho com IA](../../desenvolvimento/governanca-ia.md) e a [issue de consumo de tokens](https://github.com/AirtonDomiciano/moah/issues/4).
