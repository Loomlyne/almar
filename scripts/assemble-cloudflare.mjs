import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderStaticNotFound } from "../lib/not-found-document.ts";
import { LOCALES, isLocale, localePath, matchPublicPage, stripLocale } from "../lib/locale-path.ts";
import { opsPathsFrom } from "../lib/ops-routes.ts";
import { isHeldPath, serverPathsFrom } from "../lib/server-routes.ts";
import { assertPublicClean, assertTargetFiles, outDirNameFor, parseTarget, writeTargetFiles } from "./crawl-files.mjs";
import { assertMediaReady } from "./media-guard.mjs";
import { assertWorkerSize } from "./worker-size.mjs";

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
 *  - A locale home is written to out/<locale>/index.html, never to out/<locale>.html.
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
    const urlPath = rel === "index" ? "/" : isLocale(rel) && rel !== "en" ? `/${rel}/` : `/${rel}`;
    const { locale, path: pagePath } = stripLocale(urlPath);
    if (isHtml && matchPublicPage(pagePath) === null) continue;
    // Job 10: nothing under /api or a held section may ship as a static file. A route that lost
    // `force-dynamic` would be prerendered here and served before the Worker could hold it.
    if (pagePath === "/api" || pagePath.startsWith("/api/") || isHeldPath(pagePath)) {
      throw new Error(`${file} would ship as a static file under ${pagePath}: it must be force-dynamic (lib/server-routes.ts)`);
    }
    const dest = rel === "index" ? "index.html" : isLocale(rel) && rel !== "en" ? `${rel}/index.html` : `${rel}.html`;
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
  for (const [a, b] of [["ar", "es"], ["es", "ar"]]) {
    const missing = [...pagesOf(a)].filter((p) => !pagesOf(b).has(p));
    if (missing.length > 0) {
      throw new Error(`${a} pages without an ${b} twin: ${missing.map((p) => localePath(a, p)).join(", ")}`);
    }
  }
  const planned = new Set(plan.map((item) => item.dest));
  for (const locale of ["ar", "es"]) {
    for (const item of react[locale]) {
      const english = item.pagePath === "/" ? "index.html" : `${item.pagePath.slice(1)}.html`;
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
    const homeDest = locale === "en" ? "index.html" : `${locale}/index.html`;
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
  const must = pages ? ["index.html", ...notFound] : [...notFound];
  const absent = must.filter((f) => !fs.existsSync(path.join(outDir, f)));
  if (absent.length > 0) throw new Error(`assemble incomplete: missing ${absent.join(", ")}`);
  for (const l of ["ar", "es"]) {
    if (fs.existsSync(path.join(outDir, `${l}.html`))) {
      throw new Error(`out/${l}.html exists: a locale home must be out/${l}/index.html only`);
    }
  }
  if ((anyReact || !pages) && !fs.existsSync(path.join(outDir, "_next", "static"))) {
    throw new Error(`${path.basename(outDir)}/_next/static is missing although the static files were copied`);
  }

  const total = listFiles(outDir).filter((f) => f.rel.endsWith(".html")).length;
  return {
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
 * Next 15 stores the result of every `fetch` of a build in <root>/.next/cache/fetch-cache with revalidate 31536000 (a
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
 * Plan 03.2-02: where the public pages read the catalogue (lib/data/source.ts). Decided before anything is built or
 * removed, so a refused run leaves the previous output intact.
 *
 *   local            fixtures, unless ALMAR_DATA_SOURCE=supabase (the parity build uses both)
 *   preview, production, ops
 *                    the database, always: ALMAR_DATA_SOURCE=fixtures, a typo, a missing NEXT_PUBLIC_SUPABASE_URL or
 *                    NEXT_PUBLIC_SUPABASE_ANON_KEY, and ALMAR_FIXTURE_DIR are refused, so an assembled build can never
 *                    silently ship fixture content for the catalogue (T-3.2-09).
 *
 * Returns "fixtures" | "supabase". Names only in every message, never a value (a data-source word is not a secret).
 */
export function dataSourceFor(target, env = process.env) {
  const asked = env.ALMAR_DATA_SOURCE === undefined || env.ALMAR_DATA_SOURCE === "" ? null : env.ALMAR_DATA_SOURCE;
  if (asked !== null && asked !== "fixtures" && asked !== "supabase") {
    throw new Error(`ALMAR_DATA_SOURCE must be "fixtures" or "supabase" (got ${JSON.stringify(asked.slice(0, 40))})`);
  }
  const assembled = target !== "local";
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
function main(argv = process.argv.slice(2)) {
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
  // Every build reads the database again: Next's fetch cache would serve the rows of an earlier build (clearFetchCache).
  clearFetchCache(root);
  // Job 10: OpenNext runs the project's `next build` (standalone) and bundles the server into .open-next/. The
  // prerendered pages below come from that same build, so the static folder and the Worker script always match.
  const config = target === "preview" ? "wrangler.preview.toml" : target === "ops" ? "wrangler.ops.toml" : "wrangler.toml";
  execFileSync("./node_modules/.bin/opennextjs-cloudflare", ["build", "--config", config], {
    cwd: root,
    stdio: "inherit",
    env: nextBuildEnv(process.env, source),
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
  // _headers, robots.txt and sitemap.xml are written per target, never copied from public/.
  const htmlFiles = listFiles(outDir)
    .filter((f) => f.rel.endsWith(".html"))
    .map((f) => f.rel);
  writeTargetFiles({ outDir, target, root, htmlFiles });
  assertTargetFiles(outDir, target, { root });
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
      `server paths: ${serverPaths.join(", ") || "none"}; Worker ${Math.round(workerKiB)} KiB gzip`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
