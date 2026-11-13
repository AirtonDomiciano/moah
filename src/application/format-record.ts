import { formatInstant } from "../domain/time.js";
import type { WorkRecord } from "../domain/types.js";

const TYPE_LABEL = {
  atividade: "atividade",
  reuniao: "reunião",
  checkpoint: "checkpoint",
} as const;

export function formatRecordLines(record: WorkRecord, timeZone: string): string[] {
  const lines = [
    `Registro ${record.id}`,
    `Tipo: ${TYPE_LABEL[record.type]}`,
    `Domínio: ${record.domain}`,
    `Projeto: ${record.project ?? "(nenhum)"}`,
    `Quando: ${formatInstant(record.occurredAt, timeZone)}`,
    `Criado: ${formatInstant(record.createdAt, timeZone)}`,
    `Origem: ${record.origin}`,
    `Agente: ${record.agent}`,
    `Texto: ${record.text}`,
  ];
  lines.push(record.decisions.length === 0 ? "Decisões: (nenhuma)" : "Decisões:");
  for (const decision of record.decisions) {
    lines.push(`  - ${decision.text}`);
  }
  lines.push(record.actions.length === 0 ? "Ações: (nenhuma)" : "Ações:");
  for (const action of record.actions) {
    lines.push(`  - ${action.id} [${statusLabel(action.status)}] ${describeAction(action)}`);
  }
  lines.push(`Próximo passo: ${record.nextStep ?? "(nenhum)"}`);
  lines.push(record.refs.length === 0 ? "Referências: (nenhuma)" : "Referências:");
  for (const ref of record.refs) {
    lines.push(`  - ${ref}`);
  }
  return lines;
}

function statusLabel(status: "pendente" | "concluida"): string {
  return status === "concluida" ? "concluída" : "pendente";
}

function describeAction(action: { description: string; owner: string | null; dueOn: string | null }): string {
  const owner = action.owner ? `; responsável=${action.owner}` : "";
  const due = action.dueOn ? `; prazo=${action.dueOn}` : "; sem prazo";
  return `${action.description}${owner}${due}`;
}
