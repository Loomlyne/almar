import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { KNOWN_DEAD } from "./helpers/site-links.mjs";

// Plan 03.3-14: source-level guards on the React /experiences page. The browser proof is in
// tests/build/experiences/*.spec.ts; these keep the shape from drifting between runs of it.

const read = (file) => readFileSync(file, "utf8");
const ROUTES = { en: "app/experiences/page.tsx", ar: "app/ar/experiences/page.tsx", es: "app/es/experiences/page.tsx" };
const PAGE = "components/pages/experiences-page.tsx";
const PARTS = "components/pages/experiences";
/** Strip comments, so a sentence that names a forbidden thing is not mistaken for using it. */
const code = (source) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function files(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else out.push(path);
  }
  return out;
}

test("each route file binds one locale, is static and re-exports metadata, and nothing else", () => {
  for (const [locale, file] of Object.entries(ROUTES)) {
    const source = read(file);
    assert.match(source, new RegExp(`<ExperiencesPage locale="${locale}" />`), file);
    assert.match(source, new RegExp(`experiencesMetadata\\("${locale}"\\)`), file);
    assert.match(source, /export const dynamic = "force-static"/, file);
    assert.equal(/\bfetch\(|process\.env|cookies\(|headers\(/.test(source), false, `${file} reads the request`);
    assert.ok(source.split("\n").length <= 12, `${file} is more than a binding`);
  }
});

test("the Framer route is gone and nothing imports it", () => {
  assert.equal(existsSync("app/experiences/route.ts"), false);
  for (const dir of ["app", "components", "lib", "scripts"]) {
    for (const file of files(dir)) {
      if (!/\.(ts|tsx|mjs)$/.test(file)) continue;
      assert.equal(/experiences\/route/.test(read(file)), false, `${file} names the deleted route`);
    }
  }
});

test("the page is a server component that reads the catalogue, the five places and the stays through the data layer", () => {
  const source = code(read(PAGE));
  assert.equal(/["']use client["']/.test(source), false);
  assert.match(source, /getCatalogItems\(locale\)/);
  assert.match(source, /getDestinations\(locale, \{ includeEmpty: true \}\)/);
  assert.match(source, /getStays\(locale\)/);
  assert.equal(/lib\/data\/(fixtures|resolve|media)/.test(source), false);
  assert.match(source, /<PublicFrame[^>]*currentPath=\{PATH\}/s);
  assert.match(source, /const PATH = "\/experiences"/);
  assert.equal(/<PublicFrame[^>]*\bcurrency/s.test(source), false, "no currency prop");
  assert.match(source, /ORGANIZATION_JSON_LD_SCRIPT/);
  assert.match(source, /\[data-catalog-filters\]\{display:none\}\[data-clamp\]\{display:block;-webkit-line-clamp:unset;overflow:visible\}/);
  assert.match(source, /localePath\(locale, `\/private-stays\/\$\{/);
  assert.match(source, /siteHref\(locale, "\/contact"\)/);
  assert.match(source, /localeAlternates\(locale, PATH\)/);
  assert.match(source, /headingLevel=\{1\}/);
});

test("no part holds a held control, a price, a form, a router hook or a third-party host", () => {
  for (const file of [PAGE, ...files(PARTS)]) {
    const source = code(read(file));
    for (const word of [
      "onSearch",
      'type="submit"',
      "<form",
      "Amount",
      "price_aed",
      "per person",
      "Add to cart",
      "useRouter",
      "useSearchParams",
      "usePathname",
      "next/navigation",
      "framerusercontent",
      "catbox",
      "pexels",
      'type="radio"',
    ])
      assert.equal(source.includes(word), false, `${file}: ${word}`);
    assert.equal(/\b(AED|USD|EUR|COP)\b/.test(source), false, `${file}: a currency`);
    assert.equal(/#[0-9a-fA-F]{3,8}\b|[0-9]+px|text-\[|z-\[/.test(source), false, `${file}: raw hex, px or arbitrary value`);
  }
});

test("client files import from lib/data only types and catalog-filter", () => {
  for (const file of files(PARTS)) {
    if (!/\.(ts|tsx)$/.test(file)) continue;
    const source = code(read(file));
    for (const [, target] of source.matchAll(/from "[./]*lib\/data\/([^"]+)"/g)) {
      assert.ok(["types", "catalog-filter"].includes(target), `${file} imports lib/data/${target}`);
    }
  }
});

// Spelled in two parts so this file does not name it itself.
const RETIRED_NAME = "RETIRES_WITH" + "_STAY_PAGES";

test("the dead-link lists hold no /experiences/ address and the retired-stay-pages list is gone", () => {
  assert.deepEqual(KNOWN_DEAD.filter((path) => path.startsWith("/experiences/")), []);
  for (const dir of ["tests"]) {
    for (const file of files(dir)) {
      if (!/\.(ts|mjs)$/.test(file) || file === join("tests", "experiences-source.test.mjs")) continue;
      assert.equal(read(file).includes(RETIRED_NAME), false, file);
    }
  }
});
