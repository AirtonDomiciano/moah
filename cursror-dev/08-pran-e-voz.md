# Módulo 08 — PRAN e voz

Estado: planejado. Dependências em [README](README.md).

## Prompt para o Cursor

Você está no repositório MOAH de Airton. Leia AGENTS.md, docs/contexto-e-decisoes.md, docs/arquitetura.md e cursror-dev/README.md. Execute somente este módulo.

### Objetivo

Preparar integração com o agente de inglês existente e camadas de áudio substituíveis.

### Trabalho

Primeiro localizar projeto e contrato reais do PRAN mediante caminho fornecido ou acesso disponível. Não presumir arquivos neste repositório. Separar wake word, captura, transcrição, diálogo e síntese. Documentar adaptador para hey_pran.onnx ou hey_pran.tflite apenas após verificar compatibilidade. Permitir trocar TTS/voz sem retreinar wake word. Tornar ativação do microfone explícita e desligável. Evitar gravar áudio por padrão e limitar competição de GPU.

### Critérios de aceite

Com mocks, trocar sintetizador sem modificar detector; parar captura sob comando; encaminhar tarefa de inglês e retornar resultado. Se artefatos faltarem, entregar contrato e indicar integração pendente, sem alegar funcionamento real.

### Entrega

Implementar apenas após inspecionar o ambiente e o código existente. Adicionar testes de comportamento apropriados, documentação de configuração e execução, exemplos sem segredos e registro dos resultados reais. Informar dependências faltantes e decisões propostas. Não marcar integrações simuladas como prontas. Não avançar automaticamente para o próximo módulo.
