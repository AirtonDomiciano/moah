import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { civilDayBounds, isSupportedNodeVersion, parseExplicitInstant } from "../src/domain/time.js";

const SAO_PAULO = "America/Sao_Paulo";

describe("instantes explícitos", () => {
  it("rejeita expressão relativa", () => {
    assert.throws(() => parseExplicitInstant("sexta", SAO_PAULO), /sexta/);
    assert.throws(() => parseExplicitInstant("amanhã", SAO_PAULO), /AAAA-MM-DD/);
    assert.throws(() => parseExplicitInstant("28/10/2026", SAO_PAULO), /AAAA-MM-DD/);
  });

  it("interpreta data sem horário como meia-noite no fuso", () => {
    assert.equal(parseExplicitInstant("2026-10-28", SAO_PAULO), "2026-10-28T03:00:00.000Z");
    assert.equal(parseExplicitInstant("2026-10-28T00:00:00-03:00", SAO_PAULO), "2026-10-28T03:00:00.000Z");
  });

  it("aceita instante com deslocamento e rejeita calendário impossível", () => {
    assert.equal(parseExplicitInstant("2026-10-28T09:00:00-03:00", SAO_PAULO), "2026-10-28T12:00:00.000Z");
    assert.throws(() => parseExplicitInstant("2026-02-29", SAO_PAULO), /Data rejeitada/);
    assert.throws(() => parseExplicitInstant("2026-10-28T12:60", SAO_PAULO), /Data rejeitada/);
  });

  it("rejeita horário inexistente ou ambíguo e aceita deslocamento explícito", () => {
    assert.throws(
      () => parseExplicitInstant("2026-03-08T02:30", "America/New_York"),
      /não existe/,
    );
    assert.throws(
      () => parseExplicitInstant("2026-11-01T01:30", "America/New_York"),
      /ambíguo/,
    );
    assert.equal(
      parseExplicitInstant("2026-11-01T01:30:00-04:00", "America/New_York"),
      "2026-11-01T05:30:00.000Z",
    );
  });
});

describe("limites do dia civil", () => {
  it("coloca 02:30 UTC no dia anterior em America/Sao_Paulo", () => {
    const previous = civilDayBounds("2026-10-27", SAO_PAULO);
    const current = civilDayBounds("2026-10-28", SAO_PAULO);
    const instant = "2026-10-28T02:30:00.000Z";
    assert.ok(instant >= previous.startIso && instant < previous.endIso);
    assert.ok(instant < current.startIso || instant >= current.endIso);
    assert.equal(current.startIso, "2026-10-28T03:00:00.000Z");
    assert.equal(current.endIso, "2026-10-29T03:00:00.000Z");
  });
});

describe("versão do Node", () => {
  it("aceita a linha 22 a partir de 22.16", () => {
    assert.equal(isSupportedNodeVersion("22.16.0"), true);
    assert.equal(isSupportedNodeVersion("22.23.3"), true);
    assert.equal(isSupportedNodeVersion("22.15.9"), false);
    assert.equal(isSupportedNodeVersion("24.22.0"), false);
    assert.equal(isSupportedNodeVersion(process.versions.node), true);
  });
});
