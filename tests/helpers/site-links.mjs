import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { matchPublicPage, stripLocale } from "../../lib/locale-path.ts";
import { isLivePost } from "../../scripts/post-live.mjs";

// Shared by tests/no-dead-links.test.mjs (Framer HTML, in source) and tests/build/assembled-site.test.mjs
// (every document in out/). One list of hidden and known-dead paths, in one place.

// Job 04 item 11: no Framer page links to a path that has no route.
export const SITE = "https://almarprivatejourney.com";

// Hidden by job 04 (owner, 2026-10-02): must never be linked again.
export const HIDDEN = [
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
export const KNOWN_DEAD = [
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

/**
 * The three KNOWN_DEAD entries that were linked only from the 12 Framer stay pages. When those pages become
 * React pages (3.3 plan 06) they stop being linked, and the "still linked" test exempts them.
 */
export const RETIRES_WITH_STAY_PAGES = [
  "/experiences/getsemani-colonial-house",
  "/experiences/getsemani-courtyard-residence",
  "/experiences/cartagena-historic-center-house",
];

/** A locale-prefixed href is looked up against the English literals, so the lists are not tripled. */
export const deadKey = (path) => stripLocale(path).path;

/** Route handler files that still serve a Framer export. */
export function framerRoutes(dir = "app", out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) framerRoutes(path, out);
    else if (name === "route.ts" && readFileSync(path, "utf8").includes('const HTML = "')) out.push(path);
  }
  return out;
}

export const framerPagePath = (file) => "/" + file.replace(/^app\/?/, "").replace(/\/?route\.ts$/, "");

function pageFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) pageFiles(path, out);
    else if (name === "page.tsx") out.push(path);
  }
  return out;
}

function stayRows() {
  const data = JSON.parse(readFileSync("lib/data/fixtures/stays.json", "utf8"));
  const rows = Array.isArray(data) ? data : Object.values(data).find(Array.isArray);
  if (!rows) throw new Error("lib/data/fixtures/stays.json holds no array of stays");
  return rows;
}

function postRows() {
  const rows = JSON.parse(readFileSync("lib/data/fixtures/posts.json", "utf8"));
  if (!Array.isArray(rows)) throw new Error("lib/data/fixtures/posts.json holds no array of posts");
  // Published and dated now or earlier, as lib/data/posts.ts decides: a scheduled post has no page yet.
  return rows.filter((row) => isLivePost(row));
}

/**
 * The URL of every React public page in every locale: page.tsx files under app/ whose English path matches a
 * PUBLIC_PAGES pattern, with route groups dropped and a [stay] segment expanded to every slug of the base
 * stays fixture and a [post] segment to every live slug (published, date reached) of the posts fixture (each read only when such a page
 * exists). Any other [param] on a public page throws.
 */
export function reactPublicRoutes() {
  const urls = [];
  for (const file of pageFiles("app")) {
    const segments = file
      .replace(/^app\/?/, "")
      .replace(/\/?page\.tsx$/, "")
      .split("/")
      .filter((s) => s !== "" && !/^\(.*\)$/.test(s));
    const shape = "/" + segments.join("/");
    const probe = "/" + segments.map((s) => (/^\[.+\]$/.test(s) ? "x" : s)).join("/");
    const pattern = stripLocale(probe).path;
    if (matchPublicPage(pattern) === null) continue;
    const params = segments.filter((s) => /^\[.+\]$/.test(s));
    for (const p of params) if (p !== "[stay]" && p !== "[post]") throw new Error(`no enumerator for ${p}`);
    if (params.length === 0) {
      urls.push(shape === "/ar" || shape === "/es" ? `${shape}/` : shape);
    } else {
      const rows = params[0] === "[post]" ? postRows() : stayRows();
      for (const row of rows) urls.push(shape.replace(params[0], row.slug));
    }
  }
  return urls.sort();
}

/** The English URLs only, for the "26 English pages" sum. */
export const englishReactRoutes = () => reactPublicRoutes().filter((p) => stripLocale(p).locale === "en");

/** What Cloudflare static assets (html_handling = auto-trailing-slash) does with a request path. */
export function resolveInOut(outDir, pathname) {
  const file = (rel) => existsSync(join(outDir, rel)) && statSync(join(outDir, rel)).isFile();
  if (pathname.endsWith("/")) {
    if (file(`${pathname.slice(1)}index.html`)) return "ok";
    if (pathname !== "/" && file(`${pathname.slice(1, -1)}.html`)) return "redirect";
    return "missing";
  }
  if (file(pathname.slice(1)) || file(`${pathname.slice(1)}.html`)) return "ok";
  if (file(`${pathname.slice(1)}/index.html`)) return "redirect";
  return "missing";
}
