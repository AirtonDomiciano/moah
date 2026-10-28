import { AppError } from "../domain/errors.js";

export interface ParsedArgs {
  json: boolean;
  help: boolean;
  positionals: string[];
  options: Map<string, string[]>;
}

const FLAGS = new Set(["json", "help", "h"]);

export function parseArgs(argv: string[]): ParsedArgs {
  const positionals: string[] = [];
  const options = new Map<string, string[]>();
  let json = false;
  let help = false;

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (token === "--") {
      positionals.push(...argv.slice(index + 1));
      break;
    }
    if (token.startsWith("--")) {
      const body = token.slice(2);
      const equals = body.indexOf("=");
      const name = equals === -1 ? body : body.slice(0, equals);
      const inline = equals === -1 ? undefined : body.slice(equals + 1);
      if (!name) {
        throw new AppError("Opção vazia.", "validation");
      }
      if (FLAGS.has(name)) {
        if (inline !== undefined) {
          throw new AppError(`--${name} não recebe valor.`, "validation");
        }
        if (name === "json") {
          json = true;
        } else {
          help = true;
        }
        continue;
      }
      const value = inline !== undefined ? inline : argv[index + 1];
      if (inline === undefined) {
        index += 1;
      }
      if (value === undefined || value.startsWith("-")) {
        throw new AppError(`Informe o valor de --${name}.`, "validation");
      }
      const list = options.get(name) ?? [];
      list.push(value);
      options.set(name, list);
      continue;
    }
    if (token.startsWith("-") && token.length > 1) {
      if (token === "-h") {
        help = true;
        continue;
      }
      throw new AppError(`Opção curta não suportada: ${token}. Use --${token.slice(1)} quando existir.`, "validation");
    }
    positionals.push(token);
  }

  return { json, help, positionals, options };
}

export function rejectUnknown(options: Map<string, string[]>, allowed: readonly string[]): void {
  for (const name of options.keys()) {
    if (!allowed.includes(name)) {
      throw new AppError(`Opção desconhecida: --${name}.`, "validation");
    }
  }
}

export function one(options: Map<string, string[]>, name: string): string | null {
  const values = options.get(name) ?? [];
  if (values.length > 1) {
    throw new AppError(`A opção --${name} não pode ser repetida.`, "validation");
  }
  return values[0] ?? null;
}

export function many(options: Map<string, string[]>, name: string): string[] {
  return options.get(name) ?? [];
}
