import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

test("presença de fala rejeita silêncio e ruído sem exigir transcrição", () => {
  const runtimePath = path.join(os.homedir(), ".local/share/moah/voz/runtime.json");
  const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8")) as { python?: string };
  assert.ok(runtime.python, "o registro do detector não informa o Python");
  const script = path.resolve("scripts/voz/test_presenca_fala.py");
  const result = spawnSync(runtime.python, [script], { encoding: "utf8" });
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /^ok\n?/);
});
