import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import test from "node:test";
import { MEDIA_BASE_URL } from "../../lib/data/media.ts";
import { SITE_ORIGIN, localeAlternates, localeDir, matchPublicPage, stripLocale } from "../../lib/locale-path.ts";
import { jsonLdUrlViolations } from "../helpers/json-ld-urls.mjs";
import { HIDDEN, KNOWN_DEAD, deadKey, resolveInOut } from "../helpers/site-links.mjs";

// Invariants of the assembled out/ folder, true at every stage of the slice (no React page yet, some pages,
// all pages). The exact 42-document inventory is asserted in tests/build/locale-routing.spec.ts.
// Not in the tests/*.test.mjs glob on purpose: it needs `node scripts/assemble-cloudflare.mjs` first.

const OUT = "out";
if (!existsSync(join(OUT, "404.html"))) {
  throw new Error("out/404.html is missing: run node scripts/assemble-cloudflare.mjs first");
}

function walk(dir, found = []) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === "_next") continue; // static assets, not documents
      walk(full, found);
    } else if (name.endsWith(".html")) found.push(relative(OUT, full).split("\\").join("/"));
  }
  return found;
}

/** The URL a document is served at (a 404 is served at any path under its folder, so its base is the folder). */
function servedPath(file) {
  if (file === "404.html") return "/";
  if (file.endsWith("/404.html")) return `/${file.slice(0, -"404.html".length)}`;
  if (file === "index.html") return "/";
  if (file.endsWith("/index.html")) return `/${file.slice(0, -"index.html".length)}`;
  return `/${file.slice(0, -".html".length)}`;
}

const isNotFound = (file) => file === "404.html" || file === "ar/404.html" || file === "es/404.html";
const read = (file) => readFileSync(join(OUT, file), "utf8");

const files = walk(OUT).sort();
const docs = files.map((file) => {
  const html = read(file);
  const kind = isNotFound(file) ? "404" : html.includes("self.__next_f") ? "react" : "framer";
  return { file, html, kind };
});
const reactDocs = docs.filter((d) => d.kind === "react");
const framerDocs = docs.filter((d) => d.kind === "framer");

function htmlTag(html) {
  return /<html\b[^>]*>/i.exec(html)?.[0] ?? "";
}

function attr(tag, name) {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[1] ?? m[2]) : null;
}

function linkTags(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
}

test("out/ has the three 404s and no out/ar.html or out/es.html", () => {
  for (const f of ["404.html", "ar/404.html", "es/404.html"]) assert.ok(files.includes(f), f);
  for (const f of ["ar.html", "es.html"]) assert.equal(files.includes(f), false, f);
});

test("every document under out/ar and out/es other than 404.html is a React document", () => {
  const stray = docs.filter((d) => /^(ar|es)\//.test(d.file) && d.kind !== "react" && !isNotFound(d.file));
  assert.deepEqual(stray.map((d) => d.file), []);
});

test("the three 404s carry their language and direction", () => {
  for (const [file, lang] of [["404.html", "en"], ["ar/404.html", "ar"], ["es/404.html", "es"]]) {
    const tag = htmlTag(read(file));
    assert.equal(attr(tag, "lang"), lang, file);
    assert.equal(attr(tag, "dir"), localeDir(lang), file);
  }
});

for (const { file, html } of reactDocs) {
  const url = servedPath(file);
  const { locale, path } = stripLocale(url);

  test(`React ${file}: lang, dir, canonical and four hreflang alternates`, () => {
    const tag = htmlTag(html);
    assert.equal(attr(tag, "lang"), locale);
    assert.equal(attr(tag, "dir"), localeDir(locale));
    assert.notEqual(matchPublicPage(path), null, `${url} is not in PUBLIC_PAGES`);
    const want = localeAlternates(locale, path);
    const links = linkTags(html);
    const alternates = links.filter((l) => /hreflang/i.test(l));
    assert.equal(alternates.length, 4, `${file}: ${alternates.length} hreflang links`);
    const got = Object.fromEntries(alternates.map((l) => [attr(l, "hreflang"), attr(l, "href")]));
    assert.deepEqual(got, want.languages);
    const canonical = links.filter((l) => /rel\s*=\s*["']canonical["']/i.test(l));
    assert.equal(canonical.length, 1, `${file}: ${canonical.length} canonical links`);
    assert.equal(attr(canonical[0], "href"), want.canonical);
    for (const href of Object.values(got)) {
      assert.equal(resolveInOut(OUT, new URL(href).pathname), "ok", `${file}: alternate ${href} is not served`);
    }
  });

  test(`React ${file}: organisation JSON-LD on the real domain`, () => {
    const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    assert.ok(blocks.length > 0, "no JSON-LD block");
    // Every URL is on the real domain, except a BlogPosting's `image` (the post cover, plan 03.3-33), which is on the
    // media host: allowed by key path only (tests/helpers/json-ld-urls.mjs, proven in tests/json-ld-urls.test.mjs).
    for (const [, body] of blocks) {
      assert.deepEqual(jsonLdUrlViolations(JSON.parse(body), SITE_ORIGIN, MEDIA_BASE_URL), [], file);
    }
    assert.equal(html.includes("framer.website"), false);
  });

  test(`React ${file}: every /_next/static file it references exists`, () => {
    const refs = [
      ...[...html.matchAll(/<script\b[^>]*?\ssrc="([^"]+)"/gi)].map((m) => m[1]),
      ...linkTags(html).map((l) => attr(l, "href")),
    ].filter((r) => r && r.startsWith("/_next/static/"));
    for (const r of refs) {
      // The URL is percent-encoded (the [stay] folder is /%5Bstay%5D/ in the page); the file is on disk under its
      // decoded name, and Cloudflare's asset matcher decodes the request path the same way.
      const p = decodeURIComponent(r.split(/[?#]/)[0]);
      assert.ok(existsSync(join(OUT, p)), `${file} references ${r}, which is not in out/`);
    }
  });
}

for (const { file, html } of framerDocs) {
  test(`Framer ${file}: English, left to right, no hreflang`, () => {
    const tag = htmlTag(html);
    assert.equal(attr(tag, "lang"), "en");
    assert.ok([null, "ltr"].includes(attr(tag, "dir")), `dir ${attr(tag, "dir")}`);
    assert.equal(linkTags(html).filter((l) => /hreflang/i.test(l)).length, 0);
  });
}

for (const { file, html, kind } of docs) {
  test(`${kind} ${file}: every internal link resolves under the static-assets rules`, () => {
    const base = new URL(servedPath(file), SITE_ORIGIN);
    const bad = [];
    for (const [, raw] of html.matchAll(/<a\b[^>]*?\shref="([^"]*)"/g)) {
      if (/^(mailto:|tel:|#|javascript:)/i.test(raw)) continue;
      const url = new URL(raw.replaceAll("&amp;", "&"), base);
      if (url.origin !== SITE_ORIGIN) continue;
      const pathname = url.pathname;
      const key = deadKey(pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname);
      if (HIDDEN.includes(key)) {
        bad.push(`${raw}: a hidden path must not be linked`);
        continue;
      }
      const result = resolveInOut(OUT, pathname);
      if (result === "redirect") bad.push(`${raw}: costs a redirect (${pathname})`);
      else if (result === "missing" && !(kind === "framer" && KNOWN_DEAD.includes(key))) {
        bad.push(`${raw}: no file in out/ for ${pathname}`);
      }
    }
    assert.deepEqual(bad, []);
  });
}
