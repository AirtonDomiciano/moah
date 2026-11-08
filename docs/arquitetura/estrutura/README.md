# Estrutura alvo do MOAH

O MOAH coordena conversas, consultas e ações em uma aplicação local modular. O núcleo TypeScript aplica as regras. Adaptadores conectam áudio, banco, modelos e ferramentas. Python atende ao pipeline de áudio e ao treinamento. Esta árvore é o destino arquitetural. A organização do código evolui por capítulo.

```text
moah/
├── src/
│   ├── domain/          # Sessão, escopo, política e aprovações
│   ├── application/
│   │   ├── conversation/
│   │   ├── voice/
│   │   ├── memory/
│   │   ├── actions/
│   │   └── agents/
│   ├── infrastructure/
│   │   ├── audio/
│   │   ├── storage/
│   │   ├── models/
│   │   └── integrations/
│   └── cli/
├── scripts/voz/         # Coleta, treino, avaliação e diagnóstico
├── ui/                  # Estado, histórico e aprovações
├── tests/
├── docs/
└── cursror-dev/         # Prompts e relatórios de execução
```

CLI e interface chamam casos de uso. Casos de uso aplicam o domínio e recebem portas para dependências externas. Adaptadores implementam essas portas. A política autoriza efeitos antes da execução. O diretório de dados local guarda SQLite, áudios e modelos. O Git guarda código, exemplos sintéticos e documentação.

| Responsabilidade | Cenários |
| --- | --- |
| Voz e modelos | [Ativação, transcrição, síntese e promoção](voz.md) |
| Conversa e memória | [Contexto, evidência, escopo e pesquisa](conversa-memoria.md) |
| Ações e especialistas | [Autorizações, integrações e delegação](acoes-agentes.md) |
| Rotina e interface | [Agenda, reuniões e controles](rotina-interface.md) |
| Operação | [Persistência, falhas, testes e evolução](operacao.md) |

Consulte as [decisões vigentes](../decisoes/README.md) ao implementar. O capítulo atual alinha as janelas do treino com a escuta. A prova final de ativação precede a integração da conversa falada. Depois, a abertura de projetos no Cursor serve como primeiro fluxo completo de ação autorizada.
