// Pure helpers for blog posts (plan 03.3-30): body validation, reading time, date labels.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { parseBody, readingMinutes, dateLabel, WORDS_PER_MINUTE } = await loadTs("lib/data/post-body.ts");

test("parseBody assigns heading ids section-1..n in order and adds nothing else", () => {
  const out = parseBody([
    { type: "heading", text: "One" },
    { type: "quote", text: "Q" },
    { type: "heading", text: "Two" },
    { type: "paragraph", text: "P" },
  ]);
  assert.deepEqual(out, [
    { type: "heading", text: "One", id: "section-1" },
    { type: "quote", text: "Q" },
    { type: "heading", text: "Two", id: "section-2" },
    { type: "paragraph", text: "P" },
  ]);
});

test("parseBody throws on a non-array, a null item, an unknown type and blank text", () => {
  assert.throws(() => parseBody("x"), /not an array/);
  assert.throws(() => parseBody([null]), /body\[0\]/);
  assert.throws(() => parseBody([{ type: "html", text: "x" }]), /unknown block type/);
  assert.throws(() => parseBody([{ type: "paragraph", text: "  " }]), /empty/);
  assert.throws(() => parseBody([{ type: "paragraph", text: "ok" }, { type: "quote" }]), /body\[1\]/);
});

const words = (n) => [{ type: "paragraph", text: Array.from({ length: n }, (_, i) => `word${i}`).join(" ") }];

test("readingMinutes: 1 up to 200 words, 2 at 201, in all three locales", () => {
  assert.equal(WORDS_PER_MINUTE, 200);
  for (const l of ["en", "ar", "es"]) {
    for (const n of [1, 37, 40, 45, 200]) assert.equal(readingMinutes(words(n), l), 1);
    assert.equal(readingMinutes(words(201), l), 2);
  }
});

// Expected strings: the nine date_label values in fixtures/home-translations.json stories (before plan 30 task 3).
const EXPECTED = {
  "2025-06-01T00:00:00+00:00": { en: "Jun 1, 2025", ar: "1 يونيو 2025", es: "1 jun 2025" },
  "2025-05-28T00:00:00+00:00": { en: "May 28, 2025", ar: "28 مايو 2025", es: "28 may 2025" },
  "2025-05-24T00:00:00+00:00": { en: "May 24, 2025", ar: "24 مايو 2025", es: "24 may 2025" },
};

test("dateLabel equals the published labels byte for byte, Latin digits only", () => {
  for (const [iso, byLocale] of Object.entries(EXPECTED)) {
    for (const [l, want] of Object.entries(byLocale)) {
      const got = dateLabel(iso, l);
      assert.equal(got, want);
      assert.equal(/[٠-٩]/.test(got), false);
    }
  }
});
