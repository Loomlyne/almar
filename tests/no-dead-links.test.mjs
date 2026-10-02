import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// Job 04 item 11: no Framer page links to a path that has no route.
const SITE = "https://almarprivatejourney.com";

// Hidden by job 04 (owner, 2026-10-02): must never be linked again.
const HIDDEN = [
  "/legal/privacy-policy",
  "/legal/booking-terms",
  "/legal/disclaimer",
  "/legal/liability-waiver",
  "/legal/terms-of-service",
  "/private-stays/baru-house",
  "/private-stays/corona-island",
  "/private-stays/yury-house-cartagena",
];

// Card links that answer 404 today. Owner, 2026-10-02 (job 04): list them, fix later, when
// Phases 3.3 and 6 replace these Framer pages. Remove an entry once it has a route or no link.
const KNOWN_DEAD = [
  ...["bogota", "cartagena", "cocora-valley", "eje-cafetero", "medellin", "san-andres", ":Xe5Bq7q06"].map(
    (slug) => `/destinations/${slug}`,
  ),
  ...[
    "amazon-rainforest-expedition", "artisan-workshop-experiences", "bogota-art-gastronomy",
    "cartagena-heritage-tours", "cartagena-historic-center-house", "cartagena-night-experience",
    "coffee-hacienda-experiences", "coffee-region-immersion", "getsemani-colonial-house",
    "getsemani-courtyard-residence", "gourmet-food-tours", "helicopter-city-tours",
    "highland-trekking-experiences", "hot-air-balloon-coffee-region", "medellin-discovery-tours",
    "medellin-renaissance", "mountain-adventure-excursions", "pastry-dessert-masterclass",
    "private-beach-experiences", "private-ceremony-colombia", "private-museum-experiences",
    "private-picnic-experiences", "private-surfing-lessons", "rosario-islands-escape",
    "rural-farm-nature-visits", "san-andres-diving-escape", "scuba-diving-expeditions",
    "snorkeling-adventures", "sunrise-yoga-wellness-retreats", "tayrona-coastal-escape",
    "traditional-cooking-classes", "truffle-foraging-experiences", "vip-cultural-access",
    "vip-dinner-show-experiences", "welcome-cocktail", "wellness-yoga-retreat",
    "wine-spirits-tastings", "yacht-island-charters",
  ].map((slug) => `/experiences/${slug}`),
  ...[
    "helicopter-transfers", "in-villa-private-chef", "personal-security-detail", "pop-up-bar-experiences",
    "pop-up-cinema-at-your-villa", "private-city-guides", "wellness-spa-coordination",
  ].map((slug) => `/services/${slug}`),
];

function framerRoutes(dir = "app", out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) framerRoutes(path, out);
    else if (name === "route.ts" && readFileSync(path, "utf8").includes('const HTML = "')) out.push(path);
  }
  return out;
}

const pagePath = (file) => "/" + file.replace(/^app\/?/, "").replace(/\/?route\.ts$/, "");
const routes = framerRoutes();
const pages = new Set(routes.map(pagePath));
const hasRoute = (path) => pages.has(path) || (existsSync(join("public", path)) && statSync(join("public", path)).isFile());

// path -> pages that link to it, for every internal link with no route
const dead = new Map();
for (const file of routes) {
  const { GET } = await import(pathToFileURL(file).href);
  const html = await GET().text();
  for (const [, href] of html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)) {
    if (/^(mailto:|tel:|#)/.test(href)) continue;
    const url = new URL(href.replaceAll("&amp;", "&"), SITE + pagePath(file));
    if (url.origin !== SITE) continue;
    const path = url.pathname === "/" ? "/" : url.pathname.replace(/\/$/, "");
    if (!hasRoute(path)) dead.set(path, [...(dead.get(path) ?? []), pagePath(file)]);
  }
}

test("there are Framer pages to check", () => {
  assert.equal(routes.length, 26);
});

test("no page links to the paths hidden by job 04", () => {
  assert.deepEqual(HIDDEN.filter((path) => dead.has(path)), []);
});

test("every link without a route is a known one", () => {
  const unknown = [...dead].filter(([path]) => !KNOWN_DEAD.includes(path)).map(([path, from]) => `${path} (from ${from[0]})`);
  assert.deepEqual(unknown, []);
});

test("every known dead link is still linked and still has no route", () => {
  assert.deepEqual(KNOWN_DEAD.filter((path) => !dead.has(path)), []);
});

// Job 04 follow-up (owner, 2026-10-02): the footer link labelled "Contact" (container
// framer-1pmr5p9-container) points at /contact and stays visible, so "Connect" keeps a link.
const CONTACT_CONTAINER = "framer-1pmr5p9-container";
const STILL_HIDDEN = [
  "framer-1kw8qb8-container", "framer-b3mz9f-container", "framer-u4mwsj-container", "framer-1lnpq0j-container",
  "framer-ng404t-container", "framer-19ainfs-container", "framer-vs5r6w-container",
];
const footerPages = routes.filter((file) => readFileSync(file, "utf8").includes(`<div class=\\"${CONTACT_CONTAINER}\\">`));

test("the footer Contact link is on 20 pages, 3 breakpoint copies each, all pointing at /contact", () => {
  assert.equal(footerPages.length, 20);
  let total = 0;
  for (const file of footerPages) {
    const src = readFileSync(file, "utf8");
    const anchors = [...src.matchAll(new RegExp(`<div class=\\\\"${CONTACT_CONTAINER}\\\\"><!--\\$--><a ([^>]*)>`, "g"))];
    assert.equal(anchors.length, 3, file);
    for (const [, attrs] of anchors) assert.match(attrs, /(^|\s)href=\\"\/contact\\"/, file);
    total += anchors.length;
  }
  assert.equal(total, 60);
});

test("the hide rule lists the other seven footer links and not the Contact one", () => {
  for (const file of footerPages) {
    const rules = [...readFileSync(file, "utf8").matchAll(/((?:\.framer-[a-z0-9]+-container,?)+)\{display:none!important\}/gi)];
    assert.equal(rules.length, 1, file);
    assert.deepEqual(rules[0][1].split(",").map((c) => c.slice(1)), STILL_HIDDEN, file);
  }
});

test("/contact is a real route", () => {
  assert.ok(hasRoute("/contact"));
});
