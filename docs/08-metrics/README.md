# Métricas — evolução com evidência

Não há baseline de latência, RAM ou cobertura percentual. A primeira verificação de engenharia da CLI, em 28/10/2026, está no [relatório do prompt 00](../../cursror-dev/execucoes/2026-10-28-001-prompt-00.md): `npm run typecheck`, `npm run build` e 19 testes com 0 falhas na execução final.

| Área | Medição proposta | Condição |
| --- | --- | --- |
| Continuidade | Registros recuperados e checkpoints corretos após reinício | Testes reprodutíveis |
| Ferramentas | Ações corretas, falhas e publicações duplicadas | Execuções com evidências |
| Interação | Tempo até primeira resposta e conclusão | Informar modelo/contexto/ambiente |
| Recursos | Pico de RAM/VRAM, CPU e fila | Coletor e cenário conhecidos |
| Memória | Relevância e tamanho dos resumos, origem recuperável | Fixtures e revisão |
| Engenharia | Typecheck/build/testes e regressões | Comandos e commit |
| Alertas | Atraso, duplicação e falhas de entrega | Relógio controlado e observação real |

Cobertura isolada não prova qualidade. Não inventar métricas DORA para um projeto sem processo de deploy observado. Agregar dados antes de publicar; uso pessoal e métricas detalhadas pertencem ao runtime privado.
