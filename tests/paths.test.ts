import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";
import { resolveDirs } from "../src/infrastructure/paths.js";

describe("diretórios", () => {
  it("prioriza o diretório injetado sem usar HOME", () => {
    const dirs = resolveDirs({
      MOAH_DATA_DIR: "dados",
      MOAH_CONFIG_DIR: "/tmp/moah-config",
      HOME: "/home/nao-usar",
      XDG_DATA_HOME: "/tmp/xdg-nao-usar",
    });
    assert.equal(dirs.dataDir, path.resolve("dados"));
    assert.equal(dirs.configDir, "/tmp/moah-config");
  });

  it("usa XDG e, na ausência, o diretório do usuário informado no objeto", () => {
    const xdg = resolveDirs({
      XDG_DATA_HOME: "/tmp/xdg-data",
      XDG_CONFIG_HOME: "/tmp/xdg-config",
      HOME: "/tmp/home-nao-usar",
    });
    assert.equal(xdg.dataDir, path.join("/tmp/xdg-data", "moah"));
    assert.equal(xdg.configDir, path.join("/tmp/xdg-config", "moah"));

    const home = resolveDirs({ HOME: "/tmp/home-sintetico" });
    assert.equal(home.dataDir, path.join("/tmp/home-sintetico", ".local", "share", "moah"));
    assert.equal(home.configDir, path.join("/tmp/home-sintetico", ".config", "moah"));
  });
});
