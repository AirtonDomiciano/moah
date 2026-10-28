import path from "node:path";
import { AppError } from "../domain/errors.js";

export interface AppDirs {
  dataDir: string;
  configDir: string;
}

export function resolveDirs(env: NodeJS.ProcessEnv = process.env): AppDirs {
  return {
    dataDir: resolveDir(env, "MOAH_DATA_DIR", "XDG_DATA_HOME", path.join(".local", "share", "moah")),
    configDir: resolveDir(env, "MOAH_CONFIG_DIR", "XDG_CONFIG_HOME", path.join(".config", "moah")),
  };
}

export function databasePath(dataDir: string): string {
  return path.join(dataDir, "moah.sqlite");
}

function resolveDir(
  env: NodeJS.ProcessEnv,
  overrideName: "MOAH_DATA_DIR" | "MOAH_CONFIG_DIR",
  xdgName: "XDG_DATA_HOME" | "XDG_CONFIG_HOME",
  homeRelative: string,
): string {
  const override = env[overrideName]?.trim();
  if (override) {
    return path.resolve(override);
  }
  const xdg = env[xdgName]?.trim();
  if (xdg) {
    return path.join(xdg, "moah");
  }
  const home = env.HOME?.trim();
  if (!home) {
    throw new AppError(
      `Defina ${overrideName}, ${xdgName} ou HOME para localizar os arquivos do MOAH.`,
      "validation",
    );
  }
  return path.join(home, homeRelative);
}
