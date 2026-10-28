export type AppErrorCode = "validation" | "not_found" | "conflict" | "persistence";

export class AppError extends Error {
  readonly code: AppErrorCode;

  constructor(message: string, code: AppErrorCode) {
    super(message);
    this.name = "AppError";
    this.code = code;
  }
}

export function exitCodeFor(code: AppErrorCode): number {
  switch (code) {
    case "validation":
    case "conflict":
      return 1;
    case "not_found":
      return 2;
    case "persistence":
      return 3;
  }
}
