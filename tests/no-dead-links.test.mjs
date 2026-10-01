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
