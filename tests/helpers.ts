import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const cliPath = fileURLToPath(new URL("../src/cli/main.js", import.meta.url));

export function tempDir(prefix: string): { dir: string; cleanup: () => void } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  return {
    dir,
    cleanup: () => {
      fs.rmSync(dir, { recursive: true, force: true });
    },
  };
}

export interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

export function cliWorkspace(): {
  dataDir: string;
  configDir: string;
  env: NodeJS.ProcessEnv;
  cleanup: () => void;
} {
  const root = tempDir("moah-cli-");
  const dataDir = path.join(root.dir, "data");
  const configDir = path.join(root.dir, "config");
  fs.mkdirSync(dataDir);
  fs.mkdirSync(configDir);
  fs.writeFileSync(
    path.join(configDir, "config.json"),
    JSON.stringify({ timezone: "America/Sao_Paulo" }),
  );
  return {
    dataDir,
    configDir,
    env: { MOAH_DATA_DIR: dataDir, MOAH_CONFIG_DIR: configDir },
    cleanup: root.cleanup,
  };
}

export function runCli(args: string[], env: NodeJS.ProcessEnv): CliResult {
  const result = spawnSync(process.execPath, ["--disable-warning=ExperimentalWarning", cliPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export function runCliAsync(args: string[], env: NodeJS.ProcessEnv): Promise<CliResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", cliPath, ...args], {
      env: { ...process.env, ...env },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => {
      resolve({ status, stdout, stderr });
    });
  });
}
