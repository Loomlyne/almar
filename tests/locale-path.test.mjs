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
const PATHS = ["/", "/private-stays", STAY, "/blog", "/blog/why-medellin-is-redefining-luxury-travel"];

test("localePath: English is prefixed too (job 21)", () => {
  assert.equal(localePath("en", "/"), "/en/");
  assert.equal(localePath("en", "/about"), "/en/about");
  for (const p of PATHS) assert.equal(localePath("en", p), p === "/" ? "/en/" : `/en${p}`);
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
    "/en",
    "/en/",
    "/en/about",
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
  assert.deepEqual(stripLocale("/en/"), { locale: "en", path: "/" });
  assert.deepEqual(stripLocale("/en"), { locale: "en", path: "/" });
  assert.deepEqual(stripLocale("/en/private-stays/"), { locale: "en", path: "/private-stays" });
  // An unprefixed path (an old address) still reads as English.
  assert.deepEqual(stripLocale("/"), { locale: "en", path: "/" });
  assert.deepEqual(stripLocale("/private-stays/"), { locale: "en", path: "/private-stays" });
  assert.deepEqual(stripLocale("/english"), { locale: "en", path: "/english" });
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
  assert.equal(switchLocalePath("/en/private-stays/x", "ar"), "/ar/private-stays/x");
  assert.equal(switchLocalePath("/private-stays/x", "ar"), "/ar/private-stays/x");
  assert.equal(switchLocalePath("/es/", "en"), "/en/");
});

test("localeHrefs gives the three URLs of one page", () => {
  assert.deepEqual(localeHrefs("/"), { en: "/en/", ar: "/ar/", es: "/es/" });
  assert.deepEqual(localeHrefs("/private-stays"), {
    en: "/en/private-stays",
    ar: "/ar/private-stays",
    es: "/es/private-stays",
  });
  assert.deepEqual(localeHrefs("/contact"), { en: "/en/contact", ar: "/ar/contact", es: "/es/contact" });
});

test("matchPublicPage matches the five patterns and one [a-z0-9-] segment", () => {
  assert.equal(matchPublicPage("/"), "/");
  assert.equal(matchPublicPage("/private-stays"), "/private-stays");
  assert.equal(matchPublicPage(STAY), "/private-stays/[stay]");
  assert.equal(matchPublicPage("/about"), "/about");
  assert.equal(matchPublicPage("/contact"), "/contact");
  for (const p of [
    "/private-stays/a/b",
    "/about/x",
    "/aboutus",
    "/contacts",
    "/private-stays/Bad_Slug",
    "/private-stays/",
    "/ar",
  ]) {
    assert.equal(matchPublicPage(p), null, p);
  }
  assert.equal(matchPublicPage("/blog/why-medellin-is-redefining-luxury-travel"), "/blog/[post]");
  assert.equal(matchPublicPage("/blog/a/b"), null);
  assert.equal(siteHref("ar", "/blog"), "/ar/blog");
  assert.deepEqual([...PUBLIC_PAGES], [
    "/",
    "/private-stays",
    "/private-stays/[stay]",
    "/about",
    "/contact",
    "/blog",
    "/blog/[post]",
    "/destinations",
    "/experiences",
    "/booking/trip",
    "/bookings/trip",
    "/legal/[legal]",
  ]);
});

test("a legal page is a public page in every locale (plan 06-04)", () => {
  assert.equal(matchPublicPage("/legal/privacy"), "/legal/[legal]");
  assert.equal(matchPublicPage("/legal/booking-terms"), "/legal/[legal]");
  assert.equal(matchPublicPage("/legal"), null);
  assert.equal(siteHref("es", "/legal/privacy"), "/es/legal/privacy");
});

test("/bookings/trip is a public page in every locale (plan 04-05 Task 5); /bookings itself stays a guest page", () => {
  assert.equal(matchPublicPage("/bookings/trip"), "/bookings/trip");
  assert.equal(matchPublicPage("/bookings"), null);
  assert.equal(matchPublicPage("/bookings/trip/x"), null);
  assert.equal(siteHref("ar", "/bookings/trip?ref=ALMAR-TEST22"), "/ar/bookings/trip?ref=ALMAR-TEST22");
  assert.equal(siteHref("en", "/bookings/trip?ref=ALMAR-TEST22"), "/en/bookings/trip?ref=ALMAR-TEST22");
  assert.deepEqual(localeHrefs("/bookings/trip"), {
    en: "/en/bookings/trip",
    ar: "/ar/bookings/trip",
    es: "/es/bookings/trip",
  });
  const o = "https://almarprivatejourney.com";
  assert.equal(localeAlternates("es", "/bookings/trip").canonical, `${o}/es/bookings/trip`);
  assert.equal(localeAlternates("ar", "/bookings/trip").languages["x-default"], `${o}/en/bookings/trip`);
  assert.equal(localeAlternates("en", "/bookings/trip").languages.ar, `${o}/ar/bookings/trip`);
});

test("/booking/trip is a public page in every locale (plan 04-03, Q-06); /booking and a deeper path are not", () => {
  assert.equal(matchPublicPage("/booking/trip"), "/booking/trip");
  assert.equal(matchPublicPage("/booking"), null);
  assert.equal(matchPublicPage("/booking/trip/x"), null);
  assert.equal(siteHref("ar", "/booking/trip?stay=x"), "/ar/booking/trip?stay=x");
  assert.equal(siteHref("en", "/booking/trip?stay=x"), "/en/booking/trip?stay=x");
  assert.deepEqual(localeHrefs("/booking/trip"), {
    en: "/en/booking/trip",
    ar: "/ar/booking/trip",
    es: "/es/booking/trip",
  });
  const o = "https://almarprivatejourney.com";
  assert.equal(localeAlternates("es", "/booking/trip").canonical, `${o}/es/booking/trip`);
  assert.equal(localeAlternates("ar", "/booking/trip").languages["x-default"], `${o}/en/booking/trip`);
});

test("/destinations is a public page in every locale; a destination slug under it is not", () => {
  assert.equal(matchPublicPage("/destinations"), "/destinations");
  assert.equal(matchPublicPage("/destinations/cartagena"), null);
  assert.equal(siteHref("ar", "/destinations"), "/ar/destinations");
  assert.equal(siteHref("es", "/destinations"), "/es/destinations");
  assert.equal(siteHref("en", "/destinations"), "/en/destinations");
  assert.deepEqual(localeHrefs("/destinations"), {
    en: "/en/destinations",
    ar: "/ar/destinations",
    es: "/es/destinations",
  });
  assert.equal(siteHref("ar", "/login"), "/ar/login");
});

test("/experiences is a public page in every locale; a slug under it is not; /contact is localised (slice 3A)", () => {
  assert.equal(matchPublicPage("/experiences"), "/experiences");
  assert.equal(matchPublicPage("/experiences/x"), null);
  assert.equal(siteHref("ar", "/experiences"), "/ar/experiences");
  assert.equal(siteHref("en", "/experiences"), "/en/experiences");
  assert.equal(
    siteHref("es", "/experiences?type=service&item=vip-airport-meet-greet"),
    "/es/experiences?type=service&item=vip-airport-meet-greet",
  );
  assert.equal(siteHref("ar", "/contact"), "/ar/contact");
});

test("siteHref localises only pages that exist in every locale", () => {
  assert.equal(siteHref("ar", "/private-stays"), "/ar/private-stays");
  assert.equal(siteHref("ar", "/about"), "/ar/about");
  assert.equal(siteHref("es", "/contact"), "/es/contact");
  assert.equal(siteHref("en", "/about"), "/en/about");
  assert.equal(siteHref("ar", "/contact#inquiry"), "/ar/contact#inquiry");
  assert.equal(siteHref("ar", "/blog"), "/ar/blog");
  assert.equal(siteHref("ar", "/destinations"), "/ar/destinations");
  assert.equal(siteHref("ar", "/login"), "/ar/login");
  assert.equal(siteHref("es", "/account"), "/es/account");
  assert.equal(siteHref("en", "/bookings"), "/en/bookings");
  assert.equal(siteHref("ar", "/bookings/abc"), "/ar/bookings/abc");
  assert.equal(siteHref("ar", "/login?next=%2Faccount"), "/ar/login?next=%2Faccount");
  assert.equal(siteHref("ar", "/auth/confirm"), "/auth/confirm");
  assert.equal(siteHref("es", "/"), "/es/");
  assert.equal(siteHref("en", "/"), "/en/");
  assert.equal(siteHref("ar", "/private-stays#filters"), "/ar/private-stays#filters");
});

test("absoluteLocaleUrl is the origin plus the served form", () => {
  assert.equal(absoluteLocaleUrl("en", "/"), "https://almarprivatejourney.com/en/");
  assert.equal(absoluteLocaleUrl("ar", "/"), "https://almarprivatejourney.com/ar/");
  assert.equal(absoluteLocaleUrl("es", "/private-stays"), "https://almarprivatejourney.com/es/private-stays");
});

test("localeAlternates: canonical plus four alternates, x-default is English", () => {
  const o = "https://almarprivatejourney.com";
  assert.deepEqual(localeAlternates("ar", "/private-stays"), {
    canonical: `${o}/ar/private-stays`,
    languages: {
      en: `${o}/en/private-stays`,
      ar: `${o}/ar/private-stays`,
      es: `${o}/es/private-stays`,
      "x-default": `${o}/en/private-stays`,
    },
  });
  const home = localeAlternates("es", "/");
  assert.equal(home.canonical, `${o}/es/`);
  assert.equal(home.languages.ar, `${o}/ar/`);
  assert.equal(home.languages["x-default"], `${o}/en/`);
  assert.deepEqual(localeAlternates("ar", "/about"), {
    canonical: `${o}/ar/about`,
    languages: {
      en: `${o}/en/about`,
      ar: `${o}/ar/about`,
      es: `${o}/es/about`,
      "x-default": `${o}/en/about`,
    },
  });
  assert.throws(() => localeAlternates("en", "/login"));
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
