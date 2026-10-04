import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

// Plan 03.3-06 task 3. The node replacement for job 05's tests/stay-pages-mariven.test.mjs, which read the slugs
// from the folders under app/private-stays and asserted that every route.ts kept the sentence "for hydration".
// Both facts are gone by design: the 12 Framer pages are one React template, and the sentence is deleted, not
// hidden. This file runs before any build; tests/build/stay-detail/built-documents.test.mjs checks the build.

const { getStaySlugs } = await loadTs("lib/data/stays.ts");
const SLUGS = await getStaySlugs();

const ROOTS = ["app", "lib", "components", "public"];
const TEXT = /\.(?:ts|tsx|mjs|json|css|html|svg)$/;

function files(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files(path, out);
    else if (TEXT.test(name)) out.push(path);
  }
  return out;
}
const shipped = ROOTS.flatMap((root) => files(root));

test("the data layer publishes the 12 stays this template covers", () => {
  assert.equal(SLUGS.length, 12);
  for (const hidden of ["baru-house", "corona-island", "yury-house-cartagena"]) {
    assert.equal(SLUGS.includes(hidden), false, hidden);
  }
});

test("the 12 Framer detail routes are gone: no literal folder shadows [stay]", () => {
  for (const slug of SLUGS) {
    assert.equal(existsSync(join("app", "private-stays", slug)), false, `app/private-stays/${slug} must not exist`);
    for (const locale of ["ar", "es"]) {
      assert.equal(existsSync(join("app", locale, "private-stays", slug)), false, `app/${locale}/private-stays/${slug}`);
    }
  }
  assert.ok(existsSync("app/private-stays/page.tsx"), "the React list page (plan 05) is still one level up");
  assert.equal(existsSync("app/private-stays/route.ts"), false, "plan 05 replaced the Framer list route");
});

test("the three [stay] routes bind a locale to the one template and build only the published slugs", () => {
  const routes = {
    en: "app/private-stays/[stay]/page.tsx",
    ar: "app/ar/private-stays/[stay]/page.tsx",
    es: "app/es/private-stays/[stay]/page.tsx",
  };
  for (const [locale, file] of Object.entries(routes)) {
    assert.ok(existsSync(file), file);
    const src = readFileSync(file, "utf8");
    assert.match(src, /components\/pages\/stay-detail-page/, `${file} imports the shared template`);
    assert.match(src, /export const generateStaticParams = generateStayParams/, `${file} builds the published slugs`);
    assert.match(src, /export const dynamicParams = false;/, `${file}: any other slug is a 404`);
    assert.match(src, /export const dynamic = "force-static";/, file);
    assert.match(src, new RegExp(`locale="${locale}"`), `${file} binds ${locale}`);
    assert.match(src, new RegExp(`generateStayMetadata\\("${locale}"`), `${file} binds ${locale} in the metadata`);
    assert.equal(/^\s*["']use client["']/.test(src), false, `${file} is a server component`);
  }
});

test("the Mariven sentence is nowhere in shipped source, and nothing is allowed", () => {
  // Job 05 allowed the 12 route.ts files, because it could only hide the sentence. Nothing is allowed now.
  // app/route.ts (the Framer home) was deleted by plan 04; the scan is real while it covers the page template.
  assert.ok(shipped.length > 100 && shipped.includes("components/pages/stay-detail-page.tsx"), `expected to scan the real tree, scanned ${shipped.length}`);
  const hits = shipped.filter((file) => {
    const text = readFileSync(file, "utf8");
    return /mariven/i.test(text) || text.includes("From cozy beachfront rooms");
  });
  assert.deepEqual(hits, []);
});

test("job 05's CSS hide rule is gone with its pages", () => {
  // The class framer-1sl02v6 also belongs to other Framer pages' own styles (destinations, contact, ...); only the
  // rule that hides it inside #about was job 05's.
  const hits = files("app").filter((file) => /#about\s*\.framer-1sl02v6/.test(readFileSync(file, "utf8")));
  assert.deepEqual(hits, []);
});

test("job 05's two Framer-only guards are gone, replaced by the React-page guards", () => {
  assert.equal(existsSync("tests/stay-pages-mariven.test.mjs"), false);
  assert.equal(existsSync("tests/stay-pages-no-mariven.spec.ts"), false);
  assert.ok(existsSync("tests/build/stay-detail/stay-pages-no-mariven.spec.ts"));
  assert.ok(existsSync("tests/build/stay-detail/built-documents.test.mjs"));
});

const TEMPLATE_FILES = [
  "components/pages/stay-detail-page.tsx",
  ...readdirSync("components/pages/stay-detail").map((name) => `components/pages/stay-detail/${name}`),
  "app/private-stays/[stay]/page.tsx",
  "app/ar/private-stays/[stay]/page.tsx",
  "app/es/private-stays/[stay]/page.tsx",
];

test("the template and its parts never name a rate, a minimum stay or a price field", () => {
  for (const file of TEMPLATE_FILES) {
    const text = readFileSync(file, "utf8");
    for (const field of ["nightly_rate_aed", "min_nights", "price_aed", "price_label"]) {
      assert.equal(text.includes(field), false, `${file} names ${field}`);
    }
  }
});

test("the template and its parts hold no submit, no form and no Add or Continue control", () => {
  for (const file of TEMPLATE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/<form\b|type="submit"|onSearch=|action=\{(?!\s*<(?:StayRequestLink|LinkButton)\b)|<Button\b/.test(text), false, `${file} has a held control`);
  }
});

test("the template reads nothing from a fixture and no image host but the data layer's", () => {
  for (const file of TEMPLATE_FILES) {
    const text = readFileSync(file, "utf8");
    assert.equal(/lib\/data\/(fixtures|resolve|media)\b/.test(text), false, `${file} reads a fixture or the media module`);
    assert.equal(/framerusercontent|catbox|pexels|https?:\/\//.test(text), false, `${file} names a host`);
  }
});

test("lib/copy/stay-detail.ts has the same keys, filled, and the same slots in all three languages", async () => {
  const { STAY_DETAIL_COPY } = await loadTs("lib/copy/stay-detail.ts");
  const flat = (node, prefix = "", out = {}) => {
    for (const [key, value] of Object.entries(node)) {
      if (typeof value === "string") out[prefix + key] = value;
      else flat(value, `${prefix}${key}.`, out);
    }
    return out;
  };
  const en = flat(STAY_DETAIL_COPY.en);
  const slots = (text) => (text.match(/\{\w+\}/g) ?? []).sort().join(",");
  for (const locale of ["ar", "es"]) {
    const other = flat(STAY_DETAIL_COPY[locale]);
    assert.deepEqual(Object.keys(other).sort(), Object.keys(en).sort(), `${locale}: same keys`);
    for (const key of Object.keys(en)) {
      assert.ok(other[key].trim() !== "", `${locale}.${key} is empty`);
      assert.equal(slots(other[key]), slots(en[key]), `${locale}.${key}: same slots as en`);
    }
  }
  // EN is the published text, verbatim (read from the 12 live pages on 2026-10-03).
  assert.equal(STAY_DETAIL_COPY.en.metaTitle, "{title} — private stay in Colombia | ALMAR");
  assert.equal(STAY_DETAIL_COPY.en.policies, "Policies to check");
  assert.equal(STAY_DETAIL_COPY.en.related, "More Private Stays");
});
