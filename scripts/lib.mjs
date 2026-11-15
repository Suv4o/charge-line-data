// Shared by validate.mjs, format.mjs and new-operators.mjs. No dependencies: Node 22 or later.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

export const FILES = {
  vehicles: { data: "vehicles.json", schema: "schema/vehicles.schema.json", list: "vehicles" },
  networks: { data: "networks.json", schema: "schema/networks.schema.json", list: "networks" },
};

export function readRepoFile(path) {
  return readFileSync(root + path, "utf8");
}

export function loadSchema(kind) {
  return JSON.parse(readRepoFile(FILES[kind].schema));
}

// MARK: Schema checking
// The subset of JSON Schema the two schemas use: type, const, enum, minimum, maximum, minLength, pattern,
// format "date", required, properties, additionalProperties false, items, minItems, uniqueItems, oneOf.

const typeOf = (v) =>
  v === null ? "null" : Array.isArray(v) ? "array" : Number.isInteger(v) ? "integer" : typeof v;

const typeMatches = (v, t) => typeOf(v) === t || (t === "number" && typeOf(v) === "integer");

export function isDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

export function checkSchema(value, schema, path = "$", errors = []) {
  if ("const" in schema && value !== schema.const) errors.push(`${path}: must be ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: must be one of ${schema.enum.join(", ")}`);
  if (schema.type) {
    const types = [].concat(schema.type);
    if (!types.some((t) => typeMatches(value, t))) {
      errors.push(`${path}: must be ${types.join(" or ")}, not ${typeOf(value)}`);
      return errors;
    }
  }
  if (schema.oneOf) {
    const passing = schema.oneOf.filter((s) => checkSchema(value, s, path, []).length === 0);
    if (passing.length !== 1) errors.push(`${path}: must match exactly one allowed shape`);
  }
  if (typeof value === "number") {
    if (schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: ${value} is below ${schema.minimum}`);
    if (schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: ${value} is above ${schema.maximum}`);
  }
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.trim().length < schema.minLength) errors.push(`${path}: too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${path}: "${value}" doesn't match ${schema.pattern}`);
    if (schema.format === "date" && !isDate(value)) errors.push(`${path}: "${value}" is not a date (YYYY-MM-DD)`);
  }
  if (Array.isArray(value)) {
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: needs at least ${schema.minItems}`);
    if (schema.uniqueItems && new Set(value.map((v) => JSON.stringify(v))).size !== value.length) errors.push(`${path}: has duplicates`);
    if (schema.items) value.forEach((v, i) => checkSchema(v, schema.items, `${path}[${i}]`, errors));
  }
  if (typeOf(value) === "object") {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}: missing "${key}"`);
    for (const [key, v] of Object.entries(value)) {
      const sub = schema.properties?.[key];
      if (sub) checkSchema(v, sub, `${path}.${key}`, errors);
      else if (schema.additionalProperties === false) errors.push(`${path}: unknown key "${key}"`);
    }
  }
  return errors;
}

// MARK: Canonical formatting
// Top-level keys one per line, one list entry per line, keys in the schema's order. Small diffs, easy review.

function inline(value, schema) {
  if (Array.isArray(value)) return `[${value.map((v) => inline(v, schema?.items)).join(", ")}]`;
  if (typeOf(value) === "object") {
    const props = schema?.oneOf
      ? schema.oneOf.find((s) => checkSchema(value, s).length === 0)?.properties
      : schema?.properties;
    const order = Object.keys(props ?? {});
    const keys = Object.keys(value).sort((a, b) => rank(order, a) - rank(order, b));
    return `{${keys.map((k) => `${JSON.stringify(k)}: ${inline(value[k], props?.[k])}`).join(", ")}}`;
  }
  return JSON.stringify(value);
}

const rank = (order, key) => (order.includes(key) ? order.indexOf(key) : order.length);

export function format(kind, doc) {
  const schema = loadSchema(kind);
  const listKey = FILES[kind].list;
  const order = Object.keys(schema.properties);
  const keys = Object.keys(doc).sort((a, b) => rank(order, a) - rank(order, b));
  const lines = keys.map((key) => {
    const sub = schema.properties[key];
    if (key === listKey && Array.isArray(doc[key])) {
      const rows = doc[key].map((row) => `    ${inline(row, sub.items)}`).join(",\n");
      return `  ${JSON.stringify(key)}: [\n${rows}\n  ]`;
    }
    return `  ${JSON.stringify(key)}: ${inline(doc[key], sub)}`;
  });
  return `{\n${lines.join(",\n")}\n}\n`;
}

// MARK: Rules beyond the schema

/** The catalogue's make order: Tesla and BYD first (Australia's two best-selling EV makes in 2025), then A to Z. */
const LEADING_MAKES = ["Tesla", "BYD"];

function makeRank(make) {
  const i = LEADING_MAKES.indexOf(make);
  return i >= 0 ? [i, ""] : [LEADING_MAKES.length, make.toLowerCase()];
}

function compareMakes(a, b) {
  const [ra, na] = makeRank(a);
  const [rb, nb] = makeRank(b);
  return ra - rb || na.localeCompare(nb);
}

/** Melbourne's date, a day ahead of UTC at most: "today" for an Australian maintainer. */
export function today(now = new Date()) {
  return new Date(now.getTime() + 14 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * Every rule for one file. `doc` and `text` are the proposed file; `base` is the file on `main` (or null).
 * Returns a list of problems; empty means valid.
 */
export function validate(kind, { doc, text, base = null, now = new Date() }) {
  const errors = checkSchema(doc, loadSchema(kind));
  if (errors.length) return errors;

  const listKey = FILES[kind].list;
  const rows = doc[listKey];
  const ids = rows.map((r) => r.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupes.length) errors.push(`${listKey}: duplicate id ${[...new Set(dupes)].join(", ")}`);

  const latest = today(now);
  if (doc.updated > latest) errors.push(`updated: ${doc.updated} is in the future`);

  if (kind === "vehicles") {
    rows.forEach((v, i) => {
      if (v.untilYear !== undefined && v.untilYear < v.year) errors.push(`vehicles[${i}] ${v.id}: untilYear before year`);
      if (v.charge?.from !== undefined && v.charge.from >= v.charge.to) errors.push(`vehicles[${i}] ${v.id}: charge.from must be below charge.to`);
      if (v.checked && v.checked > latest) errors.push(`vehicles[${i}] ${v.id}: checked is in the future`);
    });
    const makes = [];
    for (const v of rows) if (makes.at(-1) !== v.make) makes.push(v.make);
    const repeated = makes.filter((m, i) => makes.indexOf(m) !== i);
    if (repeated.length) errors.push(`vehicles: keep each make's cars together (${[...new Set(repeated)].join(", ")})`);
    else {
      const sorted = [...makes].sort(compareMakes);
      const wrong = makes.findIndex((m, i) => m !== sorted[i]);
      if (wrong >= 0) errors.push(`vehicles: makes out of order at "${makes[wrong]}" (Tesla, BYD, then A to Z)`);
    }
  }

  if (kind === "networks") {
    rows.forEach((n, i) => {
      const at = `networks[${i}] ${n.id}`;
      if (n.teslaPerKWh !== undefined && n.id !== "teslaSupercharger") errors.push(`${at}: teslaPerKWh is for Tesla Supercharger only`);
      if ((n.typicalPerKWh === null) !== (n.basis === "none")) errors.push(`${at}: basis "none" if and only if typicalPerKWh is null`);
      if (n.checked > latest) errors.push(`${at}: checked is in the future`);
    });
    const owners = new Map();
    for (const n of rows) for (const m of n.match) {
      if (owners.has(m)) errors.push(`networks: "${m}" matches both ${owners.get(m)} and ${n.id}`);
      owners.set(m, n.id);
    }
  }

  if (base) {
    const kept = new Set(ids);
    const lost = base[listKey].map((r) => r.id).filter((id) => !kept.has(id));
    if (lost.length) errors.push(`${listKey}: ids can't be removed or renamed (${lost.join(", ")}); mark a car untilYear instead`);
    const changed = JSON.stringify({ ...base, updated: 0 }) !== JSON.stringify({ ...doc, updated: 0 });
    if (changed && doc.updated < base.updated) errors.push(`updated: ${doc.updated} is older than main's ${base.updated}`);
    const fortnightAgo = today(new Date(now.getTime() - 14 * 86_400_000));
    if (changed && doc.updated < fortnightAgo) errors.push(`updated: set it to the day of the change (it says ${doc.updated})`);
  }

  if (text !== undefined && text !== format(kind, doc)) {
    errors.push(`${FILES[kind].data}: not in the canonical format; run node scripts/format.mjs`);
  }
  return errors;
}

// MARK: Networks in the charger file

/** Operator labels that name nobody. */
const ANONYMOUS = new Set(["", "(none)", "(unknown operator)", "(business owner at location)", "unknown", "private"]);

/** A fast site has a connector of 50 kW or more. */
const isFast = (site) => (site.connectors ?? []).some((c) => (c.kw ?? 0) >= 50);

/**
 * Operators in Charge Line's public charger file with at least `minSites` fast sites that no network in
 * `networks` matches: candidates for a new network.
 */
export function unlistedOperators(chargerFile, networks, minSites = 3) {
  const counts = new Map();
  for (const site of chargerFile.sites ?? []) {
    if (!isFast(site)) continue;
    const label = (site.operator ?? "").trim();
    if (ANONYMOUS.has(label.toLowerCase())) continue;
    const text = `${label} ${site.name ?? ""}`.toLowerCase();
    if (networks.networks.some((n) => n.match.some((m) => text.includes(m)))) continue;
    const entry = counts.get(label) ?? { operator: label, fastSites: 0, examples: [] };
    entry.fastSites += 1;
    if (entry.examples.length < 3) entry.examples.push(`${site.name} (${site.address ?? "no address"})`);
    counts.set(label, entry);
  }
  return [...counts.values()].filter((e) => e.fastSites >= minSites).sort((a, b) => b.fastSites - a.fastSites);
}
