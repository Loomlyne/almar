import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { matchPublicPage, stripLocale } from "../../lib/locale-path.ts";

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
  // No /destinations/<slug> entries: /destinations became React in plan 03.3-13 and its cards are not links.
  // No /experiences/<slug> entries: /experiences became React in plan 03.3-14, its cards open an overlay and are not links.
  // No /services entries: the seven slugs are answered by the `/services/*` rule of public/_redirects since
  // plan 03.3-12 (owner answer 1, D-64).
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

/**
 * The URL of every React public page in every locale: page.tsx files under app/ whose English path matches a
 * PUBLIC_PAGES pattern, with route groups dropped and a [stay] segment expanded to every slug of the base
 * stays fixture (read only when such a page exists). Any other [param] on a public page throws.
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
    for (const p of params) if (p !== "[stay]") throw new Error(`no enumerator for ${p}`);
    if (params.length === 0) {
      urls.push(shape === "/ar" || shape === "/es" ? `${shape}/` : shape);
    } else {
      for (const row of stayRows()) urls.push(shape.replace("[stay]", row.slug));
    }
  }
  return urls.sort();
}

/** The English URLs only, for the "26 English pages" sum. */
export const englishReactRoutes = () => reactPublicRoutes().filter((p) => stripLocale(p).locale === "en");

/** What Cloudflare static assets (html_handling = auto-trailing-slash) does with a request path; a `_redirects` rule in the folder is applied first, one hop (plan 03.3-12). */
export function resolveInOut(outDir, pathname) {
  const rules = outRules(outDir);
  const rule = matchRedirect(rules, pathname);
  if (rule) {
    const dest = new URL(rule.to, SITE).pathname;
    return matchRedirect(rules, dest) === null && resolveDocument(outDir, dest) === "ok" ? "rule" : "rule-broken";
  }
  return resolveDocument(outDir, pathname);
}

function resolveDocument(outDir, pathname) {
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

// ---- _redirects (plan 03.3-12) ---------------------------------------------------------------------------------

export const REDIRECTS_FILE = "public/_redirects";

/** Parses a Cloudflare `_redirects` text. Never throws; an error names its line number and the reason. */
export function parseRedirects(text) {
  const rules = [];
  const errors = [];
  text.split("\n").forEach((raw, i) => {
    const line = i + 1;
    const trimmed = raw.trim();
    if (trimmed === "" || trimmed.startsWith("#")) return;
    const fields = trimmed.split(/\s+/);
    const fail = (why) => errors.push(`line ${line}: ${why}`);
    if (fields.length !== 3) return fail(`expected 3 fields, found ${fields.length}`);
    const [from, to, code] = fields;
    const status = Number(code);
    if (code !== "301") return fail(`status must be 301, found ${code}`);
    if (!from.startsWith("/")) return fail("source must start with /");
    if (/[?#:]/.test(from)) return fail("source must not hold ?, # or :");
    const star = from.indexOf("*");
    if (star !== -1 && !(from.endsWith("/*") && star === from.length - 1)) return fail("* is only allowed as a final /*");
    if (!to.startsWith("/") || to.startsWith("//")) return fail("destination must be one same-origin path starting with a single /");
    if (/[*:]/.test(to)) return fail("destination must not hold * or :");
    rules.push({ line, from, to, status, splat: star !== -1 });
  });
  return { rules, errors };
}

/** Reads a `_redirects` file; a missing file is no rules. */
export function readRedirects(file = REDIRECTS_FILE) {
  if (!existsSync(file)) return { rules: [], errors: [] };
  return parseRedirects(readFileSync(file, "utf8"));
}

/** The FIRST rule whose source equals the path, or whose `/*` source is a strict prefix of it. */
export function matchRedirect(rules, pathname) {
  for (const r of rules) {
    if (r.splat) {
      const prefix = r.from.slice(0, -1);
      if (pathname.startsWith(prefix) && pathname.length > prefix.length) return r;
    } else if (r.from === pathname) return r;
  }
  return null;
}

const rulesByOut = new Map();
function outRules(outDir) {
  if (!rulesByOut.has(outDir)) rulesByOut.set(outDir, readRedirects(join(outDir, "_redirects")).rules);
  return rulesByOut.get(outDir);
}

const trimSlash = (p) => (p.length > 1 ? p.replace(/\/$/, "") : p);

/** Framer page paths plus every React public route, trailing slash dropped except "/". */
export function sitePages() {
  return new Set([...framerRoutes().map(framerPagePath), ...reactPublicRoutes().map(trimSlash)]);
}

/**
 * True when the path answers: a matching rule is followed first (redirects run before assets) and passes only if
 * its destination is a page or a public file and matches no rule (one hop); otherwise a page or a public file.
 */
export function hasRoute(path, { pages = sitePages(), rules = readRedirects().rules, publicDir = "public" } = {}) {
  const direct = (p) => pages.has(p) || (existsSync(join(publicDir, p)) && statSync(join(publicDir, p)).isFile());
  const rule = matchRedirect(rules, path);
  if (rule) {
    const dest = trimSlash(new URL(rule.to, SITE).pathname);
    return direct(dest) && matchRedirect(rules, dest) === null;
  }
  return direct(path);
}

/** English addresses the live site answered at job 04. History: it never grows. */
export const JOB_04_ADDRESSES = [
  "/", "/about", "/blog",
  "/blog/colombias-coffee-triangle-eje-cafetero",
  "/blog/discovering-cartagenas-hidden-colonial-courtyards",
  "/blog/why-medellin-is-redefining-luxury-travel",
  "/contact", "/destinations", "/experiences", "/private-stays",
  ...[
    "getsemani-colonial-house", "getsemani-courtyard-residence", "cartagena-historic-center-house",
    "baru-island-private-villa", "bocagrande-beach-house", "casa-jardin-san-diego",
    "casa-juliana-historic-center", "casa-mariana-historic-center", "private-island-cartagena",
    "private-island-estate-cartagena", "santa-fe-farm-antioquia", "sopetran-country-estate",
  ].map((slug) => `/private-stays/${slug}`),
  "/services", "/services/24-7-private-concierge", "/services/luxury-ground-transport", "/services/vip-airport-meet-greet",
];

/** Page counts computed from the code, for diagnostics and for the "counted once, nothing lost" assertions. */
export function siteInventory() {
  const framer = framerRoutes().map(framerPagePath);
  const englishReact = englishReactRoutes().map(trimSlash);
  const rules = readRedirects().rules;
  const pages = sitePages();
  const sources = rules.filter((r) => !r.splat && !r.from.endsWith("/")).map((r) => r.from);
  const both = framer.filter((p) => englishReact.includes(p));
  const shadowed = sources.filter((p) => pages.has(p));
  return {
    framer,
    englishReact,
    redirected: sources,
    doubled: [...new Set([...both, ...shadowed])],
    unanswered: JOB_04_ADDRESSES.filter((p) => !hasRoute(p, { pages, rules })),
  };
}
