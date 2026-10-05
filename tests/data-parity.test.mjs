// Read-level parity (plan 03.2-02, Task 2): every exported read of lib/data, in en, ar and es, returns the same thing
// from the live-shaped fixtures and from the local database that scripts/import-catalog.mjs filled from those fixtures.
//
// The two sides run in separate child processes (tests/helpers/data-reads.mjs), because the source is chosen per
// process. Key ORDER is compared as well as values: the build serialises rows into client props, so it reaches the HTML
// bytes (scripts/parity-build.mjs proves the bytes). Stack cases call requireStack(t): they skip without a stack and
// FAIL under ALMAR_REQUIRE_STACK=1. Every case holds the stack lock: tests/import-catalog.test.mjs also resets and fills the database.
import test, { after } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildImportPayload } from "../scripts/import-catalog.mjs";
import { localStack, requireStack, resetLocal, runSql } from "./helpers/local-supabase.mjs";
import { importIntoLocal } from "./helpers/import-local.mjs";
import { writeLiveShapedFixtures } from "./helpers/live-shaped-fixtures.mjs";
import { withStackLock } from "./helpers/stack-lock.mjs";

// ---------------------------------------------------------------------------------------------------------------
// The comparison (pure, tested below so it is known to bite)
// ---------------------------------------------------------------------------------------------------------------

const show = (value) => String(JSON.stringify(value) ?? "undefined").slice(0, 140);

/** The first place two JSON values differ (type, array length, key SET and key ORDER, value), or null. */
export function firstDifference(a, b, path = "$") {
  if (Object.is(a, b)) return null;
  const aKind = a === null ? "null" : Array.isArray(a) ? "array" : typeof a;
  const bKind = b === null ? "null" : Array.isArray(b) ? "array" : typeof b;
  if (aKind !== bKind) return `${path}: ${show(a)} vs ${show(b)}`;
  if (aKind === "array") {
    if (a.length !== b.length) return `${path}: ${a.length} items vs ${b.length} items`;
    for (let i = 0; i < a.length; i++) {
      const hit = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (hit) return hit;
    }
    return null;
  }
  if (aKind === "object") {
    const aKeys = Object.keys(a);
    const bKeys = Object.keys(b);
    if (aKeys.join("\u0000") !== bKeys.join("\u0000")) return `${path}: keys [${aKeys.join(",")}] vs [${bKeys.join(",")}]`;
    for (const key of aKeys) {
      const hit = firstDifference(a[key], b[key], `${path}.${key}`);
      if (hit) return hit;
    }
    return null;
  }
  return `${path}: ${show(a)} vs ${show(b)}`;
}

test("firstDifference bites: value, type, length, missing key, key order, null", () => {
  assert.equal(firstDifference({ a: [1, { b: "x" }] }, { a: [1, { b: "x" }] }), null);
  assert.equal(firstDifference({ a: [1, { b: "x" }] }, { a: [1, { b: "y" }] }), '$.a[1].b: "x" vs "y"');
  assert.match(firstDifference({ a: 1 }, { a: "1" }), /^\$\.a: 1 vs "1"$/);
  assert.match(firstDifference([1, 2], [1, 2, 3]), /^\$: 2 items vs 3 items$/);
  assert.match(firstDifference({ a: 1, b: 2 }, { a: 1 }), /keys \[a,b\] vs \[a\]/);
  assert.match(firstDifference({ a: 1, b: 2 }, { b: 2, a: 1 }), /keys \[a,b\] vs \[b,a\]/, "same keys in another order is a difference");
  assert.match(firstDifference({ a: null }, { a: {} }), /^\$\.a: null vs \{\}$/);
  assert.match(firstDifference({ a: [] }, { a: {} }), /^\$\.a: \[\] vs \{\}$/);
});

// ---------------------------------------------------------------------------------------------------------------
// The two sides
// ---------------------------------------------------------------------------------------------------------------

/** The environment of a child: nothing ALMAR_*, NEXT_PUBLIC_* or service-role inherited, then exactly `extra`. */
function childEnv(extra) {
  const env = { ...process.env };
  for (const name of Object.keys(env)) {
    if (name.startsWith("ALMAR_") || name.startsWith("NEXT_PUBLIC_") || /SERVICE_ROLE/i.test(name)) delete env[name];
  }
  return { ...env, ...extra };
}

function runReads(extraEnv) {
  const dir = mkdtempSync(join(tmpdir(), "almar-data-reads-"));
  try {
    const out = join(dir, "reads.json");
    const res = spawnSync(process.execPath, ["tests/helpers/data-reads.mjs", out], {
      cwd: process.cwd(),
      env: childEnv(extraEnv),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    assert.equal(res.status, 0, `data-reads failed:\n${res.stderr.slice(-3000)}`);
    return JSON.parse(readFileSync(out, "utf8"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function fixturesSide(dir) {
  return runReads({ ALMAR_DATA_SOURCE: "fixtures", ALMAR_FIXTURE_DIR: dir });
}

function supabaseSide(stack) {
  return runReads({
    ALMAR_DATA_SOURCE: "supabase",
    NEXT_PUBLIC_SUPABASE_URL: stack.url,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: stack.anonKey,
  });
}

let touched = false;

/** The database as the import leaves it (12 stays). `fresh` rebuilds it from the migrations first. Call under the lock. */
function ensureImported(stack, { fresh = false } = {}) {
  touched = true;
  const count = () => runSql("select count(*)::int as n from public.stays").rows[0]?.n;
  if (!fresh && count() === 12) return;
  const reset = resetLocal();
  assert.equal(reset.code, 0, reset.output.slice(-2000));
  importIntoLocal(stack);
  assert.equal(count(), 12);
}

after(async () => {
  // Leave the database as the migrations make it: the pgTAP files expect an empty catalogue.
  if (touched && localStack()) await withStackLock(async () => resetLocal());
});

const SAMPLE_SLUG = "getsemani-colonial-house";

// ---------------------------------------------------------------------------------------------------------------
// Stack cases
// ---------------------------------------------------------------------------------------------------------------

test("every read x en/ar/es: live-shaped fixtures = the local database, key order included", { timeout: 900000 }, async (t) => {
  const stack = requireStack(t);
  if (!stack) return;
  await withStackLock(async () => {
    ensureImported(stack, { fresh: true });

    const dir = mkdtempSync(join(tmpdir(), "almar-live-shaped-"));
    try {
      writeLiveShapedFixtures(dir);
      const fixtures = fixturesSide(dir);
      const database = supabaseSide(stack);
      assert.equal(fixtures.mode, "fixtures");
      assert.equal(database.mode, "supabase");

      const names = Object.keys(fixtures.reads);
      assert.ok(names.length > 300, `expected the full list of reads, got ${names.length}`);
      assert.deepEqual(Object.keys(database.reads), names, "the same reads ran on both sides, in the same order");
      for (const locale of ["en", "ar", "es"]) {
        for (const read of ["getStays", "getDestinations", "getCatalogItems", "getHomeBlocks", "getJourneyTiers", "getTeam"]) {
          assert.ok(names.some((n) => n.startsWith(`${read}:`) && n.endsWith(`:${locale}`)), `${read} in ${locale}`);
        }
      }
      for (const name of names) {
        const hit = firstDifference(fixtures.reads[name], database.reads[name]);
        assert.equal(hit, null, `${name} differs between fixtures and the database at ${hit}`);
      }

      // The reads are not empty: a pair of empty results would also be "equal".
      assert.equal(database.reads["getStaySlugs"].length, 12);
      assert.equal(database.reads["getStays::ar"].length, 12);
      assert.equal(database.reads["getDestinations::en"].length, 2, "the destinations that have a published stay");
      assert.equal(database.reads["getDestinations:includeEmpty:en"].length, 5);
      assert.ok(database.reads["getCatalogItems::es"].length > 0);
      assert.equal(database.reads["getJourneyTiers::ar"].length, 3);
      assert.deepEqual(database.reads["getTeam::en"], []);
      assert.equal(database.reads[`getStay:${SAMPLE_SLUG}:ar`].translation_status, "published");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

test("per-source row counts equal the import payload's counts (a truncated read would show here)", { timeout: 600000 }, async (t) => {
  const stack = requireStack(t);
  if (!stack) return;
  await withStackLock(async () => {
    ensureImported(stack);
    const database = supabaseSide(stack);
    const { counts } = buildImportPayload({ root: process.cwd() });
    const expected = {
      destinations: counts.destinations,
      "destination-translations": counts.destination_translations,
      stays: counts.stays,
      "stay-translations": counts.stay_translations,
      catalog: counts.catalog_items,
      "catalog-translations": counts.catalog_translations,
      team: counts.team_members,
      "team-translations": counts.team_member_translations,
      "journey-tiers": counts.journey_tiers,
      "journey-tier-translations": counts.journey_tier_translations,
      "image-translations": counts.image_translations,
    };
    assert.deepEqual(database.counts, expected);
    assert.ok(counts.image_translations > 500, "the biggest view is the one a row cap would cut");
  });
});

test("an ops block on a stay reaches getBlockedDates through api_stay_blocked_days (the one read the import leaves empty)", { timeout: 600000 }, async (t) => {
  const stack = requireStack(t);
  if (!stack) return;
  await withStackLock(async () => {
    const db = (sql) => {
      const res = runSql(sql);
      assert.equal(res.code, 0, res.output.slice(-1500));
      return res.rows;
    };
    ensureImported(stack);
    try {
      db(
        `insert into public.availability_blocks (scope, stay_id, starts_on, ends_on, reason)
         select 'stay', id, current_date + 3, current_date + 5, 'data-parity test' from public.stays where slug = '${SAMPLE_SLUG}'`,
      );
      const days = db(
        `select to_char(d, 'YYYY-MM-DD') as day from generate_series(current_date + 3, current_date + 5, interval '1 day') as d order by 1`,
      ).map((r) => r.day);
      assert.equal(days.length, 3);
      const database = supabaseSide(stack);
      assert.deepEqual(database.reads[`getBlockedDates:${SAMPLE_SLUG}`], days);
      for (const [name, rows] of Object.entries(database.reads)) {
        if (name.startsWith("getBlockedDates:") && !name.endsWith(SAMPLE_SLUG)) assert.deepEqual(rows, [], `${name}: other stays are untouched`);
      }
    } finally {
      db("delete from public.availability_blocks where reason = 'data-parity test'");
    }
  });
});
