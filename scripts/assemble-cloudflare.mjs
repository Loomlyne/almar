import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderStaticNotFound } from "../lib/not-found-document.ts";
import { LOCALES, isLocale, localePath, matchPublicPage, stripLocale } from "../lib/locale-path.ts";

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
    const dest = rel === "index" ? "index.html" : isLocale(rel) && rel !== "en" ? `${rel}/index.html` : `${rel}.html`;
    if (taken.has(dest)) {
      throw new Error(`two sources for out/${dest}: ${taken.get(dest)} and ${file}`);
    }
    taken.set(dest, file);
    plan.push({ src: full, dest, kind: isBody ? "framer" : "react", locale, pagePath });
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

function main() {
  process.chdir(root);
  execSync("npm run build", { cwd: root, stdio: "inherit" });
  const report = assembleOut({
    appDir: path.join(root, ".next/server/app"),
    staticDir: path.join(root, ".next/static"),
    outDir: path.join(root, "out"),
    publicDir: path.join(root, "public"),
    headersFile: path.join(root, "_headers"),
  });
  const r = report.react;
  console.log(
    `assembled ${report.total} html files into out/: ${report.framer.length} Framer, ` +
      `React en ${r.en.length} / ar ${r.ar.length} / es ${r.es.length}, ${report.notFound.length} 404s`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
