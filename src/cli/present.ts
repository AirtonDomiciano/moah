import { formatInstant } from "../domain/time.js";
import type { ActionView, DailySummary, WorkRecord } from "../domain/types.js";

const TYPE_LABEL = {
  atividade: "atividade",
  reuniao: "reunião",
  checkpoint: "checkpoint",
} as const;

export function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

export function recordJson(record: WorkRecord): unknown {
  return {
    id: record.id,
    type: record.type,
    domain: record.domain,
    project: record.project,
    text: record.text,
    origin: record.origin,
    agent: record.agent,
    occurredAt: record.occurredAt,
    createdAt: record.createdAt,
    nextStep: record.nextStep,
    decisions: record.decisions,
    actions: record.actions,
    refs: record.refs,
  };
}

export function printRecord(record: WorkRecord, timeZone: string, json: boolean): void {
  if (json) {
    printJson(recordJson(record));
    return;
  }
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
  process.stdout.write(`${lines.join("\n")}\n`);
}

export function printRecordList(
  date: string,
  timeZone: string,
  records: WorkRecord[],
  json: boolean,
  domain: string | null,
  project: string | null,
): void {
  if (json) {
    printJson({
      date,
      timezone: timeZone,
      domain,
      project,
      records: records.map(recordJson),
    });
    return;
  }
  if (records.length === 0) {
    process.stdout.write(`Nenhum registro em ${date}${filterSuffix(domain, project)}.\n`);
    return;
  }
  process.stdout.write(`Registros de ${date} (${timeZone})${filterSuffix(domain, project)}\n`);
  for (const record of records) {
    process.stdout.write("\n");
    printRecord(record, timeZone, false);
  }
}

export function printActions(actions: ActionView[], timeZone: string, json: boolean): void {
  if (json) {
    printJson({
      actions: actions.map((item) => ({
        ...item.action,
        recordId: item.recordId,
        recordType: item.recordType,
        domain: item.domain,
        project: item.project,
        origin: item.origin,
        occurredAt: item.occurredAt,
      })),
    });
    return;
  }
  if (actions.length === 0) {
    process.stdout.write("Nenhuma ação.\n");
    return;
  }
  for (const item of actions) {
    const project = item.project ? `/${item.project}` : "";
    process.stdout.write(
      `${item.action.id} [${statusLabel(item.action.status)}] ${item.domain}${project} ${describeAction(item.action)} | origem=${item.origin} | ${formatInstant(item.occurredAt, timeZone)}\n`,
    );
  }
}

export function printSummary(summary: DailySummary, json: boolean): void {
  if (json) {
    printJson({
      ...summary,
      activities: summary.activities.map(recordJson),
      meetings: summary.meetings.map(recordJson),
      checkpoints: summary.checkpoints.map(recordJson),
      pendingActions: summary.pendingActions.map(actionJson),
      concludedActions: summary.concludedActions.map(actionJson),
    });
    return;
  }
  const lines = [
    `Resumo ${summary.date} (${summary.timezone})${filterSuffix(summary.domain, summary.project)}`,
    "Agrupamento dos registros desse dia civil. Reuniões são relatos; a origem está em cada item.",
    "As ações aparecem no estado atual, não como fotografia histórica do dia.",
    "",
    "Reuniões relatadas",
  ];
  appendRecords(lines, summary.meetings, summary.timezone);
  lines.push("", "Atividades");
  appendRecords(lines, summary.activities, summary.timezone);
  lines.push("", "Checkpoints");
  appendRecords(lines, summary.checkpoints, summary.timezone);
  lines.push("", "Decisões");
  if (summary.decisions.length === 0) {
    lines.push("  (nenhuma)");
  } else {
    for (const decision of summary.decisions) {
      lines.push(`  - ${decision.text} | registro=${decision.recordId} | origem=${decision.origin}`);
    }
  }
  lines.push("", "Pendências em aberto");
  appendActions(lines, summary.pendingActions);
  lines.push("", "Ações concluídas ligadas a este dia");
  appendActions(lines, summary.concludedActions);
  process.stdout.write(`${lines.join("\n")}\n`);
}

export function printCheckpoint(record: WorkRecord | null, domain: string, project: string | null, timeZone: string, json: boolean): void {
  if (json) {
    printJson({ domain, project, checkpoint: record ? recordJson(record) : null });
    return;
  }
  if (!record) {
    const where = project ? `${domain}/${project}` : domain;
    process.stdout.write(`Nenhum checkpoint para ${where}.\n`);
    return;
  }
  printRecord(record, timeZone, false);
}

function actionJson(item: ActionView): unknown {
  return {
    ...item.action,
    recordId: item.recordId,
    recordType: item.recordType,
    domain: item.domain,
    project: item.project,
    origin: item.origin,
    occurredAt: item.occurredAt,
  };
}

function appendRecords(lines: string[], records: WorkRecord[], timeZone: string): void {
  if (records.length === 0) {
    lines.push("  (nenhum)");
    return;
  }
  for (const record of records) {
    const project = record.project ? `/${record.project}` : "";
    lines.push(
      `  - ${formatInstant(record.occurredAt, timeZone)} [${record.domain}${project}] origem=${record.origin} agente=${record.agent}`,
    );
    lines.push(`    ${record.text}`);
    if (record.nextStep) {
      lines.push(`    próximo: ${record.nextStep}`);
    }
  }
}

function appendActions(lines: string[], actions: ActionView[]): void {
  if (actions.length === 0) {
    lines.push("  (nenhuma)");
    return;
  }
  for (const item of actions) {
    lines.push(
      `  - ${item.action.id} [${statusLabel(item.action.status)}] ${describeAction(item.action)} | registro=${item.recordId} | origem=${item.origin}`,
    );
  }
}

function describeAction(action: { description: string; owner: string | null; dueOn: string | null }): string {
  const owner = action.owner ? `; responsável=${action.owner}` : "";
  const due = action.dueOn ? `; prazo=${action.dueOn}` : "; sem prazo";
  return `${action.description}${owner}${due}`;
}

function statusLabel(status: "pendente" | "concluida"): string {
  return status === "concluida" ? "concluída" : "pendente";
}

function filterSuffix(domain: string | null, project: string | null): string {
  const parts = [domain, project].filter((part): part is string => part !== null);
  return parts.length === 0 ? "" : ` — ${parts.join("/")}`;
}
