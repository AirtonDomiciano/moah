import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AppError } from "../domain/errors.js";
import { parseWpctl, runGreetingProbe, type ProbeReport } from "../infrastructure/audio-hardware.js";

export async function probeHeadset(enabled: boolean, choice: "jbl" | "camera"): Promise<ProbeReport> {
  const status = await run("wpctl", ["status"]);
  let captureRunning = false;
  try {
    return await runGreetingProbe({
      enabled,
      nodes: parseWpctl(status),
      choice,
      capture: async (id) => {
        captureRunning = true;
        try {
          return await recordOneSecond(id);
        } finally {
          captureRunning = false;
        }
      },
      play: async (id, text) => {
        await speak(id, text);
      },
      captureOpen: () => captureRunning,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha de áudio.";
    if (message.includes("habilitação")) {
      throw new AppError(message, "validation");
    }
    if (message.includes("não está disponível")) {
      throw new AppError(message, "not_found");
    }
    throw new AppError(message, "unavailable");
  }
}

async function recordOneSecond(id: string): Promise<{ frames: number; peak: number; heldAfter: boolean }> {
  const file = path.join(os.tmpdir(), `moah-probe-${process.pid}.wav`);
  const child = spawn(
    "pw-record",
    ["--target", id, "--rate", "16000", "--channels", "1", "--format", "s16", file],
    { stdio: "ignore" },
  );
  await new Promise((resolve) => setTimeout(resolve, 1000));
  child.kill("SIGINT");
  await new Promise((resolve) => child.once("close", resolve));
  await new Promise((resolve) => setTimeout(resolve, 300));
  const after = await run("wpctl", ["status"]);
  const heldAfter = after.includes("pw-record");
  try {
    const wav = fs.readFileSync(file);
    const pcm = wav.subarray(wav.includes(Buffer.from("data")) ? wav.indexOf(Buffer.from("data")) + 8 : 44);
    let peak = 0;
    for (let index = 0; index + 1 < pcm.length; index += 2) {
      peak = Math.max(peak, Math.abs(pcm.readInt16LE(index)));
    }
    return { frames: Math.floor(pcm.length / 2), peak, heldAfter };
  } finally {
    fs.rmSync(file, { force: true });
  }
}

async function speak(id: string, text: string): Promise<void> {
  const file = path.join(os.tmpdir(), `moah-ola-${process.pid}.wav`);
  try {
    await run("espeak", ["-v", "pt-br", "-s", "140", "-w", file, text]);
    await run("pw-play", ["--target", id, file]);
  } finally {
    fs.rmSync(file, { force: true });
  }
}

function run(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
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
      if (status !== 0) {
        reject(new Error(stderr.trim() || `${command} saiu com código ${status ?? "desconhecido"}.`));
        return;
      }
      resolve(stdout);
    });
  });
}
