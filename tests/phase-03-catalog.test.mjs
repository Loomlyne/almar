import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";

// The four catalog pages under app/dashboard/(ops)/catalog. Job 02 pinned each to the shared drawn screen
// (../catalog-screen) and to its empty `<tbody />`. Phase 3.2 replaces that screen one page at a time (plans 03.2-06,
// -07, -08), so this file is written once, here, to follow whichever screen a page uses and to need no edit when a
// page moves: a page may import `../catalog-screen` with its own `kind`, or a screen file of its own folder
// (`./<name>-screen`). The checks on the content of catalog-screen.tsx run only while a page still imports it and only
// while the file exists. What stays true for every screen is checked over the whole catalog folder.

const CATALOG_DIR = "app/dashboard/(ops)/catalog";
const SCREEN = `${CATALOG_DIR}/catalog-screen.tsx`;

/** kind = the folder and the `kind` prop; `empty` and `add` are the dashboard copy keys of the empty line and its New action. */
const PAGES = [
  { kind: "destinations", empty: "noDestinationsYet", add: "newDestination" },
  { kind: "stays", empty: "noStaysYet", add: "newStay" },
  { kind: "experiences", empty: "noExperiencesYet", add: "newExperience" },
  { kind: "packages", empty: "noPackagesYet", add: "newPackage" },
].map((page) => ({ ...page, path: `${CATALOG_DIR}/${page.kind}/page.tsx` }));

const SHARED_IMPORT = /from ["']\.\.\/catalog-screen["']/;
const OWN_IMPORT = /from ["']\.\/([a-z0-9-]+-screen)["']/;

const read = (path) => readFileSync(path, "utf8");
const onSharedScreen = PAGES.filter((page) => SHARED_IMPORT.test(read(page.path)));
const sharedScreenInUse = onSharedScreen.length > 0 && existsSync(SCREEN);
const stillOn = (kind) => sharedScreenInUse && onSharedScreen.some((page) => page.kind === kind);

/** node:test option: run when `condition` holds, else skip with the reason said. */
const only = (condition, reason) => ({ skip: condition ? false : reason });
const WHILE_SHARED = "no catalog page imports ../catalog-screen any more";
const whileOn = (kind) => only(stillOn(kind), `the ${kind} page no longer imports ../catalog-screen`);

/** Source text without comments, so a comment that names a rule is not read as drawing it. */
const withoutComments = (text) => text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

function* files(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory()) yield* files(full);
    else yield full;
  }
}

test("each catalog page is a server component with no gate of its own (the layout is the 02-04 owner gate) and shows one screen", () => {
  for (const { path, kind } of PAGES) {
    const text = read(path);
    assert.equal(text.includes("use client"), false, `${path} must not be a client component`);
    assert.equal(/NODE_ENV|notFound\(\)/.test(text), false, `${path} has a gate of its own`);
    const own = OWN_IMPORT.exec(text);
    if (SHARED_IMPORT.test(text)) {
      assert.match(text, new RegExp(`kind=["']${kind}["']`), `${path} passes its own kind`);
      assert.equal(existsSync(SCREEN), true, `${path} imports ${SCREEN}, which does not exist`);
    } else {
      assert.ok(own, `${path} must import ../catalog-screen or a screen of its own folder (./<name>-screen)`);
      const file = `${CATALOG_DIR}/${kind}/${own[1]}.tsx`;
      assert.equal(existsSync(file), true, `${path} imports ${own[1]}, which is not ${file}`);
    }
  }
});

for (const page of PAGES) {
  test(`${page.kind}: the empty line and the New action come from dashboard copy; no sample row`, whileOn(page.kind), () => {
    const text = read(SCREEN);
    assert.match(text, new RegExp(`copy\\.${page.empty}`));
    assert.match(text, new RegExp(`copy\\.${page.add}`));
  });
}

test("the shared list renders no sample row", only(sharedScreenInUse, WHILE_SHARED), () => {
  assert.match(read(SCREEN), /<tbody\s*\/>/, "catalog list must not render a sample row");
});

test("stay editor (shared screen) has Pets, Min nights, Infants count, Media URL and Rates", whileOn("stays"), () => {
  const text = read(SCREEN);
  for (const label of ["Pets", "Min nights", "Infants count", "Media URL", "Rates"]) {
    assert.equal(text.includes(label), true, `missing stay field: ${label}`);
  }
});

test("no screen under the catalog folder draws Max nights (STAY-06: a stay has a minimum only)", () => {
  const offenders = [];
  for (const path of files(CATALOG_DIR)) {
    if (/\.(?:ts|tsx|js|jsx|mjs)$/.test(path) && /Max nights/i.test(withoutComments(read(path)))) offenders.push(path);
  }
  assert.deepEqual(offenders, [], "Max nights must not be drawn");
});

test("experience list controls (shared screen) are named and do not filter or fetch", whileOn("experiences"), () => {
  const text = read(SCREEN);
  assert.match(text, /<label className="flex flex-col[^>]*>\s*Type/);
  assert.match(text, /<label className="flex flex-col[^>]*>\s*Price/);
  assert.match(text, /<label className="flex flex-col[^>]*>\s*Destination/);
  assert.equal(text.includes("fetch("), false, "experience controls must not fetch");
});

test("no inclusion toggle is drawn in the shared catalog screen", only(sharedScreenInUse, WHILE_SHARED), () => {
  assert.equal(/inclusion/i.test(read(SCREEN)), false);
});

test("Media URL (shared screen) keeps every keystroke and flags a value that cannot become https://", whileOn("stays"), () => {
  const text = read(SCREEN);
  assert.match(text, /setMediaInvalid\(!canBecomeHttpsUrl\(value\)\)/);
  assert.equal(text.includes('type="file"'), false, "no file input");
});

test("Publish (shared screen) is a Button that does not publish; Close closes", only(sharedScreenInUse, WHILE_SHARED), () => {
  const text = read(SCREEN);
  assert.match(text, /<Button onClick=\{\(\) => undefined\}>\{copy\.publish\}<\/Button>/);
  assert.match(text, /onOpenChange=\{setOpen\}/);
  assert.equal(text.includes("fetch("), false, "Publish must not call a server");
});

test("no destination or catalog row is seeded in a page or in the shared screen", () => {
  const paths = [...PAGES.map((page) => page.path), ...(existsSync(SCREEN) ? [SCREEN] : [])];
  for (const path of paths) assert.equal(read(path).toLowerCase().includes("cartagena"), false, path);
});

test("no file under app/dashboard is named seed", () => {
  const offenders = [...files("app/dashboard")].filter((path) => /seed/i.test(path.split("/").pop()));
  assert.deepEqual(offenders, []);
});

test("no detail route exists for any catalog list", () => {
  for (const { kind } of PAGES) {
    assert.equal(existsSync(`${CATALOG_DIR}/${kind}/[id]`), false);
  }
});
