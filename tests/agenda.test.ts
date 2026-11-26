import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { answerAgendaQuestion, resolveAgendaDate, speakAgenda } from "../src/application/agenda-voice.js";
import { civilDayUtcRange } from "../src/application/agenda-time.js";
import { authorizationUrl, createPkce, writeTokens, readTokens, tokenPath } from "../src/infrastructure/google/oauth.js";
import { listEvents } from "../src/infrastructure/google/calendar.js";
import { cliWorkspace } from "./helpers.js";

test("hoje e amanhã viram data civil sem inventar evento", () => {
  const now = new Date("2026-11-25T15:00:00.000Z");
  const today = resolveAgendaDate("Moah, quais são minhas reuniões hoje?", "America/Sao_Paulo", now);
  assert.deepEqual(today, { kind: "date", data: "2026-11-25", label: "Hoje" });
  const tomorrow = resolveAgendaDate("o que tenho na agenda amanhã", "America/Sao_Paulo", now);
  assert.equal(tomorrow.kind, "date");
  if (tomorrow.kind === "date") {
    assert.equal(tomorrow.data, "2026-11-26");
  }
  assert.equal(resolveAgendaDate("que horas são", "America/Sao_Paulo", now).kind, "no");
  assert.equal(resolveAgendaDate("quais são minhas reuniões", "America/Sao_Paulo", now).kind, "ask");
});

test("o dia civil de São Paulo vira intervalo UTC", () => {
  const range = civilDayUtcRange("2026-11-25", "America/Sao_Paulo");
  assert.equal(range.timeMin, "2026-11-25T03:00:00.000Z");
  assert.equal(range.timeMax, "2026-11-26T03:00:00.000Z");
});

test("a fala distingue agenda vazia e só usa títulos da resposta", () => {
  assert.equal(speakAgenda("Hoje", []), "Hoje: não há reuniões.");
  assert.equal(
    speakAgenda("Hoje", [{ title: "Planejamento", when: "9:00", allDay: false }]),
    "Hoje: 9:00, Planejamento.",
  );
});

test("sem conta, com falha e com eventos a voz não inventa", async () => {
  const workspace = cliWorkspace();
  const context = {
    dataDir: workspace.dataDir,
    timeZone: "America/Sao_Paulo",
    now: () => new Date("2026-11-25T15:00:00.000Z"),
  };
  const google = { clientId: "cliente", clientSecret: null, calendarios: { pessoal: "primary" as const } };
  try {
    const disconnected = await answerAgendaQuestion({
      context,
      domain: "pessoal",
      text: "quais são minhas reuniões hoje",
      google,
      provider: null,
    });
    assert.match(disconnected?.speak ?? "", /não está conectada/);
    writeTokens(workspace.dataDir, {
      refreshToken: "r",
      accessToken: "a",
      expiresAt: "2099-01-01T00:00:00.000Z",
      scope: "https://www.googleapis.com/auth/calendar.events.readonly",
    });
    const failed = await answerAgendaQuestion({
      context,
      domain: "pessoal",
      text: "quais são minhas reuniões hoje",
      google,
      provider: null,
      fetchImpl: async () => {
        throw new Error("rede");
      },
    });
    assert.match(failed?.speak ?? "", /Não consegui consultar a agenda/);
    const listed = await answerAgendaQuestion({
      context,
      domain: "pessoal",
      text: "quais são minhas reuniões hoje",
      google,
      provider: null,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            items: [{ status: "confirmed", summary: "Planejamento", start: { dateTime: "2026-11-25T12:00:00.000Z" } }],
          }),
          { status: 200 },
        ),
    });
    assert.match(listed?.speak ?? "", /Planejamento/);
    assert.equal(listed?.speak?.includes("invent"), false);
    const other = await answerAgendaQuestion({
      context,
      domain: "imex",
      text: "quais são minhas reuniões hoje",
      google,
      provider: null,
    });
    assert.match(other?.speak ?? "", /domínio/);
  } finally {
    workspace.cleanup();
  }
});

test("o token fica fora do repositório e a desconexão apaga o arquivo", () => {
  const workspace = cliWorkspace();
  try {
    writeTokens(workspace.dataDir, {
      refreshToken: "segredo",
      accessToken: "segredo",
      expiresAt: "2099-01-01T00:00:00.000Z",
      scope: "https://www.googleapis.com/auth/calendar.events.readonly",
    });
    const file = tokenPath(workspace.dataDir);
    assert.equal(file.includes(`${workspace.dataDir}/contas/`), true);
    assert.equal(fs.statSync(file).mode & 0o777, 0o600);
    assert.equal(readTokens(workspace.dataDir)?.refreshToken, "segredo");
    fs.rmSync(file);
    assert.equal(readTokens(workspace.dataDir), null);
  } finally {
    workspace.cleanup();
  }
});

test("a URL de conexão pede só leitura e PKCE", () => {
  const pkce = createPkce();
  assert.equal(pkce.verifier.length >= 43, true);
  const url = new URL(
    authorizationUrl({
      clientId: "cliente",
      redirectUri: "http://127.0.0.1:9",
      challenge: pkce.challenge,
      state: "estado",
    }),
  );
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/calendar.events.readonly");
  assert.equal(url.searchParams.get("code_challenge_method"), "S256");
  assert.equal(url.searchParams.get("redirect_uri"), "http://127.0.0.1:9");
});

test("a lista ignora evento cancelado", async () => {
  const events = await listEvents(
    {
      accessToken: "a",
      calendarId: "primary",
      timeMin: "2026-11-25T03:00:00.000Z",
      timeMax: "2026-11-26T03:00:00.000Z",
      timeZone: "America/Sao_Paulo",
    },
    async () =>
      new Response(
        JSON.stringify({
          items: [
            { status: "cancelled", summary: "Não mostrar", start: { dateTime: "2026-11-25T12:00:00.000Z" } },
            { status: "confirmed", summary: "1:1", start: { date: "2026-11-25" } },
          ],
        }),
        { status: 200 },
      ),
  );
  assert.deepEqual(events, [{ title: "1:1", when: "o dia inteiro", allDay: true }]);
});
