// Plan 02-06: Settings at the publish rebuild: the anon row, the brand style, the closed page, the runtime gate on
// /login, /account and /bookings, and the assembler step that applies them to out/.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadTs } from "./helpers/load-ts.mjs";

const s = await loadTs("lib/site-settings.ts");
const m = await loadTs("lib/maintenance-document.ts");
const g = await loadTs("lib/maintenance-gate.ts");
const assemble = await import("../scripts/assemble-cloudflare.mjs");

const ROW = { maintenance: false, teal: null, charcoal: null, gold: null, ivory: null, white: null, title_face: "Questa", body_face: "Lato", logo_key: null };

test("parseSiteSettingsRow: defaults for nulls, exact values only, throws on anything else", () => {
  assert.deepEqual(s.parseSiteSettingsRow(ROW), s.DEFAULT_SITE_SETTINGS);
  const saved = s.parseSiteSettingsRow({ ...ROW, maintenance: true, teal: "#123456", logo_key: "brand/logo-1.webp" });
  assert.equal(saved.maintenance, true);
  assert.equal(saved.colors.teal, "#123456");
  assert.equal(saved.logoKey, "brand/logo-1.webp");
  for (const bad of [null, [], { ...ROW, maintenance: "yes" }, { ...ROW, teal: "#FFF" }, { ...ROW, teal: "red" },
    { ...ROW, title_face: "Arial" }, { ...ROW, logo_key: "../x.webp" }, { ...ROW, logo_key: "https://x/y.png" }, { ...ROW, logo_key: "a.svg" }]) {
    assert.throws(() => s.parseSiteSettingsRow(bad));
  }
});

test("brandStyle: empty for the design system's colours, CSS variables for saved ones, teal hover follows", () => {
  assert.equal(s.brandStyle(s.DEFAULT_SITE_SETTINGS), "");
  assert.equal(s.brandStyle({ ...s.DEFAULT_SITE_SETTINGS, colors: { ...s.BRAND_DEFAULTS } }), "");
  const css = s.brandStyle({ ...s.DEFAULT_SITE_SETTINGS, colors: { ...s.DEFAULT_SITE_SETTINGS.colors, teal: "#123456", white: "#fefefe" } });
  assert.match(css, /^<style id="almar-brand">:root\{.*\}<\/style>$/);
  assert.match(css, /--color-teal:#123456/);
  assert.match(css, /--color-teal-hover:color-mix\(in srgb,#123456 92%,#262626\)/);
  assert.match(css, /--color-surface:#fefefe/);
  assert.doesNotMatch(css, /--color-gold/);
  assert.throws(() => s.brandStyle({ ...s.DEFAULT_SITE_SETTINGS, colors: { ...s.DEFAULT_SITE_SETTINGS.colors, teal: "</style>" } }));
});

test("logoPath: the wordmark until a logo is saved, then /brand/logo.<ext>", () => {
  assert.equal(s.logoPath(null), "/brand/wordmark.svg");
  assert.equal(s.logoPath("brand/x.png"), "/brand/logo.png");
});

test("fetchSiteSettings: one row with the anon key, else it throws", async () => {
  const seen = [];
  const ok = (rows, status = 200) => async (url, init) => { seen.push({ url, init }); return { ok: status === 200, status, json: async () => rows }; };
  const read = await s.fetchSiteSettings("https://x.supabase.co/", "anon-key", ok([{ ...ROW, maintenance: true }]));
  assert.equal(read.maintenance, true);
  assert.equal(seen[0].url, "https://x.supabase.co/rest/v1/api_site_settings?select=*");
  assert.equal(seen[0].init.headers.apikey, "anon-key");
  await assert.rejects(s.fetchSiteSettings("https://x", "k", ok([])));
  await assert.rejects(s.fetchSiteSettings("https://x", "k", ok([ROW, ROW])));
  await assert.rejects(s.fetchSiteSettings("https://x", "k", ok([ROW], 500)));
});

test("closed page: locked line per language, real tel and mailto, no form, button, WhatsApp, sign-in or dashboard", () => {
  for (const locale of ["en", "ar", "es"]) {
    const html = m.renderMaintenancePage(locale, { logoSrc: "/brand/wordmark.svg" });
    assert.ok(html.includes(m.MAINTENANCE_COPY[locale].line), locale);
    assert.match(html, new RegExp(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}">`));
    assert.match(html, /href="tel:\+971563883302">\+971 56 388 3302</);
    assert.match(html, /href="mailto:inquiries@almarprivatejourney\.com">inquiries@almarprivatejourney\.com</);
    assert.doesNotMatch(html, /<form|<button|<script|wa\.me|whatsapp|dashboard|login|sign in/i);
    assert.match(html, /<a class="skip" href="#content">/);
    assert.match(html, /href="\/ar\/" lang="ar"/);
  }
  assert.equal(m.MAINTENANCE_COPY.en.line, "ALMAR Private Journey is closed for a short time.");
  assert.throws(() => m.renderMaintenancePage("en", { logoSrc: "https://evil.example/x.png" }));
  assert.throws(() => m.renderMaintenancePage("en", { logoSrc: "/brand/wordmark.svg", brandStyle: "<script>x</script>" }));
});

test("gate: closes only /login, /account, /bookings on the public host while maintenance is on; fails open", async () => {
  const env = { url: "https://x.supabase.co", anonKey: "k" };
  const on = async () => ({ ok: true, status: 200, json: async () => [{ ...ROW, maintenance: true }] });
  const off = async () => ({ ok: true, status: 200, json: async () => [ROW] });
  const broken = async () => { throw new Error("offline"); };

  g.__testing.reset();
  const closed = await g.maintenanceResponse({ path: "/login", opsHost: false, cookieLocale: "es", env, now: 1, fetcher: on });
  assert.equal(closed.status, 503);
  assert.equal(closed.headers.get("cache-control"), "no-store");
  assert.match(await closed.text(), /está cerrado por un momento/);
  for (const p of ["/account", "/bookings/", "/login"]) {
    assert.ok(await g.maintenanceResponse({ path: p, opsHost: false, cookieLocale: undefined, env, now: 2, fetcher: on }), p);
  }
  assert.equal(await g.maintenanceResponse({ path: "/login", opsHost: true, cookieLocale: undefined, env, now: 3, fetcher: on }), null);
  assert.equal(await g.maintenanceResponse({ path: "/api/booking/quote", opsHost: false, cookieLocale: undefined, env, now: 3, fetcher: on }), null);
  assert.equal(await g.maintenanceResponse({ path: "/auth/confirm", opsHost: false, cookieLocale: undefined, env, now: 3, fetcher: on }), null);

  // Read on every request (PR #14 review): saved off opens on the next request, no 30 s wait.
  assert.equal(await g.maintenanceResponse({ path: "/login", opsHost: false, cookieLocale: undefined, env, now: 4, fetcher: off }), null);

  g.__testing.reset();
  assert.equal(await g.maintenanceResponse({ path: "/login", opsHost: false, cookieLocale: undefined, env, now: 1, fetcher: broken }), null);
  g.__testing.reset();
  assert.equal(await g.maintenanceResponse({ path: "/login", opsHost: false, cookieLocale: undefined, env: {}, now: 1, fetcher: on }), null);
});

function tmpOut(pages) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "almar-0206-"));
  for (const { dest, html } of pages) {
    fs.mkdirSync(path.dirname(path.join(dir, dest)), { recursive: true });
    fs.writeFileSync(path.join(dir, dest), html);
  }
  return dir;
}

const PAGE = '<html><head><title>x</title></head><body><img src="/_next/static/media/Stacked_Charcoal.a16ac07e.svg"><img src="/_next/static/media/Poly_White.646c5553.svg"></body></html>';
const PAGES = [{ dest: "index.html", locale: "en" }, { dest: "ar/index.html", locale: "ar" }, { dest: "es/about.html", locale: "es" }];

test("applySiteSettings: maintenance writes the closed page over every public page in its language", () => {
  const out = tmpOut(PAGES.map((p) => ({ ...p, html: PAGE })));
  const settings = { ...s.DEFAULT_SITE_SETTINGS, maintenance: true };
  const report = assemble.applySiteSettings({ outDir: out, pages: PAGES, settings, logo: null });
  assert.deepEqual(report, { maintenance: true, pages: 3, styled: 0 });
  assert.match(fs.readFileSync(path.join(out, "index.html"), "utf8"), /is closed for a short time/);
  assert.match(fs.readFileSync(path.join(out, "ar/index.html"), "utf8"), /dir="rtl"[\s\S]*مغلقة لوقت قصير/);
  assert.match(fs.readFileSync(path.join(out, "es/about.html"), "utf8"), /cerrado por un momento/);
  for (const f of ["brand/wordmark.svg", "brand/questa.woff", "brand/lato.ttf"]) assert.ok(fs.existsSync(path.join(out, f)), f);
});

test("applySiteSettings: saved colours and logo reach every page; defaults leave pages untouched", () => {
  const untouched = tmpOut(PAGES.map((p) => ({ ...p, html: PAGE })));
  assert.equal(assemble.applySiteSettings({ outDir: untouched, pages: PAGES, settings: s.DEFAULT_SITE_SETTINGS, logo: null }).styled, 0);
  assert.equal(fs.readFileSync(path.join(untouched, "index.html"), "utf8"), PAGE);

  const out = tmpOut(PAGES.map((p) => ({ ...p, html: PAGE })));
  const settings = { ...s.DEFAULT_SITE_SETTINGS, colors: { ...s.DEFAULT_SITE_SETTINGS.colors, teal: "#123456" }, logoKey: "brand/logo-1.png" };
  const logo = { ext: "png", bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0]) };
  assert.equal(assemble.applySiteSettings({ outDir: out, pages: PAGES, settings, logo }).styled, 3);
  const html = fs.readFileSync(path.join(out, "es/about.html"), "utf8");
  assert.match(html, /<style id="almar-brand">:root\{--color-teal:#123456;[^<]*\}<\/style><\/head>/);
  assert.equal((html.match(/src="\/brand\/logo\.png"/g) ?? []).length, 2);
  assert.doesNotMatch(html, /Stacked_Charcoal|Poly_White/);
  assert.deepEqual(fs.readFileSync(path.join(out, "brand/logo.png")), logo.bytes);
});

test("readBuildSiteSettings: fixtures file or defaults; database row plus a checked logo; failures throw", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "almar-0206-fx-"));
  assert.deepEqual((await assemble.readBuildSiteSettings("fixtures", { ALMAR_FIXTURE_DIR: dir })).settings, s.DEFAULT_SITE_SETTINGS);
  fs.writeFileSync(path.join(dir, "site-settings.json"), JSON.stringify({ ...ROW, maintenance: true }));
  assert.equal((await assemble.readBuildSiteSettings("fixtures", { ALMAR_FIXTURE_DIR: dir })).settings.maintenance, true);

  const env = { NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co", NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon" };
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);
  const fetcher = (logoBytes, logoStatus = 200) => async (url) =>
    url.includes("/rest/v1/")
      ? { ok: true, status: 200, json: async () => [{ ...ROW, logo_key: "brand/l.png" }] }
      : { ok: logoStatus === 200, status: logoStatus, arrayBuffer: async () => logoBytes };
  const read = await assemble.readBuildSiteSettings("supabase", env, fetcher(png));
  assert.equal(read.logo.ext, "png");
  assert.deepEqual(read.logo.bytes, png);
  await assert.rejects(assemble.readBuildSiteSettings("supabase", env, fetcher(Buffer.from("GIF89a....."))), /not a png/);
  await assert.rejects(assemble.readBuildSiteSettings("supabase", env, fetcher(Buffer.alloc(assemble.LOGO_MAX_BYTES + 1, 0x89))), /over 1 MB/);
  await assert.rejects(assemble.readBuildSiteSettings("supabase", env, fetcher(png, 404)), /media host/);
});
