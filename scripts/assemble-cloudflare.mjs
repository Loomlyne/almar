import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderStaticNotFound } from "../lib/not-found-document.ts";
import { LOCALES, isLocale, localePath, matchPublicPage, stripLocale } from "../lib/locale-path.ts";
import { opsPathsFrom } from "../lib/ops-routes.ts";
import { assertAnonKey } from "../lib/data/anon-key.ts";
import { isHeldPath, serverPathsFrom } from "../lib/server-routes.ts";
import { assertPublicClean, assertSitemapCovers, assertTargetFiles, outDirNameFor, parseTarget, writeTargetFiles } from "./crawl-files.mjs";
import { assertMediaReady } from "./media-guard.mjs";
import { assertWorkerSize } from "./worker-size.mjs";
import { BRAND_FILES, DEFAULT_SITE_SETTINGS, brandStyle, fetchSiteSettings, logoPath, parseSiteSettingsRow } from "../lib/site-settings.ts";
import { renderMaintenancePage } from "../lib/maintenance-document.ts";
import { mediaUrl } from "../lib/data/media.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function posix(p) {
  return p.split(path.sep).join("/");
}

function listFiles(dir, base = dir, found = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) listFiles(full, base, found);
    else found.push({ full, rel: posix(path.relative(base, full)) });
  }
  return found;
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

/**
 * Everything after the build: turn the prerendered output into the folder Cloudflare serves.
 *
 *  - `.body` files (the Framer route handlers) are copied as before.
 *  - `.html` files (React pages) are copied only for public pages (matchPublicPage), so account, dashboard,
 *    login, booking, bookings and _not-found never reach out/.
 *  - A locale home is written to out/<locale>/index.html, never to out/<locale>.html. Since job 21 English is a locale
 *    like the others (out/en/…); nothing ships as out/index.html: "/" is the Worker's language redirect.
 *  - .next/static goes to out/_next/static when any React document ships, so it is styled and hydrates.
 *  - Three branded 404s are rendered by renderStaticNotFound, never templated here.
 *  - `pages: false` (the ops target, plan 03.2-03) ships no page at all: no .body, no .html, no index.html. Only
 *    public/ (without its marketing _redirects), .next/static (always), the three 404s and the headers file reach the
 *    folder; Worker almar-ops serves every page itself.
 *
 * Returns { framer, react: { en, ar, es }, notFound, total }, paths relative to outDir.
 */
export function assembleOut({ appDir, staticDir, outDir, publicDir, headersFile, pages = true }) {
  if (pages && !fs.existsSync(appDir)) {
    throw new Error(`missing build output: ${appDir}`);
  }

  // 1. Decide what ships, before touching out/.
  const plan = []; // { src, dest, kind: "framer" | "react", locale }
  const taken = new Map(); // dest -> src
  for (const { full, rel: file } of pages ? listFiles(appDir) : []) {
    const isBody = file.endsWith(".body");
    const isHtml = file.endsWith(".html");
    if (!isBody && !isHtml) continue;
    const rel = file.replace(/\.(body|html)$/, "");
    const urlPath = rel === "index" ? "/" : isLocale(rel) ? `/${rel}/` : `/${rel}`;
    const { locale, path: pagePath } = stripLocale(urlPath);
    if (isHtml && matchPublicPage(pagePath) === null) continue;
    // Job 21: every page is prefixed; an unprefixed page (app/<page> outside app/en) would shadow a 301 in _redirects.
    if (!LOCALES.some((l) => urlPath === `/${l}/` || urlPath.startsWith(`/${l}/`))) {
      throw new Error(`${file} would ship unprefixed at ${urlPath}: every page lives under /en, /ar or /es (job 21)`);
    }
    // Job 10: nothing under /api or a held section may ship as a static file. A route that lost
    // `force-dynamic` would be prerendered here and served before the Worker could hold it.
    if (pagePath === "/api" || pagePath.startsWith("/api/") || isHeldPath(pagePath)) {
      throw new Error(`${file} would ship as a static file under ${pagePath}: it must be force-dynamic (lib/server-routes.ts)`);
    }
    const dest = isLocale(rel) ? `${rel}/index.html` : `${rel}.html`;
    if (taken.has(dest)) {
      throw new Error(`two sources for out/${dest}: ${taken.get(dest)} and ${file}`);
    }
    taken.set(dest, file);
    plan.push({ src: full, dest, kind: isBody ? "framer" : "react", locale, pagePath });
  }

  // Job 10: public/ is copied as it is, so it may not hold a file under /api or a held section either (it would be
  // served as a static file ahead of the Worker).
  if (publicDir && fs.existsSync(publicDir)) {
    for (const { rel } of listFiles(publicDir)) {
      const address = `/${rel.replace(/(^|\/)index\.html$/, "").replace(/\.html$/, "")}`.replace(/\/$/, "") || "/";
      const { path: bare } = stripLocale(address);
      if (bare === "/api" || bare.startsWith("/api/") || isHeldPath(bare)) {
        throw new Error(`public/${rel} would be served under ${address}, which only the Worker may answer (lib/server-routes.ts)`);
      }
    }
  }

  // 2. Parity checks on the plan, so a half-localised build cannot be assembled.
  const react = { en: [], ar: [], es: [] };
  for (const item of plan) if (item.kind === "react") react[item.locale].push(item);
  const pagesOf = (locale) => new Set(react[locale].map((item) => item.pagePath));
  for (const [a, b] of [["ar", "es"], ["es", "ar"], ["en", "ar"], ["ar", "en"]]) {
    const missing = [...pagesOf(a)].filter((p) => !pagesOf(b).has(p));
    if (missing.length > 0) {
      throw new Error(`${a} pages without an ${b} twin: ${missing.map((p) => localePath(a, p)).join(", ")}`);
    }
  }
  const planned = new Set(plan.map((item) => item.dest));
  for (const locale of ["ar", "es"]) {
    for (const item of react[locale]) {
      const english = item.pagePath === "/" ? "en/index.html" : `en${item.pagePath}.html`;
      if (!planned.has(english)) {
        throw new Error(`${item.dest} has no English page (expected out/${english})`);
      }
    }
  }

  // 3. Write out/.
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  if (publicDir && fs.existsSync(publicDir)) {
    fs.cpSync(publicDir, outDir, { recursive: true });
  }
  // public/_redirects holds the marketing site's address moves (/services -> /experiences). The ops host has no such
  // pages: there /services is the branded 404, not a redirect to a page that does not exist.
  if (!pages) fs.rmSync(path.join(outDir, "_redirects"), { force: true });
  const anyReact = plan.some((item) => item.kind === "react");
  if (anyReact || !pages) {
    if (!staticDir || !fs.existsSync(staticDir)) {
      throw new Error(
        pages
          ? `React documents are shipping but ${staticDir} is missing: they would be unstyled and never hydrate`
          : `${staticDir} is missing: the dashboard pages Worker almar-ops serves would be unstyled and never hydrate`,
      );
    }
    fs.cpSync(staticDir, path.join(outDir, "_next", "static"), { recursive: true });
  }
  for (const item of plan) copyFile(item.src, path.join(outDir, item.dest));

  const notFound = [];
  for (const locale of LOCALES) {
    const homeDest = `${locale}/index.html`;
    const homeHref = planned.has(homeDest) ? localePath(locale, "/") : "/";
    const dest = locale === "en" ? "404.html" : `${locale}/404.html`;
    fs.mkdirSync(path.dirname(path.join(outDir, dest)), { recursive: true });
    fs.writeFileSync(path.join(outDir, dest), renderStaticNotFound(locale, homeHref));
    notFound.push(dest);
  }

  if (headersFile && fs.existsSync(headersFile)) {
    copyFile(headersFile, path.join(outDir, "_headers"));
  }

  // 4. Self-checks on what is on disk.
  const must = pages ? ["en/index.html", "ar/index.html", "es/index.html", ...notFound] : [...notFound];
  const absent = must.filter((f) => !fs.existsSync(path.join(outDir, f)));
  if (absent.length > 0) throw new Error(`assemble incomplete: missing ${absent.join(", ")}`);
  if (fs.existsSync(path.join(outDir, "index.html"))) {
    throw new Error(`out/index.html exists: "/" is the Worker's language redirect (job 21), never a static page`);
  }
  for (const l of LOCALES) {
    if (fs.existsSync(path.join(outDir, `${l}.html`))) {
      throw new Error(`out/${l}.html exists: a locale home must be out/${l}/index.html only`);
    }
  }
  if ((anyReact || !pages) && !fs.existsSync(path.join(outDir, "_next", "static"))) {
    throw new Error(`${path.basename(outDir)}/_next/static is missing although the static files were copied`);
  }

  const total = listFiles(outDir).filter((f) => f.rel.endsWith(".html")).length;
  return {
    pages: plan.map((item) => ({ dest: item.dest, locale: item.locale })),
    framer: plan.filter((item) => item.kind === "framer").map((item) => item.dest),
    react: { en: react.en.map((i) => i.dest), ar: react.ar.map((i) => i.dest), es: react.es.map((i) => i.dest) },
    notFound,
    total,
  };
}

/**
 * Job 10: OpenNext copies every value of the project's .env files into .open-next/cloudflare/next-env.mjs, which is
 * bundled into the uploaded Worker. No value may travel that way: secrets are Worker secrets, set by the owner.
 * The file holds one `export const <mode> = <JSON>;` line per mode; each must be `{}`.
 */
export function assertNoBundledEnv(file) {
  if (!fs.existsSync(file)) throw new Error(`missing ${file}: the OpenNext build did not finish`);
  const modes = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = /^export const (\w+) = (.*);$/.exec(line.trim());
    if (m) modes[m[1]] = JSON.parse(m[2]);
  }
  if (!("production" in modes)) throw new Error(`${file} has no production block`);
  const filled = Object.entries(modes).filter(([, values]) => Object.keys(values).length > 0);
  if (filled.length > 0) {
    const names = filled.map(([mode, values]) => `${mode}: ${Object.keys(values).join(", ")}`).join("; ");
    throw new Error(`a .env file would be bundled into the Worker (${names}); move these to Worker secrets`);
  }
}

/**
 * The only NEXT_PUBLIC_* names the SHELL may hold when it runs the assembler (plan 03.2-02): the project's public URL and
 * its public (anon) key. The catalogue is read through them at build time (lib/data/source.ts, anon key, published views
 * only, C-04). Supabase says both are public by design.
 *
 * They never reach Next. `nextBuildEnv` removes them from the environment of `opennextjs-cloudflare build` and hands the
 * values to the data layer under other names (BUILD_HANDOVER_ENV), which Next does not inline. Measured: with
 * NEXT_PUBLIC_SUPABASE_URL set in the Next build's environment Next writes its value as a string into the middleware,
 * the auth pages and the OpenNext Worker bundles, which then ignore the Worker's secret at request time; and
 * `almar-preview`, which holds no secret on purpose (fail closed), would carry the project's address. So job 10's rule
 * stays whole for Next (no NEXT_PUBLIC_* in the Next build) and every Worker still reads its Worker secrets at request time.
 */
export const BUILD_PUBLIC_ENV = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];

/** The names under which the data layer receives the two public values during the build (read by lib/data/source.ts). */
export const BUILD_HANDOVER_ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "ALMAR_BUILD_SUPABASE_URL",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "ALMAR_BUILD_SUPABASE_ANON_KEY",
};

/**
 * The environment of the OpenNext / Next build: the shell's, without any NEXT_PUBLIC_* and without a stale hand-over
 * name, plus ALMAR_DATA_SOURCE and, for the database source, the two public values under their hand-over names.
 */
export function nextBuildEnv(env, source) {
  const handover = new Set(Object.values(BUILD_HANDOVER_ENV));
  const out = {};
  for (const [name, value] of Object.entries(env)) {
    if (name.startsWith("NEXT_PUBLIC_") || handover.has(name)) continue;
    out[name] = value;
  }
  if (source === "supabase") {
    for (const [from, to] of Object.entries(BUILD_HANDOVER_ENV)) out[to] = String(env[from] ?? "").trim();
  }
  out.ALMAR_DATA_SOURCE = source;
  out.WRANGLER_SEND_METRICS = "false";
  return out;
}

/**
 * Next (15 and 16; job 20 read 16.4.2's file-system-cache.js: <distDir>/server/../cache/fetch-cache) stores the result of every `fetch` of a build in <root>/.next/cache/fetch-cache with revalidate 31536000 (a
 * year). The data layer reads the api_* views through supabase-js, which uses fetch, so a later build in the same checkout
 * finds those entries and rebuilds the OLD catalogue: a title changed in the database kept its old text (proved on the
 * local stack by tests/rebuild-fresh.test.mjs). Deleted before every build; only this folder, the webpack cache beside it
 * keeps builds fast and deterministic. Not fixable in the data layer (see lib/data/source.ts). Safe to call when the
 * folder does not exist.
 */
export function clearFetchCache(rootDir) {
  fs.rmSync(path.join(rootDir, ".next", "cache", "fetch-cache"), { recursive: true, force: true });
}

/**
 * Job 10 review: assertNoBundledEnv only sees the project's .env files. The build also inherits the shell it runs in,
 * and Next inlines every NEXT_PUBLIC_* value it finds there into the bundles that name it. Since plan 03.2-02 the shell
 * may hold exactly two such names (BUILD_PUBLIC_ENV, which nextBuildEnv keeps away from Next); any other NEXT_PUBLIC_*
 * may not be set.
 * Only the names are reported, never the values. `env` is process.env in the build, a plain object in the test.
 */
export function assertNoPublicEnv(env) {
  const names = Object.keys(env)
    .filter((name) => name.startsWith("NEXT_PUBLIC_") && !BUILD_PUBLIC_ENV.includes(name))
    .sort();
  if (names.length > 0) {
    throw new Error(`NEXT_PUBLIC_* in the build shell would be inlined into the browser bundle: ${names.join(", ")}`);
  }
}

/**
 * Plan 03.2-02 (threat T-3.2-10): the build reads the public views with the anon key and nothing else. A service-role
 * variable in the build shell is refused before anything runs, whatever its value, so it can never reach `next build`,
 * the OpenNext bundle or a Worker. Names only; an empty variable is ignored.
 */
export function assertNoServiceKey(env) {
  const names = Object.keys(env)
    .filter((name) => /SERVICE_ROLE/i.test(name) && String(env[name] ?? "").trim() !== "")
    .sort();
  if (names.length > 0) {
    throw new Error(`a service-role key in the build shell may never reach a build: unset ${names.join(", ")}`);
  }
}

/**
 * Plan 03.2-02b (review of 03.2-02, finding 1): the one Supabase project an assembled build may read. A shell that still
 * exports the local stack's URL and its anon key would otherwise assemble preview or production from the local sample rows.
 * Names only in the message, never the value that was given (the expected host is public).
 */
export const LIVE_SUPABASE_HOST = "jkdkaldgeiowkhlfmsft.supabase.co";

/** Throws unless `value` (the content of variable `name`) is https://<LIVE_SUPABASE_HOST>, no port, no credentials, no path. */
export function assertLiveSupabaseUrl(name, value) {
  let url = null;
  try {
    url = new URL(String(value).trim());
  } catch {
    // reported below, with the same words as every other wrong value
  }
  const ok =
    url !== null &&
    url.protocol === "https:" &&
    url.hostname === LIVE_SUPABASE_HOST &&
    url.port === "" &&
    url.username === "" &&
    url.password === "" &&
    url.pathname === "/" &&
    url.search === "" &&
    url.hash === "";
  if (!ok) throw new Error(`${name} must be https://${LIVE_SUPABASE_HOST}: an assembled build reads the live project only`);
  return value;
}

/**
 * The publish sequence the database reports (api_site_version.requested_seq), read with a plain fetch of the PostgREST
 * view, the anon key and the pinned URL: outside Next, so nothing caches it. `cache: "no-store"` is fine here (this is the
 * assembler process, not the static build). Messages name the view and the HTTP status, never the URL or the key.
 */
export async function readPublishSequence({ url, anonKey, fetchImpl = globalThis.fetch }) {
  let res;
  try {
    res = await fetchImpl(`${new URL(String(url).trim()).origin}/rest/v1/api_site_version?select=requested_seq`, {
      headers: { apikey: String(anonKey).trim(), authorization: `Bearer ${String(anonKey).trim()}`, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new Error("api_site_version: the publish sequence could not be read (network error or timeout)");
  }
  if (!res.ok) throw new Error(`api_site_version: the publish sequence could not be read (HTTP ${res.status})`);
  const rows = await res.json().catch(() => null);
  const seq = Array.isArray(rows) && rows.length === 1 ? rows[0]?.requested_seq : undefined;
  if (typeof seq !== "number" && typeof seq !== "string") {
    throw new Error("api_site_version: expected one row with a requested_seq (the publish sequence the build is checked against)");
  }
  return String(seq);
}

/**
 * 03.2-02b (Grok 4.7 review of PR #10): the 11 catalogue views are read one after another, and Next (15.5 and 16) caches every
 * fetch of a static build (implicit build-time cache, shared between export workers), so a second read INSIDE the build
 * would only be a cache hit. The check therefore lives here, around the whole build: for preview and production, the
 * sequence is read before `build()` starts and again after it ends; a different number throws and the live site stays as
 * it was. A failed build skips the second read (its own error is the one to see). Local, ops and fixtures builds read
 * nothing. Returns the sequence ("n/a" when nothing was checked).
 */
export async function guardPublishSequence({ target, source, env = process.env, fetchImpl, build }) {
  if (target === "local" || source !== "supabase") {
    build();
    return "n/a";
  }
  const settings = { url: env.NEXT_PUBLIC_SUPABASE_URL, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, fetchImpl };
  const before = await readPublishSequence(settings);
  build();
  const after = await readPublishSequence(settings);
  if (after !== before) {
    throw new Error(
      `api_site_version: requested_seq moved from ${before} to ${after} while --target=${target} was built (a publish during a build never ships; start the build again)`,
    );
  }
  return before;
}

/**
 * Plan 03.2-02: where the public pages read the catalogue (lib/data/source.ts). Decided before anything is built or
 * removed, so a refused run leaves the previous output intact.
 *
 *   local            fixtures, unless ALMAR_DATA_SOURCE=supabase (the parity build uses both)
 *   preview, production
 *                    the database, always: ALMAR_DATA_SOURCE=fixtures, a typo, a missing NEXT_PUBLIC_SUPABASE_URL or
 *                    NEXT_PUBLIC_SUPABASE_ANON_KEY, and ALMAR_FIXTURE_DIR are refused, so an assembled build can never
 *                    silently ship fixture content for the catalogue (T-3.2-09). NEXT_PUBLIC_SUPABASE_URL must also be
 *                    https://<LIVE_SUPABASE_HOST> (03.2-02b): never the local stack, never another project.
 *   ops              fixtures, always: out-ops/ ships no page HTML, so no catalogue page of this build is ever served, and
 *                    the dashboard Worker reads the database at request time with its own secrets. It needs no public
 *                    setting in the shell (the 03.2-04 ops build steps run without one); ALMAR_DATA_SOURCE=supabase, a
 *                    typo and ALMAR_FIXTURE_DIR are refused.
 *
 * The database source also checks the anon key's value (lib/data/anon-key.ts): a secret key is refused.
 *
 * Returns "fixtures" | "supabase". Names only in every message, never a value (a data-source word is not a secret).
 */
export function dataSourceFor(target, env = process.env) {
  const asked = env.ALMAR_DATA_SOURCE === undefined || env.ALMAR_DATA_SOURCE === "" ? null : env.ALMAR_DATA_SOURCE;
  if (asked !== null && asked !== "fixtures" && asked !== "supabase") {
    throw new Error(`ALMAR_DATA_SOURCE must be "fixtures" or "supabase" (got ${JSON.stringify(asked.slice(0, 40))})`);
  }
  const assembled = target !== "local";
  if (target === "ops") {
    if (asked === "supabase") {
      throw new Error("--target=ops refuses ALMAR_DATA_SOURCE=supabase: the ops build ships no catalogue page and reads fixtures");
    }
    if (env.ALMAR_FIXTURE_DIR) {
      throw new Error("--target=ops refuses ALMAR_FIXTURE_DIR: an assembled build reads the page blocks from lib/data/fixtures");
    }
    return "fixtures";
  }
  if (assembled && asked === "fixtures") {
    throw new Error(`--target=${target} refuses ALMAR_DATA_SOURCE=fixtures: an assembled build reads the database only`);
  }
  if (assembled && env.ALMAR_FIXTURE_DIR) {
    throw new Error(`--target=${target} refuses ALMAR_FIXTURE_DIR: an assembled build reads the page blocks from lib/data/fixtures`);
  }
  const source = assembled || asked === "supabase" ? "supabase" : "fixtures";
  if (source === "supabase") {
    const missing = BUILD_PUBLIC_ENV.filter((name) => !String(env[name] ?? "").trim());
    if (missing.length > 0) {
      throw new Error(`the database source needs ${missing.join(" and ")} in the build shell (public values; names only, never printed)`);
    }
    assertAnonKey("NEXT_PUBLIC_SUPABASE_ANON_KEY", String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).trim());
    // Only an assembled target is pinned: --target=local keeps reading the local stack (the parity and rebuild tests).
    if (assembled) assertLiveSupabaseUrl("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL);
  }
  return source;
}

/**
 * Job 10: the exact server paths worker/almar.mjs forwards to Next, computed from Next's route manifest by
 * lib/server-routes.ts and written to .open-next/almar-server-routes.json. Returns the list.
 */
export function writeServerPaths({ manifestFile, openNextDir }) {
  if (!fs.existsSync(path.join(openNextDir, "worker.js"))) {
    throw new Error(`missing ${path.join(openNextDir, "worker.js")}: the OpenNext build did not finish`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const paths = serverPathsFrom(Object.keys(manifest));
  fs.writeFileSync(path.join(openNextDir, "almar-server-routes.json"), `${JSON.stringify(paths)}\n`);
  return paths;
}

/**
 * Plan 03.2-03: the exact paths worker/almar-ops.mjs forwards to Next, computed from the same manifest by
 * lib/ops-routes.ts and written to .open-next/almar-ops-routes.json (the ops build writes this file instead of
 * almar-server-routes.json). Returns the list.
 */
export function writeOpsPaths({ manifestFile, openNextDir }) {
  if (!fs.existsSync(path.join(openNextDir, "worker.js"))) {
    throw new Error(`missing ${path.join(openNextDir, "worker.js")}: the OpenNext build did not finish`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestFile, "utf8"));
  const paths = opsPathsFrom(Object.keys(manifest));
  fs.writeFileSync(path.join(openNextDir, "almar-ops-routes.json"), `${JSON.stringify(paths)}\n`);
  return paths;
}

/**
 * Job 10 review: bundle the Worker the way `wrangler deploy` would, with `--dry-run` (nothing is uploaded, no login is
 * used), into a temporary folder, and fail when its gzip size is over the limit in scripts/worker-size.mjs. Wrangler
 * reads the assets folder and .open-next/, so this runs after both are written. Returns the size in KiB.
 */
function assertBuiltWorkerSize(config) {
  const bundleDir = fs.mkdtempSync(path.join(os.tmpdir(), "almar-worker-bundle-"));
  try {
    execFileSync("./node_modules/.bin/wrangler", ["deploy", "--dry-run", "--config", config, "--outdir", bundleDir], {
      cwd: root,
      stdio: "inherit",
      env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
    });
    const kib = assertWorkerSize(bundleDir);
    if (kib === null) throw new Error(`the dry run wrote no Worker bundle for ${config}`);
    return kib;
  } finally {
    fs.rmSync(bundleDir, { recursive: true, force: true });
  }
}

// ---- Plan 02-06: Settings at the publish rebuild ------------------------------------------------------------------

/** The saved logo may be at most 1 MB (02-06 plan, T-02-13). */
export const LOGO_MAX_BYTES = 1024 * 1024;

const LOGO_MAGIC = {
  png: (b) => b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  jpg: (b) => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  webp: (b) => b.length > 12 && b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP",
};

/**
 * What the public build takes from Settings. Fixtures mode (local builds, tests): <fixture folder>/site-settings.json
 * when it exists, else the design system's defaults. Database mode: api_site_settings with the anon key, and the saved
 * logo's bytes from the media host (checked: at most 1 MB, PNG/JPEG/WebP by its first bytes, matching its key). Any
 * failure throws before a folder is wiped, so the live site stays as it was.
 */
export async function readBuildSiteSettings(source, env = process.env, fetcher = fetch) {
  let settings;
  if (source === "supabase") {
    settings = await fetchSiteSettings(String(env.NEXT_PUBLIC_SUPABASE_URL).trim(), String(env.NEXT_PUBLIC_SUPABASE_ANON_KEY).trim(), fetcher);
  } else {
    const file = path.join(env.ALMAR_FIXTURE_DIR || path.join(root, "lib", "data", "fixtures"), "site-settings.json");
    settings = fs.existsSync(file) ? parseSiteSettingsRow(JSON.parse(fs.readFileSync(file, "utf8"))) : DEFAULT_SITE_SETTINGS;
  }
  let logo = null;
  if (settings.logoKey !== null) {
    const ext = settings.logoKey.slice(settings.logoKey.lastIndexOf(".") + 1);
    const response = await fetcher(mediaUrl(settings.logoKey));
    if (!response.ok) throw new Error(`the saved logo could not be read from the media host (${response.status})`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > LOGO_MAX_BYTES) throw new Error("the saved logo is empty or over 1 MB");
    if (!LOGO_MAGIC[ext]?.(bytes)) throw new Error(`the saved logo is not a ${ext} file`);
    logo = { ext, bytes };
  }
  return { settings, logo };
}

/** The wordmark files the Next build hashes into /_next/static/media/ (components/ui/nav.tsx and the ops shell). */
const WORDMARK_SRC = /\/_next\/static\/media\/(?:Poly_White|Stacked_Charcoal)\.[A-Za-z0-9_-]+\.svg/g;

/**
 * After assembleOut, for a target with pages: copy the brand files and the saved logo into out/brand/; then, with
 * maintenance on, every public page becomes the closed page in its own language; otherwise every page gets the saved
 * colours (a <style> before </head>) and, when a logo is saved, the wordmark images point at it.
 * Returns { maintenance, pages, styled }.
 */
export function applySiteSettings({ outDir, pages, settings, logo, repoRoot = root }) {
  for (const { from, to } of BRAND_FILES) copyFile(path.join(repoRoot, from), path.join(outDir, to));
  if (logo) {
    fs.mkdirSync(path.join(outDir, "brand"), { recursive: true });
    fs.writeFileSync(path.join(outDir, "brand", `logo.${logo.ext}`), logo.bytes);
  }
  const style = brandStyle(settings);
  const logoSrc = logoPath(settings.logoKey);
  let styled = 0;
  for (const { dest, locale } of pages) {
    const file = path.join(outDir, dest);
    if (settings.maintenance) {
      fs.writeFileSync(file, renderMaintenancePage(locale, { logoSrc, brandStyle: style }));
      continue;
    }
    let html = fs.readFileSync(file, "utf8");
    const before = html;
    if (style && html.includes("</head>")) html = html.replace("</head>", `${style}</head>`);
    if (settings.logoKey !== null) html = html.replace(WORDMARK_SRC, logoSrc);
    if (html !== before) {
      fs.writeFileSync(file, html);
      styled += 1;
    }
  }
  return { maintenance: settings.maintenance, pages: pages.length, styled };
}


/**
 * Runs scripts/write-site-nav.mjs with the build's env, then reads the file back. A failed read or write stops the
 * assemble with the script's own error (execFileSync throws on a non-zero exit), and a snapshot without a header and a
 * footer list for every language is refused, so a build never ships a silent empty or half-written nav (controller,
 * 2026-10-28). Links the owner hid are simply not in the lists; Login, currency and language are drawn in code.
 */
export function writeNavSnapshot(env, run = execFileSync) {
  run(process.execPath, [path.join(root, "scripts/write-site-nav.mjs")], { cwd: root, stdio: "inherit", env });
  const file = path.join(root, "lib/data/site-nav.snapshot.json");
  let snapshot;
  try {
    snapshot = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new Error(`site-nav: ${file} could not be read after write-site-nav.mjs (${error.message}); the build stops`);
  }
  for (const area of ["header", "footer"]) {
    for (const locale of LOCALES) {
      if (!Array.isArray(snapshot?.[area]?.[locale])) {
        throw new Error(`site-nav: the snapshot has no ${area} list for ${locale}; the build stops`);
      }
    }
  }
  return snapshot;
}

/**
 * Plan 06-04: the public paths the published rows say must be pages, read by scripts/expected-public-paths.mjs with the
 * build's own env (the same source as the pages), in the English form. A failed read stops the assemble with the script's
 * own error (execFileSync throws on a non-zero exit), and so does an answer that is not a list of paths.
 */
export function expectedPublicPaths(source, env = process.env, run = execFileSync) {
  const out = run(process.execPath, [path.join(root, "scripts/expected-public-paths.mjs")], {
    cwd: root,
    stdio: ["ignore", "pipe", "inherit"],
    encoding: "utf8",
    env: nextBuildEnv(env, source),
  });
  let paths;
  try {
    paths = JSON.parse(out);
  } catch (error) {
    throw new Error(`expected public paths: unreadable answer (${error.message}); the build stops`);
  }
  if (!Array.isArray(paths) || !paths.every((p) => typeof p === "string" && p.startsWith("/"))) {
    throw new Error("expected public paths: not a list of paths; the build stops");
  }
  return paths;
}

/**
 * node scripts/assemble-cloudflare.mjs [--target=local|preview|production|ops]
 *
 *   local (default)  out/          production crawl files; no media check, so the check set can build
 *   production       out/          the same files, after assertMediaReady()
 *   preview          out-preview/  noindex header, disallow-all robots.txt, no sitemap, after assertMediaReady()
 *   ops              out-ops/      the dashboard Worker almar-ops (plan 03.2-03): no page HTML, public/ and _next/static,
 *                                  the three 404s, the preview's noindex files, after assertMediaReady(); the OpenNext
 *                                  build uses wrangler.ops.toml and the list of served paths is almar-ops-routes.json
 *
 * Preview, ops and production go to different folders, so a preview build never writes out/ and a production build
 * never writes out-preview/ or out-ops/ (reconcile R-11): a wrong `wrangler deploy` cannot ship preview files to the live site.
 * A typo in the target throws before anything is built or removed.
 */
async function main(argv = process.argv.slice(2)) {
  const target = parseTarget(argv);
  // Before anything is built or removed, like the target check above: what the shell may hold, and where the pages read
  // the catalogue from (plan 03.2-02).
  assertNoPublicEnv(process.env);
  assertNoServiceKey(process.env);
  const source = dataSourceFor(target);
  process.chdir(root);
  assertPublicClean(root);
  // Before the build and before any folder is wiped: a refused run leaves the previous output intact.
  if (target !== "local") assertMediaReady();
  // Plan 02-06: Settings (maintenance, colours, logo) are read before anything is built or wiped, like the catalogue.
  const site = target === "ops" ? null : await readBuildSiteSettings(source);
  // Every build reads the database again: Next's fetch cache would serve the rows of an earlier build (clearFetchCache).
  clearFetchCache(root);
  // Job 10: OpenNext runs the project's `next build` (standalone) and bundles the server into .open-next/. The
  // prerendered pages below come from that same build, so the static folder and the Worker script always match.
  const config = target === "preview" ? "wrangler.preview.toml" : target === "ops" ? "wrangler.ops.toml" : "wrangler.toml";
  // Plan 06-04: only these two targets have a sitemap.
  const hasSitemap = target === "production" || target === "local";
  let expectedPaths = [];
  // 03.2-02b: for preview and production the publish sequence is read before and after the build, outside Next.
  await guardPublishSequence({
    target,
    source,
    build: () => {
      // Plan 06-02 (CMS-09): the header and footer links are baked from the same source as the pages, inside the
      // publish-sequence window. The ops build draws no public page and keeps the committed snapshot.
      if (target !== "ops") writeNavSnapshot(nextBuildEnv(process.env, source));
      // Plan 06-04: the booking terms version this build saw; the request gate opens only on the same version. Its one
      // line says which version or that none was baked. Only a file that cannot be written stops here.
      if (target !== "ops") execFileSync(process.execPath, [path.join(root, "scripts/write-booking-terms.mjs")], { cwd: root, stdio: "inherit", env: nextBuildEnv(process.env, source) });
      if (hasSitemap) expectedPaths = expectedPublicPaths(source);
      execFileSync("./node_modules/.bin/opennextjs-cloudflare", ["build", "--config", config], {
        cwd: root,
        stdio: "inherit",
        env: nextBuildEnv(process.env, source),
      });
    },
  });
  assertNoBundledEnv(path.join(root, ".open-next/cloudflare/next-env.mjs"));
  const folder = outDirNameFor(target);
  const outDir = path.join(root, folder);
  const report = assembleOut({
    appDir: path.join(root, ".next/server/app"),
    staticDir: path.join(root, ".next/static"),
    outDir,
    publicDir: path.join(root, "public"),
    pages: target !== "ops",
  });
  // Plan 02-06: the three branded 404s take the saved colours and close with the site too (lib/not-found-document.ts
  // reads the colour variables, falling back to the design system's values).
  const notFoundPages = report.notFound.map((dest) => ({ dest, locale: dest === "404.html" ? "en" : dest.slice(0, 2) }));
  const siteReport = site ? applySiteSettings({ outDir, pages: [...report.pages, ...notFoundPages], settings: site.settings, logo: site.logo }) : null;
  // _headers, robots.txt and sitemap.xml are written per target, never copied from public/.
  const htmlFiles = listFiles(outDir)
    .filter((f) => f.rel.endsWith(".html"))
    .map((f) => f.rel);
  writeTargetFiles({ outDir, target, root, htmlFiles });
  // Plan 06-04: the dashboard's Money row reads this file to know what the public Worker was built with (lib/ops/money-settings.ts).
  if (target !== "ops") fs.copyFileSync(path.join(root, "lib/booking/baked-terms.snapshot.json"), path.join(outDir, "booking-terms-version.json"));
  assertTargetFiles(outDir, target, { root });
  // A published post or legal page with no page file stops the build, naming the URL (the live site stays as it was).
  if (hasSitemap) assertSitemapCovers(fs.readFileSync(path.join(outDir, "sitemap.xml"), "utf8"), expectedPaths);
  const pathArgs = {
    manifestFile: path.join(root, ".next/server/app-paths-manifest.json"),
    openNextDir: path.join(root, ".open-next"),
  };
  const serverPaths = target === "ops" ? writeOpsPaths(pathArgs) : writeServerPaths(pathArgs);
  const workerKiB = assertBuiltWorkerSize(config);
  const r = report.react;
  if (target === "ops") {
    console.log(
      `assembled ${folder}/ (target: ops): no page HTML, ${report.notFound.length} 404s; ` +
        `Worker ${Math.round(workerKiB)} KiB gzip; ops paths: ${serverPaths.join(", ")}`,
    );
    return;
  }
  console.log(
    `assembled ${report.total} html files into ${folder}/ (target: ${target}): ${report.framer.length} Framer, ` +
      `React en ${r.en.length} / ar ${r.ar.length} / es ${r.es.length}, ${report.notFound.length} 404s; ` +
      `server paths: ${serverPaths.join(", ") || "none"}; Worker ${Math.round(workerKiB)} KiB gzip; ` +
      (siteReport.maintenance ? `MAINTENANCE: ${siteReport.pages} pages closed` : `settings applied to ${siteReport.styled} pages`),
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
