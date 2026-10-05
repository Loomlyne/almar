// The /services redirect contract (plan 03.3-12, design 5.2): public/_redirects holds exactly 9 rules, each
// well formed, 301, same-origin, one hop. Cloudflare runs redirects before asset matching, so a rule that
// shadows a live page would silently hide it: that is checked here too.
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
  resolveInOut,
  sitePages,
} from "./helpers/site-links.mjs";

const EXPECTED = [
  ["/services", "/experiences?type=service", 301],
  ["/services/", "/experiences?type=service", 301],
  ["/services/24-7-private-concierge", "/experiences?type=service&item=24-7-private-concierge", 301],
  ["/services/24-7-private-concierge/", "/experiences?type=service&item=24-7-private-concierge", 301],
  ["/services/luxury-ground-transport", "/experiences?type=service&item=luxury-ground-transport", 301],
  ["/services/luxury-ground-transport/", "/experiences?type=service&item=luxury-ground-transport", 301],
  ["/services/vip-airport-meet-greet", "/experiences?type=service&item=vip-airport-meet-greet", 301],
  ["/services/vip-airport-meet-greet/", "/experiences?type=service&item=vip-airport-meet-greet", 301],
  ["/services/*", "/experiences?type=service", 301],
];

const { rules, errors } = readRedirects();
const catalog = JSON.parse(readFileSync("lib/data/fixtures/catalog.json", "utf8"));
const serviceSlugs = catalog.filter((r) => r.kind === "service").map((r) => r.slug);
const pathOf = (to) => new URL(to, SITE).pathname;

test("public/_redirects: no errors and exactly the 9 rules of design 5.2, in order", () => {
  assert.deepEqual(errors, []);
  assert.deepEqual(rules.map((r) => [r.from, r.to, r.status]), EXPECTED);
  assert.deepEqual(rules.filter((r) => r.splat).map((r) => r.from), ["/services/*"]);
  assert.equal(rules.at(-1).splat, true, "the splat rule is last");
  assert.equal(new Set(rules.map((r) => r.from)).size, rules.length, "no source repeats");
  assert.equal(rules.every((r) => r.status === 301), true);
});

test("public/_redirects: LF only, trailing newline, no BOM", () => {
  const text = readFileSync(REDIRECTS_FILE, "utf8");
  assert.equal(text.endsWith("\n"), true);
  assert.equal(text.includes("\r"), false);
  assert.equal(text.charCodeAt(0) === 0xfeff, false);
  assert.equal(text.endsWith("/services/* /experiences?type=service 301\n"), true);
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
});

test("destinations: same origin, a real page, only type and item, item is a service row", () => {
  const pages = sitePages();
  for (const r of rules) {
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
    assert.equal(matchRedirect(rules, pathOf(r.to)), null, r.to);
    const first = matchRedirect(rules, r.from.replace(/\*$/, "x"));
    assert.ok(first);
    assert.equal(matchRedirect(rules, pathOf(first.to)), null);
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
    assert.equal(pathOf(r.to), "/experiences");
  }
  for (const p of ["/ar/services", "/es/services", "/experiences", "/services-x", "/"]) {
    assert.equal(matchRedirect(rules, p), null, p);
  }
  assert.equal(matchRedirect(rules, "/services/"), rules[1], "the exact rule wins before the splat");
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
