import fs from "node:fs";
import path from "node:path";
import { AppError } from "../domain/errors.js";

const LOCK_WAIT_MS = 5_000;

export function acquireProcessLock(lockPath: string): () => void {
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const started = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(lockPath, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_RDWR);
      fs.writeSync(fd, String(process.pid));
      return () => {
        fs.closeSync(fd);
        fs.rmSync(lockPath, { force: true });
      };
    } catch (error) {
      if (!isAlreadyExists(error)) {
        throw new AppError("Não foi possível reservar o banco local.", "persistence");
      }
      if (lockIsStale(lockPath)) {
        fs.rmSync(lockPath, { force: true });
        continue;
      }
      if (Date.now() - started > LOCK_WAIT_MS) {
        throw new AppError(
          "O banco estava ocupado por outra invocação do MOAH. Execute o comando de novo.",
          "persistence",
        );
      }
      sleep(20);
    }
  }
}

function lockIsStale(lockPath: string): boolean {
  let stat: fs.Stats;
  try {
    stat = fs.statSync(lockPath);
  } catch (error) {
    return isNotFound(error);
  }
  let pidText = "";
  try {
    pidText = fs.readFileSync(lockPath, "utf8").trim();
  } catch (error) {
    return isNotFound(error);
  }
  if (!pidText) {
    return Date.now() - stat.mtimeMs > 2_000;
  }
  const pid = Number(pidText);
  if (!Number.isInteger(pid) || pid <= 0) {
    return true;
  }
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    const code = errorCode(error);
    return code === "ESRCH";
  }
}

function isAlreadyExists(error: unknown): boolean {
  return errorCode(error) === "EEXIST";
}

function isNotFound(error: unknown): boolean {
  return errorCode(error) === "ENOENT";
}

function errorCode(error: unknown): string {
  if (typeof error === "object" && error !== null && "code" in error) {
    return String(error.code);
  }
  return "";
}

function sleep(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
