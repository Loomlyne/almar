// Contract tests for lib/data (plan 03.3-01): resolver, media helper, locale-first reads, one media host.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const resolveMod = await loadTs("lib/data/resolve.ts");
const mediaMod = await loadTs("lib/data/media.ts");

test("resolveRow: exact locale gives its own status, flattened, with no translations array", () => {
  const base = { id: "s1", slug: "x" };
  const rows = [
    { stay_id: "s1", locale: "en", title: "Title", status: "published" },
    { stay_id: "s1", locale: "ar", title: "عنوان", status: "draft" },
  ];
  const ar = resolveMod.resolveRow(base, rows, "ar");
  assert.equal(ar.title, "عنوان");
  assert.equal(ar.locale, "ar");
  assert.equal(ar.translation_status, "draft");
  assert.equal(ar.slug, "x");
  assert.equal("stay_id" in ar, false);
  assert.equal("status" in ar, false);
  assert.equal("translations" in ar, false);
  const en = resolveMod.resolveRow(base, rows, "en");
  assert.equal(en.translation_status, "published");
});

test("resolveRow: a missing locale falls back to English and says so", () => {
  const rows = [{ stay_id: "s1", locale: "en", title: "Title", status: "published" }];
  const es = resolveMod.resolveRow({ id: "s1" }, rows, "es");
  assert.equal(es.title, "Title");
  assert.equal(es.locale, "en");
  assert.equal(es.translation_status, "fallback");
});

test("resolveRow: no en and no locale record is an error, not a silent empty row", () => {
  assert.throws(() => resolveMod.resolveRow({ id: "s1" }, [], "ar"));
});

test("resolveImage: url through mediaUrl, alt with the English fallback", () => {
  const raw = { id: "i1", media_key: "stays/x/hero.webp", width: 10, height: 20, position: 0 };
  const alts = [
    { image_id: "i1", locale: "en", alt: "EN alt", status: "published" },
    { image_id: "i1", locale: "ar", alt: "AR alt", status: "draft" },
  ];
  const ar = resolveMod.resolveImage(raw, alts, "ar");
  assert.equal(ar.alt, "AR alt");
  assert.equal(ar.url, `${mediaMod.MEDIA_BASE_URL}/stays/x/hero.webp`);
  assert.equal(resolveMod.resolveImage(raw, alts, "es").alt, "EN alt");
  assert.equal(resolveMod.resolveImage(null, alts, "en"), null);
  assert.deepEqual(Object.keys(ar).sort(), ["alt", "height", "id", "position", "url", "width"]);
});

test("mediaUrl joins a key onto the base and rejects traversal and host injection", () => {
  assert.equal(mediaMod.mediaUrl("stays/x/hero.webp"), `${mediaMod.MEDIA_BASE_URL}/stays/x/hero.webp`);
  for (const bad of ["https://evil.example/x.webp", "a/../b.webp", "/abs.webp", "a\\b.webp", "", "//host/x.webp"]) {
    assert.throws(() => mediaMod.mediaUrl(bad), undefined, `should reject ${JSON.stringify(bad)}`);
  }
});

test("the media base is the pending placeholder until the controller supplies the R2 hostname", () => {
  assert.equal(mediaMod.MEDIA_BASE_URL, "https://media-pending.invalid");
  assert.equal(mediaMod.MEDIA_BASE_URL_IS_PLACEHOLDER, true);
});

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "worktrees" || name.startsWith(".")) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js)$/.test(name)) out.push(p);
  }
  return out;
}

test("the media host literal appears in exactly one source file: lib/data/media.ts", () => {
  const hits = [];
  for (const root of ["lib", "app", "components"]) {
    for (const f of walk(root)) {
      if (readFileSync(f, "utf8").includes("media-pending.invalid")) hits.push(f.replaceAll("\\", "/"));
    }
  }
  assert.deepEqual(hits, ["lib/data/media.ts"]);
});
