// Contact details (plan 03.3-20, design 3.2/3.5, ROADMAP SC4 / SITE-13, S3-2): getContactDetails in three locales,
// the live links rebuilt byte for byte, and a guard that fails when the data, PublicFrame and SiteFooter disagree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const ROOT = process.cwd();
const EMAIL = "inquiries@almarprivatejourney.com";
const PHONE_DISPLAY = "+971 56 388 3302";
const PHONE_E164 = "+971563883302";
const NAME = "ALMAR Private Journeys";
// The live Framer page's Maps href was "Bogotá,+Colombia". The query is now percent-encoded (encodeURIComponent, then
// %20 -> +), so the same search is written MAPS; decoded, both are the same path (the "same search" test below).
const LIVE_MAPS = "https://www.google.com/maps/search/Bogotá,+Colombia";
const MAPS = "https://www.google.com/maps/search/Bogot%C3%A1%2C+Colombia";
const MAPS_BASE = "https://www.google.com/maps/search/";
const INSTAGRAM = "https://www.instagram.com/almarprivatejourney/";
const WA_TEXT = "Hello ALMAR, I would like to plan a private journey.";
const WA_HREF = "https://wa.me/971563883302?text=Hello%20ALMAR%2C%20I%20would%20like%20to%20plan%20a%20private%20journey.";
const BOGOTA_AR = "بوغوتا، كولومبيا"; // S3-2: Arabic script, Arabic comma U+060C
const ARABIC_LETTER = /[؀-ۿ]/;
const ARABIC_INDIC_DIGIT = /[٠-٩]/;
const KEYS = ["business_name", "email", "instagram_url", "locale", "location_label", "location_url", "phone_display", "phone_e164", "translation_status", "whatsapp_message"];

const details = async (l) => (await loadTs("lib/data/contact.ts")).getContactDetails(l);
const { contactLinks } = await loadTs("components/pages/contact/contact-links.ts");

async function withScratch(edit, locale = "en") {
  const dir = mkdtempSync(join(tmpdir(), "almar-contact-"));
  mkdirSync(join(dir, "lib"), { recursive: true });
  cpSync(join(ROOT, "lib", "data"), join(dir, "lib", "data"), { recursive: true });
  const p = join(dir, "lib", "data", "fixtures", "contact.json");
  const row = JSON.parse(readFileSync(p, "utf8"));
  edit(row);
  writeFileSync(p, JSON.stringify(row, null, 2));
  const cwd = process.cwd();
  try {
    process.chdir(dir);
    const mod = await loadTs("lib/data/contact.ts");
    return await mod.getContactDetails(locale);
  } finally {
    process.chdir(cwd);
  }
}

/** Reads `NAME ... = { key: "value", ... }` out of a source text. Throws when the declaration is not there. */
export function parseConstant(source, name) {
  const m = new RegExp(`\\b${name}\\b[^=\\n]*=\\s*\\{([^}]*)\\}`).exec(source);
  if (!m) throw new Error(`constant ${name} not found`);
  const out = {};
  for (const [, k, v] of m[1].matchAll(/(\w+)\s*:\s*"([^"]*)"/g)) out[k] = v;
  return out;
}
const src = (p) => readFileSync(join(ROOT, p), "utf8");

test("exact key set: no id, no row meta, no second inbox, no translations", async () => {
  for (const l of ["en", "ar", "es"]) assert.deepEqual(Object.keys(await details(l)).sort(), KEYS, l);
});

test("the published facts are the same in en, ar and es", async () => {
  for (const l of ["en", "ar", "es"]) {
    const d = await details(l);
    assert.equal(d.email, EMAIL, l);
    assert.equal(d.phone_display, PHONE_DISPLAY, l);
    assert.equal(d.phone_e164, PHONE_E164, l);
    assert.equal(d.business_name, NAME, l);
    assert.equal(d.location_url, MAPS, l);
    assert.equal(d.instagram_url, INSTAGRAM, l);
    assert.equal(d.locale, l);
  }
});

test("every language is published (AR and ES reviewed and published 2026-10-05, I18N-REVIEW-2026-10-05.md); the Bogotá label is pinned per language (S3-2)", async () => {
  const en = await details("en");
  assert.equal(en.location_label, "Bogotá, Colombia");
  assert.equal(en.whatsapp_message, WA_TEXT);
  assert.equal(en.translation_status, "published");
  const es = await details("es");
  assert.equal(es.location_label, "Bogotá, Colombia");
  assert.equal(es.translation_status, "published");
  assert.notEqual(es.whatsapp_message, WA_TEXT);
  const ar = await details("ar");
  assert.equal(ar.location_label, "بوغوتا، كولومبيا");
  assert.equal(ar.location_label, BOGOTA_AR);
  assert.equal(ar.translation_status, "published");
  assert.match(ar.whatsapp_message, ARABIC_LETTER);
  assert.doesNotMatch(ar.whatsapp_message, ARABIC_INDIC_DIGIT);
  assert.doesNotMatch(ar.location_label, ARABIC_INDIC_DIGIT);
});

test("the live hrefs rebuild byte for byte from the en details; the Maps href is the same search, percent-encoded", async () => {
  const d = await details("en");
  assert.equal("https://wa.me/" + d.phone_e164.replace("+", "") + "?text=" + encodeURIComponent(d.whatsapp_message), WA_HREF);
  assert.equal("tel:" + d.phone_e164, "tel:+971563883302");
  assert.equal(d.location_url, MAPS);
  assert.notEqual(d.location_url, LIVE_MAPS, "the href is encoded now: Bogot%C3%A1%2C+Colombia, not the raw live text");
  assert.equal(decodeURIComponent(new URL(d.location_url).pathname), decodeURIComponent(new URL(LIVE_MAPS).pathname), "same search path once decoded");
  assert.equal(new URL(d.location_url).pathname.slice("/maps/search/".length), "Bogot%C3%A1%2C+Colombia");
});

test("the Maps href encodes the query: a % or any reserved character cannot make a malformed URL", async () => {
  const cases = [
    ["Bogotá 100% Colombia", `${MAPS_BASE}Bogot%C3%A1+100%25+Colombia`],
    ["50%25 off", `${MAPS_BASE}50%2525+off`],
    ["a&b=c;d", `${MAPS_BASE}a%26b%3Dc%3Bd`],
    ['say "hi" <b>', `${MAPS_BASE}say+%22hi%22+%3Cb%3E`],
  ];
  for (const [query, want] of cases) {
    const d = await withScratch((r) => { r.location_query = query; });
    assert.equal(d.location_url, want, query);
    assert.doesNotMatch(d.location_url, /%(?![0-9A-F]{2})/, `${query}: every % starts a valid escape`);
    assert.equal(decodeURIComponent(d.location_url.slice(MAPS_BASE.length).replace(/\+/g, " ")), query, `${query}: decodes back to the query`);
    assert.doesNotThrow(() => contactLinks(d), query);
  }
  // encodeURIComponent leaves ' alone; contactLinks still refuses a quote in the address, so the build fails closed.
  const quote = await withScratch((r) => { r.location_query = "it's"; });
  assert.throws(() => contactLinks(quote), /location/);
});

test("guard: the data, SITE_CONTACT (PublicFrame) and OWNER_CONTACT (SiteFooter) agree", async () => {
  const frame = parseConstant(src("components/site/public-frame.tsx"), "SITE_CONTACT");
  const footer = parseConstant(src("components/ui/footer.tsx"), "OWNER_CONTACT");
  assert.deepEqual(Object.keys(frame).sort(), ["email", "instagram", "phone"]);
  assert.deepEqual(Object.keys(footer).sort(), ["email", "instagram", "phone"]);
  const d = await details("en");
  assert.equal(d.email, frame.email);
  assert.equal(d.email, footer.email);
  assert.equal(d.phone_e164, frame.phone.replace(/\s/g, ""));
  assert.equal(d.phone_display, footer.phone);
  assert.equal(d.phone_display, frame.phone);
  assert.equal(d.instagram_url, frame.instagram);
  assert.equal(d.instagram_url, footer.instagram);
});

test("guard: the parser throws when a constant is renamed or missing", () => {
  const renamed = src("components/site/public-frame.tsx").replace(/SITE_CONTACT/g, "SITE_CONTACT_RENAMED");
  assert.throws(() => parseConstant(renamed, "SITE_CONTACT"), /not found/);
  assert.throws(() => parseConstant("const x = 1;", "OWNER_CONTACT"), /not found/);
});

test("while app/contact/route.ts exists, the live page carries the pinned facts (skipped once plan 24 deletes it)", (t) => {
  const file = join(ROOT, "app", "contact", "route.ts");
  if (!existsSync(file)) return t.skip("app/contact/route.ts is gone (plan 24 deleted it); the pin was proven before");
  const line = readFileSync(file, "utf8").split("\n").find((l) => l.startsWith("const HTML = "));
  assert.ok(line, "HTML constant not found");
  const html = JSON.parse(line.slice("const HTML = ".length).replace(/;$/, ""));
  for (const p of [EMAIL, PHONE_DISPLAY, "Bogotá, Colombia", `href="${LIVE_MAPS}"`, `href="${WA_HREF}"`, NAME]) {
    assert.ok(html.includes(p), `not on the live Contact page: ${p}`);
  }
});

test("fixtures hold no URL, no /assets/ path, no second inbox and no locale-keyed map; one record per language", () => {
  for (const f of ["contact", "contact-translations"]) {
    const text = readFileSync(join(ROOT, "lib", "data", "fixtures", `${f}.json`), "utf8");
    assert.doesNotMatch(text, /http|\/assets\//, f);
    assert.doesNotMatch(text, /partnerships/i, f);
    assert.doesNotMatch(text, /"(?:en|ar|es)"\s*:\s*[{[]/, f);
  }
  const t = JSON.parse(readFileSync(join(ROOT, "lib", "data", "fixtures", "contact-translations.json"), "utf8"));
  assert.deepEqual(t.map((r) => r.locale).sort(), ["ar", "en", "es"]);
  assert.equal(t.find((r) => r.locale === "ar").location_label, "بوغوتا، كولومبيا");
});

test("a malformed row is refused at read (scratch tree)", async () => {
  await assert.doesNotReject(withScratch(() => {}));
  await assert.rejects(withScratch((r) => { r.phone_e164 = "0563883302"; }), /phone_e164/);
  await assert.rejects(withScratch((r) => { r.phone_e164 = "+971 56"; }), /phone_e164/);
  await assert.rejects(withScratch((r) => { r.email = "nobody"; }), /email/);
  await assert.rejects(withScratch((r) => { r.email = "a@b@c.com"; }), /email/);
  // a percent escape decodes to a header break or a second recipient in a mailto: link; ; separates recipients in some mail clients
  await assert.rejects(withScratch((r) => { r.email = "a%0D%0ABcc%3Ax%40y.com@b.com"; }), /email/);
  await assert.rejects(withScratch((r) => { r.email = "50%@b.com"; }), /email/);
  await assert.rejects(withScratch((r) => { r.email = "a;b@c.com"; }), /email/);
  await assert.rejects(withScratch((r) => { r.email = "a@b.com;c@d.com"; }), /email/);
  await assert.rejects(withScratch((r) => { r.instagram_handle = "Bad/Handle"; }), /instagram_handle/);
  await assert.rejects(withScratch((r) => { r.instagram_handle = "javascript:alert(1)"; }), /instagram_handle/);
  await assert.rejects(withScratch((r) => { r.location_query = "Bogotá/../x"; }), /location_query/);
  await assert.rejects(withScratch((r) => { r.location_query = "Bogotá?q=1"; }), /location_query/);
});
