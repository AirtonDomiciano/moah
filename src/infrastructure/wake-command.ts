import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AppError } from "../domain/errors.js";
import { resolveDirs } from "./paths.js";

export function voiceDirectory(env: NodeJS.ProcessEnv): string {
  const override = env.MOAH_VOICE_DIR?.trim();
  if (override) {
    return path.resolve(override);
  }
  return path.join(resolveDirs(env).dataDir, "voz");
}

export function voiceScriptDir(): string {
  return path.resolve(fileURLToPath(new URL("../../../scripts/voz/", import.meta.url)));
}

export function trainedModelPath(dir: string): string {
  return path.join(dir, "completo", "moah-corrigido.onnx");
}

export function experimentalModelPath(dir: string): string {
  return path.join(dir, "completo", "moah-experimental.onnx");
}

export async function runVoiceScript(
  env: NodeJS.ProcessEnv,
  script: "escutar.py" | "coletar.py",
  args: string[],
): Promise<void> {
  const dir = voiceDirectory(env);
  const runtimePath = path.join(dir, "runtime.json");
  if (!fs.existsSync(runtimePath)) {
    throw new AppError("O treino local ainda não registrou o interpretador Python.", "unavailable");
  }
  const runtime = JSON.parse(fs.readFileSync(runtimePath, "utf8")) as { python?: string; recursos?: string };
  if (!runtime.python || !runtime.recursos) {
    throw new AppError("O registro do treino não informa o interpretador.", "unavailable");
  }
  const file = path.join(voiceScriptDir(), script);
  await new Promise<void>((resolve, reject) => {
    const child = spawn(runtime.python as string, [file, ...args], { stdio: "inherit" });
    child.on("error", () => {
      reject(new AppError("Não foi possível iniciar o interpretador do detector.", "unavailable"));
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new AppError(`O comando de voz encerrou com código ${code ?? "desconhecido"}.`, "unavailable"));
    });
  });
}
