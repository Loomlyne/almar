import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

// Job 05. File-level companion of tests/stay-pages-no-mariven.spec.ts. The
// browser spec is the guard; this only pins the shape of the fix in the files:
// one hiding rule per stay page, the template sentence left exactly where Framer
// hydrates it (removing it makes React replace the whole page), and no other
// "Mariven" anywhere in the code that ships.
const ROOT = process.cwd();
const STAYS = path.join(ROOT, "app", "private-stays");
const RULE = "<style>#about .framer-1sl02v6{display:none!important}</style>";
const SENTENCE = "each space at Mariven ";

const slugs = readdirSync(STAYS).filter((n) => statSync(path.join(STAYS, n)).isDirectory());

test("12 stay pages exist", () => {
  assert.equal(slugs.length, 12);
});

for (const slug of slugs) {
  test(`${slug}: one hiding rule, one hydrated sentence, no other Mariven`, () => {
    const src = readFileSync(path.join(STAYS, slug, "route.ts"), "utf8");
    assert.equal(src.split(RULE).length - 1, 1, "hiding rule present once");
    assert.equal(src.split(SENTENCE).length - 1, 1, "template sentence present once, for hydration");
    assert.equal(src.split("Mariven").length - 1, 1, "no other Mariven");
  });
}

test("no Mariven in app/, lib/ or components/ outside the 12 stay pages", () => {
  const hits = [];
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const p = path.join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|mjs|json|css)$/.test(name) && readFileSync(p, "utf8").includes("Mariven")) {
        hits.push(path.relative(ROOT, p));
      }
    }
  };
  for (const d of ["app", "lib", "components"]) walk(path.join(ROOT, d));
  const allowed = new Set(slugs.map((s) => path.join("app", "private-stays", s, "route.ts")));
  assert.deepEqual(hits.filter((h) => !allowed.has(h)), []);
});
