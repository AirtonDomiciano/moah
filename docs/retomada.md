# Ponto de retomada do MOAH

Atualizado em 22/11/2026, horário de São Paulo.

## Leia primeiro

Este arquivo resume o estado atual. Os relatórios em [cursror-dev/execucoes](../cursror-dev/execucoes/README.md) guardam evidências por capítulo. A [arquitetura alvo](arquitetura/estrutura/README.md) descreve a divisão de responsabilidades. As [issues](https://github.com/AirtonDomiciano/moah/issues) guardam o backlog.

## Estado atual

- CLI de memória, checkpoints e consultas de leitura já existem.
- Escuta com confirmação em dois estágios: detector `moah-experimental.onnx` (limiar 0,5) + verificador acústico ONNX separado (embeddings 16×96). Modo legado STT com `--confirmar-ativacao stt`. Produção acústica exige `correcao/verificador.json` validado; até lá use `--modo-verificador manual`.
- STT offline (faster-whisper small, CPU int8, pt) transcreve o pedido após “Estou aqui.”; janela do pedido: 5 s.
- Prova no JBL (09/11/2026) com `--confirmar-ativacao sim --diagnostico sim`: três ciclos completos de ativação + pedido.

### Três ciclos observados no JBL — 09/11/2026

1. Confirmação `Moa.` (score 0,9787) → saudação → pedido STT: `Beleza, funcionou. Isso aí.`
2. Um disparo rejeitado (texto vazio no WAV 02) → confirmação `Moa` (score 0,9694) → saudação → pedido STT: `Funciona a nossa segunda vez.`
3. Um falso (`Um, dois, três…`) rejeitado → confirmação `Moa` (score 0,9782) → saudação → pedido STT: `funcionou a terceira vez.`

WAVs de diagnóstico em `~/.local/share/moah/voz/diagnostico/confirmacao/` (fora do Git). Comando da prova: `npm run moah -- voz escutar --habilitar sim --microfone jbl --confirmar-ativacao sim --diagnostico sim`.

- Consulta de checkpoint (Ledger) preservada: `consultar_checkpoint` via política; fala Texto + Próximo passo.
- Módulo de lembretes em `src/application/reminders/`: validação e agendamento separados da voz. Ferramenta `criar_lembrete_local` no catálogo e na política (`voiceAuthority`). Fila `jobs` reaproveitada (`lembrete_local`); lembretes avulsos em memória da sessão. Voz interpreta, chama a ferramenta e fala confirmação + aviso (“vale só nesta sessão”).
- STT real “Me lembro de tomar água daqui a um minuto.” agenda; “Me lembro de tomar água” sem prazo não agenda. Aceite no JBL pendente.
- Sessões 01/02 treino, 03 validação, 04 reservada. Candidatos ONNX não promovidos.
- Base publicada anterior: [prova de transcrição](https://github.com/AirtonDomiciano/moah/commit/5148a1a65b9496b1d5bf8b6e5e1552551925fcb5).

## Diagnóstico da ativação — 22/11/2026

Nesta máquina o JBL Quantum 360 é a origem padrão (fonte 44, destino 46). A escuta pede 16 kHz, 1 canal, `s16`, quadro de 1280. O detector carregado é `moah-experimental.onnx`, SHA-256 `04fcd7bb45fffa4a82fdcb266fd9e795691ee53228195334d1ef6fbc6b587bdf`, chave `moah-experimental`, VAD 0, limiar 0,5.

Leituras curtas do microfone, sem gravar e sem palavra controlada: em 2 s o pico do score foi 0,9782; em 3,2 s seguintes, 0,1848. Pelo comando de escuta, com limiar 1 para não saudar, o primeiro segundo quieto (RMS 25) chegou a 0,9942 e o segundo caiu a 0,01. O áudio chega ao modelo. O formato não é o defeito observado. A escuta ignora os primeiros 1,7 s de cada espera para não tratar esse arranque como “MOAH”. Não houve retreino. A palavra falada ainda não foi medida.

## Próximo capítulo

Calibrar o verificador (`treinar_verificador.py` + `calibrar_verificador.py`), marcar `validado: true` só após métricas na sessão 03 e negativos. Medir no JBL vinte chamadas “moa”/“moá” e “que horas são?” com `--confirmar-ativacao acustico --diagnostico sim`. O aceite da palavra continua pendente sem áudio real.

Validar também, se o fluxo de horas estiver estável:

1. “Me lembro de tomar água daqui a um minuto.” → confirmação + aviso falados; registro no terminal.
2. “Me lembro de tomar água” → não agenda.
3. “Onde paramos no Ledger?” → checkpoint intacto.

Comando no headset:

```bash
npm run moah -- voz escutar --habilitar sim --microfone jbl --confirmar-ativacao acustico --modo-verificador manual --diagnostico sim
```

Diga “MOAH”, espere “Estou aqui.” e peça “que horas são?”. `Ctrl+C` encerra. O roteiro das vinte chamadas está em [voz](operacao/voz.md). Relatório: [2026-11-22-001-voz-fluxo](../cursror-dev/execucoes/2026-11-22-001-voz-fluxo.md).

Checagem sem microfone:

```bash
npm run moah -- voz pedido --dominio pessoal --texto "Que horas são?"
npm run moah -- voz pedido --dominio pessoal --texto "Me lembro de tomar água daqui a um minuto."
npm run moah -- voz pedido --dominio pessoal --texto "Me lembro de tomar água"
npm run moah -- voz pedido --dominio pessoal --texto "Onde paramos no Ledger?"
```

## Como manter esta memória

Ao fechar cada capítulo, atualizar este resumo com o resultado, próximo passo e link para o relatório ou commit. Registrar o comando de validação, o que foi simulado e o que foi comprovado no hardware. Manter WAVs, pesos e dados pessoais fora do Git.

Uma issue, um capítulo e uma validação por rodada. Codex prepara o recorte, Cursor implementa, Airton valida no terminal e publica, Codex revisa o diff. Veja a [governança de IA](desenvolvimento/governanca-ia.md).

## Depois da primeira versão

- [Mapa mental e Obsidian](https://github.com/AirtonDomiciano/moah/issues/5).
- [Consumo de tokens do Cursor](https://github.com/AirtonDomiciano/moah/issues/4).
- Piloto de memória externa para agentes permanece adiado.
