#!/usr/bin/env node
// Thin launcher for the AI Software Company CLI. The implementation is TypeScript,
// executed natively by Node (type stripping); this wrapper keeps the bin stable.
import { main } from "../src/cli/cli.ts";

main(process.argv.slice(2)).then(
  (code) => process.exit(code),
  (err) => {
    console.error(err?.stack || String(err));
    process.exit(1);
  },
);
