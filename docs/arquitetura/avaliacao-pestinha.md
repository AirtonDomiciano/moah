# Pestinha como referência para o MOAH

Data: 03/11/2026. Origem: pedido explícito de Airton.
Estado: levantamento e proposta de sequência; nenhuma integração implementada.

## Objetivo e escopo

Aproveitar ideias de presença no desktop, contexto do computador, organização e controle do usuário sem substituir o núcleo TypeScript do MOAH. Não foi decidido incorporar código, instalar o Pestinha ou adotar sua rede neural.

Base MOAH: `02ab0da78a188e594f0a5524cc28f642671c6913`, após os commits do prompt 15. Foram consultados os diffs novos em relação a `a0f4f01`, os documentos alterados e as instruções relevantes. Esta leitura não equivale a auditoria completa ou execução dos testes. O relatório do Cursor informa 55 testes aprovados; eles não foram reexecutados neste levantamento.

Referência externa: [Pestinha](https://github.com/mille-okws/pestinha), HEAD observado `4898787cb5128bea81a57894c30607477d2f9818`. Análise estática de documentação e módulos selecionados, sem executar binários. Links de fonte ao final.

## O que existe depois das seis etapas

| Frente | Evidência atual | O que continua pendente |
| --- | --- | --- |
| Política | Controles anteriores preservados segundo o relatório e testes registrados | Sandbox do sistema operacional e ferramentas com efeitos reais |
| Modelo | Adaptador e avaliação preparados | Motor, download autorizado e avaliação com modelo real |
| Armazenamento | Verificação Linux de volume, backup consistente e migração explícita | Validar destino real e recuperação operacional; suporte equivalente no Windows |
| Serviço | Fila persistente e processamento de uma tarefa por chamada | Serviço contínuo instalado, supervisão e entrega regular |
| Agenda | Arquivo sintético, relógio e registro local de notificação | Conta real, sincronização e canal de alerta perceptível |
| Reuniões | Importação de texto e consulta por id | Análise com modelo real; captura de áudio permanece fora |

Seis etapas trabalhadas não significam seis módulos completos. Uma linha em `notifications` não prova que Airton recebeu ou leu um aviso.

## O que estudar agora no Pestinha

| Referência | Aplicação proposta | Critério para avançar |
| --- | --- | --- |
| Núcleo independente de Qt e de APIs nativas | Preservar domínio e casos de uso independentes da interface e do SO; testar dependências proibidas onde houver risco real | Trocar interface ou sensor sem reescrever regras |
| Adaptadores de plataforma e sensores | Definir contrato mínimo de contexto e validar primeiro com fonte sintética | Sensor indisponível resulta em estado desconhecido, sem inferência inventada |
| Controle central de sessão | Definir pausa, retomada e interrupção por responsabilidade | Pausa impede novos trabalhos; tarefas em andamento têm cancelamento ou estado incerto explícito |
| Memória separada por personagem | Reforçar separação por agente, domínio e projeto | Contexto pessoal, IMEX e Aluai não se misturam sem autorização |
| Escrita temporária seguida de substituição e migração preservando origem | Comparar com o armazenamento já existente; manter snapshot SQLite para o banco | Falha não perde a origem e restauração é verificável |

Estudar agora não autoriza ativar coleta. A primeira entrega pode usar apenas contexto sintético. Não copiar o fallback para valores padrão do armazenamento do pet para políticas de segurança: política ausente ou corrompida deve impedir a ação e emitir diagnóstico.

## Prioridade imediata do MOAH

1. Validar o recorte do prompt 15 na máquina com dados sintéticos: concorrência CLI/fila, cancelamento durante execução, recuperação, volume ausente e restauração.
2. Revisar a compatibilidade e disponibilidade atuais do motor/modelo antes de repetir os comandos antigos; apresentar download concreto e executar após a autorização correspondente. Medir latência, RAM e VRAM e revisar respostas com evidências.
3. Escolher a primeira fonte de agenda e conta permitida. Implementar leitura, sincronização e um canal visível de aviso, com permissões específicas.
4. Transformar o processamento pontual em rotina supervisionada. Comprovar que o relógio continua funcionando sem LLM e que pausa/parada têm efeito observável.
5. Avaliar resumo real de transcrição sintética. Preservar fonte, versão, domínio e distinção entre ação candidata e ação autorizada.

Essas prioridades são propostas técnicas para alcançar a rotina útil de Tech Lead. Não habilitam instalações, contas, serviços ou efeitos externos pela simples publicação deste documento.

## O que deixar para depois

| Frente | Quando avaliar | Resultado esperado |
| --- | --- | --- |
| Contexto real do desktop | Depois da base de serviço, permissões e canal de interação | Sinais mínimos de inatividade, aplicativo e tela cheia, com coleta desligável |
| Bandeja e painel simples | Quando houver estado real para exibir | Saúde, tarefas, fontes, pausa e aprovações sem depender da conversa |
| Proatividade contextual | Após agenda confiável e preferências explícitas | Oferecer ajuda em momento adequado, com adiamento e sem insistência |
| Avatar e animações | Depois de a rotina principal ser útil | Presença visual opcional, sem capturar foco e com baixo consumo medido |
| Personalidade e aprendizado de preferências | Após haver feedback e critérios de qualidade | Ajustar estilo e horário dentro dos limites definidos pelo usuário |
| Rede neural spiking do Pestinha | Como estudo ou experimento isolado, se houver benefício mensurável | Explorar comportamento do avatar; não substituir LLM, memória ou autorização |
| Voz, captura de reuniões e demais agentes | Conforme roadmap e contratos próprios | Integrar separadamente, sem carregar tudo ou coletar áudio automaticamente |

Obsidian e Graphify continuam na direção já registrada na ADR 0006; este levantamento não muda sua prioridade nem os implementa.

## Contratos de responsabilidade propostos

- **Contexto do computador:** observa somente sinais autorizados e publica eventos com origem, instante, disponibilidade e retenção definida. Não decide tarefas.
- **MOAH:** combina evidências e memória para apresentar propostas e coordenar especialistas.
- **Política e executor:** verificam agente, domínio, ferramenta, escopo, aprovação e pausa antes de qualquer efeito.
- **Interface desktop:** apresenta estado e recebe escolhas; não ganha privilégios por exibir um avatar.
- **Especialistas:** mantêm detalhes no próprio contexto e entregam resumo rastreável ao MOAH.

Começar com tipos e eventos mínimos, reutilizando contratos existentes. Não criar microserviços ou novos frameworks apenas para reproduzir a organização do Pestinha.

## Exemplo de uso futuro

Às 16h30, o agendador identifica o horário do inglês sem chamar LLM. Com preferências habilitadas e contexto disponível, a interface pergunta: “Airton, posso chamar o agente de inglês?”.

Se Airton disser “agora não”, oferecer ou aplicar o adiamento previamente combinado e persistir o novo horário. Iniciar o especialista exige o aceite previsto na política. Teams aberto não comprova reunião; aplicativo ativo não comprova trabalho nem presença. Contexto incerto deve ser apresentado como incerto.

## Limites de adoção

- A SNN do Pestinha é voltada ao comportamento do pet; não equivale a um LLM para leitura, pesquisa ou coordenação.
- Python/Qt podem continuar em um componente separado se isso for útil. Não reescrever o MOAH em Python nem introduzir Qt sem decisão própria.
- Não transportar o ciclo de animação para o diretor: agendamento e eventos não precisam consultar modelo continuamente.
- Aprendizado não pode conceder permissões, alterar política ou aprovar ações.
- Coleta real requer escopo, preferência explícita, minimização e retenção. Não acrescentar captura de teclas, títulos, tela ou áudio por conveniência.
- O README externo informa limitações no Wayland e ausência de validação real em Linux/macOS. Testar a sessão real do Debian antes de prometer suporte.
- O projeto declara GPL-3.0-or-later para código e condições separadas para recursos visuais. Antes de incorporar ou distribuir código/recursos, verificar os arquivos e obrigações aplicáveis. Este levantamento usa referências conceituais e não copia implementação.

## Fontes e rastreabilidade

- [README e licença declarada](https://github.com/mille-okws/pestinha/blob/4898787cb5128bea81a57894c30607477d2f9818/README.md)
- [Arquitetura](https://github.com/mille-okws/pestinha/blob/4898787cb5128bea81a57894c30607477d2f9818/docs/ARQUITETURA.md)
- [Rede neural](https://github.com/mille-okws/pestinha/blob/4898787cb5128bea81a57894c30607477d2f9818/docs/REDE_NEURAL.md)
- [Sensores](https://github.com/mille-okws/pestinha/blob/4898787cb5128bea81a57894c30607477d2f9818/pestinha/sense/senses.py)
- [Plataforma Windows](https://github.com/mille-okws/pestinha/blob/4898787cb5128bea81a57894c30607477d2f9818/pestinha/plataforma/windows.py)
- [Controle de sessão](https://github.com/mille-okws/pestinha/blob/4898787cb5128bea81a57894c30607477d2f9818/pestinha/controle/sessao.py)
- [Persistência de arquivos](https://github.com/mille-okws/pestinha/blob/4898787cb5128bea81a57894c30607477d2f9818/pestinha/store.py)
- [Relatório local do prompt 15](../../cursror-dev/execucoes/2026-11-02-003-prompt-15.md)
- [Roadmap](../produto/roadmap.md)

## Orientação para o Cursor

Ler este levantamento como referência e backlog, não como autorização para implementar tudo. Selecionar um recorte por vez com critério observável, consultar segurança e ADRs e reaproveitar os casos de uso existentes. Registrar prompt, execução e limitações. Não declarar sensores, interface, calendário real ou modelo como funcionais enquanto só houver documentação ou fixture.
