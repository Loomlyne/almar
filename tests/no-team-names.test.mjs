import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

// D-56, D-57: no real or fake team member names in app, components or lib, the Framer
// route.ts pages included (job 04 item 10 removed the three invented people from them).
const NAMES = ["Ana Velásquez", "Mateo Ríos", "Sofía Marín", "Maria Del Mar Valdes", "María Francis"];
const ROOTS = ["app", "components", "lib"];
const EXT = /\.(tsx?|jsx?|mjs|cjs|css|json|md|html|svg)$/;
const ACUTE = { a: "á", e: "é", i: "í", o: "ó", u: "ú" };

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (EXT.test(name)) out.push(path);
  }
  return out;
}

// The Framer pages hold HTML inside a JS string, so a name can also be spelled with escapes.
function decode(text) {
  return text
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([aeiou])acute;/g, (_, v) => ACUTE[v])
    .normalize("NFC");
}

test("no team member names in app, components or lib", () => {
  const hits = [];
  for (const file of ROOTS.flatMap((r) => walk(r))) {
    const text = decode(readFileSync(file, "utf8"));
    for (const name of NAMES) {
      if (text.includes(name.normalize("NFC"))) hits.push(`${file}: ${name}`);
    }
  }
  assert.deepEqual(hits, []);
});
