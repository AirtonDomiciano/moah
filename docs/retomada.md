# Ponto de retomada do MOAH

Atualizado em 09/11/2026, horário de São Paulo.

## Leia primeiro

Este arquivo resume o estado atual. Os relatórios em [cursror-dev/execucoes](../cursror-dev/execucoes/README.md) guardam evidências por capítulo. A [arquitetura alvo](arquitetura/estrutura/README.md) descreve a divisão de responsabilidades. As [issues](https://github.com/AirtonDomiciano/moah/issues) guardam o backlog.

## Estado atual

- CLI de memória, checkpoints e consultas de leitura já existem.
- Escuta com confirmação STT da ativação: buffer de ~1,6 s obrigatório antes do disparo aceito; aceite `MOA`/`MOAH` (1 ou 2 palavras). ONNX em uso: `moah-experimental.onnx`, limiar 0,5.
- STT offline (faster-whisper small, CPU int8, pt) transcreve o pedido após “Estou aqui.”.
- Prova no JBL (09/11/2026) com `--confirmar-ativacao sim --diagnostico sim`: três ciclos completos de ativação + pedido.

### Três ciclos observados no JBL — 09/11/2026

1. Confirmação `Moa.` (score 0,9787) → saudação → pedido STT: `Beleza, funcionou. Isso aí.`
2. Um disparo rejeitado (texto vazio no WAV 02) → confirmação `Moa` (score 0,9694) → saudação → pedido STT: `Funciona a nossa segunda vez.`
3. Um falso (`Um, dois, três…`) rejeitado → confirmação `Moa` (score 0,9782) → saudação → pedido STT: `funcionou a terceira vez.`

WAVs de diagnóstico em `~/.local/share/moah/voz/diagnostico/confirmacao/` (fora do Git). Comando da prova: `npm run moah -- voz escutar --habilitar sim --microfone jbl --confirmar-ativacao sim --diagnostico sim`.

- Pedido com «onde paramos no &lt;projeto&gt;» (com ou sem prefixo, ex. «Pão, onde paramos no Ledger?») consulta `onde-paramos` no domínio pessoal. Projeto ambíguo pede confirmação no terminal. Transcrição original permanece impressa. Sem resposta falada ainda.
- Sessões 01/02 treino, 03 validação, 04 reservada. Candidatos ONNX não promovidos.
- Base publicada anterior: [prova de transcrição](https://github.com/AirtonDomiciano/moah/commit/5148a1a65b9496b1d5bf8b6e5e1552551925fcb5).

## Próximo capítulo

Validar no JBL o pedido “Onde paramos no Ledger?” com a consulta no terminal. Depois: resposta falada do checkpoint.

## Como manter esta memória

Ao fechar cada capítulo, atualizar este resumo com o resultado, próximo passo e link para o relatório ou commit. Registrar o comando de validação, o que foi simulado e o que foi comprovado no hardware. Manter WAVs, pesos e dados pessoais fora do Git.

Uma issue, um capítulo e uma validação por rodada. Codex prepara o recorte, Cursor implementa, Airton valida no terminal e publica, Codex revisa o diff. Veja a [governança de IA](desenvolvimento/governanca-ia.md).

## Depois da primeira versão

- [Mapa mental e Obsidian](https://github.com/AirtonDomiciano/moah/issues/5).
- [Consumo de tokens do Cursor](https://github.com/AirtonDomiciano/moah/issues/4).
- Piloto de memória externa para agentes permanece adiado.
