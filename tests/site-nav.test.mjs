// lib/site-nav.ts and scripts/write-site-nav.mjs (plan 06-02, CMS-09, F-15): the committed snapshot is today's links,
// Login is never a link, every internal key resolves in every language, an external link is marked, and a link to a page
// that is not on the site yet stays out of the snapshot. Written, not run (owner rule, 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";
import { snapshotFromRows } from "../scripts/write-site-nav.mjs";

const nav = await loadTs("lib/site-nav.ts");
const { PUBLIC_PAGES } = await loadTs("lib/locale-path.ts");
const LOCALES = ["en", "ar", "es"];

test("the committed snapshot deep-equals defaultNavSnapshot(): today's four links, header and footer, EN/AR/ES", () => {
  const committed = JSON.parse(readFileSync("lib/data/site-nav.snapshot.json", "utf8"));
  assert.deepEqual(committed, nav.defaultNavSnapshot());
  assert.deepEqual(committed.header.en.map((l) => l.href), ["/en/destinations", "/en/experiences", "/en/about", "/en/contact"]);
  assert.deepEqual(committed.footer, committed.header);
});

test("navLinks never returns a Login item, in any area or language", () => {
  for (const area of ["header", "footer"]) {
    for (const locale of LOCALES) {
      for (const link of nav.navLinks(area, locale)) assert.doesNotMatch(link.href, /\/login\b/, `${area} ${locale}`);
    }
  }
});

test("every NAV_TARGETS key and journey:<slug> resolves to a locale address in all three languages", () => {
  for (const key of [...nav.NAV_TARGET_KEYS, "journey:the-explorer"]) {
    for (const locale of LOCALES) {
      const item = nav.navItem(locale, { link_kind: "internal", target: key, label: "x" });
      assert.ok(item.href.startsWith(`/${locale}`), `${key} ${locale}: ${item.href}`);
      assert.equal("external" in item, false);
    }
  }
  assert.equal(nav.navItem("en", { link_kind: "internal", target: "home", label: "x" }).href, "/en/");
  assert.throws(() => nav.navItem("en", { link_kind: "internal", target: "login", label: "x" }));
  assert.equal(nav.isNavTarget("login"), false);
  assert.equal(nav.isNavTarget("journey:Bad_Slug"), false);
});

test("an external link keeps its https address and is marked external", () => {
  const item = nav.navItem("ar", { link_kind: "external", target: "https://example.com/a", label: "x" });
  assert.deepEqual(item, { label: "x", href: "https://example.com/a", external: true });
});

test("targetAvailable: a page is available only once it is on the site", () => {
  const today = { pages: PUBLIC_PAGES, legal: [], packages: [] };
  assert.equal(nav.targetAvailable("about", today), true);
  assert.equal(nav.targetAvailable("list-with-us", { ...today, pages: PUBLIC_PAGES.filter((p) => p !== "/list-with-us") }), false);
  assert.equal(nav.targetAvailable("list-with-us", today), true, "plan 06-05: the page is on the site");
  const legalRoute = [...PUBLIC_PAGES, "/legal/[legal]"];
  assert.equal(nav.targetAvailable("legal-privacy", { ...today, pages: legalRoute }), false, "route without the published page");
  assert.equal(nav.targetAvailable("legal-privacy", { ...today, legal: ["privacy"] }), false, "published page without the route");
  assert.equal(nav.targetAvailable("legal-privacy", { pages: legalRoute, legal: ["privacy"], packages: [] }), true);
  const journeyRoute = [...PUBLIC_PAGES, "/journeys/[journey]"];
  assert.equal(nav.targetAvailable("journey:the-explorer", { pages: journeyRoute, legal: [], packages: [] }), false);
  assert.equal(nav.targetAvailable("journey:the-explorer", { pages: journeyRoute, legal: [], packages: ["the-explorer"] }), true);
  assert.equal(nav.targetAvailable("nope", today), false);
});

test("the snapshot writer drops a link whose page is not on the site, sorts by position, falls back to English", async () => {
  const mod = { ...nav };
  const built = { pages: PUBLIC_PAGES, legal: [], packages: [] };
  const links = [
    { id: "b", area: "header", position: 2, link_kind: "internal", target: "about" },
    { id: "a", area: "header", position: 1, link_kind: "internal", target: "destinations" },
    { id: "c", area: "header", position: 3, link_kind: "internal", target: "list-with-us" },
    { id: "d", area: "footer", position: 1, link_kind: "external", target: "https://example.com" },
  ];
  const translations = [
    { link_id: "a", locale: "en", status: "published", label: "Destinations" },
    { link_id: "a", locale: "ar", status: "published", label: "الوجهات" },
    { link_id: "b", locale: "en", status: "published", label: "About" },
    { link_id: "b", locale: "es", status: "draft", label: "[draft]" },
    { link_id: "c", locale: "en", status: "published", label: "List with us" },
    { link_id: "d", locale: "en", status: "published", label: "Partner" },
  ];
  const out = snapshotFromRows(mod, { links, translations, built });
  assert.deepEqual(out.header.en.map((l) => l.label), ["Destinations", "About"]);
  assert.equal(out.header.ar[0].label, "الوجهات");
  assert.equal(out.header.es[1].label, "About", "a draft Spanish label falls back to English");
  assert.deepEqual(out.footer.es, [{ label: "Partner", href: "https://example.com", external: true }]);
});

test("the snapshot writer leaves out a link with a draft English label, with a warning, and the build goes on", () => {
  const built = { pages: PUBLIC_PAGES, legal: [], packages: [] };
  const links = [
    { id: "a", area: "header", position: 1, link_kind: "internal", target: "destinations" },
    { id: "b", area: "header", position: 2, link_kind: "internal", target: "about" },
  ];
  const translations = [
    { link_id: "a", locale: "en", status: "draft", label: "Destinations" },
    { link_id: "b", locale: "en", status: "published", label: "About" },
  ];
  const warned = [];
  const out = snapshotFromRows({ ...nav }, { links, translations, built }, (line) => warned.push(line));
  for (const locale of ["en", "ar", "es"]) assert.deepEqual(out.header[locale].map((l) => l.label), ["About"]);
  assert.equal(warned.length, 1);
  assert.match(warned[0], /link a left out/);
});
