import { createHash } from "node:crypto";
import { isDomain, type Domain } from "./constants.js";
import { AppError } from "./errors.js";

export const POLICY_VERSION = "1";

/** Formato canônico que inclui o agente do contexto confiável. A versão 1 não tinha esse vínculo. */
export const FINGERPRINT_VERSION = 2;

export const READ_TOOLS = ["consultar_pendencias", "consultar_resumo", "consultar_checkpoint"] as const;

/** Ferramenta falsa da demonstração. Não entra na lista oferecida ao modelo. */
export const DEMO_EFFECT_TOOL = "eco_sintetico";

export const BLOCKED_TOOLS = [
  "shell",
  "terminal",
  "escrever_arquivo",
  "rede",
  "instalar",
  "git",
  "azure",
  "agenda",
  "registrar",
  "concluir",
] as const;

const WIDENING_KEYS = new Set(["ampliar", "permissao", "permissão", "dominio", "domain", "shell"]);

export type PolicyKind = "allow" | "ask" | "deny";

export interface ActionProposal {
  action: string;
  tool: string;
  agent: string;
  domain: string;
  target: string;
  parameters: Record<string, string>;
}

/** Fornecido pelo código que chama a política. O modelo não preenche este objeto. */
export interface AuthorityContext {
  sessionDomain: Domain;
  agent: string;
  grantedTools: readonly string[];
  parentGrantedTools: readonly string[] | null;
}

export interface PolicyDecision {
  decision: PolicyKind;
  reason: string;
}

const LIMITS = {
  action: 40,
  tool: 80,
  agent: 80,
  target: 200,
  key: 40,
  value: 200,
  params: 8,
} as const;

export function conversationAuthority(sessionDomain: Domain): AuthorityContext {
  return {
    sessionDomain,
    agent: "conversa",
    grantedTools: READ_TOOLS,
    parentGrantedTools: null,
  };
}

export function demoAuthority(sessionDomain: Domain): AuthorityContext {
  return {
    sessionDomain,
    agent: "manual",
    grantedTools: [DEMO_EFFECT_TOOL],
    parentGrantedTools: null,
  };
}

export function validateProposal(input: ActionProposal): ActionProposal {
  const action = requiredText(input.action, "ação", LIMITS.action);
  const tool = requiredText(input.tool, "ferramenta", LIMITS.tool);
  const agent = requiredText(input.agent, "agente", LIMITS.agent);
  const domain = requiredText(input.domain, "domínio", 20);
  const target = requiredText(input.target, "alvo", LIMITS.target);
  if (!isDomain(domain)) {
    throw new AppError("Domínio inválido. Use pessoal, imex ou aluai.", "validation");
  }
  const parameters = validateParameters(input.parameters);
  return { action, tool, agent, domain, target, parameters };
}

export function canonicalAction(proposal: ActionProposal): string {
  const keys = Object.keys(proposal.parameters).sort();
  const lines = [
    `fingerprint=${FINGERPRINT_VERSION}`,
    `agent=${proposal.agent}`,
    `action=${proposal.action}`,
    `tool=${proposal.tool}`,
    `domain=${proposal.domain}`,
    `target=${proposal.target}`,
    ...keys.map((key) => `param.${key}=${proposal.parameters[key]}`),
  ];
  return lines.join("\n");
}

export function actionFingerprint(proposal: ActionProposal): string {
  return createHash("sha256").update(canonicalAction(proposal)).digest("hex");
}

export function evaluatePolicy(proposal: ActionProposal, authority: AuthorityContext): PolicyDecision {
  const checked = validateProposal(proposal);
  if ((BLOCKED_TOOLS as readonly string[]).includes(checked.tool)) {
    return { decision: "deny", reason: `A ferramenta ${checked.tool} está bloqueada.` };
  }
  if (!(READ_TOOLS as readonly string[]).includes(checked.tool) && checked.tool !== DEMO_EFFECT_TOOL) {
    return { decision: "deny", reason: `Ferramenta desconhecida: ${checked.tool}.` };
  }
  if (checked.domain !== authority.sessionDomain) {
    return {
      decision: "deny",
      reason: `O domínio ${checked.domain} está fora da sessão ${authority.sessionDomain}.`,
    };
  }
  const widening = Object.keys(checked.parameters).find((key) => WIDENING_KEYS.has(key.toLowerCase()));
  if (widening) {
    return { decision: "deny", reason: `O parâmetro ${widening} tentaria ampliar a permissão.` };
  }
  if (checked.agent !== authority.agent) {
    return {
      decision: "deny",
      reason: "A identidade declarada na proposta não comprova o agente autorizado.",
    };
  }
  if (authority.parentGrantedTools !== null && !authority.parentGrantedTools.includes(checked.tool)) {
    return {
      decision: "deny",
      reason: `O agente filho não pode usar ${checked.tool} além do que o supervisor concedeu.`,
    };
  }
  if (!authority.grantedTools.includes(checked.tool)) {
    return { decision: "deny", reason: `A ferramenta ${checked.tool} não está no escopo concedido.` };
  }
  if ((READ_TOOLS as readonly string[]).includes(checked.tool)) {
    return { decision: "allow", reason: "Consulta liberada para o domínio da sessão." };
  }
  return { decision: "ask", reason: "A ação tem efeito e exige aprovação específica." };
}

/** Um sim genérico não converte negação nem pedido em permissão. */
export function applyGenericConsent(decision: PolicyDecision, genericYes: boolean): PolicyDecision {
  if (!genericYes) {
    return decision;
  }
  if (decision.decision === "deny") {
    return { decision: "deny", reason: `${decision.reason} Um sim genérico não desbloqueia a ação.` };
  }
  if (decision.decision === "ask") {
    return { decision: "ask", reason: `${decision.reason} Um sim genérico não substitui a aprovação da ação exata.` };
  }
  return decision;
}

function validateParameters(value: unknown): Record<string, string> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("Os parâmetros precisam ser um objeto de textos.", "validation");
  }
  const entries = Object.entries(value);
  if (entries.length > LIMITS.params) {
    throw new AppError("Há parâmetros demais na proposta.", "validation");
  }
  const parameters: Record<string, string> = {};
  for (const [key, raw] of entries) {
    const name = requiredText(key, "nome do parâmetro", LIMITS.key);
    if (typeof raw !== "string") {
      throw new AppError(`O parâmetro ${name} precisa ser texto.`, "validation");
    }
    if (isSensitiveKey(name)) {
      throw new AppError(`O parâmetro ${name} não entra em autorização nem em auditoria.`, "validation");
    }
    parameters[name] = requiredText(raw, name, LIMITS.value);
  }
  return parameters;
}

function isSensitiveKey(key: string): boolean {
  return /token|secret|password|senha|api[-_]?key|authorization/i.test(key);
}

function requiredText(value: unknown, label: string, max: number): string {
  if (typeof value !== "string") {
    throw new AppError(`Informe ${label}.`, "validation");
  }
  const text = value.trim();
  if (!text || text.length > max || text.includes("\0") || text.includes("\n")) {
    throw new AppError(`${label} inválido.`, "validation");
  }
  return text;
}
