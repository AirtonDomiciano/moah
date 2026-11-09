# Ponto de retomada do MOAH

Atualizado em 08/11/2026, horário de São Paulo.

## Leia primeiro

Este arquivo resume o estado atual. Os relatórios em [cursror-dev/execucoes](../cursror-dev/execucoes/README.md) guardam evidências por capítulo. A [arquitetura alvo](arquitetura/estrutura/README.md) descreve a divisão de responsabilidades. As [issues](https://github.com/AirtonDomiciano/moah/issues) guardam o backlog.

## Estado atual

- CLI de memória, checkpoints e consultas de leitura já existem.
- O laço de voz experimental reconhece ativações e reproduz “Estou aqui”. A robustez do detector continua em avaliação.
- O candidato de janelas `49ac8909…` teve 8/8 por clipe na sessão 03. A inspeção mostrou que a tomada 07 pontuou fora da fala.
- O candidato de fundo `749fb6fa…`, em 0,95, teve 6/8 na 03, 4 falsos de fala, 5/8 clipes de música e 3/8 de ambiente. A tomada 08 foi perdida durante “MOAH”. Atenuar as tomadas 07 e 08 não recuperou os acertos.
- Sessões 01/02 para treino, 03 para validação e 04 reservada. O foco imediato passou para transcrição de pedidos no JBL.
- Prova offline de STT aprovada no Debian 13. O usuário confirmou que disse “Valéria vai fazer um café”. O texto foi transcrito corretamente em 1,16 s, com carga de 0,45 s.
- STT usa faster-whisper 1.2.1, modelo small multilíngue, idioma pt, CPU int8. Ambiente separado do PRAN e pesos locais sob `MOAH_VOICE_DIR/stt/`. Revisão do modelo `536b0662742c02347bc0e980a01041f333bce120`. A prova leu PCM via `wave` e passou as amostras ao modelo, contornando a incompatibilidade observada no PyAV.
- O JBL precisa estar ligado. Com o headset desligado, a entrada apareceu no Debian mas capturou pico zero. Depois de ligar, a gravação e reprodução funcionaram.
- Base publicada deste checkpoint: [prova de transcrição](https://github.com/AirtonDomiciano/moah/commit/5148a1a65b9496b1d5bf8b6e5e1552551925fcb5). A transcrição integrada à escuta ainda aguarda evidência.

## Próximo capítulo

Integrar STT offline ao `escutar.py`. Fluxo: “MOAH” → “Estou aqui” → capturar um pedido com limite → mostrar a transcrição no terminal → voltar à espera. Usar a mesma leitura PCM da prova e descartar o áudio após processar. O teste no JBL é falar “Onde paramos no Ledger?” e conferir a frase inteira, sem a saudação misturada. A consulta à memória e a resposta falada são o capítulo seguinte.

## Como manter esta memória

Ao fechar cada capítulo, atualizar este resumo com o resultado, próximo passo e link para o relatório ou commit. Registrar o comando de validação, o que foi simulado e o que foi comprovado no hardware. Manter WAVs, pesos e dados pessoais fora do Git.

Uma issue, um capítulo e uma validação por rodada. Codex prepara o recorte, Cursor implementa, Airton valida no terminal e publica, Codex revisa o diff. Veja a [governança de IA](desenvolvimento/governanca-ia.md).

## Depois da primeira versão

- [Mapa mental e Obsidian](https://github.com/AirtonDomiciano/moah/issues/5).
- [Consumo de tokens do Cursor](https://github.com/AirtonDomiciano/moah/issues/4).
- Piloto de memória externa para agentes permanece adiado.
