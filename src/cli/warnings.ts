export function suppressSqliteExperimentalWarning(): void {
  const original = process.emitWarning.bind(process);
  process.emitWarning = ((warning: string | Error, type?: string, code?: string, ctor?: Function) => {
    const message = typeof warning === "string" ? warning : warning.message;
    const name = typeof warning === "string" ? type : warning.name;
    if (name === "ExperimentalWarning" && message.includes("SQLite")) {
      return;
    }
    original(warning, type, code, ctor);
  }) as typeof process.emitWarning;
}
