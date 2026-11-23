import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

test("a janela do pedido encerra por espera, silêncio e duração", () => {
  const script = path.resolve("scripts/voz/janela_pedido.py");
  const result = spawnSync("python3", [script], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^ok\n?/);
});
