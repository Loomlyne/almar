// scripts/import-site-content.mjs (plan 06-01, Task 4): the payload, the refusals and the dry run. No database here: the
// real import runs once, by the controller, after migration 20261025120000 is applied (owner rule 2026-10-21: written,
// run when the controller says so).
import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSiteContentPayload, checkApplyTarget, postBlockId, sectionId, SITE_PAYLOAD_TABLES, uuidV5 } from "../scripts/import-site-content.mjs";
import { PAGE_KEYS, PAGE_SECTIONS } from "../lib/data/page-sections.ts";

const fixture = (name) => JSON.parse(readFileSync(`lib/data/fixtures/${name}.json`, "utf8"));
const built = await buildSiteContentPayload({ root: process.cwd() });
const { payload, counts } = built;

/** A scratch copy of everything the builder reads, which ALMAR_DATA_ROOT can point at. */
function scratch(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "almar-site-import-"));
  mkdirSync(join(dir, "lib", "data"), { recursive: true });
  cpSync("lib/data/fixtures", join(dir, "lib", "data", "fixtures"), { recursive: true });
  cpSync("lib/data/media-manifest.json", join(dir, "lib", "data", "media-manifest.json"));
  cpSync("lib/data/page-sections.ts", join(dir, "lib", "data", "page-sections.ts"));
  cpSync("lib/copy", join(dir, "lib", "copy"), { recursive: true });
  const edit = (name, fn) => {
    const file = join(dir, "lib", "data", "fixtures", `${name}.json`);
    const json = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, JSON.stringify(fn(json) ?? json));
  };
  mutate(edit, dir);
  return dir;
}

async function buildFrom(dir) {
  const before = process.env.ALMAR_DATA_ROOT;
  process.env.ALMAR_DATA_ROOT = dir;
  try {
    return await buildSiteContentPayload({ root: process.cwd() });
  } finally {
    if (before === undefined) delete process.env.ALMAR_DATA_ROOT;
    else process.env.ALMAR_DATA_ROOT = before;
  }
}

test("the payload has exactly the tables import_site_content takes, in foreign-key order", () => {
  assert.deepEqual(Object.keys(payload), SITE_PAYLOAD_TABLES);
  assert.deepEqual(Object.keys(counts), SITE_PAYLOAD_TABLES);
  assert.equal(payload.nav_links.length, 0, "nav links come from 06-02");
  assert.equal(payload.nav_link_translations.length, 0);
});

test("one page_sections row per section of PAGE_SECTIONS, shown, no video, with the deterministic id", () => {
  const expected = PAGE_KEYS.flatMap((page) => PAGE_SECTIONS[page].map((s) => ({ id: sectionId(page, s.section), page, section: s.section, is_shown: true, video_url: null })));
  assert.deepEqual(payload.page_sections, expected);
});

test("ids are stable across two builds (a second run of the import is a no-op)", async () => {
  const again = await buildSiteContentPayload({ root: process.cwd() });
  assert.deepEqual(again.payload, payload);
  assert.equal(uuidV5("page-section:home/hero"), sectionId("home", "hero"));
  assert.match(sectionId("home", "hero"), /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  assert.notEqual(postBlockId("p", 1), postBlockId("p", 2));
});

test("every copy-held section text is present in EN, AR and ES", () => {
  for (const page of PAGE_KEYS) {
    for (const spec of PAGE_SECTIONS[page]) {
      if (spec.textFrom?.kind !== "copy") continue;
      const rows = payload.page_section_translations.filter((r) => r.section_id === sectionId(page, spec.section));
      assert.deepEqual(rows.map((r) => r.locale).sort(), ["ar", "en", "es"], `${page}/${spec.section}`);
      for (const row of rows) {
        for (const column of Object.keys(spec.textFrom.paths)) {
          assert.equal(typeof row[column], "string", `${page}/${spec.section} ${row.locale} ${column}`);
          assert.ok(row[column].trim().length > 0, `${page}/${spec.section} ${row.locale} ${column}`);
        }
      }
    }
  }
});

test("the fixture-held texts are imported as they are (same words, same status)", () => {
  const home = fixture("home-translations");
  const welcome = payload.page_section_translations.filter((r) => r.section_id === sectionId("home", "welcome"));
  for (const record of home.welcome) {
    const row = welcome.find((r) => r.locale === record.locale);
    const { locale, status, ...text } = record;
    assert.equal(row.status, status);
    for (const [k, v] of Object.entries(text)) assert.deepEqual(row[k], v, `welcome ${locale} ${k}`);
  }
});

test("photos keep their fixture ids and positions; About collage, still and Get In Touch band are decorative", () => {
  const media = (page, section, slot) =>
    payload.page_section_media.filter((m) => m.section_id === sectionId(page, section) && m.slot === slot);
  assert.deepEqual(media("home", "gallery", "images").map((m) => [m.media_id, m.position]), fixture("home").gallery.images.map((i) => [i.id, i.position]));
  assert.ok(media("about", "intro", "images").every((m) => m.is_decorative));
  assert.ok(media("about", "intro", "still").every((m) => m.is_decorative));
  assert.ok(media("about", "get_in_touch", "cta_image").every((m) => m.is_decorative));
  assert.ok(media("home", "hero", "poster").every((m) => !m.is_decorative));
  assert.equal(media("experiences", "hero", "image").length, 0, "empty today");
});

test("the three posts, their texts and one block row per body block in every language", () => {
  assert.equal(payload.posts.length, fixture("posts").length);
  const texts = fixture("post-translations");
  assert.equal(payload.post_translations.length, texts.length);
  const blockCount = texts.reduce((n, t) => n + t.body.length, 0);
  assert.equal(payload.post_block_translations.length, blockCount);
  for (const block of payload.post_blocks) assert.equal(block.id, postBlockId(block.post_id, block.position));
});

test("a sample row is refused: an About card and a post", async () => {
  await assert.rejects(
    buildFrom(scratch((edit) => edit("about", (a) => ({ ...a, cards: a.cards.map((c, i) => (i === 0 ? { ...c, is_sample: true, sample_fields: ["title"] } : c)) })))),
    /a sample row is never imported/,
  );
  await assert.rejects(buildFrom(scratch((edit) => edit("posts", (p) => p.map((x, i) => (i === 0 ? { ...x, is_sample: true } : x))))), /a sample row is never imported/);
});

test("a photo outside the media manifest is refused, naming the section", async () => {
  const dir = scratch((edit) => edit("home", (h) => ({ ...h, hero: { ...h.hero, poster: { ...h.hero.poster, id: "00000000-0000-5000-8000-000000000000" } } })));
  await assert.rejects(buildFrom(dir), /home\/hero\.poster: image 00000000-0000-5000-8000-000000000000 is not in the media manifest/);
});

test("a post whose Arabic body has another block shape than the English is refused", async () => {
  const dir = scratch((edit) =>
    edit("post-translations", (rows) => rows.map((r, i) => (r.locale === "ar" && i < 3 ? { ...r, body: [...r.body, { type: "quote", text: "x" }] } : r))),
  );
  await assert.rejects(buildFrom(dir), /body's blocks differ from the English/);
});

test("a fixture text field the section does not use is refused (never dropped)", async () => {
  const dir = scratch((edit) => edit("home-translations", (t) => ({ ...t, hero: t.hero.map((r) => ({ ...r, kicker: "extra" })) })));
  await assert.rejects(buildFrom(dir), /home\/hero: home-translations\.json field kicker is not a text column/);
});

test("the host guard is import-catalog's: wrong host, http, both or neither target, and no key are refused", () => {
  const key = "service-key-for-a-test";
  assert.equal(checkApplyTarget({ url: "https://abc.supabase.co", key, projectRef: "abc" }).ok, true);
  assert.equal(checkApplyTarget({ url: "https://evil.example", key, projectRef: "abc" }).ok, false);
  assert.equal(checkApplyTarget({ url: "http://abc.supabase.co", key, projectRef: "abc" }).ok, false);
  assert.equal(checkApplyTarget({ url: "https://abc.supabase.co", key, projectRef: "abc", local: true }).ok, false);
  assert.equal(checkApplyTarget({ url: "https://abc.supabase.co", key: "", projectRef: "abc" }).ok, false);
});

test("the dry run sends nothing: exit 0, the report, and no client library imported", () => {
  const run = spawnSync(process.execPath, ["scripts/import-site-content.mjs"], { encoding: "utf8", env: { ...process.env, SUPABASE_URL: "", SUPABASE_SERVICE_ROLE_KEY: "" } });
  assert.equal(run.status, 0, run.stderr);
  assert.match(run.stdout, /dry run: nothing was sent/);
  const source = readFileSync("scripts/import-site-content.mjs", "utf8");
  assert.doesNotMatch(source, /from "@supabase\/supabase-js"/, "no static client import");
  assert.doesNotMatch(source, /SERVICE_ROLE/, "the key is named only in import-catalog.mjs (tests/secrets.test.mjs)");
});

test("--apply with a wrong host is refused before any request", () => {
  const run = spawnSync(process.execPath, ["scripts/import-site-content.mjs", "--apply", "--project-ref", "abc"], {
    encoding: "utf8",
    env: { ...process.env, SUPABASE_URL: "https://evil.example", SUPABASE_SERVICE_ROLE_KEY: "service-key-for-a-test" },
  });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /refused: SUPABASE_URL host evil\.example is not abc\.supabase\.co\. Nothing was sent\./);
  assert.doesNotMatch(run.stdout + run.stderr, /service-key-for-a-test/);
});
