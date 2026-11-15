#!/usr/bin/env node
// Lists operators in Charge Line's public charger file with three or more fast sites (50 kW or more) that no
// network in networks.json matches: candidates for a new network.
//
//   node scripts/new-operators.mjs <charger-file.json> [min-sites]

import { readFileSync } from "node:fs";
import { readRepoFile, unlistedOperators } from "./lib.mjs";

const [file, min = "3"] = process.argv.slice(2);
if (!file) {
  console.error("usage: node scripts/new-operators.mjs <charger-file.json> [min-sites]");
  process.exit(2);
}
const chargers = JSON.parse(readFileSync(file, "utf8"));
const networks = JSON.parse(readRepoFile("networks.json"));
const candidates = unlistedOperators(chargers, networks, Number(min));
console.log(JSON.stringify({ chargerFileBuiltAt: chargers.builtAt ?? null, minFastSites: Number(min), candidates }, null, 2));
