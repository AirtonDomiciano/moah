import { AppError, exitCodeFor } from "../domain/errors.js";
import { execute } from "./commands.js";

export async function runCli(argv: string[]): Promise<number> {
  try {
    await execute(argv);
    return 0;
  } catch (error) {
    if (error instanceof AppError) {
      process.stderr.write(`${error.message}\n`);
      return exitCodeFor(error.code);
    }
    const message = error instanceof Error ? error.message : "Falha inesperada.";
    process.stderr.write(`${message}\n`);
    return 3;
  }
}
