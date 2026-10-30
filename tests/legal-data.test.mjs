// Plan 06-04, Task 3: the legal kinds and the build-time readers on fake view rows. Bracketed stand-ins only: no legal text
// is written by us (F-07). Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { buildSiteContentPayload } from "../scripts/import-site-content.mjs";
import { catalogViews, fakeClient, pageViews, SUPABASE_ENV, withEnv } from "./helpers/site-cms-views.mjs";
import { loadTs } from "./helpers/load-ts.mjs";

const { payload } = await buildSiteContentPayload({ root: process.cwd() });
const kinds = await loadTs("lib/legal/kinds.ts");

let counter = 0;
async function loadLegal() {
  const out = await build({
    stdin: { contents: `export * from "./lib/data/legal.ts"; export { __testing } from "./lib/data/source.ts";`, resolveDir: resolve("."), loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    logLevel: "silent",
  });
  const file = join(mkdtempSync(join(tmpdir(), "almar-legal-")), `module-${counter++}.mjs`);
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

const page = (id, kind) => ({ id, kind, updated_at: "2026-10-30T00:00:00.000Z" });
const record = (page_id, locale, extra = {}) => ({
  page_id,
  locale,
  status: "published",
  title: `[${page_id} title ${locale}]`,
  seo_title: null,
  seo_description: null,
  necessary_label: null,
  necessary_body: null,
  analytics_label: null,
  analytics_body: null,
  body: [{ type: "paragraph", text: `[${page_id} text ${locale}]` }],
  ...extra,
});
const whole = (id, extra) => ["en", "ar", "es"].map((locale) => record(id, locale, extra));

async function withViews(pages, translations, run) {
  const mod = await loadLegal();
  mod.__testing.setClientFactory(() => fakeClient({ ...catalogViews(), ...pageViews(payload), api_legal_pages: pages, api_legal_page_translations: translations }));
  return withEnv(SUPABASE_ENV, () => run(mod));
}

test("kinds: slugs and addresses; the cookie banner is never a page", () => {
  assert.equal(kinds.legalKindFromSlug("booking-terms"), "booking_terms");
  assert.equal(kinds.legalKindFromSlug("cookie-banner"), null);
  assert.equal(kinds.legalKindFromSlug("x"), null);
  assert.equal(kinds.legalPath("ar", "privacy"), "/ar/legal/privacy");
  assert.equal(kinds.legalPath("es", "booking_terms"), "/es/legal/booking-terms");
  assert.deepEqual([...kinds.LEGAL_PAGE_KINDS], ["privacy", "terms", "booking_terms", "waiver", "disclaimer"]);
});

test("fixtures mode: no legal page, no link, no banner, no params", async () => {
  const mod = await loadLegal();
  assert.deepEqual(await mod.getPublishedLegalKinds(), []);
  assert.deepEqual(await mod.generateLegalParams(), []);
  assert.deepEqual(await mod.getSiteLegalChrome("en"), { links: [], banner: null, privacyHref: null });
  assert.equal(await mod.getLegalPage("en", "privacy"), null);
});

test("a half-translated page has no address in any language", async () => {
  const rows = [record("p1", "en"), record("p1", "ar"), record("p1", "es", { status: "draft" })];
  await withViews([page("p1", "privacy")], rows, async (mod) => {
    assert.deepEqual(await mod.getPublishedLegalKinds(), []);
    assert.equal(await mod.getLegalPage("en", "privacy"), null);
    assert.deepEqual(await mod.generateLegalParams(), []);
  });
});

test("links follow LEGAL_PAGE_KINDS whatever the row order, in the page's language", async () => {
  const pages = [page("w", "waiver"), page("t", "terms"), page("p", "privacy")];
  await withViews(pages, [...whole("w"), ...whole("t"), ...whole("p")], async (mod) => {
    assert.deepEqual(await mod.getPublishedLegalKinds(), ["privacy", "terms", "waiver"]);
    assert.deepEqual(await mod.generateLegalParams(), [{ legal: "privacy" }, { legal: "terms" }, { legal: "waiver" }]);
    const chrome = await mod.getSiteLegalChrome("ar");
    assert.deepEqual(chrome.links, [
      { label: "[p title ar]", href: "/ar/legal/privacy" },
      { label: "[t title ar]", href: "/ar/legal/terms" },
      { label: "[w title ar]", href: "/ar/legal/waiver" },
    ]);
    assert.equal(chrome.privacyHref, "/ar/legal/privacy");
  });
});

test("the banner is null until published in three languages with both labels; it is never a link", async () => {
  const labels = { necessary_label: "[n]", analytics_label: "[a]" };
  await withViews([page("b", "cookie_banner")], [record("b", "en", labels), record("b", "ar", labels)], async (mod) => {
    assert.equal((await mod.getSiteLegalChrome("en")).banner, null);
  });
  await withViews([page("b", "cookie_banner")], whole("b"), async (mod) => {
    assert.equal((await mod.getSiteLegalChrome("en")).banner, null, "no labels");
  });
  await withViews([page("b", "cookie_banner")], whole("b", labels), async (mod) => {
    const chrome = await mod.getSiteLegalChrome("es");
    assert.equal(chrome.banner.title, "[b title es]");
    assert.equal(chrome.banner.necessary_label, "[n]");
    assert.deepEqual(chrome.links, []);
    assert.equal(chrome.privacyHref, null);
  });
});

test("a block with no text in this language is not drawn", async () => {
  const body = [{ type: "paragraph", text: "[one]" }, { type: "quote", text: null }, { type: "heading", text: "  " }];
  await withViews([page("p", "privacy")], whole("p", { body }), async (mod) => {
    assert.deepEqual((await mod.getLegalPage("en", "privacy")).body, [{ type: "paragraph", text: "[one]" }]);
  });
});

test("getBookingTermsLink: published terms but no baked version (the committed snapshot): no link, the label stays", async () => {
  await withViews([page("t", "booking_terms")], whole("t", { body: [{ type: "paragraph", text: "[one]" }] }), async (mod) => {
    assert.ok(await mod.getLegalPage("en", "booking_terms"));
    assert.equal(await mod.getBookingTermsLink("en"), null);
  });
});

test("getBookingPageLegal: the footer's links, never the banner (the booking address holds its token)", async () => {
  const labels = { necessary_label: "[n]", analytics_label: "[a]" };
  await withViews([page("p", "privacy"), page("b", "cookie_banner")], [...whole("p", { body: [{ type: "paragraph", text: "[one]" }] }), ...whole("b", labels)], async (mod) => {
    const chrome = await mod.getBookingPageLegal("en");
    assert.equal(chrome.links.length, 1);
    assert.equal(chrome.banner, null);
    assert.equal(chrome.privacyHref, null);
  });
});
