#!/usr/bin/env node
import { runCli } from "../src/index.mjs";

runCli(process.argv.slice(2)).then(
  (code) => process.exit(code ?? 0),
  (error) => {
    console.error(error?.stack ?? error);
    process.exit(1);
  },
);
