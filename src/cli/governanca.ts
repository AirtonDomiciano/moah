import { AppError } from "../domain/errors.js";
import { isDomain } from "../domain/constants.js";
import {
  demoAuthority,
  validateProposal,
  type ActionProposal,
} from "../domain/policy.js";
import {
  denyApproval,
  executeFake,
  executorIsPaused,
  grantApproval,
  listAudit,
  pauseExecutor,
  proposeAction,
  readApproval,
  resumeExecutor,
  revokeApproval,
  type GovernanceContext,
} from "../application/governance.js";
import { many, one, rejectUnknown, type ParsedArgs } from "./parse-args.js";
import { printJson } from "./present.js";

export function handleGovernance(parsed: ParsedArgs, context: GovernanceContext): void {
  const sub = parsed.positionals[1];
  if (sub === "propor") {
    rejectUnknown(parsed.options, ["ferramenta", "dominio", "alvo", "param", "acao", "validade-ms"]);
    const proposal = proposalFrom(parsed, "eco_sintetico");
    const domain = requiredDomain(proposal.domain);
    const validForMs = one(parsed.options, "validade-ms");
    const outcome = proposeAction(
      context,
      proposal,
      demoAuthority(domain),
      validForMs === null ? undefined : Number(validForMs),
    );
    printJson({
      decisao: outcome.policy.decision,
      motivo: outcome.policy.reason,
      aprovacao: outcome.approval ? publicApproval(outcome.approval) : null,
    });
    if (outcome.policy.decision === "deny") {
      throw new AppError(outcome.policy.reason, "validation");
    }
    return;
  }
  if (sub === "conceder" || sub === "negar" || sub === "revogar" || sub === "ver") {
    rejectUnknown(parsed.options, []);
    const id = requiredId(parsed);
    const row = sub === "conceder"
      ? grantApproval(context, id)
      : sub === "negar"
        ? denyApproval(context, id)
        : sub === "revogar"
          ? revokeApproval(context, id)
          : readApproval(context, id);
    printJson(publicApproval(row));
    return;
  }
  if (sub === "executar") {
    rejectUnknown(parsed.options, ["aprovacao", "ferramenta", "dominio", "alvo", "param", "acao"]);
    const approvalId = one(parsed.options, "aprovacao");
    if (!approvalId) {
      throw new AppError("Informe --aprovacao <id>.", "validation");
    }
    const proposal = proposalFrom(parsed, "eco_sintetico");
    const domain = requiredDomain(proposal.domain);
    const outcome = executeFake(context, proposal, demoAuthority(domain), approvalId);
    printJson({
      status: outcome.status,
      motivo: outcome.reason,
      aprovacao: outcome.approval ? publicApproval(outcome.approval) : null,
    });
    if (outcome.status !== "concluida") {
      const code = outcome.status === "falha" && outcome.reason.includes("não encontrada") ? "not_found" : "conflict";
      throw new AppError(outcome.reason, code);
    }
    return;
  }
  if (sub === "pausar" || sub === "retomar" || sub === "pausa") {
    rejectUnknown(parsed.options, []);
    if (parsed.positionals.length !== 2) {
      throw new AppError("Uso: moah governanca pausar|retomar|pausa.", "validation");
    }
    if (sub === "pausar") {
      pauseExecutor(context);
    } else if (sub === "retomar") {
      resumeExecutor(context);
    }
    const paused = executorIsPaused(context);
    printJson({
      pausado: paused,
      aviso: "A pausa bloqueia novas execuções. Não desfaz efeito já realizado.",
    });
    return;
  }
  if (sub === "auditoria") {
    rejectUnknown(parsed.options, []);
    printJson({ eventos: listAudit(context).map(publicAudit) });
    return;
  }
  throw new AppError(
    "Uso: moah governanca propor|conceder|negar|revogar|ver|executar|pausar|retomar|pausa|auditoria.",
    "validation",
  );
}

function proposalFrom(parsed: ParsedArgs, fallbackTool: string): ActionProposal {
  if (parsed.positionals.length !== 2) {
    throw new AppError("O subcomando de governança não aceita argumentos posicionais extras.", "validation");
  }
  const domain = one(parsed.options, "dominio");
  const target = one(parsed.options, "alvo");
  if (!domain || !target) {
    throw new AppError("Informe --dominio e --alvo.", "validation");
  }
  return validateProposal({
    action: one(parsed.options, "acao") ?? "executar",
    tool: one(parsed.options, "ferramenta") ?? fallbackTool,
    agent: "manual",
    domain,
    target,
    parameters: parseParams(many(parsed.options, "param")),
  });
}

function parseParams(values: string[]): Record<string, string> {
  const parameters: Record<string, string> = {};
  for (const value of values) {
    const eq = value.indexOf("=");
    if (eq <= 0) {
      throw new AppError("Use --param chave=valor.", "validation");
    }
    const key = value.slice(0, eq);
    if (Object.prototype.hasOwnProperty.call(parameters, key)) {
      throw new AppError(`Parâmetro repetido: ${key}.`, "validation");
    }
    parameters[key] = value.slice(eq + 1);
  }
  return parameters;
}

function requiredId(parsed: ParsedArgs): string {
  const id = parsed.positionals[2];
  if (!id || parsed.positionals.length !== 3) {
    throw new AppError("Informe o id da aprovação.", "validation");
  }
  return id;
}

function requiredDomain(value: string) {
  if (!isDomain(value)) {
    throw new AppError("Domínio inválido. Use pessoal, imex ou aluai.", "validation");
  }
  return value;
}

function publicApproval(row: {
  id: string;
  state: string;
  action: string;
  tool: string;
  domain: string;
  target: string;
  agent: string;
  parameters: Record<string, string>;
  fingerprint: string;
  fingerprintVersion: number;
  createdAt: string;
  validUntil: string;
  decidedAt: string | null;
  consumedAt: string | null;
}) {
  return {
    id: row.id,
    estado: row.state,
    acao: row.action,
    ferramenta: row.tool,
    dominio: row.domain,
    alvo: row.target,
    agente: row.agent,
    parametros: row.parameters,
    fingerprint: row.fingerprint,
    fingerprintVersao: row.fingerprintVersion,
    criadaEm: row.createdAt,
    validaAte: row.validUntil,
    decididaEm: row.decidedAt,
    consumidaEm: row.consumedAt,
  };
}

function publicAudit(row: {
  id: string;
  kind: string;
  approvalId: string | null;
  tool: string;
  domain: string;
  target: string;
  outcome: string;
  fingerprint: string;
  detail: string;
  createdAt: string;
}) {
  return {
    id: row.id,
    tipo: row.kind,
    aprovacao: row.approvalId,
    ferramenta: row.tool,
    dominio: row.domain,
    alvo: row.target,
    resultado: row.outcome,
    fingerprint: row.fingerprint,
    detalhe: row.detail,
    em: row.createdAt,
  };
}
