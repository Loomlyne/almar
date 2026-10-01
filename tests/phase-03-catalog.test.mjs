import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

const CATALOG_DIR = "app/dashboard/(ops)/catalog";
const SCREEN = `${CATALOG_DIR}/catalog-screen.tsx`;

const PAGES = [
  { path: `${CATALOG_DIR}/destinations/page.tsx`, kind: "destinations" },
  { path: `${CATALOG_DIR}/stays/page.tsx`, kind: "stays" },
  { path: `${CATALOG_DIR}/experiences/page.tsx`, kind: "experiences" },
  { path: `${CATALOG_DIR}/packages/page.tsx`, kind: "packages" },
];

test("each catalog page has no page gate (02-04 owner gate in the layout) and delegates to CatalogScreen with its kind", () => {
  for (const { path, kind } of PAGES) {
    const text = readFileSync(path, "utf8");
    assert.equal(text.includes("use client"), false, `${path} must not be a client component`);
    assert.equal(/NODE_ENV|notFound\(\)/.test(text), false);
    assert.match(text, /from ["']\.\.\/catalog-screen["']/);
    assert.match(text, new RegExp(`kind=["']${kind}["']`));
  }
});

test("the four empty lines and their New actions are wired to dashboard copy", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.match(text, /copy\.noDestinationsYet/);
  assert.match(text, /copy\.newDestination/);
  assert.match(text, /copy\.noStaysYet/);
  assert.match(text, /copy\.newStay/);
  assert.match(text, /copy\.noExperiencesYet/);
  assert.match(text, /copy\.newExperience/);
  assert.match(text, /copy\.noPackagesYet/);
  assert.match(text, /copy\.newPackage/);
  assert.match(text, /<tbody\s*\/>/, "catalog list must not render a sample row");
});

test("stay editor has Pets, Min nights, and Rates, and has no Max nights", () => {
  const text = readFileSync(SCREEN, "utf8");
  for (const label of ["Pets", "Min nights", "Infants count", "Media URL", "Rates"]) {
    assert.equal(text.includes(label), true, `missing stay field: ${label}`);
  }
  assert.equal(/Max nights/i.test(text), false, "Max nights must not be drawn");
});

test("experience list controls are named and do not filter or fetch", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.match(text, /<label className="flex flex-col[^>]*>\s*Type/);
  assert.match(text, /<label className="flex flex-col[^>]*>\s*Price/);
  assert.match(text, /<label className="flex flex-col[^>]*>\s*Destination/);
  assert.equal(text.includes("fetch("), false, "experience controls must not fetch");
});

test("no inclusion toggle is drawn anywhere in the catalog screens", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.equal(/inclusion/i.test(text), false);
});

test("Media URL rejects a non-https value and does not store it", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.match(text, /startsWith\(HTTPS_PREFIX\)/);
  assert.match(text, /setMediaInvalid\(true\)/);
  assert.equal(text.includes("<input type=\"file\""), false);
  assert.equal(text.includes('type="file"'), false, "no file input");
});

test("Publish is a Button that does not publish; Close closes", () => {
  const text = readFileSync(SCREEN, "utf8");
  assert.match(text, /<Button onClick=\{\(\) => undefined\}>\{copy\.publish\}<\/Button>/);
  assert.match(text, /onOpenChange=\{setOpen\}/);
  assert.equal(text.includes("fetch("), false, "Publish must not call a server");
});

test("no destination or catalog row is seeded", () => {
  assert.equal(text_lower_includes(SCREEN, "cartagena"), false);
  for (const { path } of PAGES) {
    assert.equal(text_lower_includes(path, "cartagena"), false);
  }
});

test("no file under app/dashboard is named seed", () => {
  const offenders = [];
  walk("app/dashboard", offenders);
  assert.deepEqual(offenders, []);
});

test("no detail route exists for any catalog list", () => {
  for (const kind of ["destinations", "stays", "experiences", "packages"]) {
    assert.equal(existsSync(`${CATALOG_DIR}/${kind}/[id]`), false);
  }
});

function text_lower_includes(path, needle) {
  return readFileSync(path, "utf8").toLowerCase().includes(needle);
}

function walk(dir, offenders) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) {
      walk(full, offenders);
      continue;
    }
    if (/seed/i.test(entry.name)) offenders.push(full);
  }
}
