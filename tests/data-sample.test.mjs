// Sample data may never carry money (plan 03.3-01, design 3.9 tests 1 and 2, threat T-3.3-01).
//   1. No row with a non-null money field has is_sample true, and no money field name is in any sample_fields.
//   2. is_sample is true if and only if sample_fields is non-empty, and every entry is a key on that row.
// Plus the published-content facts of design 3.8/3.9 that make the first two meaningful.
// ALMAR_DATA_ROOT points the scan at a scratch copy so a deliberate violation can be shown red.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

const ROOT = resolve(process.env.ALMAR_DATA_ROOT ?? process.cwd());
const DIR = join(ROOT, "lib", "data", "fixtures");
const MONEY = ["nightly_rate_aed", "price_aed", "price_from", "price_estimate"];

const fixture = (name) => JSON.parse(readFileSync(join(DIR, `${name}.json`), "utf8"));
const allFixtures = () => readdirSync(DIR).filter((f) => f.endsWith(".json")).map((f) => [f.replace(/\.json$/, ""), fixture(f.replace(/\.json$/, ""))]);

/** Every object that carries the RowMeta sample markers, wherever it sits in a fixture. */
function* rows(node, where) {
  if (Array.isArray(node)) {
    for (const [i, v] of node.entries()) yield* rows(v, `${where}[${i}]`);
  } else if (node && typeof node === "object") {
    if ("sample_fields" in node || "is_sample" in node) yield [node, where];
    for (const [k, v] of Object.entries(node)) yield* rows(v, `${where}.${k}`);
  }
}

export function sampleProblems(fixtures) {
  const problems = [];
  for (const [name, data] of fixtures) {
    for (const [row, where] of rows(data, name)) {
      const fields = row.sample_fields;
      if (typeof row.is_sample !== "boolean") problems.push(`${where}: is_sample is not a boolean`);
      if (!Array.isArray(fields)) { problems.push(`${where}: sample_fields is not an array`); continue; }
      if (row.is_sample !== (fields.length > 0)) problems.push(`${where}: is_sample ${row.is_sample} but sample_fields has ${fields.length} entries`);
      for (const f of fields) {
        if (!(f in row)) problems.push(`${where}: sample_fields names "${f}", which is not a key on the row`);
        if (MONEY.includes(f)) problems.push(`${where}: money field "${f}" is listed as sample`);
      }
      if (row.is_sample) {
        for (const m of MONEY) if (row[m] !== undefined && row[m] !== null) problems.push(`${where}: sample row holds money in ${m}`);
      }
    }
  }
  return problems;
}

test("the checker flags each kind of violation (red cases)", () => {
  const bad = (row) => sampleProblems([["x", [row]]]);
  assert.ok(bad({ is_sample: true, sample_fields: ["blocked_dates"], blocked_dates: [], nightly_rate_aed: 900 }).length > 0);
  assert.ok(bad({ is_sample: true, sample_fields: ["nightly_rate_aed"], nightly_rate_aed: null }).length > 0);
  assert.ok(bad({ is_sample: false, sample_fields: ["blocked_dates"], blocked_dates: [] }).length > 0);
  assert.ok(bad({ is_sample: true, sample_fields: [] }).length > 0);
  assert.ok(bad({ is_sample: true, sample_fields: ["no_such_key"] }).length > 0);
  assert.ok(bad({ is_sample: true, sample_fields: ["price_estimate"], price_estimate: null }).length > 0);
  assert.ok(bad({ is_sample: true, sample_fields: ["tier"], tier: 1, price_from: { amount: 1, currency: "USD" } }).length > 0);
  assert.deepEqual(bad({ is_sample: true, sample_fields: ["blocked_dates"], blocked_dates: ["2026-10-20"], nightly_rate_aed: null }), []);
  assert.deepEqual(bad({ is_sample: false, sample_fields: [], price_from: { amount: 3000, currency: "USD" } }), []);
});

test("no fixture row breaks the sample-data rules", () => {
  const all = allFixtures();
  const count = all.reduce((n, [name, d]) => n + [...rows(d, name)].length, 0);
  assert.ok(count >= 12 + 5 + 45 + 3 + 3, `expected every entity row to be checked, saw ${count}`);
  assert.deepEqual(sampleProblems(all), []);
});

test("stays: no rate, no minimum, blocked dates are the only sample field", () => {
  const stays = fixture("stays");
  assert.equal(stays.length, 12);
  for (const s of stays) {
    assert.equal(s.nightly_rate_aed, null, `${s.slug}: nightly_rate_aed must stay null`);
    assert.equal(s.min_nights, null, `${s.slug}: min_nights must stay null`);
    assert.equal(s.is_sample, true, `${s.slug}: blocked_dates are sample values`);
    assert.deepEqual(s.sample_fields, ["blocked_dates"]);
    assert.ok(s.blocked_dates.length >= 4 && s.blocked_dates.length <= 8);
    assert.ok(s.blocked_dates.every((d) => /^2026-1[0-2]-\d\d$/.test(d)), `${s.slug}: blocked dates outside 2026-10..12`);
  }
});

test("catalogue prices stay null; the three tier prices are the owner's, never flagged sample", () => {
  for (const c of fixture("catalog")) assert.equal(c.price_aed, null, `${c.slug}: price_aed must stay null`);
  const tiers = fixture("home").tiers;
  assert.equal(tiers.length, 3);
  for (const t of tiers) {
    assert.equal(t.is_sample, false);
    assert.deepEqual(t.sample_fields, []);
    assert.ok(t.price_from && t.price_estimate);
  }
});

test("published-content facts: no team, no hidden stays, no Mariven sentence, no third-party media host", () => {
  assert.deepEqual(fixture("team"), []);
  assert.deepEqual(fixture("team-translations"), []);
  for (const [name, data] of allFixtures()) {
    const text = JSON.stringify(data);
    assert.doesNotMatch(text, /Mariven/, `${name}: the Mariven template sentence must not appear`);
    assert.doesNotMatch(text, /framerusercontent|catbox|pexels|https?:\/\//, `${name}: a fixture stores keys, never URLs`);
  }
  const slugs = fixture("stays").map((s) => s.slug);
  for (const hidden of ["baru-house", "corona-island", "yury-house-cartagena"]) assert.ok(!slugs.includes(hidden));
});

test("storage shape: one record per language per entity, no locale-keyed map in any fixture", () => {
  const rule = (name, fk, base) => {
    const baseIds = fixture(base).map((b) => b.id);
    const t = fixture(name);
    for (const id of baseIds) {
      const mine = t.filter((r) => r[fk] === id);
      assert.deepEqual(mine.map((r) => r.locale).sort(), ["ar", "en", "es"], `${name}: ${id}`);
      for (const r of mine) assert.equal(r.status, r.locale === "en" ? "published" : "draft", `${name}: ${r.locale} status`);
    }
    assert.equal(t.length, baseIds.length * 3);
  };
  rule("stay-translations", "stay_id", "stays");
  rule("destination-translations", "destination_id", "destinations");
  rule("catalog-translations", "item_id", "catalog");
  for (const [name, data] of allFixtures()) {
    assert.doesNotMatch(JSON.stringify(data), /"(?:en|ar|es)"\s*:\s*[{[]/, `${name}: locale-keyed map`);
  }
  // Every image has an alt record in all three locales.
  const alts = fixture("image-translations");
  const ids = new Set();
  const collect = (n) => { if (Array.isArray(n)) n.forEach(collect); else if (n && typeof n === "object") { if (typeof n.media_key === "string") ids.add(n.id); Object.values(n).forEach(collect); } };
  for (const f of ["stays", "destinations", "catalog", "home", "destinations-page"]) collect(fixture(f));
  // Base 118 distinct image ids at b698507 (S2-18, S2-27) + slice 2's 41.
  assert.ok(ids.size >= 118 + 41);
  for (const id of ids) assert.deepEqual(alts.filter((a) => a.image_id === id).map((a) => a.locale).sort(), ["ar", "en", "es"], id);
  assert.equal(alts.length, ids.size * 3);
});
