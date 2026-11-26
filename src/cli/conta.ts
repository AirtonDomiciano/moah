import { AppError } from "../domain/errors.js";
import { loadConfig } from "../infrastructure/config.js";
import { connectGoogle, disconnectGoogle, readTokens, CALENDAR_READONLY_SCOPE } from "../infrastructure/google/oauth.js";
import { resolveDirs } from "../infrastructure/paths.js";
import { rejectUnknown, type ParsedArgs } from "./parse-args.js";
import { printJson } from "./present.js";

export async function handleAccount(parsed: ParsedArgs): Promise<boolean> {
  if (parsed.positionals[0] !== "conta") {
    return false;
  }
  if (parsed.positionals[1] !== "google") {
    throw new AppError("Uso: moah conta google conectar|estado|desconectar.", "validation");
  }
  const action = parsed.positionals[2] ?? "estado";
  rejectUnknown(parsed.options, []);
  const dirs = resolveDirs();
  const config = loadConfig(dirs.configDir);
  if (action === "estado") {
    const tokens = readTokens(dirs.dataDir);
    printJson({
      conectada: Boolean(tokens),
      escopo: tokens?.scope ?? null,
      calendarios: config.google.calendarios,
      clientId: Boolean(config.google.clientId),
    });
    return true;
  }
  if (action === "desconectar") {
    await disconnectGoogle(dirs.dataDir);
    printJson({ conectada: false });
    return true;
  }
  if (action === "conectar") {
    if (!config.google.clientId) {
      throw new AppError(
        "Informe google.clientId em config.json. O cliente OAuth precisa ser do tipo computador, com retorno http://127.0.0.1.",
        "validation",
      );
    }
    await connectGoogle(
      { clientId: config.google.clientId, clientSecret: config.google.clientSecret },
      dirs.dataDir,
    );
    printJson({ conectada: true, escopo: CALENDAR_READONLY_SCOPE, calendarios: config.google.calendarios });
    return true;
  }
  throw new AppError("Uso: moah conta google conectar|estado|desconectar.", "validation");
}

