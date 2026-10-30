// Plan 06-04, Task 6: the consent cookie and the beacon's conditions. No legal or cookie wording here: the owner's text is
// bracketed. Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const c = await loadTs("lib/consent.ts");
const config = await loadTs("lib/analytics-config.ts");
const { loadBeacon } = await loadTs("components/site/cookie-consent.tsx");

test("parseConsent: no cookie or another value is no choice; v1.a1 and v1.a0 are the two choices", () => {
  assert.equal(c.parseConsent(""), null);
  assert.equal(c.parseConsent(null), null);
  assert.equal(c.parseConsent(undefined), null);
  assert.deepEqual(c.parseConsent("almar-consent=v1.a1"), { analytics: true });
  assert.deepEqual(c.parseConsent("almar-consent=v1.a0"), { analytics: false });
  assert.deepEqual(c.parseConsent("a=1; almar-consent=v1.a1; b=2"), { analytics: true });
  assert.equal(c.parseConsent("almar-consent=v2.a1"), null);
  assert.equal(c.parseConsent("almar-consent="), null);
  assert.equal(c.parseConsent("not-almar-consent=v1.a1"), null);
});

test("the lifetime is the signed 180 days", () => {
  assert.equal(c.CONSENT_MAX_AGE_SECONDS, 15552000);
});

test("serializeConsent: the first-party cookie, not HttpOnly, and it reads back", () => {
  assert.equal(c.serializeConsent({ analytics: true }), `almar-consent=v1.a1; Path=/; Max-Age=${c.CONSENT_MAX_AGE_SECONDS}; SameSite=Lax; Secure`);
  assert.equal(c.serializeConsent({ analytics: false }), `almar-consent=v1.a0; Path=/; Max-Age=${c.CONSENT_MAX_AGE_SECONDS}; SameSite=Lax; Secure`);
  assert.deepEqual(c.parseConsent(c.serializeConsent({ analytics: true }).split(";")[0]), { analytics: true });
  assert.doesNotMatch(c.serializeConsent({ analytics: true }), /HttpOnly/i);
});

test("the token is null until the owner's step, and only the two live hosts may load the beacon", () => {
  assert.equal(config.CF_WEB_ANALYTICS_TOKEN, null);
  assert.deepEqual([...config.ANALYTICS_HOSTS], ["almarprivatejourney.com", "www.almarprivatejourney.com"]);
});

function fakeDocument() {
  const scripts = [];
  return {
    scripts,
    querySelector: () => (scripts.length > 0 ? scripts[0] : null),
    createElement: () => ({ attributes: {}, setAttribute(name, value) { this.attributes[name] = value; } }),
    head: { appendChild: (el) => scripts.push(el) },
  };
}

test("loadBeacon: one deferred script with the token, on a live host only", () => {
  const live = fakeDocument();
  assert.equal(loadBeacon("[token]", live, "almarprivatejourney.com"), true);
  assert.equal(loadBeacon("[token]", live, "almarprivatejourney.com"), false, "exactly one");
  assert.equal(live.scripts.length, 1);
  assert.equal(live.scripts[0].src, "https://static.cloudflareinsights.com/beacon.min.js");
  assert.equal(live.scripts[0].defer, true);
  assert.equal(live.scripts[0].attributes["data-cf-beacon"], '{"token":"[token]"}');
  for (const host of ["preview.almarprivatejourney.com", "dashboard.almarprivatejourney.com", "localhost", "127.0.0.1", "almarprivatejourney.com.example"]) {
    const other = fakeDocument();
    assert.equal(loadBeacon("[token]", other, host), false, host);
    assert.equal(other.scripts.length, 0, host);
  }
});

test("the component loads the beacon only behind the choice, and renders nothing without words or a token", () => {
  const src = readFileSync("components/site/cookie-consent.tsx", "utf8");
  assert.match(src, /const enabled = banner !== null && token !== null;/);
  assert.match(src, /if \(!enabled\) return null;/);
  // Three places only: the definition, a stored yes on load, and a yes just given.
  assert.deepEqual([...src.matchAll(/loadBeacon\(([^)]*)\)/g)].map((m) => m[1]).sort(), ["token", "token as string", "token: string, doc: Document = document, hostname: string = window.location.hostname"].sort());
  assert.match(src, /else if \(choice\.analytics\) \{\s*loadBeacon\(token\);/);
  assert.match(src, /if \(next\) loadBeacon\(token as string\);/);
  assert.match(src, /if \(wasOn && !next\) \{\s*window\.location\.reload\(\);/);
  assert.doesNotMatch(src, /type="radio"/);
  assert.doesNotMatch(src, /dangerouslySetInnerHTML/);
});

test("the frame gives the footer Cookie settings and mounts the banner only with words and a token; a nothing-published page has neither", () => {
  const frame = readFileSync("components/site/public-frame.tsx", "utf8");
  assert.match(frame, /const banner = legal\?\.banner && CF_WEB_ANALYTICS_TOKEN \? legal\.banner : null;/);
  assert.match(frame, /cookieSettings=\{banner \?/);
  assert.match(frame, /\{banner \? <CookieConsent/);
  assert.match(frame, /legalLinks=\{legal\?\.links\}/);
});

test("the footer without the legal props is today's footer: the same class strings", () => {
  const footer = readFileSync("components/ui/footer.tsx", "utf8");
  assert.ok(footer.includes('"mt-8 grid items-center gap-4 border-t border-teal-tint pt-6 @2xl:grid-cols-3"'));
  assert.ok(footer.includes('"mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-ivory pt-6"'));
  assert.match(footer, /\{hasLegal \? <LegalRow/);
});

test("the legal route exists in all three languages, static, with an empty list allowed and no placeholder param", () => {
  for (const locale of ["en", "ar", "es"]) {
    const src = readFileSync(`app/${locale}/legal/[legal]/page.tsx`, "utf8");
    assert.match(src, /export const dynamicParams = false;/);
    assert.match(src, /export const dynamic = "force-static";/);
    assert.match(src, /generateStaticParams = generateLegalStaticParams/);
    assert.ok(src.includes(`locale="${locale}"`));
  }
  assert.equal(existsSync("app/[locale]/legal"), false, "only login, account and bookings live in app/[locale]");
  const page = readFileSync("components/pages/legal-page.tsx", "utf8");
  assert.doesNotMatch(page, /_none/);
  assert.doesNotMatch(page, /dangerouslySetInnerHTML/);
  assert.match(page, /notFound\(\)/);
  assert.match(page, /<RichText/);
});

test("the nine public pages pass the one prop", () => {
  for (const name of ["home", "about", "blog", "post", "contact", "destinations", "experiences", "private-stays", "stay-detail"]) {
    assert.match(readFileSync(`components/pages/${name}-page.tsx`, "utf8"), /legal=\{await getSiteLegalChrome\(locale\)\}/, name);
  }
  assert.match(readFileSync("lib/locale-path.ts", "utf8"), /"\/legal\/\[legal\]"/);
});
