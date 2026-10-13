// Plan 03.2-09 Task 3: the pure parts of the photo field, picker and Media library. The browser parts (canvas, picker,
// panel) are in tests/ops-media.spec.ts. Nothing here sends a request.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const prep = await loadTs("components/ops/image-prep.ts");
const alt = await loadTs("components/ops/media-alt.ts");
const { OPS_MEDIA_COPY } = await loadTs("lib/copy/ops-media.ts");
const { OPS_LIVE_SECTIONS, isLiveOpsPath } = await loadTs("lib/ops-routes.ts");
const { formatPlural } = await loadTs("lib/journey-format.ts");

const read = (path) => readFileSync(path, "utf8");

// ---- image-prep ---------------------------------------------------------------------------------------------------

test("a 4000x3000 source is scaled to 2560x1920; 1200x800 and exactly 2560 are not scaled", () => {
  assert.deepEqual(prep.scaleToFit(4000, 3000), { width: 2560, height: 1920 });
  assert.deepEqual(prep.scaleToFit(3000, 4000), { width: 1920, height: 2560 });
  assert.deepEqual(prep.scaleToFit(1200, 800), { width: 1200, height: 800 });
  assert.deepEqual(prep.scaleToFit(2560, 100), { width: 2560, height: 100 });
});

test("a very thin source keeps at least one pixel on its short side", () => {
  assert.deepEqual(prep.scaleToFit(100000, 10), { width: 2560, height: 1 });
});

test("the output is WebP only when the probe came back as WebP, else JPEG (Safari answers PNG)", () => {
  assert.equal(prep.chooseOutputType("image/webp"), "image/webp");
  assert.equal(prep.chooseOutputType("image/png"), "image/jpeg");
  assert.equal(prep.chooseOutputType(""), "image/jpeg");
  assert.equal(prep.chooseOutputType(null), "image/jpeg");
  assert.equal(prep.chooseOutputType(undefined), "image/jpeg");
  assert.equal(prep.JPEG_QUALITY, 0.85);
  assert.equal(prep.MAX_EDGE, 2560);
});

test("toHex is 64 lowercase hex characters for a SHA-256 and matches node's own digest", async () => {
  const bytes = new TextEncoder().encode("almar");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = prep.toHex(digest);
  assert.match(hex, /^[0-9a-f]{64}$/);
  const { createHash } = await import("node:crypto");
  assert.equal(hex, createHash("sha256").update(bytes).digest("hex"));
  assert.equal(prep.toHex(new Uint8Array([0, 15, 16, 255])), "000f10ff");
});

test("only JPEG, PNG and WebP are accepted; HEIC is not", () => {
  for (const type of ["image/jpeg", "image/png", "image/webp", "IMAGE/JPEG"]) assert.equal(prep.isAcceptedType(type), true, type);
  for (const type of ["image/heic", "image/heif", "image/gif", "application/pdf", ""]) assert.equal(prep.isAcceptedType(type), false, type);
});

test("a HEIC file is refused with wrong_type before anything is decoded", async () => {
  const file = { type: "image/heic", name: "IMG_0001.HEIC", size: 10 };
  await assert.rejects(
    () => prep.prepareImage(file),
    (error) => error instanceof prep.ImagePrepError && error.reason === "wrong_type",
  );
});

// ---- the panel's alt text steps ----------------------------------------------------------------------------------

const item = (over = {}) => ({
  id: "11111111-1111-4111-8111-111111111111",
  key: "uploads/a.webp",
  url: "https://media.example/uploads/a.webp",
  width: 10,
  height: 10,
  alt_en: "Pool at dusk",
  content_type: "image/webp",
  source: "upload",
  alt: { en: "Pool at dusk", ar: null, es: "Piscina" },
  alt_status: { en: "published", ar: "missing", es: "draft" },
  used_by: 0,
  ...over,
});

test("altDraftOf ticks 'I checked' only for a published language", () => {
  const draft = alt.altDraftOf(item({ alt: { en: "x", ar: "ع", es: "y" }, alt_status: { en: "published", ar: "published", es: "draft" } }));
  assert.deepEqual(draft, { alt: { en: "x", ar: "ع", es: "y" }, checked: { ar: true, es: false } });
  assert.deepEqual(alt.altDraftOf(item()).alt, { en: "Pool at dusk", ar: "", es: "Piscina" });
});

test("applyAltDrafts fills the box, marks it Draft and unticks 'I checked this translation'", () => {
  const start = { alt: { en: "Pool at dusk", ar: "قديم", es: "" }, checked: { ar: true, es: true } };
  const ar = alt.applyAltDrafts(start, "ar", { alt: "مسبح عند الغروب" });
  assert.equal(ar.alt.ar, "مسبح عند الغروب");
  assert.equal(ar.checked.ar, false);
  assert.equal(ar.checked.es, true, "the other language is untouched");
  assert.equal(alt.altStateOf(ar, "ar"), "draft");
  const es = alt.applyAltDrafts(ar, "es", { alt: ["Piscina al atardecer"] });
  assert.equal(es.alt.es, "Piscina al atardecer");
  assert.equal(es.checked.es, false);
  assert.equal(es.alt.en, "Pool at dusk");
  // The input is not changed, and an empty reply changes nothing.
  assert.equal(start.checked.ar, true);
  assert.equal(alt.applyAltDrafts(start, "ar", { alt: "  " }), start);
  assert.equal(alt.applyAltDrafts(start, "ar", {}), start);
});

test("save_alt: ar/es are published only when ticked, draft otherwise, and an empty language is null with no status", () => {
  const id = "11111111-1111-4111-8111-111111111111";
  const draft = { alt: { en: " Pool at dusk ", ar: "مسبح", es: "" }, checked: { ar: true, es: true } };
  assert.deepEqual(alt.buildSaveAlt(id, draft), {
    action: "save_alt",
    id,
    alt: { en: "Pool at dusk", ar: "مسبح", es: null },
    status: { ar: "published" },
  });
  const unticked = alt.applyAltDrafts(alt.applyAltDrafts(draft, "ar", { alt: "مسبح" }), "es", { alt: "Piscina" });
  assert.deepEqual(alt.buildSaveAlt(id, unticked).status, { ar: "draft", es: "draft" });
});

test("itemAfterSave shows what was sent", () => {
  const body = alt.buildSaveAlt("x", { alt: { en: "A", ar: "ب", es: "" }, checked: { ar: false, es: false } });
  const after = alt.itemAfterSave(item(), body);
  assert.equal(after.alt_en, "A");
  assert.deepEqual(after.alt_status, { en: "published", ar: "draft", es: "missing" });
  assert.deepEqual(after.alt, { en: "A", ar: "ب", es: null });
});

// ---- copy ---------------------------------------------------------------------------------------------------------

test("OPS_MEDIA_COPY has the same keys in en, ar and es, none empty", () => {
  const keys = Object.keys(OPS_MEDIA_COPY.en).sort();
  assert.ok(keys.length >= 25);
  for (const locale of ["ar", "es"]) {
    assert.deepEqual(Object.keys(OPS_MEDIA_COPY[locale]).sort(), keys, locale);
  }
  for (const locale of ["en", "ar", "es"]) {
    for (const key of keys) {
      const value = OPS_MEDIA_COPY[locale][key];
      const texts = typeof value === "string" ? [value] : Object.values(value);
      for (const text of texts) assert.ok(text.trim().length > 0, `${locale}.${key} is empty`);
    }
  }
});

test("the usage line follows each language's plural rules (Arabic one, two, few, many)", () => {
  const used = (locale, n) => formatPlural(OPS_MEDIA_COPY[locale].usedIn, n, locale);
  assert.equal(used("en", 1), "Used in 1 place");
  assert.equal(used("en", 2), "Used in 2 places");
  assert.equal(used("en", 0), "Used in 0 places");
  assert.equal(used("es", 1), "Usada en 1 lugar");
  assert.equal(used("es", 11), "Usada en 11 lugares");
  assert.equal(used("ar", 1), "مستخدمة في مكان واحد");
  assert.equal(used("ar", 2), "مستخدمة في مكانين");
  assert.equal(used("ar", 3), "مستخدمة في 3 أماكن");
  assert.equal(used("ar", 10), "مستخدمة في 10 أماكن");
  assert.equal(used("ar", 11), "مستخدمة في 11 مكانًا");
  assert.equal(used("ar", 100), "مستخدمة في 100 مكان");
  assert.equal(used("ar", 0), "غير مستخدمة في أي مكان");
});

// ---- wiring guards ------------------------------------------------------------------------------------------------

const FILES = [
  "components/ops/image-prep.ts",
  "components/ops/media-alt.ts",
  "components/ops/media-field.tsx",
  "components/ops/media-picker.tsx",
  "components/ops/media-types.ts",
  "components/ops/use-media-library.ts",
  "app/dashboard/(ops)/content/media/media-screen.tsx",
  "app/dashboard/(ops)/content/media/media-library.tsx",
  "app/dashboard/(ops)/content/media/page.tsx",
];

test("no file of this plan calls fetch( or XMLHttpRequest; requests go through ops-client", () => {
  for (const file of FILES) {
    const source = read(file);
    assert.equal(/\bfetch\s*\(/.test(source) || /XMLHttpRequest|sendBeacon/.test(source), false, file);
  }
  const hook = read("components/ops/use-media-library.ts");
  assert.match(hook, /opsFetch/);
  assert.match(hook, /opsPut/);
  assert.match(read("app/dashboard/(ops)/content/media/media-library.tsx"), /opsSend/);
});

test("the picker sends search after 250 ms and Load more with after = the last key; the upload sends the four x-almar headers", () => {
  const hook = read("components/ops/use-media-library.ts");
  assert.match(hook, /SEARCH_DELAY_MS = 250/);
  assert.match(hook, /after: next/);
  for (const header of ["x-almar-sha256", "x-almar-width", "x-almar-height", "x-almar-alt-en"]) assert.ok(hook.includes(`"${header}"`), header);
  assert.match(hook, /encodeURIComponent\(altEn\)/);
  assert.match(hook, /"content-type": prepared\.contentType/);
  assert.match(hook, /picked\.size > MAX_UPLOAD_BYTES/);
});

test("MediaField and MediaListField keep the plan's public props: no `library` prop any more", () => {
  const field = read("components/ops/media-field.tsx");
  assert.equal(/library\s*:\s*PickerLibrary/.test(field), false);
  assert.equal(/PickerLibrary/.test(field), false);
  assert.match(field, /useMediaLibrary/);
});

test("no Images / Video filter on the Media screen (owner, 2026-10-11): the file has no filter control", () => {
  const screen = read("app/dashboard/(ops)/content/media/media-screen.tsx");
  assert.equal(/\bVideo\b|\bImages\b/.test(screen), false);
});

test("the Media page is a server component with noindex and no gate of its own; the section is live", () => {
  const page = read("app/dashboard/(ops)/content/media/page.tsx");
  assert.equal(page.includes("use client"), false);
  assert.equal(/NODE_ENV|notFound\(\)|redirect\(/.test(page), false);
  assert.match(page, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false\s*\}/);
  assert.match(page, /<MediaLibrary \/>/);
  assert.ok(OPS_LIVE_SECTIONS.includes("/content/media"));
  assert.equal(isLiveOpsPath("/content/media"), true);
  assert.equal(isLiveOpsPath("/dashboard/content/media"), true);
  assert.equal(isLiveOpsPath("/content/team"), false);
});

test("the Translate slot is empty on the live page and says what 03.2-10 renders there", () => {
  const library = read("app/dashboard/(ops)/content/media/media-library.tsx");
  assert.match(library, /\/\/ 03\.2-10: render <TranslateButton/);
  assert.match(library, /onDrafts=\{applyDrafts\}/);
  assert.equal(/from ["'][^"']*translate-button["']/.test(library), false, "the button is not on main: no import");
});
