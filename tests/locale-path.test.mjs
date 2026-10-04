import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  LOCALES,
  PUBLIC_PAGES,
  absoluteLocaleUrl,
  isLocale,
  localeAlternates,
  localeDir,
  localeHrefs,
  localePath,
  matchPublicPage,
  siteHref,
  stripLocale,
  switchLocalePath,
} from "../lib/locale-path.ts";

const STAY = "/private-stays/getsemani-colonial-house";
const PATHS = ["/", "/private-stays", STAY];

test("localePath: English is unchanged", () => {
  for (const p of PATHS) assert.equal(localePath("en", p), p);
});

test("localePath: a locale home keeps its trailing slash", () => {
  assert.equal(localePath("ar", "/"), "/ar/");
  assert.equal(localePath("es", "/"), "/es/");
});

test("localePath: a page has no trailing slash", () => {
  assert.equal(localePath("ar", "/private-stays"), "/ar/private-stays");
  assert.equal(localePath("es", STAY), `/es${STAY}`);
});

test("localePath throws on anything that is not a plain unprefixed site path", () => {
  const bad = [
    "private-stays",
    "//evil.example",
    "https://evil.example/",
    "/x//y",
    "/x\\y",
    "/x?y=1",
    "/x#y",
    "/private-stays/",
    "/ar/x",
    "/ar/",
    "/ar",
    "/es",
    "/es/private-stays",
    "",
  ];
  for (const p of bad) assert.throws(() => localePath("ar", p), `${JSON.stringify(p)} must throw`);
  assert.throws(() => localePath("fr", "/"));
});

test("stripLocale handles prefixes with and without a trailing slash", () => {
  assert.deepEqual(stripLocale("/ar/"), { locale: "ar", path: "/" });
  assert.deepEqual(stripLocale("/ar"), { locale: "ar", path: "/" });
  assert.deepEqual(stripLocale("/ar/private-stays"), { locale: "ar", path: "/private-stays" });
  assert.deepEqual(stripLocale("/ar/private-stays/"), { locale: "ar", path: "/private-stays" });
  assert.deepEqual(stripLocale("/es/private-stays/x"), { locale: "es", path: "/private-stays/x" });
  assert.deepEqual(stripLocale("/"), { locale: "en", path: "/" });
  assert.deepEqual(stripLocale("/private-stays/"), { locale: "en", path: "/private-stays" });
  assert.deepEqual(stripLocale("/arabic"), { locale: "en", path: "/arabic" });
  assert.deepEqual(stripLocale("/esx/y"), { locale: "en", path: "/esx/y" });
});

test("round trip: stripLocale inverts localePath for every locale and path", () => {
  for (const l of LOCALES) {
    for (const p of PATHS) {
      const url = localePath(l, p);
      assert.deepEqual(stripLocale(url), { locale: l, path: p });
      const back = stripLocale(url);
      assert.equal(localePath(back.locale, back.path), url);
    }
  }
});

test("switchLocalePath rebuilds the current page in another language", () => {
  assert.equal(switchLocalePath("/ar/private-stays", "es"), "/es/private-stays");
  assert.equal(switchLocalePath("/private-stays/x", "ar"), "/ar/private-stays/x");
  assert.equal(switchLocalePath("/es/", "en"), "/");
});

test("localeHrefs gives the three URLs of one page", () => {
  assert.deepEqual(localeHrefs("/"), { en: "/", ar: "/ar/", es: "/es/" });
  assert.deepEqual(localeHrefs("/private-stays"), {
    en: "/private-stays",
    ar: "/ar/private-stays",
    es: "/es/private-stays",
  });
});

test("matchPublicPage matches the three patterns and one [a-z0-9-] segment", () => {
  assert.equal(matchPublicPage("/"), "/");
  assert.equal(matchPublicPage("/private-stays"), "/private-stays");
  assert.equal(matchPublicPage(STAY), "/private-stays/[stay]");
  for (const p of ["/private-stays/a/b", "/about", "/private-stays/Bad_Slug", "/private-stays/", "/ar"]) {
    assert.equal(matchPublicPage(p), null, p);
  }
  assert.deepEqual([...PUBLIC_PAGES], ["/", "/private-stays", "/private-stays/[stay]", "/destinations", "/experiences"]);
});

test("/destinations is a public page in every locale; a destination slug under it is not", () => {
  assert.equal(matchPublicPage("/destinations"), "/destinations");
  assert.equal(matchPublicPage("/destinations/cartagena"), null);
  assert.equal(siteHref("ar", "/destinations"), "/ar/destinations");
  assert.equal(siteHref("es", "/destinations"), "/es/destinations");
  assert.equal(siteHref("en", "/destinations"), "/destinations");
  assert.deepEqual(localeHrefs("/destinations"), {
    en: "/destinations",
    ar: "/ar/destinations",
    es: "/es/destinations",
  });
  assert.equal(siteHref("ar", "/about"), "/about");
});

test("/experiences is a public page in every locale; a slug under it is not; /contact stays English-only", () => {
  assert.equal(matchPublicPage("/experiences"), "/experiences");
  assert.equal(matchPublicPage("/experiences/x"), null);
  assert.equal(siteHref("ar", "/experiences"), "/ar/experiences");
  assert.equal(siteHref("en", "/experiences"), "/experiences");
  assert.equal(
    siteHref("es", "/experiences?type=service&item=vip-airport-meet-greet"),
    "/es/experiences?type=service&item=vip-airport-meet-greet",
  );
  assert.equal(siteHref("ar", "/contact"), "/contact");
});

test("siteHref localises only pages that exist in every locale", () => {
  assert.equal(siteHref("ar", "/private-stays"), "/ar/private-stays");
  assert.equal(siteHref("ar", "/about"), "/about");
  assert.equal(siteHref("es", "/contact"), "/contact");
  assert.equal(siteHref("en", "/about"), "/about");
  assert.equal(siteHref("es", "/"), "/es/");
  assert.equal(siteHref("ar", "/private-stays#filters"), "/ar/private-stays#filters");
});

test("absoluteLocaleUrl is the origin plus the served form", () => {
  assert.equal(absoluteLocaleUrl("en", "/"), "https://almarprivatejourney.com/");
  assert.equal(absoluteLocaleUrl("ar", "/"), "https://almarprivatejourney.com/ar/");
  assert.equal(absoluteLocaleUrl("es", "/private-stays"), "https://almarprivatejourney.com/es/private-stays");
});

test("localeAlternates: canonical plus four alternates, x-default is English", () => {
  const o = "https://almarprivatejourney.com";
  assert.deepEqual(localeAlternates("ar", "/private-stays"), {
    canonical: `${o}/ar/private-stays`,
    languages: {
      en: `${o}/private-stays`,
      ar: `${o}/ar/private-stays`,
      es: `${o}/es/private-stays`,
      "x-default": `${o}/private-stays`,
    },
  });
  const home = localeAlternates("es", "/");
  assert.equal(home.canonical, `${o}/es/`);
  assert.equal(home.languages.ar, `${o}/ar/`);
  assert.equal(home.languages["x-default"], `${o}/`);
  assert.throws(() => localeAlternates("en", "/about"));
});

test("isLocale and localeDir", () => {
  assert.equal(isLocale("ar"), true);
  for (const v of ["fr", "", undefined, null, 1]) assert.equal(isLocale(v), false);
  assert.equal(localeDir("ar"), "rtl");
  assert.equal(localeDir("en"), "ltr");
  assert.equal(localeDir("es"), "ltr");
});

test("lib/locale-path.ts has no value import (plain Node must load it)", () => {
  const src = readFileSync(new URL("../lib/locale-path.ts", import.meta.url), "utf8");
  const bad = src.split("\n").filter((line) => /^import /.test(line) && !/^import type /.test(line));
  assert.deepEqual(bad, []);
});
