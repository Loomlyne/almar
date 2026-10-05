// The data-layer boundary (plan 03.3-01, design 3.1.2 and 7.12). This is the test that turns Phase 3.2's
// criterion 5 ("swapping fixtures for Supabase edits only lib/data/*") from a hope into a gate.
//
// Rules, over every source file under app/ and components/ (a route.ts holding a Framer `const HTML = "`
// string and the test harness folder are skipped):
//   1. No import of lib/data/fixtures, lib/data/resolve, lib/data/source or lib/data/media. source.ts (plan 03.2-02)
//      decides fixtures or Supabase for the whole data layer; it is internal to lib/data and is on no client allow-list.
//   2. No `*_en` / `*_ar` / `*_es` field suffix and no `translations` identifier, except under the owner API
//      folders below (plan 03.2-11): the dashboard talks to /api/ops/*, whose shapes are `translations: { en, ar, es }`
//      and fields such as `name_en` (03.2-API-CONTRACT.md). That is the owner's editing API, not the public data
//      layer. Rules 1, 3 and 4 still hold there.
//   3. Under components/ui, components/journey, components/icons and components/site, the only lib/data
//      imports are `types`, `stay-filter` and `catalog-filter` (those components take props).
//   4. A file whose first statement is "use client" imports only `types`, `stay-filter` and `catalog-filter`
//      from lib/data.
// components/pages/** and app/** server files may import the read modules: they pass props down.
//
// ALMAR_DATA_ROOT points the scan at a scratch copy so a deliberate violation can be shown red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, relative, resolve, sep } from "node:path";

const ROOT = resolve(process.env.ALMAR_DATA_ROOT ?? process.cwd());
const SKIP_DIRS = new Set(["node_modules", ".next", "%5F%5Fharness", "__harness"]);
const FORBIDDEN_IMPORT = /lib\/data\/(?:fixtures\b|resolve\b|source\b(?!-)|media\b(?!-))/;
const FIELD_SUFFIX = /\b[a-z]+_(?:en|ar|es)\b/;
const TRANSLATIONS = /\btranslations\b/;
const PROPS_ONLY_DIRS = ["components/ui/", "components/journey/", "components/icons/", "components/site/"];
const ALLOWED_FROM_CLIENT = new Set(["types", "stay-filter", "catalog-filter"]);
const OWNER_API_DIRS = ["components/ops/", "app/dashboard/", "app/api/ops/"];

/** The module specifiers a source file imports (static, side-effect, dynamic and require). */
export function specifiers(src) {
  const out = [];
  for (const m of src.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s+)(["'])([^"']+)\1/gm)) out.push(m[2]);
  return out;
}

/** The lib/data module a specifier points at ("types", "stays", "fixtures/stays", ...), or null. */
export function libDataTarget(spec, fileRel) {
  let abs;
  if (spec.startsWith("@/")) abs = spec.slice(2);
  else if (spec.startsWith(".")) abs = relative(".", join(dirname(fileRel), spec)).split(sep).join("/");
  else abs = spec;
  abs = abs.split(sep).join("/");
  const m = abs.match(/^(?:.*\/)?lib\/data(?:\/(.*))?$/) ?? (abs === "lib/data" ? [abs, ""] : null);
  if (!m) return null;
  return (m[1] ?? "").replace(/\.(?:ts|tsx|json|mjs|js)$/, "");
}

/** Every violation in one file, as strings. `fileRel` is the repo-relative path with forward slashes. */
export function analyze(src, fileRel) {
  const found = [];
  const first = src.replace(/^(?:\s|\/\/[^\n]*\n|\/\*[\s\S]*?\*\/)*/, "");
  const isClient = /^["']use client["']/.test(first);
  const propsOnly = PROPS_ONLY_DIRS.some((d) => fileRel.startsWith(d));
  for (const spec of specifiers(src)) {
    if (FORBIDDEN_IMPORT.test(spec)) found.push(`${fileRel}: imports ${spec}`);
    const target = libDataTarget(spec, fileRel);
    if (target === null) continue;
    if ((propsOnly || isClient) && !ALLOWED_FROM_CLIENT.has(target)) {
      found.push(`${fileRel}: ${isClient ? "a client file" : "a props-only component"} imports lib/data/${target}`);
    }
  }
  if (!OWNER_API_DIRS.some((d) => fileRel.startsWith(d))) {
    const field = src.match(FIELD_SUFFIX);
    if (field) found.push(`${fileRel}: language-suffixed field ${field[0]}`);
    if (TRANSLATIONS.test(src)) found.push(`${fileRel}: identifier "translations"`);
  }
  return found;
}

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(name)) yield p;
  }
}

function scanTree() {
  const found = [];
  let scanned = 0;
  for (const top of ["app", "components"]) {
    const dir = join(ROOT, top);
    for (const file of walk(dir)) {
      const rel = relative(ROOT, file).split(sep).join("/");
      const src = readFileSync(file, "utf8");
      if (/\/route\.ts$/.test(rel) && src.includes('const HTML = "')) continue;
      scanned++;
      found.push(...analyze(src, rel));
    }
  }
  return { found, scanned };
}

test("the analyzer flags each kind of violation (red cases)", () => {
  assert.equal(analyze('import x from "../../lib/data/fixtures/stays.json";', "components/ui/a.tsx").length > 0, true);
  assert.equal(analyze('import { readFixture } from "@/lib/data/resolve";', "app/page.tsx").length > 0, true);
  assert.equal(analyze('import { loadSource } from "@/lib/data/source";', "app/page.tsx").length > 0, true);
  assert.equal(analyze('import { readSource } from "../../lib/data/source";', "components/pages/p.tsx").length > 0, true);
  assert.equal(analyze('"use client";\nimport { dataSource } from "@/lib/data/source";', "components/pages/c.tsx").length > 0, true);
  assert.equal(analyze('import { mediaUrl } from "@/lib/data/media";', "components/pages/p.tsx").length > 0, true);
  assert.equal(analyze("const title_ar = 1;", "components/ui/a.tsx").length > 0, true);
  assert.equal(analyze("const { translations } = row;", "app/page.tsx").length > 0, true);
  assert.equal(analyze('import { getStays } from "@/lib/data/stays";', "components/ui/a.tsx").length > 0, true);
  assert.equal(analyze('import { getStays } from "../../lib/data/stays";', "components/journey/a.tsx").length > 0, true);
  assert.equal(analyze('import { getRates } from "@/lib/data/rates";', "components/site/a.tsx").length > 0, true);
  assert.equal(analyze('"use client";\nimport { getStays } from "@/lib/data/stays";', "components/pages/p.tsx").length > 0, true);
  assert.equal(analyze('// c\n"use client"\nimport { getHomeBlocks } from "../../lib/data/home";', "app/x/client.tsx").length > 0, true);
  assert.equal(analyze('const m = await import("@/lib/data/fixtures/stays.json");', "app/x/page.tsx").length > 0, true);
});

test("the analyzer allows what the contract allows (green cases)", () => {
  assert.deepEqual(analyze('import type { Stay } from "@/lib/data/types";', "components/ui/a.tsx"), []);
  assert.deepEqual(analyze('import { filterStays } from "../../lib/data/stay-filter";', "components/journey/a.tsx"), []);
  assert.deepEqual(analyze('"use client";\nimport { filterStays } from "@/lib/data/stay-filter";', "components/pages/c.tsx"), []);
  assert.deepEqual(analyze('import { getStays } from "@/lib/data/stays";', "components/pages/p.tsx"), []);
  assert.deepEqual(analyze('import { getStays } from "@/lib/data/stays";', "app/private-stays/page.tsx"), []);
  assert.deepEqual(analyze('import { x } from "@/lib/data/media-manifest.json";', "app/x/page.tsx"), []);
  assert.deepEqual(analyze('"use client";\nimport { filterCatalog } from "@/lib/data/catalog-filter";', "components/pages/c.tsx"), []);
  assert.deepEqual(analyze('import { filterCatalog } from "../../lib/data/catalog-filter";', "components/ui/a.tsx"), []);
  assert.equal(analyze('"use client";\nimport { getCatalogItems } from "@/lib/data/experiences";', "components/pages/c.tsx").length > 0, true);
  assert.deepEqual(analyze("const price_estimate = 1; const base_url = 2;", "app/x/page.tsx"), []);
  // The owner API folders speak the contract's shapes (03.2-11) ...
  assert.deepEqual(analyze("const name_en = row.translations.en;", "components/ops/api-types.ts"), []);
  assert.deepEqual(analyze("const name_en = row.translations.en;", "app/dashboard/(ops)/catalog/x.tsx"), []);
  // ... but the import rules still hold there.
  assert.equal(analyze('"use client";\nimport { getStays } from "../../lib/data/stays";', "components/ops/x.tsx").length > 0, true);
  assert.equal(analyze("const name_en = row.translations.en;", "components/pages/p.tsx").length > 0, true);
});

test("source.ts is imported by nothing outside lib/data: not app, components, the rest of lib, middleware, worker or scripts", () => {
  const importers = [];
  const scanDirs = ["app", "components", "lib", "worker", "scripts"];
  const files = [...scanDirs.flatMap((top) => [...walk(join(ROOT, top))]), join(ROOT, "middleware.ts")];
  for (const file of files) {
    const rel = relative(ROOT, file).split(sep).join("/");
    if (rel.startsWith("lib/data/")) continue;
    for (const spec of specifiers(readFileSync(file, "utf8"))) {
      if (/(?:^|\/)lib\/data\/source(?:\.ts)?$/.test(spec) || libDataTarget(spec, rel) === "source") importers.push(`${rel}: ${spec}`);
    }
  }
  assert.deepEqual(importers, []);
});

test("every lib/data module that reads a picture awaits loadSource() (image() reads the shared source)", () => {
  const dir = join(ROOT, "lib", "data");
  const offenders = readdirSync(dir)
    .filter((name) => name.endsWith(".ts") && name !== "resolve.ts" && name !== "source.ts")
    .filter((name) => {
      const src = readFileSync(join(dir, name), "utf8");
      return /\bimage\(/.test(src) && !/await loadSource\(\)/.test(src);
    });
  assert.deepEqual(offenders, []);
});

test("no file under app/ or components/ breaks the data-layer boundary", () => {
  const { found, scanned } = scanTree();
  assert.ok(scanned > 40, `expected to scan the real tree, scanned ${scanned}`);
  assert.deepEqual(found, []);
});
