// scripts/crawl-files.mjs
//
// The crawl files of the two hosts (plan 03.3-08, design 8 SC5 and SC6) and the guard that keeps one host's
// files off the other.
//
//   production  https://almarprivatejourney.com            robots.txt allows and names the sitemap; sitemap.xml
//   preview     https://preview.almarprivatejourney.com    noindex header, disallow-all robots.txt, no sitemap
//   ops         https://dashboard.almarprivatejourney.com  the preview's files, in out-ops/ (plan 03.2-03; no page ships)
//
// Both hosts serve a static folder with the same [assets] block, so the one thing that must never happen is a
// preview-only `noindex` reaching production. It is closed three ways, and tests/crawl-files.test.mjs holds each:
//   1. the repo-root _headers (copied to the production folder) never contains X-Robots-Tag;
//   2. the preview files live in deploy/preview/ and are written only on --target=preview, into out-preview/,
//      which is not the folder wrangler.toml serves (reconcile R-11);
//   3. assertTargetFiles() refuses to finish a folder whose crawl files do not match its target.
//
// The functions are pure and build-free: the assembler calls them, and the node test calls them on temp folders.
// The locale list and the address form come from lib/locale-path.ts, the one place that builds a locale URL
// (Node loads that leaf module directly, as the assembler already does).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LOCALES, SITE_ORIGIN, localePath, stripLocale } from "../lib/locale-path.ts";

export { LOCALES, SITE_ORIGIN };

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const TARGETS = ["local", "preview", "production", "ops"];
export const DEFAULT_TARGET = "local";

/** The folder each target is built into. Preview and ops never share a folder with the live site. */
export function outDirNameFor(target) {
  assertTarget(target);
  return target === "preview" ? "out-preview" : target === "ops" ? "out-ops" : "out";
}

/** The dashboard host and the review host are never indexed: both carry the noindex block and the disallow-all file. */
const isNoindexTarget = (target) => target === "preview" || target === "ops";

export function assertTarget(target) {
  if (!TARGETS.includes(target)) {
    throw new Error(`unknown target ${JSON.stringify(target)}: use ${TARGETS.map((t) => `--target=${t}`).join(", ")}`);
  }
  return target;
}

/** `--target=<name>` from an argv slice. Anything else is an error, so a typo cannot build the wrong variant. */
export function parseTarget(argv = []) {
  let target = null;
  for (const arg of argv) {
    const m = /^--target=(.*)$/.exec(arg);
    if (!m) throw new Error(`unknown argument ${JSON.stringify(arg)}: the only option is --target=${TARGETS.join("|")}`);
    if (target !== null) throw new Error("--target given more than once");
    target = m[1];
  }
  return assertTarget(target ?? DEFAULT_TARGET);
}

function assertFolderFor(outDir, target) {
  const want = outDirNameFor(target);
  if (path.basename(path.resolve(outDir)) !== want) {
    throw new Error(`target ${target} is built into ${want}/, not ${path.basename(path.resolve(outDir))}/ (${outDir})`);
  }
}

// ---- addresses ---------------------------------------------------------------------------------------------------

/** "index.html" -> "/", "ar/index.html" -> "/ar/", "private-stays.html" -> "/private-stays". Posix separators. */
export function htmlFileToPath(rel) {
  if (!rel.endsWith(".html")) throw new Error(`not an html file: ${JSON.stringify(rel)}`);
  if (rel === "index.html") return "/";
  if (rel.endsWith("/index.html")) return `/${rel.slice(0, -"index.html".length)}`;
  return `/${rel.slice(0, -".html".length)}`;
}

/**
 * The sections that are never public pages. A locale prefix does not change that (ar/login.html is excluded too).
 * Any name that starts with an underscore (the test harness, Next's own documents) is excluded by the rule below.
 */
const NOT_PUBLIC = new Set(["dashboard", "account", "login", "booking", "bookings", "fx", "newsletter", "embed"]);

export function isSitemapExcluded(rel) {
  const segments = rel.split("/");
  if (segments[segments.length - 1] === "404.html") return true;
  if (segments.some((segment) => segment.startsWith("_"))) return true;
  const { path: pagePath } = stripLocale(htmlFileToPath(rel));
  const first = pagePath.split("/")[1] ?? "";
  return NOT_PUBLIC.has(first);
}

// ---- sitemap.xml -------------------------------------------------------------------------------------------------

function escapeXml(text) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

/**
 * Every live public page once. A page that exists in all three locales is three <url> entries, each with four
 * alternates (en, ar, es, x-default -> en); an English-only page is one entry with none. A page present in ar or
 * es but missing a locale throws. No lastmod and no priority: no reliable date exists and none is invented.
 */
export function buildSitemap(htmlFiles) {
  const pages = new Map(); // base path -> { en?, ar?, es? } -> rel
  for (const rel of htmlFiles) {
    if (isSitemapExcluded(rel)) continue;
    const { locale, path: base } = stripLocale(htmlFileToPath(rel));
    const slot = pages.get(base) ?? {};
    if (slot[locale]) throw new Error(`two documents for ${SITE_ORIGIN}${localePath(locale, base)}: ${slot[locale]} and ${rel}`);
    slot[locale] = rel;
    pages.set(base, slot);
  }

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
  ];
  for (const base of [...pages.keys()].sort()) {
    const slot = pages.get(base);
    const translated = LOCALES.filter((locale) => locale !== "en" && slot[locale]);
    if (translated.length === 0) {
      lines.push("  <url>", `    <loc>${escapeXml(SITE_ORIGIN + htmlFileToPath(slot.en))}</loc>`, "  </url>");
      continue;
    }
    const missing = LOCALES.filter((locale) => !slot[locale]);
    if (missing.length > 0) {
      throw new Error(
        `${base} is half translated: no document for ${missing.map((l) => localePath(l, base)).join(", ")} ` +
          `(present: ${LOCALES.filter((l) => slot[l]).map((l) => localePath(l, base)).join(", ")})`,
      );
    }
    const alternates = [
      ["en", SITE_ORIGIN + localePath("en", base)],
      ["ar", SITE_ORIGIN + localePath("ar", base)],
      ["es", SITE_ORIGIN + localePath("es", base)],
      ["x-default", SITE_ORIGIN + localePath("en", base)],
    ];
    for (const locale of LOCALES) {
      const own = SITE_ORIGIN + localePath(locale, base);
      const fromFile = SITE_ORIGIN + htmlFileToPath(slot[locale]);
      if (own !== fromFile) throw new Error(`${slot[locale]} is served at ${fromFile}, but the locale helper says ${own}`);
      lines.push("  <url>", `    <loc>${escapeXml(own)}</loc>`);
      for (const [hreflang, href] of alternates) {
        lines.push(`    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>`);
      }
      lines.push("  </url>");
    }
  }
  lines.push("</urlset>", "");
  return lines.join("\n");
}

// ---- the folder ---------------------------------------------------------------------------------------------------

/** public/ is copied into the output folder before anything else, so a crawl file there would bypass the target logic. */
export function assertPublicClean(root = REPO_ROOT) {
  const found = ["robots.txt", "sitemap.xml", "_headers"].filter((name) => fs.existsSync(path.join(root, "public", name)));
  if (found.length > 0) {
    throw new Error(
      `public/ must not hold ${found.join(", ")}: the assembler writes them per target (scripts/crawl-files.mjs), and a copy from public/ would bypass that`,
    );
  }
}

const read = (file) => fs.readFileSync(file, "utf8");

/**
 * Writes _headers, robots.txt and (not on preview or ops) sitemap.xml into outDir. _headers always starts as the
 * repo-root file, byte for byte; only the preview and ops targets append the one noindex block after it.
 */
export function writeTargetFiles({ outDir, target, root = REPO_ROOT, htmlFiles }) {
  assertTarget(target);
  assertFolderFor(outDir, target);
  fs.mkdirSync(outDir, { recursive: true });
  const headers = read(path.join(root, "_headers"));
  if (isNoindexTarget(target)) {
    const block = read(path.join(root, "deploy", "preview", "_headers"));
    fs.writeFileSync(path.join(outDir, "_headers"), `${headers}${headers.endsWith("\n") ? "" : "\n"}\n${block}`);
    fs.copyFileSync(path.join(root, "deploy", "preview", "robots.txt"), path.join(outDir, "robots.txt"));
    return;
  }
  fs.writeFileSync(path.join(outDir, "_headers"), headers);
  fs.copyFileSync(path.join(root, "deploy", "production", "robots.txt"), path.join(outDir, "robots.txt"));
  fs.writeFileSync(path.join(outDir, "sitemap.xml"), buildSitemap(htmlFiles));
}

/** Throws, naming the file, unless the folder's crawl files match its target. */
export function assertTargetFiles(outDir, target, { root = REPO_ROOT } = {}) {
  assertTarget(target);
  assertFolderFor(outDir, target);
  const file = (name) => path.join(outDir, name);
  const fail = (name, why) => {
    throw new Error(`${path.basename(path.resolve(outDir))}/${name}: ${why} (target ${target})`);
  };
  const need = (name) => {
    if (!fs.existsSync(file(name))) fail(name, "is missing");
    return read(file(name));
  };

  const headers = need("_headers");
  const robots = need("robots.txt");

  if (isNoindexTarget(target)) {
    const block = read(path.join(root, "deploy", "preview", "_headers"));
    if (!headers.endsWith(block)) fail("_headers", "does not end with the preview noindex block");
    if (headers.split(block).length - 1 !== 1 || (headers.match(/x-robots-tag/gi) ?? []).length !== 1) {
      fail("_headers", "must carry the noindex block exactly once");
    }
    if (robots !== read(path.join(root, "deploy", "preview", "robots.txt"))) fail("robots.txt", "is not the preview disallow-all file");
    if (fs.existsSync(file("sitemap.xml"))) fail("sitemap.xml", "must not exist on the preview host");
    return;
  }

  // production and local: the files of the live site.
  if (/noindex/i.test(headers) || /x-robots-tag/i.test(headers)) fail("_headers", "carries noindex or X-Robots-Tag, which would de-index the live site");
  if (/^Disallow:\s*\/\s*$/m.test(robots)) fail("robots.txt", "carries a bare Disallow: /, which would de-index the live site");
  if (!robots.split("\n").includes(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`)) fail("robots.txt", "has no Sitemap line");
  const production = path.join(root, "deploy", "production", "robots.txt");
  if (fs.existsSync(production) && robots !== read(production)) fail("robots.txt", "is not deploy/production/robots.txt");
  if (!fs.existsSync(file("sitemap.xml"))) fail("sitemap.xml", "is missing");
}
