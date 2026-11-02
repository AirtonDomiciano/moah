import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyGenericConsent,
  conversationAuthority,
  DEMO_EFFECT_TOOL,
  evaluatePolicy,
  READ_TOOLS,
  type ActionProposal,
  type AuthorityContext,
} from "../src/domain/policy.js";

const base: ActionProposal = {
  action: "consultar",
  tool: "consultar_pendencias",
  agent: "conversa",
  domain: "imex",
  target: "imex",
  parameters: {},
};

describe("política", () => {
  it("nega ferramenta desconhecida e ferramenta bloqueada mesmo com sim genérico", () => {
    const unknown = evaluatePolicy({ ...base, tool: "inventada" }, conversationAuthority("imex"));
    assert.equal(unknown.decision, "deny");
    const blocked = evaluatePolicy({ ...base, action: "executar", tool: "shell", target: "local" }, conversationAuthority("imex"));
    assert.equal(blocked.decision, "deny");
    assert.equal(applyGenericConsent(blocked, true).decision, "deny");
    assert.match(applyGenericConsent(blocked, true).reason, /sim genérico/);
  });

  it("nega domínio fora da sessão e tentativa de ampliar permissão", () => {
    const other = evaluatePolicy({ ...base, domain: "aluai", target: "aluai" }, conversationAuthority("imex"));
    assert.equal(other.decision, "deny");
    assert.match(other.reason, /fora da sessão/);
    const widen = evaluatePolicy({ ...base, parameters: { ampliar: "shell" } }, conversationAuthority("imex"));
    assert.equal(widen.decision, "deny");
  });

  it("nega delegação que ultrapassa o supervisor e permite a consulta concedida", () => {
    const child: AuthorityContext = {
      sessionDomain: "imex",
      grantedTools: [...READ_TOOLS, DEMO_EFFECT_TOOL, "shell"],
      parentGrantedTools: ["consultar_pendencias"],
    };
    const widened = evaluatePolicy(
      { ...base, action: "executar", tool: DEMO_EFFECT_TOOL, agent: "supervisor", target: "nota" },
      child,
    );
    assert.equal(widened.decision, "deny");
    assert.match(widened.reason, /supervisor/);
    const allowed = evaluatePolicy({ ...base, agent: "filho" }, child);
    assert.equal(allowed.decision, "allow");
  });

  it("pede aprovação para a ferramenta falsa e não transforma um sim genérico em allow", () => {
    const asked = evaluatePolicy(
      { ...base, action: "executar", tool: DEMO_EFFECT_TOOL, agent: "manual", target: "nota-sintetica", parameters: { texto: "eco" } },
      { sessionDomain: "imex", grantedTools: [DEMO_EFFECT_TOOL], parentGrantedTools: null },
    );
    assert.equal(asked.decision, "ask");
    assert.equal(applyGenericConsent(asked, true).decision, "ask");
  });
});
