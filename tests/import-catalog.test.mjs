// scripts/import-catalog.mjs (plan 03.2-01): the payload, the refusals, and (with this worktree's local stack) the
// real import. Stack cases call requireStack(t): they skip without a stack and FAIL under ALMAR_REQUIRE_STACK=1.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildImportPayload, checkApplyTarget, formatReport, PAYLOAD_TABLES } from "../scripts/import-catalog.mjs";
import { localStack, requireStack, resetLocal, runSql } from "./helpers/local-supabase.mjs";

const fixture = (name) => JSON.parse(readFileSync(`lib/data/fixtures/${name}.json`, "utf8"));
const manifest = JSON.parse(readFileSync("lib/data/media-manifest.json", "utf8"));
const built = buildImportPayload({ root: process.cwd() });
const { payload, counts } = built;

/** A scratch copy of the data (lib/data/fixtures + the manifest) that ALMAR_DATA_ROOT can point at. */
function scratch(mutate) {
  const dir = mkdtempSync(join(tmpdir(), "almar-import-"));
  mkdirSync(join(dir, "lib", "data"), { recursive: true });
  cpSync("lib/data/fixtures", join(dir, "lib", "data", "fixtures"), { recursive: true });
  cpSync("lib/data/media-manifest.json", join(dir, "lib", "data", "media-manifest.json"));
  const edit = (name, fn) => {
    const file = join(dir, "lib", "data", "fixtures", `${name}.json`);
    const json = JSON.parse(readFileSync(file, "utf8"));
    writeFileSync(file, JSON.stringify(fn(json) ?? json));
  };
  mutate(edit, dir);
  return dir;
}

function buildFrom(dir) {
  const before = process.env.ALMAR_DATA_ROOT;
  process.env.ALMAR_DATA_ROOT = dir;
  try {
    return buildImportPayload({ root: process.cwd() });
  } finally {
    if (before === undefined) delete process.env.ALMAR_DATA_ROOT;
    else process.env.ALMAR_DATA_ROOT = before;
  }
}

test("the payload follows the fixtures: counts, no team, no inclusions", () => {
  const totalImageIds = manifest.reduce((n, e) => n + e.image_ids.length, 0);
  assert.equal(counts.media, totalImageIds);
  assert.equal(payload.media.length, totalImageIds);
  assert.equal(counts.image_translations, fixture("image-translations").length);
  assert.equal(counts.destinations, fixture("destinations").length);
  assert.equal(counts.destination_translations, fixture("destination-translations").length);
  assert.equal(counts.stays, fixture("stays").length);
  assert.equal(counts.stay_translations, fixture("stay-translations").length);
  assert.equal(counts.catalog_items, fixture("catalog").length);
  assert.equal(counts.catalog_translations, fixture("catalog-translations").length);
  assert.equal(counts.journey_tiers, fixture("home").tiers.length);
  assert.equal(counts.journey_tier_translations, fixture("home-translations").tiers.length);
  assert.equal(counts.team_members, 0);
  assert.equal(counts.team_member_translations, 0);
  assert.equal("inclusions" in payload, false);
  assert.deepEqual(Object.keys(payload), PAYLOAD_TABLES);
});

test("every image translation belongs to a media row, and the media rows are one per manifest image id", () => {
  const ids = new Set(payload.media.map((m) => m.id));
  assert.equal(ids.size, payload.media.length);
  for (const t of payload.image_translations) assert.ok(ids.has(t.image_id), t.image_id);
  for (const m of payload.media) {
    assert.equal(m.source, "import");
    assert.match(m.key, /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.(webp|jpg|png)$/);
  }
});

test("no rate, no sample flag, no blocked date reaches the payload", () => {
  const dates = fixture("stays").flatMap((s) => s.blocked_dates);
  assert.ok(dates.length > 0, "the fixtures hold sample dates to refuse");
  const text = JSON.stringify(payload);
  for (const d of new Set(dates)) assert.equal(text.includes(`"${d}"`), false, d);
  assert.equal(text.includes("blocked_dates"), false);
  for (const s of payload.stays) {
    assert.equal(s.base_nightly_rate_aed, null, s.slug);
    assert.equal("min_nights" in s, false, `${s.slug}: min_nights takes the database default`);
    assert.equal(s.is_sample, false);
    assert.deepEqual(s.sample_fields, []);
    assert.equal("nightly_rate_aed" in s, false);
  }
  for (const c of payload.catalog_items) {
    assert.equal(c.price_aed, null, c.slug);
    assert.equal(c.is_sample, false);
  }
  for (const row of [...payload.destinations, ...payload.journey_tiers]) assert.equal(row.is_sample, false);
});

test("stay links: catalog_item_stays positions are the index in each stay's own list", () => {
  const stays = fixture("stays");
  const links = new Map(payload.catalog_item_stays.map((l) => [`${l.item_id}:${l.stay_id}`, l.position]));
  let total = 0;
  for (const s of stays) {
    for (const list of [s.experience_ids, s.service_ids]) {
      list.forEach((itemId, i) => {
        assert.equal(links.get(`${itemId}:${s.id}`), i, `${s.slug}: ${itemId}`);
        total += 1;
      });
    }
  }
  assert.equal(total, payload.catalog_item_stays.length);
  const catalogLinks = fixture("catalog").reduce((n, c) => n + c.stay_ids.length, 0);
  assert.equal(catalogLinks, payload.catalog_item_stays.length, "both sides of the link agree");
});

test("every image the moved entities reference is a media row", () => {
  const ids = new Set(payload.media.map((m) => m.id));
  const refs = [
    ...payload.destinations.flatMap((d) => [d.hero_media_id, d.inset_media_id]),
    ...payload.stays.map((s) => s.hero_media_id),
    ...payload.stay_gallery.map((g) => g.media_id),
    ...payload.catalog_items.map((c) => c.media_id),
    ...payload.journey_tiers.map((j) => j.media_id),
  ].filter(Boolean);
  assert.ok(refs.length > 100);
  for (const id of refs) assert.ok(ids.has(id), id);
  assert.equal(payload.stay_gallery.length, fixture("stays").reduce((n, s) => n + s.gallery.length, 0));
});

test("journeys carry their structured prices as the five columns", () => {
  const tiers = fixture("home").tiers;
  tiers.forEach((t, i) => {
    const row = payload.journey_tiers[i];
    assert.equal(row.price_from_amount, t.price_from.amount);
    assert.equal(row.price_from_currency, t.price_from.currency);
    assert.equal(row.est_low, t.price_estimate.low);
    assert.equal(row.est_high, t.price_estimate.high);
    assert.equal(row.est_open_ended, t.price_estimate.open_ended);
  });
});

test("the report lists the counts and every skipped value class", () => {
  const text = formatReport(built);
  for (const table of PAYLOAD_TABLES) assert.ok(text.includes(table), table);
  assert.match(text, /stays\.blocked_dates: 72 sample dates on 12 stays/);
  assert.match(text, /stays\.nightly_rate_aed: null on 12 stays/);
  assert.match(text, /team: 0 rows/);
  assert.match(text, /home blocks/);
});

test("a fixture stay with a rate makes the build throw, naming the slug", () => {
  const dir = scratch((edit) => edit("stays", (stays) => { stays[2].nightly_rate_aed = 1500; }));
  const slug = fixture("stays")[2].slug;
  assert.throws(() => buildFrom(dir), (e) => e.message.includes(slug) && /nightly_rate_aed/.test(e.message));
  rmSync(dir, { recursive: true, force: true });
});

test("a blocked date that is not listed as sample makes the build throw, naming the slug", () => {
  const dir = scratch((edit) => edit("stays", (stays) => { stays[1].is_sample = false; stays[1].sample_fields = []; }));
  const slug = fixture("stays")[1].slug;
  assert.throws(() => buildFrom(dir), (e) => e.message.includes(slug) && /blocked_dates/.test(e.message));
  rmSync(dir, { recursive: true, force: true });
});

test("a sample field the script cannot drop makes the build throw", () => {
  const dir = scratch((edit) => edit("destinations", (d) => { d[0].is_sample = true; d[0].sample_fields = ["short_line"]; }));
  assert.throws(() => buildFrom(dir), (e) => e.message.includes(fixture("destinations")[0].slug) && /short_line/.test(e.message));
  rmSync(dir, { recursive: true, force: true });
});

test("a team row makes the build throw (the team imports empty)", () => {
  const dir = scratch((edit) => {
    edit("team", () => [{ id: "00000000-0000-4000-8000-000000000001", slug: "someone", is_published: true }]);
  });
  assert.throws(() => buildFrom(dir), (e) => /team/.test(e.message) && e.message.includes("someone"));
  rmSync(dir, { recursive: true, force: true });
});

test("a catalog stay link that the stay's own list does not hold makes the build throw", () => {
  const dir = scratch((edit) => {
    edit("stays", (stays) => {
      const removed = stays[0].service_ids.pop();
      assert.ok(removed);
    });
  });
  assert.throws(() => buildFrom(dir), (e) => /own (service|experience) list|stay_ids/.test(e.message));
  rmSync(dir, { recursive: true, force: true });
});

test("a field the database holds no column for makes the build throw", () => {
  const dir = scratch((edit) => edit("catalog", (c) => { c[0].badge = "new"; }));
  assert.throws(() => buildFrom(dir), (e) => e.message.includes(fixture("catalog")[0].slug) && /badge/.test(e.message));
  rmSync(dir, { recursive: true, force: true });
});

test("an image the manifest does not hold makes the build throw", () => {
  const dir = scratch((edit) => edit("destinations", (d) => { d[0].hero_image.id = "00000000-0000-4000-8000-00000000dead"; }));
  assert.throws(() => buildFrom(dir), (e) => e.message.includes(fixture("destinations")[0].slug) && /manifest/.test(e.message));
  rmSync(dir, { recursive: true, force: true });
});

// --apply refusals ------------------------------------------------------------------------------------------------------

test("--apply is refused unless the URL host is the project's own (or a local host with --local)", () => {
  const key = "sk-test-not-a-real-key";
  const ok = (url, extra) => checkApplyTarget({ url, key, projectRef: null, local: false, ...extra });
  assert.equal(ok("https://abc.supabase.co", { projectRef: "abc" }).ok, true);
  assert.equal(ok("https://abc.supabase.co", { projectRef: "xyz" }).ok, false, "another project");
  assert.equal(ok("https://abc.supabase.co.evil.example", { projectRef: "abc" }).ok, false, "a look-alike host");
  assert.equal(ok("https://evil.example/abc.supabase.co", { projectRef: "abc" }).ok, false, "the ref in the path");
  assert.equal(ok("http://abc.supabase.co", { projectRef: "abc" }).ok, false, "not https");
  assert.equal(ok("https://user:pw@abc.supabase.co", { projectRef: "abc" }).ok, false, "credentials in the URL");
  assert.equal(ok("https://abc.supabase.co", {}).ok, false, "no --project-ref and no --local");
  assert.equal(ok("https://abc.supabase.co", { projectRef: "abc", local: true }).ok, false, "both flags");
  assert.equal(ok("http://127.0.0.1:54651", { local: true }).ok, true);
  assert.equal(ok("http://localhost:54651", { local: true }).ok, true);
  assert.equal(ok("https://abc.supabase.co", { local: true }).ok, false, "--local on a hosted URL");
  assert.equal(ok("http://127.0.0.1:54651", { projectRef: "abc" }).ok, false, "a local URL for a project ref");
  assert.equal(checkApplyTarget({ url: "https://abc.supabase.co", key: "", projectRef: "abc" }).ok, false, "no key");
  assert.equal(checkApplyTarget({ url: "", key, projectRef: "abc" }).ok, false, "no URL");
  const error = ok("https://abc.supabase.co/path?token=secret", { projectRef: "xyz" }).error;
  assert.equal(error.includes("secret") || error.includes("token"), false, "the error never repeats the query");
});

function cli(args, env = {}) {
  const clean = { ...process.env };
  delete clean.SUPABASE_URL;
  delete clean.SUPABASE_SERVICE_ROLE_KEY;
  return spawnSync(process.execPath, ["scripts/import-catalog.mjs", ...args], { env: { ...clean, ...env }, encoding: "utf8" });
}

test("the CLI without a flag is a dry run: counts, skips, exit 0, nothing sent", () => {
  const res = cli([]);
  assert.equal(res.status, 0, res.stderr);
  assert.match(res.stdout, /media\s+173/);
  assert.match(res.stdout, /skipped on purpose:/);
  assert.match(res.stdout, /dry run: nothing was sent/);
  // Even with a hosted target in the environment, no flag means no request.
  const withEnv = cli([], { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "sk-test-not-a-real-key" });
  assert.equal(withEnv.status, 0);
  assert.match(withEnv.stdout, /dry run/);
});

test("the CLI refuses --apply before any request, and never prints the key", () => {
  const key = "sk-test-not-a-real-key";
  const wrong = cli(["--apply", "--project-ref", "xyz"], { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_SERVICE_ROLE_KEY: key });
  assert.equal(wrong.status, 1);
  assert.match(wrong.stderr, /refused/);
  assert.equal((wrong.stdout + wrong.stderr).includes(key), false);
  const noKey = cli(["--apply", "--project-ref", "abc"], { SUPABASE_URL: "https://abc.supabase.co" });
  assert.equal(noKey.status, 1);
  assert.match(noKey.stderr, /SUPABASE_SERVICE_ROLE_KEY is not set/);
  const noFlag = cli(["--apply"], { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_SERVICE_ROLE_KEY: key });
  assert.equal(noFlag.status, 1);
  assert.match(noFlag.stderr, /exactly one of/);
  const hostedLocal = cli(["--apply", "--local"], { SUPABASE_URL: "https://abc.supabase.co", SUPABASE_SERVICE_ROLE_KEY: key });
  assert.equal(hostedLocal.status, 1);
});

test("the supabase client is imported only under --apply", () => {
  const src = readFileSync("scripts/import-catalog.mjs", "utf8");
  assert.equal(/^import [^\n]*@supabase\/supabase-js/m.test(src), false, "no static import");
  assert.match(src, /await import\("@supabase\/supabase-js"\)/);
  assert.match(src, /rpc\("import_catalog"/);
  assert.equal((src.match(/rpc\(/g) ?? []).length, 1, "one rpc call, one transaction");
});

// The real import on this worktree's own stack -----------------------------------------------------------------------

const REST = { destinations: "api_destinations", stays: "api_stays", catalog_items: "api_catalog", journey_tiers: "api_journey_tiers" };

async function readView(stack, view) {
  const res = await fetch(`${stack.url}/rest/v1/${view}?select=*`, { headers: { apikey: stack.anonKey, authorization: `Bearer ${stack.anonKey}` } });
  assert.equal(res.status, 200, `${view}: ${res.status}`);
  return res.json();
}

let importedLocally = false;
after(() => {
  // The pgTAP files expect an empty catalogue: leave the local database as the migrations make it.
  if (importedLocally && localStack()) resetLocal();
});

test("local stack: --apply --local imports, the public views return the fixtures, a second run writes nothing", { timeout: 600000 }, async (t) => {
  const stack = requireStack(t);
  if (!stack) return;
  const existing = runSql("select count(*)::int as n from public.destinations").rows[0]?.n;
  if (existing !== 0) resetLocal();
  importedLocally = true;

  const env = { SUPABASE_URL: stack.url, SUPABASE_SERVICE_ROLE_KEY: stack.serviceKey };
  const first = cli(["--apply", "--local"], env);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.equal((first.stdout + first.stderr).includes(stack.serviceKey), false, "the key is never printed");
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert.match(first.stdout, new RegExp(`${total} rows inserted`));

  const views = {
    api_destinations: counts.destinations, api_stays: counts.stays, api_catalog: counts.catalog_items, api_journey_tiers: counts.journey_tiers,
    api_destination_translations: counts.destination_translations, api_stay_translations: counts.stay_translations,
    api_catalog_translations: counts.catalog_translations, api_journey_tier_translations: counts.journey_tier_translations,
    api_image_translations: counts.image_translations,
  };
  for (const [view, n] of Object.entries(views)) assert.equal((await readView(stack, view)).length, n, view);
  assert.equal((await readView(stack, "api_team")).length, 0);
  assert.equal((await readView(stack, "api_inclusions")).length, 21);

  // The rows come back in the fixtures' shape and key order (03.2-02 proves the whole build byte for byte).
  const fixtures = {
    api_destinations: fixture("destinations"), api_stays: fixture("stays"), api_catalog: fixture("catalog"), api_journey_tiers: fixture("home").tiers,
  };
  const sampleOnly = { api_stays: ["min_nights", "blocked_dates", "is_sample", "sample_fields"] };
  for (const [view, rows] of Object.entries(fixtures)) {
    const got = await readView(stack, view);
    const byId = new Map(got.map((r) => [r.id, r]));
    for (const want of rows) {
      const row = byId.get(want.id);
      assert.ok(row, `${view}: ${want.slug}`);
      assert.deepEqual(Object.keys(row), Object.keys(want), `${view} ${want.slug}: key order`);
      for (const key of Object.keys(want)) {
        if (sampleOnly[view]?.includes(key)) continue;
        assert.deepEqual(row[key], want[key], `${view} ${want.slug}.${key}`);
      }
    }
  }
  for (const s of await readView(stack, "api_stays")) {
    assert.deepEqual(s.blocked_dates, []);
    assert.equal(s.nightly_rate_aed, null);
    assert.equal(s.min_nights, 1);
    assert.equal(s.is_sample, false);
  }

  const second = cli(["--apply", "--local"], env);
  assert.equal(second.status, 0, second.stderr);
  assert.match(second.stdout, /0 rows inserted/);
  const rows = (await readView(stack, "api_stays")).length;
  assert.equal(rows, counts.stays, "no duplicate rows");
});
