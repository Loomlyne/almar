// Plan 02-06 (D-108, D-110, D-113, D-116): the saved colours, faces and logo reach the surfaces rendered at request
// time: the ops shell (layout reads the row on every request) and the sign-in email (read at send time, inline styles,
// the logo as an absolute media URL). The public pages take them at the publish rebuild (tests/site-settings.test.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";
import { renderMagicLinkEmail } from "../lib/email/magic-link.ts";
import { GUEST_COPY } from "../lib/copy/guest.ts";

const s = await loadTs("lib/site-settings.ts");
const r = await loadTs("lib/site-settings-read.ts");
const g = await loadTs("lib/maintenance-gate.ts");
const media = await loadTs("lib/data/media.ts");

const ROW = { maintenance: false, teal: null, charcoal: null, gold: null, ivory: null, white: null, title_face: "Questa", body_face: "Lato", logo_key: null };
const SAVED = { ...ROW, teal: "#7a1f3b", gold: "#c9a227", ivory: "#f6f1e7", charcoal: "#1a1a1a", logo_key: "uploads/logo-1.webp" };
const LOGO_URL = "https://media.almarprivatejourney.com/uploads/logo-1.webp";
const COPY = { ...GUEST_COPY.en.mail, button: GUEST_COPY.en.accessWithMagicLink };
const HREF = "https://almarprivatejourney.com/auth/confirm?token_hash=x";
const read = (file) => readFileSync(file, "utf8");

test("brandCss: nothing for the design system; a saved colour is a CSS variable, teal hover and press follow", () => {
  assert.equal(s.brandCss(s.DEFAULT_SITE_SETTINGS), "");
  const css = s.brandCss(s.parseSiteSettingsRow(SAVED));
  assert.match(css, /^:root\{[^<>]*\}$/);
  for (const part of ["--color-teal:#7a1f3b", "--color-gold:#c9a227", "--color-ivory:#f6f1e7", "--color-ink:#1a1a1a", "--color-teal-hover:color-mix(in srgb,#7a1f3b 92%,#262626)"]) {
    assert.ok(css.includes(part), part);
  }
  assert.equal(css.includes("--color-surface"), false, "white is unchanged, so no rule");
  assert.equal(s.brandStyle(s.parseSiteSettingsRow(SAVED)), `<style id="almar-brand">${css}</style>`);
});

test("logoMediaUrl: null without a logo, the image host's URL with one, refuses anything else", () => {
  assert.equal(s.logoMediaUrl(null), null);
  assert.equal(s.logoMediaUrl("uploads/logo-1.webp"), LOGO_URL);
  for (const bad of ["../x.webp", "https://evil/x.png", "x.svg", "/abs.png"]) assert.throws(() => s.logoMediaUrl(bad), bad);
  // site-settings.ts imports nothing, so it repeats the image host: it must stay lib/data/media.ts's.
  assert.equal(s.MEDIA_ORIGIN, media.MEDIA_BASE_URL);
});

test("readSiteSettings: maxAgeMs 0 reads every time; the default keeps a read 30 s; a failure is null", async () => {
  const env = { url: "https://x.supabase.co", anonKey: "k" };
  let calls = 0;
  const fetcher = async () => ({ ok: true, status: 200, json: async () => { calls += 1; return [SAVED]; } });
  r.__testing.reset();
  await r.readSiteSettings(env, { now: 1, fetcher, maxAgeMs: 0 });
  await r.readSiteSettings(env, { now: 2, fetcher, maxAgeMs: 0 });
  assert.equal(calls, 2);
  r.__testing.reset();
  await r.readSiteSettings(env, { now: 1, fetcher });
  const again = await r.readSiteSettings(env, { now: 29_000, fetcher });
  assert.equal(calls, 3);
  assert.equal(again.colors.teal, "#7a1f3b");
  r.__testing.reset();
  assert.equal(await r.readSiteSettings(env, { now: 1, fetcher: async () => { throw new Error("offline"); } }), null);
  r.__testing.reset();
  assert.equal(await r.readSiteSettings({}, { now: 1, fetcher }), null);
});

test("email: the design system without settings; the saved colours, faces and logo with them", () => {
  const plain = renderMagicLinkEmail({ href: HREF, locale: "en", kind: "sign-in", copy: COPY });
  for (const hex of ["#1f3b40", "#d4ba8a", "#fffaf0", "#262626"]) assert.ok(plain.html.includes(hex), hex);
  assert.match(plain.html, />ALMAR Private Journey<\/td>/);
  assert.equal(plain.html.includes("<img"), false);
  assert.deepEqual(renderMagicLinkEmail({ href: HREF, locale: "en", kind: "sign-in", copy: COPY, brand: s.emailBrand(null) }), plain);
  assert.deepEqual(
    renderMagicLinkEmail({ href: HREF, locale: "en", kind: "sign-in", copy: COPY, brand: s.emailBrand(s.DEFAULT_SITE_SETTINGS) }),
    plain,
    "a row with every colour null is the design system",
  );

  const branded = renderMagicLinkEmail({ href: HREF, locale: "en", kind: "sign-in", copy: COPY, brand: s.emailBrand(s.parseSiteSettingsRow(SAVED)) });
  for (const hex of ["#7a1f3b", "#c9a227", "#f6f1e7", "#1a1a1a"]) assert.ok(branded.html.includes(hex), hex);
  for (const hex of ["#1f3b40", "#d4ba8a", "#fffaf0", "#262626"]) assert.equal(branded.html.includes(hex), false, `${hex} replaced`);
  assert.match(branded.html, new RegExp(`<img src="${LOGO_URL.replace(/[.]/g, "\\.")}" alt="ALMAR Private Journey" width="140"`));
  assert.match(branded.html, /font-family:Questa,Georgia,serif/);
  assert.match(branded.html, /font-family:Lato,Arial,sans-serif/);
  assert.equal(branded.text, plain.text, "the text part does not change");

  const ar = renderMagicLinkEmail({ href: HREF, locale: "ar", kind: "sign-in", copy: COPY, brand: s.emailBrand(s.parseSiteSettingsRow(SAVED)) });
  assert.match(ar.html, /font-family:'Noto Naskh Arabic',Georgia,serif/, "Arabic keeps its own faces (D-123)");
  assert.match(ar.html, /font-family:'Noto Sans Arabic',Arial,sans-serif/);
  assert.equal(/style="[^"]*"[^ >]/.test(ar.html), false, "no quote breaks a style attribute");
});

test("email: refuses a brand that did not come from the checked row", () => {
  const good = s.emailBrand(s.parseSiteSettingsRow(SAVED));
  for (const bad of [{ ...good, teal: "red" }, { ...good, titleFace: "Arial" }, { ...good, logoUrl: "http://media.almarprivatejourney.com/x.png" },
    { ...good, logoUrl: 'https://media.almarprivatejourney.com/x.png" onerror="x' }]) {
    assert.throws(() => renderMagicLinkEmail({ href: HREF, locale: "en", kind: "sign-in", copy: COPY, brand: bad }));
  }
});

test("the sign-in email reads the settings at send time; the ops layout reads them on every request", () => {
  const server = read("lib/auth/magic-link-server.ts");
  assert.match(server, /brand: emailBrand\(await readSiteSettings\(siteSettingsEnv\(\)\)\)/);
  const layout = read("app/dashboard/(ops)/layout.tsx");
  assert.match(layout, /readSiteSettings\(siteSettingsEnv\(\), \{ maxAgeMs: 0 \}\)/);
  assert.match(layout, /<style id="almar-brand" dangerouslySetInnerHTML=\{\{ __html: css \}\} \/>/);
  assert.match(layout, /logoSrc: settings \? logoMediaUrl\(settings\.logoKey\) : null/);
  assert.ok(layout.indexOf('redirect("/sign-in")') < layout.indexOf("await OpsBrand()"), "the row is read after the owner gate");
  const shell = read("app/dashboard/(ops)/ops-shell.tsx");
  assert.match(shell, /src=\{logoSrc \?\? charcoalLogo\.src\}/);
  const screen = read("app/dashboard/(ops)/settings/settings-screen.tsx");
  assert.match(screen, /else if \(reply\.affects_site\) \{[^}]*router\.refresh\(\)/s);
});

test("closed page from the public Worker: a saved logo comes from the image host (no /brand/ copy before a rebuild)", async () => {
  const env = { url: "https://x.supabase.co", anonKey: "k" };
  const on = async () => ({ ok: true, status: 200, json: async () => [{ ...SAVED, maintenance: true }] });
  g.__testing.reset();
  const html = await (await g.maintenanceResponse({ path: "/login", opsHost: false, cookieLocale: "en", env, now: 1, fetcher: on })).text();
  assert.ok(html.includes(`<img src="${LOGO_URL}"`));
  assert.ok(html.includes("--color-teal:#7a1f3b"));
  const plainOn = async () => ({ ok: true, status: 200, json: async () => [{ ...ROW, maintenance: true }] });
  g.__testing.reset();
  const plain = await (await g.maintenanceResponse({ path: "/login", opsHost: false, cookieLocale: "en", env, now: 1, fetcher: plainOn })).text();
  assert.ok(plain.includes('<img src="/brand/wordmark.svg"'));
});
