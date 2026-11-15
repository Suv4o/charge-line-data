// node --test scripts/

import assert from "node:assert/strict";
import { test } from "node:test";
import { format, readRepoFile, today, unlistedOperators, validate } from "./lib.mjs";

const now = new Date("2026-11-15T00:00:00Z");
const car = {
  id: "example-ev-2026", make: "Example", model: "EV", variant: "Long Range", year: 2026, body: "suv",
  usableKWh: 80, wltpKm: 500, maxDCkW: 200, maxACkW: 11, connectors: ["ccs2", "type2"],
  charge: { from: 10, to: 80, minutes: 25 }, source: "Maker's Australian specifications page",
};
const vehicles = (cars, updated = "2026-11-15") => ({ schemaVersion: 1, updated, vehicles: cars });
const check = (doc, base = null) => validate("vehicles", { doc, text: format("vehicles", doc), base, now });

test("the repo's files are valid and canonical", () => {
  for (const kind of ["vehicles", "networks"]) {
    const text = readRepoFile(`${kind}.json`);
    assert.deepEqual(validate(kind, { doc: JSON.parse(text), text, now: new Date() }), []);
  }
});

test("a good car passes", () => {
  assert.deepEqual(check(vehicles([car])), []);
});

test("schema problems are reported with the path", () => {
  const errors = check(vehicles([{ ...car, usableKWh: 900, connectors: ["ccs2", "nacs"] }]));
  assert.ok(errors.some((e) => e.includes("usableKWh") && e.includes("above")));
  assert.ok(errors.some((e) => e.includes("connectors[1]")));
});

test("unknown keys are refused", () => {
  assert.ok(check(vehicles([{ ...car, colour: "red" }])).some((e) => e.includes('unknown key "colour"')));
});

test("a charge claim is one shape or the other", () => {
  assert.deepEqual(check(vehicles([{ ...car, charge: { kmIn15Minutes: 250 } }])), []);
  assert.ok(check(vehicles([{ ...car, charge: { from: 10, to: 80, minutes: 25, kmIn15Minutes: 250 } }])).length > 0);
  assert.ok(check(vehicles([{ ...car, charge: { from: 80, to: 10, minutes: 25 } }])).some((e) => e.includes("below charge.to")));
});

test("duplicate ids are refused", () => {
  assert.ok(check(vehicles([car, { ...car, variant: "Other" }])).some((e) => e.includes("duplicate id")));
});

test("ids on main can't disappear", () => {
  const base = vehicles([car, { ...car, id: "example-ev-2024", year: 2024 }], "2026-11-01");
  const errors = check(vehicles([car]), base);
  assert.ok(errors.some((e) => e.includes("can't be removed") && e.includes("example-ev-2024")));
});

test("a change needs a fresh updated date", () => {
  const base = vehicles([car], "2026-10-01");
  assert.ok(check(vehicles([{ ...car, wltpKm: 510 }], "2026-10-01"), base).some((e) => e.startsWith("updated:")));
  assert.deepEqual(check(vehicles([{ ...car, wltpKm: 510 }], "2026-11-15"), base), []);
  assert.deepEqual(check(vehicles([car], "2026-10-01"), base), []);
});

test("makes stay together, Tesla and BYD first, then A to Z", () => {
  const tesla = { ...car, id: "tesla-x", make: "Tesla" };
  const byd = { ...car, id: "byd-x", make: "BYD" };
  const audi = { ...car, id: "audi-x", make: "Audi" };
  assert.deepEqual(check(vehicles([tesla, byd, audi, car])), []);
  assert.ok(check(vehicles([byd, tesla, audi])).some((e) => e.includes("out of order")));
  assert.ok(check(vehicles([audi, car, { ...audi, id: "audi-y" }])).some((e) => e.includes("together")));
});

test("the canonical format is enforced", () => {
  const doc = vehicles([car]);
  const errors = validate("vehicles", { doc, text: JSON.stringify(doc, null, 2), now });
  assert.ok(errors.some((e) => e.includes("canonical format")));
});

test("format puts keys in the schema's order", () => {
  const shuffled = { source: car.source, ...car };
  assert.ok(format("vehicles", vehicles([shuffled])).includes('{"id": "example-ev-2026", "make": "Example"'));
});

test("a network's price and basis agree", () => {
  const networks = JSON.parse(readRepoFile("networks.json"));
  const doc = structuredClone(networks);
  doc.networks.push({ id: "newNet", name: "New Net", match: ["new net"], typicalPerKWh: null, basis: "estimate", siteReading: "unchecked", source: "Seen in the charger file", checked: "2026-11-15" });
  const errors = validate("networks", { doc, text: format("networks", doc), now });
  assert.ok(errors.some((e) => e.includes('basis "none"')));
});

test("two networks can't claim the same match text", () => {
  const doc = structuredClone(JSON.parse(readRepoFile("networks.json")));
  doc.networks.push({ id: "other", name: "Other", match: ["evie"], typicalPerKWh: null, basis: "none", siteReading: "unchecked", source: "Seen in the charger file", checked: "2026-11-15" });
  assert.ok(validate("networks", { doc, now }).some((e) => e.includes('"evie" matches both')));
});

test("unlisted operators with three or more fast sites are candidates", () => {
  const site = (operator, kw = 75) => ({ name: "Site", operator, connectors: [{ kw }] });
  const file = {
    sites: [
      site("Evie Networks"), site("Evie Networks"), site("Evie Networks"),
      site("Yurika"), site("Yurika"), site("Yurika"),
      site("Tiny"), site("Tiny"),
      site("Slow Co", 22), site("Slow Co", 22), site("Slow Co", 22),
      site("(Unknown Operator)"), site("(Unknown Operator)"), site("(Unknown Operator)"),
    ],
  };
  const networks = JSON.parse(readRepoFile("networks.json"));
  assert.deepEqual(unlistedOperators(file, networks).map((c) => [c.operator, c.fastSites]), [["Yurika", 3]]);
});

test("today is Australia's date", () => {
  assert.equal(today(new Date("2026-11-15T13:30:00Z")), "2026-11-16");
});
