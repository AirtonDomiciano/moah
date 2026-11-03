import assert from "node:assert/strict";
import test from "node:test";
import { parseWpctl, runGreetingProbe } from "../src/infrastructure/audio-hardware.js";
import { runCli, cliWorkspace } from "./helpers.js";

const STATUS = `
 ├─ Sinks:
 │  *   59. GB205 High Definition Audio Controller Digital Stereo (HDMI 2) [vol: 0.86]
 │      61. JBL Quantum 360 Wireless Analog Stereo [vol: 0.34]
 ├─ Sources:
 │  *   60.  REDRAGON Live Camera Analog Stereo [vol: 0.29]
 │      62. JBL Quantum 360 Wireless Mono       [vol: 0.67]
 ├─ Filters:
 └─ Streams:
Video
`;

test("a saudação de hardware só toca com o microfone fechado", async () => {
  const nodes = parseWpctl(STATUS);
  assert.equal(nodes.find((node) => node.id === "62")?.kind, "source");
  let open = false;
  let playedWhileOpen = false;
  const report = await runGreetingProbe({
    enabled: true,
    nodes,
    choice: "jbl",
    capture: async (id) => {
      assert.equal(id, "62");
      open = true;
      open = false;
      return { frames: 16000, peak: 1200, heldAfter: false };
    },
    play: async (id, text) => {
      playedWhileOpen = open;
      assert.equal(id, "61");
      assert.equal(text, "Estou aqui.");
    },
    captureOpen: () => open,
  });
  assert.equal(playedWhileOpen, false);
  assert.equal(report.microfoneLiberado, true);
  assert.equal(report.detectorConfirmado, false);
  assert.equal(report.nomeFaladoReconhecido, false);
  await assert.rejects(runGreetingProbe({
    enabled: false,
    nodes,
    choice: "jbl",
    capture: async () => ({ frames: 0, peak: 0, heldAfter: false }),
    play: async () => undefined,
    captureOpen: () => false,
  }), /habilitação/);
});

test("escuta e coleta exigem ordem explícita", () => {
  const workspace = cliWorkspace();
  try {
    const listen = runCli(["voz", "escutar", "--microfone", "jbl"], workspace.env);
    assert.equal(listen.status, 1);
    assert.match(listen.stderr, /habilitar sim/);
    const collect = runCli(["voz", "coletar", "--microfone", "jbl"], workspace.env);
    assert.equal(collect.status, 1);
    assert.match(collect.stderr, /iniciar sim/);
  } finally {
    workspace.cleanup();
  }
});
test("hardware sem habilitação não abre o microfone", () => {
  const workspace = cliWorkspace();
  try {
    const refused = runCli(["voz", "hardware", "--microfone", "jbl"], workspace.env);
    assert.equal(refused.status, 1);
    assert.match(refused.stderr, /habilitar sim/);
  } finally {
    workspace.cleanup();
  }
});
