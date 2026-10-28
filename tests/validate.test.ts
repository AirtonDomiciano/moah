import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { LIMITS } from "../src/domain/constants.js";
import { validateRecord } from "../src/domain/validate.js";
import { parseActionSpec } from "../src/cli/action-spec.js";

describe("validação de registro", () => {
  it("normaliza reunião com decisão e ação sem prazo", () => {
    const record = validateRecord({
      type: "reuniao",
      domain: "imex",
      project: " financeiro ",
      text: " Reunião sintética ",
      origin: null,
      agent: null,
      occurredAt: "2026-10-28T12:00:00.000Z",
      nextStep: null,
      decisions: [" Manter o registro manual "],
      actions: [parseActionSpec("Mapear casos de teste")],
      refs: [],
    });
    assert.equal(record.domain, "imex");
    assert.equal(record.project, "financeiro");
    assert.equal(record.text, "Reunião sintética");
    assert.equal(record.origin, "user_report");
    assert.equal(record.agent, "manual");
    assert.equal(record.decisions[0], "Manter o registro manual");
    assert.equal(record.actions[0]?.dueOn, null);
    assert.equal(record.actions[0]?.owner, null);
  });

  it("rejeita domínio, origem e texto vazio", () => {
    assert.throws(() => base({ domain: "empresa" }), /Domínio inválido/);
    assert.throws(() => base({ origin: "email" }), /user_report/);
    assert.throws(() => base({ text: "   " }), /texto/);
  });

  it("rejeita prazo relativo dentro da ação", () => {
    assert.throws(
      () => base({ actions: [parseActionSpec("Mapear casos ;; prazo=sexta")] }),
      /sexta/,
    );
  });

  it("rejeita texto acima do limite", () => {
    assert.throws(() => base({ text: "a".repeat(LIMITS.text + 1) }), /excede/);
  });
});

function base(overrides: Record<string, unknown>) {
  return validateRecord({
    type: "atividade",
    domain: "pessoal",
    project: null,
    text: "nota",
    origin: null,
    agent: null,
    occurredAt: "2026-10-28T12:00:00.000Z",
    nextStep: null,
    decisions: [],
    actions: [],
    refs: [],
    ...overrides,
  });
}
