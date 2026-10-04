import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderStaticNotFound } from "../lib/not-found-document.ts";
import { LOCALES, isLocale, localePath, matchPublicPage, stripLocale } from "../lib/locale-path.ts";
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
 *
 * Returns { framer, react: { en, ar, es }, notFound, total }, paths relative to outDir.
 */
export function assembleOut({ appDir, staticDir, outDir, publicDir, headersFile }) {
  if (!fs.existsSync(appDir)) {
    throw new Error(`missing build output: ${appDir}`);
  }

  // 1. Decide what ships, before touching out/.
  const plan = []; // { src, dest, kind: "framer" | "react", locale }
  const taken = new Map(); // dest -> src
  for (const { full, rel: file } of listFiles(appDir)) {
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
  const anyReact = plan.some((item) => item.kind === "react");
  if (anyReact) {
    if (!staticDir || !fs.existsSync(staticDir)) {
      throw new Error(`React documents are shipping but ${staticDir} is missing: they would be unstyled and never hydrate`);
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
  const must = ["index.html", ...notFound];
  const absent = must.filter((f) => !fs.existsSync(path.join(outDir, f)));
  if (absent.length > 0) throw new Error(`assemble incomplete: missing ${absent.join(", ")}`);
  for (const l of ["ar", "es"]) {
    if (fs.existsSync(path.join(outDir, `${l}.html`))) {
      throw new Error(`out/${l}.html exists: a locale home must be out/${l}/index.html only`);
    }
  }
  if (anyReact && !fs.existsSync(path.join(outDir, "_next", "static"))) {
    throw new Error("out/_next/static is missing although React documents were copied");
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
 * Job 10 review: assertNoBundledEnv only sees the project's .env files. The build also inherits the shell it runs in,
 * and Next inlines every NEXT_PUBLIC_* value it finds there into the browser bundle. No such variable may be set.
 * Only the names are reported, never the values. `env` is process.env in the build, a plain object in the test.
 */
export function assertNoPublicEnv(env) {
  const names = Object.keys(env)
    .filter((name) => name.startsWith("NEXT_PUBLIC_"))
    .sort();
  if (names.length > 0) {
    throw new Error(`NEXT_PUBLIC_* in the build shell would be inlined into the browser bundle: ${names.join(", ")}`);
  }
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
 * node scripts/assemble-cloudflare.mjs [--target=local|preview|production]
 *
 *   local (default)  out/          production crawl files; no media check, so the check set can build
 *   production       out/          the same files, after assertMediaReady()
 *   preview          out-preview/  noindex header, disallow-all robots.txt, no sitemap, after assertMediaReady()
 *
 * Preview and production go to different folders, so a preview build never writes out/ and a production build
 * never writes out-preview/ (reconcile R-11): a wrong `wrangler deploy` cannot ship preview files to the live site.
 * A typo in the target throws before anything is built or removed.
 */
function main(argv = process.argv.slice(2)) {
  const target = parseTarget(argv);
  // Before anything is built or removed, like the target check above.
  assertNoPublicEnv(process.env);
  process.chdir(root);
  assertPublicClean(root);
  // Before the build and before any folder is wiped: a refused run leaves the previous output intact.
  if (target !== "local") assertMediaReady();
  // Job 10: OpenNext runs the project's `next build` (standalone) and bundles the server into .open-next/. The
  // prerendered pages below come from that same build, so the static folder and the Worker script always match.
  const config = target === "preview" ? "wrangler.preview.toml" : "wrangler.toml";
  execFileSync("./node_modules/.bin/opennextjs-cloudflare", ["build", "--config", config], {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, WRANGLER_SEND_METRICS: "false" },
  });
  assertNoBundledEnv(path.join(root, ".open-next/cloudflare/next-env.mjs"));
  const folder = outDirNameFor(target);
  const outDir = path.join(root, folder);
  const report = assembleOut({
    appDir: path.join(root, ".next/server/app"),
    staticDir: path.join(root, ".next/static"),
    outDir,
    publicDir: path.join(root, "public"),
  });
  // _headers, robots.txt and sitemap.xml are written per target, never copied from public/.
  const htmlFiles = listFiles(outDir)
    .filter((f) => f.rel.endsWith(".html"))
    .map((f) => f.rel);
  writeTargetFiles({ outDir, target, root, htmlFiles });
  assertTargetFiles(outDir, target, { root });
  const serverPaths = writeServerPaths({
    manifestFile: path.join(root, ".next/server/app-paths-manifest.json"),
    openNextDir: path.join(root, ".open-next"),
  });
  const workerKiB = assertBuiltWorkerSize(config);
  const r = report.react;
  console.log(
    `assembled ${report.total} html files into ${folder}/ (target: ${target}): ${report.framer.length} Framer, ` +
      `React en ${r.en.length} / ar ${r.ar.length} / es ${r.es.length}, ${report.notFound.length} 404s; ` +
      `server paths: ${serverPaths.join(", ") || "none"}; Worker ${Math.round(workerKiB)} KiB gzip`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
