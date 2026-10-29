#!/usr/bin/env -S node --disable-warning=ExperimentalWarning
import { suppressSqliteExperimentalWarning } from "./warnings.js";

suppressSqliteExperimentalWarning();

const { runCli } = await import("./run.js");
process.exitCode = await runCli(process.argv.slice(2));
