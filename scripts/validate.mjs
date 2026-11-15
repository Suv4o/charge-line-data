#!/usr/bin/env node
// Checks vehicles.json and networks.json: the schema, the rules beyond it, the canonical format, and, with
// --base-ref, that no id on that ref was removed or renamed.
//
//   node scripts/validate.mjs                    # the files as they are
//   node scripts/validate.mjs --base-ref origin/main

import { execFileSync } from "node:child_process";
import { FILES, readRepoFile, validate } from "./lib.mjs";

const args = process.argv.slice(2);
const refAt = args.indexOf("--base-ref");
const baseRef = refAt >= 0 ? args[refAt + 1] : null;

function fromRef(ref, path) {
  try {
    return JSON.parse(execFileSync("git", ["show", `${ref}:${path}`], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }));
  } catch {
    return null; // a new file, or no such ref
  }
}

let failed = false;
for (const kind of Object.keys(FILES)) {
  const path = FILES[kind].data;
  let text, doc;
  try {
    text = readRepoFile(path);
    doc = JSON.parse(text);
  } catch (error) {
    console.error(`✗ ${path}: ${error.message}`);
    failed = true;
    continue;
  }
  const base = baseRef ? fromRef(baseRef, path) : null;
  const errors = validate(kind, { doc, text, base });
  if (errors.length) {
    failed = true;
    console.error(`✗ ${path}: ${errors.length} problem${errors.length === 1 ? "" : "s"}`);
    for (const e of errors) console.error(`  - ${e}`);
  } else {
    const n = doc[FILES[kind].list].length;
    console.log(`✓ ${path}: ${n} ${FILES[kind].list}${base ? `, every id on ${baseRef} kept` : ""}`);
  }
}
process.exit(failed ? 1 : 0);
