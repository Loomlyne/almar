import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// D-56, D-57: no real or fake team member names outside the Framer route.ts pages.
const NAMES = ["Ana Velásquez", "Mateo Ríos", "Sofía Marín", "Maria Del Mar Valdes", "María Francis"];
const ROOTS = ["app", "components", "lib"];
const EXT = /\.(tsx?|jsx?|mjs|cjs|css|json|md)$/;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (EXT.test(name) && name !== "route.ts") out.push(path);
  }
  return out;
}

test("no team member names in app, components or lib (route.ts excluded)", () => {
  const hits = [];
  for (const file of ROOTS.flatMap((r) => walk(r))) {
    const text = readFileSync(file, "utf8").normalize("NFC");
    for (const name of NAMES) {
      if (text.includes(name.normalize("NFC"))) hits.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(hits, []);
});
