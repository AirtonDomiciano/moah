# Prompts de desenvolvimento para o Cursor

Usar um módulo por vez. Os arquivos contêm prompts completos para copiar ao Cursor com este repositório aberto. A grafia da pasta segue o pedido original.

## Ordem e dependências

| Módulo | Responsabilidade | Depende de |
| --- | --- | --- |
| [01](01-servico-local.md) | Base e execução contínua | — |
| [02](02-inferencia-gpu.md) | Modelo local e GPU | 01 |
| [03](03-gmail-calendario.md) | Conectores de leitura | 01 |
| [04](04-agenda-alertas.md) | Agenda e notificações | 03 |
| [05](05-memoria-compartilhada.md) | Memória e decisões | 01 |
| [06](06-diretor-e-ctos.md) | Orquestração e empresas | 05 |
| [07](07-rotina-tech-leader.md) | Apoio à liderança | 04, 05, 06 |
| [08](08-pran-e-voz.md) | Agente de inglês e voz | 02, 06 |
| [09](09-painel.md) | Estado e controle | 04, 06 |
| [10](10-sala-virtual.md) | Estudo de interface virtual | 09 |

02 e 03 são independentes depois de 01. Concluir o MVP 01–04 antes de ampliar o escopo. Não é necessário modelo para testar alertas.

## Instruções comuns a todos os prompts

Ler AGENTS.md e docs/ antes de começar. Inspecionar o código e o ambiente. Tratar tecnologias descritas como propostas até validar sua adequação. Executar apenas o módulo solicitado e preservar o restante. Não usar credenciais reais em fixtures, logs ou commits.

Antes de mudanças, informar abordagem e arquivos afetados. Implementar, validar comportamentos essenciais, atualizar documentação com evidência e limitações e entregar resumo com instruções de execução. Não publicar alterações em outros projetos ou executar ações externas sem autorização específica.

Nenhum módulo está implementado atualmente.
