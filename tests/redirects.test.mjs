// The redirect contract (plan 03.3-12, design 5.2; job 21): public/_redirects holds the old unprefixed English
// addresses (301 to /en/…, owner 2026-10-21 decision #13) and the /services rules, each well formed, 301, same-origin,
// one hop. Cloudflare runs redirects before asset matching, so a rule that shadows a live page would silently hide it:
// that is checked here too.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  HIDDEN,
  REDIRECTS_FILE,
  SITE,
  matchRedirect,
  parseRedirects,
  readRedirects,
  redirectTarget,
  resolveInOut,
  sitePages,
} from "./helpers/site-links.mjs";
import { LEGACY_SECTIONS, legacyLocaleTarget } from "../lib/locale-redirect.ts";

const LEGACY = ["/about", "/blog", "/contact", "/destinations", "/experiences", "/private-stays", "/login", "/account", "/bookings"];

const EXPECTED = [
  ...LEGACY.flatMap((p) => [
    [p, `/en${p}`, 301],
    [`${p}/`, `/en${p}`, 301],
  ]),
  ["/services", "/en/experiences?type=service", 301],
  ["/services/", "/en/experiences?type=service", 301],
  ["/services/24-7-private-concierge", "/en/experiences?type=service&item=24-7-private-concierge", 301],
  ["/services/24-7-private-concierge/", "/en/experiences?type=service&item=24-7-private-concierge", 301],
  ["/services/luxury-ground-transport", "/en/experiences?type=service&item=luxury-ground-transport", 301],
  ["/services/luxury-ground-transport/", "/en/experiences?type=service&item=luxury-ground-transport", 301],
  ["/services/vip-airport-meet-greet", "/en/experiences?type=service&item=vip-airport-meet-greet", 301],
  ["/services/vip-airport-meet-greet/", "/en/experiences?type=service&item=vip-airport-meet-greet", 301],
  ["/services/*", "/en/experiences?type=service", 301],
  ["/blog/*", "/en/blog/:splat", 301],
  ["/private-stays/*", "/en/private-stays/:splat", 301],
  ["/bookings/*", "/en/bookings/:splat", 301],
];

const { rules, errors } = readRedirects();
const catalog = JSON.parse(readFileSync("lib/data/fixtures/catalog.json", "utf8"));
const serviceSlugs = catalog.filter((r) => r.kind === "service").map((r) => r.slug);
const pathOf = (to) => new URL(to, SITE).pathname;
const serviceRules = rules.filter((r) => r.from.startsWith("/services"));
/** The guest pages are Worker pages (never static), so they are not in sitePages(). */
const GUEST = new Set(["/en/login", "/en/account", "/en/bookings"]);

test("public/_redirects: no errors and exactly the expected rules, in order", () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(rules.map((r) => [r.from, r.to, r.status]), EXPECTED);
  assert.deepEqual(rules.filter((r) => r.splat).map((r) => r.from), ["/services/*", "/blog/*", "/private-stays/*", "/bookings/*"]);
  assert.equal(rules.findIndex((r) => r.splat), rules.length - 4, "the splat rules are last");
  assert.equal(new Set(rules.map((r) => r.from)).size, rules.length, "no source repeats");
  assert.equal(rules.every((r) => r.status === 301), true);
});

test("job 21: the legacy rules and lib/locale-redirect.ts agree", () => {
  assert.deepEqual([...LEGACY_SECTIONS], LEGACY);
  for (const p of LEGACY) {
    assert.equal(redirectTarget(matchRedirect(rules, p), p), legacyLocaleTarget(p), p);
    assert.equal(redirectTarget(matchRedirect(rules, `${p}/`), `${p}/`), legacyLocaleTarget(`${p}/`), `${p}/`);
  }
  for (const p of ["/blog/why-medellin-is-redefining-luxury-travel", "/private-stays/casa-jardin-san-diego", "/bookings/abc"]) {
    assert.equal(redirectTarget(matchRedirect(rules, p), p), legacyLocaleTarget(p), p);
  }
  for (const p of ["/", "/en/about", "/ar/login", "/api/health", "/auth/confirm", "/newsletter", "/aboutx"]) {
    assert.equal(legacyLocaleTarget(p), null, p);
  }
});

test("public/_redirects: LF only, trailing newline, no BOM", () => {
  const text = readFileSync(REDIRECTS_FILE, "utf8");
  assert.equal(text.endsWith("\n"), true);
  assert.equal(text.includes("\r"), false);
  assert.equal(text.charCodeAt(0) === 0xfeff, false);
  assert.equal(text.endsWith("/bookings/* /en/bookings/:splat 301\n"), true);
});

test("parseRedirects: form errors name their line", () => {
  const bad = [
    ["/a /b", /line 1/],
    ["/a /b 301 extra", /line 1/],
    ["/a /b 302", /line 1/],
    ["a /b 301", /line 1/],
    ["/a?x=1 /b 301", /line 1/],
    ["/a#x /b 301", /line 1/],
    ["/a:b /b 301", /line 1/],
    ["/a*b /b 301", /line 1/],
    ["/*/a /b 301", /line 1/],
    ["/a //evil.example 301", /line 1/],
    ["/a https://evil.example 301", /line 1/],
    ["/a /b/* 301", /line 1/],
    ["/a /b/:splat 301", /line 1/],
  ];
  for (const [text, re] of bad) {
    const out = parseRedirects(text);
    assert.equal(out.errors.length, 1, text);
    assert.match(out.errors[0], re, text);
  }
  const lined = parseRedirects("# c\n\n/a /b 301\n/c d 301\n");
  assert.equal(lined.errors.length, 1);
  assert.match(lined.errors[0], /line 4/);
  assert.deepEqual(parseRedirects("# only a comment\n\n/a /b 301\n").errors, []);
  assert.deepEqual(parseRedirects("/a/* /b 301\n").rules[0].splat, true);
  assert.deepEqual(parseRedirects("/a/* /b/:splat 301\n").errors, []);
  assert.deepEqual(parseRedirects("/a/* /b/:x 301\n").errors.length, 1);
});

test("destinations: same origin, a real page (or a guest page), only type and item, item is a service row", () => {
  const pages = sitePages();
  for (const r of rules) {
    const dest = pathOf(redirectTarget(r, r.from.replace(/\*$/, "x")));
    assert.equal(new URL(r.to, SITE).origin, SITE, r.to);
    if (r.splat && !r.from.startsWith("/services")) continue;
    assert.ok(pages.has(dest) || GUEST.has(dest), `${dest} is not a page`);
  }
  for (const r of serviceRules) {
    const url = new URL(r.to, SITE);
    assert.equal(url.origin, SITE, r.to);
    assert.equal(pages.has(url.pathname), true, `${url.pathname} is not a page`);
    assert.equal(HIDDEN.includes(url.pathname), false);
    for (const [k, v] of url.searchParams) {
      assert.ok(k === "type" || k === "item", `${r.to}: query key ${k}`);
      if (k === "type") assert.equal(v, "service");
      if (k === "item") assert.ok(serviceSlugs.includes(v), `${v} is not a service slug`);
    }
    assert.equal(url.searchParams.get("type"), "service");
  }
});

test("one hop: no destination matches a rule, no loop", () => {
  for (const r of rules) {
    const probe = r.from.replace(/\*$/, "x");
    assert.equal(matchRedirect(rules, pathOf(redirectTarget(r, probe))), null, r.to);
    const first = matchRedirect(rules, probe);
    assert.ok(first);
    assert.equal(matchRedirect(rules, pathOf(redirectTarget(first, probe))), null);
  }
});

test("slash pairs: every non-splat source has its twin with the same destination", () => {
  const plain = rules.filter((r) => !r.splat);
  for (const r of plain) {
    const twin = r.from.endsWith("/") ? r.from.slice(0, -1) : `${r.from}/`;
    const other = plain.find((x) => x.from === twin);
    assert.ok(other, `${r.from} has no ${twin}`);
    assert.equal(other.to, r.to);
    assert.equal(other.status, r.status);
  }
});

test("no rule shadows a live page; the services routes are gone", () => {
  const pages = sitePages();
  for (const r of rules.filter((x) => !x.splat)) {
    assert.equal(pages.has(r.from.length > 1 ? r.from.replace(/\/$/, "") : r.from), false, r.from);
  }
  assert.equal(existsSync("app/services"), false);
});

test("coverage: every service slug lands on /experiences; locale prefixes and other paths match nothing", () => {
  for (const slug of ["helicopter-transfers", ...serviceSlugs]) {
    const r = matchRedirect(rules, `/services/${slug}`);
    assert.ok(r, slug);
    assert.equal(pathOf(r.to), "/en/experiences");
  }
  for (const p of ["/ar/services", "/es/services", "/en/services", "/en/experiences", "/services-x", "/"]) {
    assert.equal(matchRedirect(rules, p), null, p);
  }
  assert.equal(matchRedirect(rules, "/services/"), rules.find((r) => r.from === "/services/"), "the exact rule wins before the splat");
});

test("resolveInOut: rule, rule-broken, and the old answers without a rules file", () => {
  const dir = mkdtempSync(join(tmpdir(), "almar-redirects-"));
  writeFileSync(join(dir, "experiences.html"), "<html></html>");
  assert.equal(resolveInOut(dir, "/experiences"), "ok");
  assert.equal(resolveInOut(dir, "/experiences/"), "redirect");
  assert.equal(resolveInOut(dir, "/nope"), "missing");
  const withRules = mkdtempSync(join(tmpdir(), "almar-redirects-"));
  writeFileSync(join(withRules, "experiences.html"), "<html></html>");
  writeFileSync(
    join(withRules, "_redirects"),
    "/a /experiences?type=service 301\n/b /missing 301\n/c /a 301\n",
  );
  assert.equal(resolveInOut(withRules, "/a"), "rule");
  assert.equal(resolveInOut(withRules, "/b"), "rule-broken");
  assert.equal(resolveInOut(withRules, "/c"), "rule-broken");
  assert.equal(resolveInOut(withRules, "/experiences"), "ok");
});
