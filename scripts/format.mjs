#!/usr/bin/env node
// Rewrites vehicles.json and networks.json in the canonical format: one entry per line, keys in the schema's
// order. Run it after editing either file by hand.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { FILES, format, readRepoFile } from "./lib.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));

for (const kind of Object.keys(FILES)) {
  const path = FILES[kind].data;
  const before = readRepoFile(path);
  const after = format(kind, JSON.parse(before));
  if (after !== before) {
    writeFileSync(root + path, after);
    console.log(`formatted ${path}`);
  }
}
