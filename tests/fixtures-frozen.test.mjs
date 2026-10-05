// The moved fixtures are frozen (plan 03.2-02, ROADMAP SC5 and 03.2-01 owner step 4).
//
// Since 3.2 the content below lives in the database: the public site is built from it (lib/data/source.ts) and the owner
// edits it in the dashboard. scripts/import-catalog.mjs is insert-only (`on conflict do nothing`), so an edit to one of
// these fixture files after the import would never reach the live site. This test makes such an edit loud.
//
// Frozen: destinations, stays, the catalogue, team and the three home journeys with their translations, and the alt
// texts of the pictures those rows reference (canonical JSON, sha256). NOT frozen: every other fixture file (home hero,
// begin, welcome and gallery, about, contact, posts, the /destinations hero) and the alt texts of pictures only those
// blocks use: they stay fixtures in v1 (C-21).
//
// Recorded 2026-10-05 from the fixtures of `main` 45a07e7 (AR/ES text of 7f3c1d1 included). A deliberate change before
// the import has landed is re-recorded here with the controller's OK, in the same commit as the fixture change.
// ALMAR_DATA_ROOT points the scan at a scratch copy so a deliberate edit can be shown red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const RECORDED = {
  destinations: "b35fcd5ece51787219df9f5d16aff66e3d68b7aff86b30fd327d55135d284158",
  "destination-translations": "d86890707c1d1b8cf1b422180b694dc5c99b1fed4f32464fc77fbc69d767428f",
  stays: "950ae7a214c7b1400b9f5b06c02322e13824ae69e82f4ab854bdfb2822f09f14",
  "stay-translations": "57c6524e80a306eac4bc2a52098a1e22446b367b8a70546ec4f4146007517e2b",
  catalog: "aa1fc1ae142bbc8e04cf8d58f73d2dfdc9ffc940689e54ced1c2921cf82b399e",
  "catalog-translations": "d4a57f4caf74aaa329a2b13d44ab35f457bc2ed3b449fc71431a56caf09fb060",
  team: "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "team-translations": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
  "home.json .tiers": "59ba15a95906e076ef655409a1038d286707b491db159029af1d8d286bcb1cdb",
  "home-translations.json .tiers": "e7440f5c231d31a418315efc2bdf65e3dbf4ea4fa5cc35dd433434f6d0887c82",
  "image-translations (pictures of the moved rows)": "1a114880baeabc9aa77f1b4cdaf8ba1c0f5100b3743fd312ed3f06700051fa61",
};

/** JSON with every object's keys sorted and no whitespace: the same data always gives the same text. */
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

const sha256 = (value) => createHash("sha256").update(canonical(value)).digest("hex");

/** Every id of an image object ({ id, media_key, ... }) anywhere inside `node`. */
function imageIds(node, found = new Set()) {
  if (Array.isArray(node)) node.forEach((n) => imageIds(n, found));
  else if (node && typeof node === "object") {
    if (typeof node.media_key === "string" && typeof node.id === "string") found.add(node.id);
    Object.values(node).forEach((n) => imageIds(n, found));
  }
  return found;
}

/** { name: sha256 } of everything frozen, read from <root>/lib/data/fixtures. */
export function frozenHashes(root) {
  const fx = (name) => JSON.parse(readFileSync(join(root, "lib", "data", "fixtures", `${name}.json`), "utf8"));
  const moved = {
    destinations: fx("destinations"),
    "destination-translations": fx("destination-translations"),
    stays: fx("stays"),
    "stay-translations": fx("stay-translations"),
    catalog: fx("catalog"),
    "catalog-translations": fx("catalog-translations"),
    team: fx("team"),
    "team-translations": fx("team-translations"),
    "home.json .tiers": fx("home").tiers,
    "home-translations.json .tiers": fx("home-translations").tiers,
  };
  const ids = imageIds(Object.values(moved));
  const alts = fx("image-translations")
    .filter((record) => ids.has(record.image_id))
    .sort((a, b) => `${a.image_id}:${a.locale}`.localeCompare(`${b.image_id}:${b.locale}`));
  return {
    ...Object.fromEntries(Object.entries(moved).map(([name, rows]) => [name, sha256(rows)])),
    "image-translations (pictures of the moved rows)": sha256(alts),
  };
}

/** Names of the frozen content that differs from the recorded hash. */
export function frozenProblems(root) {
  const now = frozenHashes(root);
  return Object.keys(RECORDED)
    .filter((name) => now[name] !== RECORDED[name])
    .map((name) => `${name}: this content lives in the database since 3.2: edit it in the dashboard (a fixture edit never reaches the live site)`);
}

const ROOT = resolve(process.env.ALMAR_DATA_ROOT ?? process.cwd());

test("the moved fixtures are unchanged since the import was prepared", () => {
  assert.deepEqual(frozenProblems(ROOT), []);
});

/** A scratch copy of lib/data/fixtures with one file edited. */
function scratch(file, edit) {
  const dir = mkdtempSync(join(tmpdir(), "almar-frozen-"));
  cpSync(join(process.cwd(), "lib", "data", "fixtures"), join(dir, "lib", "data", "fixtures"), { recursive: true });
  const path = join(dir, "lib", "data", "fixtures", `${file}.json`);
  writeFileSync(path, JSON.stringify(edit(JSON.parse(readFileSync(path, "utf8")))));
  return dir;
}

test("an edited stay title fails with the dashboard message", () => {
  const dir = scratch("stay-translations", (rows) => {
    rows[0].title += " (edited)";
    return rows;
  });
  const problems = frozenProblems(dir);
  assert.deepEqual(problems.map((p) => p.split(":")[0]), ["stay-translations"]);
  assert.match(problems[0], /this content lives in the database since 3\.2: edit it in the dashboard/);
});

test("an edited journey tier (home.json .tiers) and an edited journey translation fail, the rest of home.json does not", () => {
  const tier = scratch("home", (home) => {
    home.tiers[0].is_featured = !home.tiers[0].is_featured;
    return home;
  });
  assert.deepEqual(frozenProblems(tier).map((p) => p.split(":")[0]), ["home.json .tiers"]);
  const hero = scratch("home", (home) => {
    home.hero.video_key = "changed/hero.mp4";
    return home;
  });
  assert.deepEqual(frozenProblems(hero), [], "the home hero stays a fixture block (C-21)");
  const text = scratch("home-translations", (t) => {
    t.tiers[0].price_label += "!";
    return t;
  });
  assert.deepEqual(frozenProblems(text).map((p) => p.split(":")[0]), ["home-translations.json .tiers"]);
});

test("an edited alt text of a picture a moved row uses fails; the alt of a picture only a page block uses does not", () => {
  const onlyBlocks = JSON.parse(readFileSync("lib/data/fixtures/about.json", "utf8"));
  const blockImageIds = [...imageIds(onlyBlocks)];
  const stays = JSON.parse(readFileSync("lib/data/fixtures/stays.json", "utf8"));
  const usedId = stays[0].hero_image.id;
  const used = scratch("image-translations", (rows) => {
    rows.find((r) => r.image_id === usedId && r.locale === "ar").alt += "!";
    return rows;
  });
  assert.deepEqual(frozenProblems(used).map((p) => p.split(":")[0]), ["image-translations (pictures of the moved rows)"]);
  const movedIds = imageIds([
    "destinations", "stays", "catalog", "team",
  ].map((name) => JSON.parse(readFileSync(`lib/data/fixtures/${name}.json`, "utf8"))));
  const aboutOnly = blockImageIds.find((id) => !movedIds.has(id));
  assert.ok(aboutOnly, "the about page has a picture no moved row uses");
  const free = scratch("image-translations", (rows) => {
    rows.find((r) => r.image_id === aboutOnly && r.locale === "en").alt += "!";
    return rows;
  });
  assert.deepEqual(frozenProblems(free), []);
});

test("changing the other fixture files (about, contact, posts, destinations page) is not frozen", () => {
  for (const file of ["about", "contact", "posts", "destinations-page"]) {
    const dir = scratch(file, (data) => ({ ...data, __touched: true }));
    assert.deepEqual(frozenProblems(dir), [], file);
  }
});

test("canonical JSON ignores key order and keeps array order", () => {
  assert.equal(canonical({ b: 1, a: [2, { d: 1, c: 2 }] }), canonical({ a: [2, { c: 2, d: 1 }], b: 1 }));
  assert.notEqual(canonical([1, 2]), canonical([2, 1]));
});
