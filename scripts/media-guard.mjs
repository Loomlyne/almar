// scripts/media-guard.mjs
//
// The deploy check for the image host (plan 03.3-07, design 10.1). No page may ship pointing at a host that does
// not exist, or at Framer, catbox or pexels.
//
//   node scripts/media-guard.mjs --deploy [--out <dir>] [--root <dir>]
//
// The controller runs it between the assemble step and every preview or production deploy (runbook C10); plan 08's
// assembler calls assertMediaReady() for the preview and production targets. It exits 1 while the placeholder is
// set, while the media base is not an https origin, or while any React document (slice 1, the blog, and About and Contact once they are in PUBLIC_PAGES) in the output folder
// holds the placeholder, a third-party image host, or an <img> src / srcset / og:image that does not start with the
// media base. Two same-site shapes are let through for an <img src>: the nav wordmark files under /_next/static/media/
// and the light footer's inline brand SVG (a data:image/svg+xml URL whose markup names nothing outside itself).

import fs from "node:fs";
import path from "node:path";
import { MEDIA_BASE_URL, MEDIA_BASE_URL_IS_PLACEHOLDER } from "../lib/data/media.ts";
import { FORBIDDEN_HOSTS, REPO_ROOT, defaultPaths, isMain, readPostSlugs, readStaySlugs, reactDocuments } from "./media-lib.mjs";

/**
 * The nav wordmarks (Poly_White, Stacked_Charcoal) are brand assets from brand/: the Next build hashes them to
 * /_next/static/media/<name>.<hash>.svg and the site serves them itself. That one same-origin shape is allowed for
 * an <img src> or a srcset candidate: a single plain file name under that folder (no deeper path, no "..", no
 * query, no scheme, no "//"). Everything else, and every og:image, must start with the media base.
 */
const SAME_ORIGIN_BRAND_ASSET_RE = /^\/_next\/static\/media\/(?!\.+$)[A-Za-z0-9._-]+$/;

/**
 * The light footer's wordmark is not a file: components/ui/footer.tsx writes the brand SVG markup into its <img src>
 * as `data:image/svg+xml;charset=utf-8,<encodeURIComponent(markup)>`. Inline markup is no network request, so it
 * cannot reach a forbidden host, and the guard lets it through, but only for an <img src> (never an og:image, never a
 * srcset candidate) and only while the decoded markup names nothing outside itself. The only accepted form is the
 * plain percent-encoded one (no ;base64, no other parameter).
 */
const INLINE_SVG_RE = /^data:image\/svg\+xml(?:;charset=utf-8)?,([\s\S]*)$/;

/**
 * Parts of an SVG that look like URLs but are names, not requests: the xmlns declarations and the W3C SVG 1.1
 * DOCTYPE the brand files carry. They are removed before the markup is searched for references. An xmlns value may
 * not contain markup, so a declaration cannot be used to hide a reference.
 */
const INERT_SVG_PARTS = [
  /<!DOCTYPE\s+svg\s+PUBLIC\s+"[^"<>[\]]*"\s+"http:\/\/www\.w3\.org\/Graphics\/SVG\/[^"<>[\]]*"\s*>/i,
  /\sxmlns(?::[A-Za-z_][\w.-]*)?\s*=\s*(?:"[^"<>]*"|'[^'<>]*')/g,
];

/** What, in SVG markup, points outside the document or could be hiding such a pointer. First match is reported. */
const SVG_EXTERNAL_REFERENCES = [
  [/https?:/i, "names an http(s) URL"],
  [/\/\//, 'has a "//" (a protocol-relative URL)'],
  [/@import/i, "has an @import"],
  [/\bhref\s*=\s*(?:"(?!#)|'(?!#)|(?!["'#]))/i, "has an href that is not a fragment of its own document"],
  [/url\(\s*(?:["']\s*)?(?!#)/i, "has a url() that points off-document"],
  [/<!(?:DOCTYPE|ENTITY)/i, "has a DOCTYPE or ENTITY other than the W3C SVG 1.1 one"],
  [/&#/, "has a numeric character reference"],
  [/\\/, "has a backslash escape"],
];

/**
 * Why an <img src> that starts with `data:image/svg+xml` is not allowed, as a clause that follows "is an inline SVG
 * that", or null when it is a self-contained, percent-encoded SVG.
 */
export function inlineSvgProblem(url) {
  const m = url.match(INLINE_SVG_RE);
  if (!m) return "is not plain percent-encoded markup (only ;charset=utf-8, no ;base64)";
  let markup;
  try {
    markup = decodeURIComponent(m[1]);
  } catch {
    return "has a bad percent-escape";
  }
  for (const part of INERT_SVG_PARTS) markup = markup.replace(part, "");
  for (const [re, why] of SVG_EXTERNAL_REFERENCES) {
    if (re.test(markup)) return why;
  }
  return null;
}

/** The placeholder base is a reserved .invalid name; any such host in a document is a leftover of it. */
const INVALID_HOST_RE = /[a-z0-9][a-z0-9.-]*\.invalid\b/gi;

const PLACEHOLDER_MESSAGE = "media host is a placeholder (MEDIA_BASE_URL_IS_PLACEHOLDER = true): R2 runbook step C9 has not landed";

/**
 * The two constants of lib/data/media.ts. For the repo itself they are the real imports; for another root (a scratch
 * copy in a test) the file is read by pattern, exactly one declaration of each.
 */
export function readMediaConstants(root = REPO_ROOT) {
  if (path.resolve(root) === REPO_ROOT) return { base: MEDIA_BASE_URL, placeholder: MEDIA_BASE_URL_IS_PLACEHOLDER };
  const text = fs.readFileSync(path.join(root, "lib", "data", "media.ts"), "utf8");
  const urls = [...text.matchAll(/^export const MEDIA_BASE_URL = "([^"]*)";/gm)];
  const flags = [...text.matchAll(/^export const MEDIA_BASE_URL_IS_PLACEHOLDER = (true|false);/gm)];
  if (urls.length !== 1 || flags.length !== 1) {
    throw new Error("lib/data/media.ts must declare MEDIA_BASE_URL and MEDIA_BASE_URL_IS_PLACEHOLDER exactly once each");
  }
  return { base: urls[0][1], placeholder: flags[0][1] === "true" };
}

/** Why a base is not usable on a real deploy, or null when it is an https origin that can resolve. */
export function baseProblem(base) {
  let u;
  try {
    u = new URL(base);
  } catch {
    return `media host ${JSON.stringify(base)} is not a URL`;
  }
  if (u.protocol !== "https:" || u.origin !== base || u.hostname.endsWith(".invalid") || u.username || u.password) {
    return `media host ${JSON.stringify(base)} is not an https origin that can resolve (no path, no trailing slash, not .invalid): set MEDIA_BASE_URL in lib/data/media.ts (R2 runbook step C9)`;
  }
  return null;
}

/** Throws unless the media base is real. Returns the base. Synchronous, so an assembler can call it first. */
export function assertMediaReady({ root = REPO_ROOT } = {}) {
  const { base, placeholder } = readMediaConstants(root);
  if (placeholder) throw new Error(PLACEHOLDER_MESSAGE);
  const problem = baseProblem(base);
  if (problem) throw new Error(problem);
  return base;
}

function decode(value) {
  return value.replaceAll("&amp;", "&").replaceAll("&#x27;", "'").replaceAll("&quot;", '"').trim();
}

function attr(tag, name) {
  const m = tag.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"));
  return m ? decode(m[1] ?? m[2] ?? "") : null;
}

/** Every image reference in a document: <img src>, any srcset candidate, and og:image. */
export function imageReferences(html) {
  const refs = [];
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = attr(m[0], "src");
    if (src !== null) refs.push({ kind: "img src", url: src });
    else refs.push({ kind: "img without src", url: "" });
  }
  for (const m of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const set = attr(m[0], "srcset");
    if (set === null) continue;
    for (const cand of set.split(",")) {
      const url = cand.trim().split(/\s+/)[0];
      if (url) refs.push({ kind: "srcset", url });
    }
  }
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if ((attr(m[0], "property") ?? "").toLowerCase() === "og:image") refs.push({ kind: "og:image", url: attr(m[0], "content") ?? "" });
  }
  return refs;
}

/**
 * Scans the guarded documents under outDir. Returns
 * `{ violations: [{ document, problem }], documents, images }`: `documents` is how many were found and read,
 * `images` how many image references were checked.
 */
export function scanOut(outDir, base, { documents = reactDocuments() } = {}) {
  const violations = [];
  let found = 0;
  let images = 0;
  for (const doc of documents) {
    const file = path.join(outDir, ...doc.split("/"));
    if (!fs.existsSync(file)) {
      violations.push({ document: doc, problem: "document is missing" });
      continue;
    }
    found++;
    const html = fs.readFileSync(file, "utf8");
    for (const host of new Set(html.match(INVALID_HOST_RE) ?? [])) violations.push({ document: doc, problem: `contains the placeholder host ${host}` });
    for (const host of FORBIDDEN_HOSTS) {
      if (html.includes(host)) violations.push({ document: doc, problem: `contains ${host}` });
    }
    for (const ref of imageReferences(html)) {
      images++;
      if (ref.kind !== "og:image" && SAME_ORIGIN_BRAND_ASSET_RE.test(ref.url)) continue;
      if (ref.kind === "img src" && ref.url.startsWith("data:image/svg+xml")) {
        const why = inlineSvgProblem(ref.url);
        if (why) violations.push({ document: doc, problem: `img src ${JSON.stringify(ref.url.slice(0, 120))} is an inline SVG that ${why}` });
        continue;
      }
      if (!ref.url.startsWith(`${base}/`)) {
        violations.push({ document: doc, problem: `${ref.kind} ${JSON.stringify(ref.url.slice(0, 120))} does not start with ${base}/` });
      }
    }
  }
  return { violations, documents: found, images };
}

/** Returns the exit code. */
export function main(argv = [], { log = console.log } = {}) {
  let root;
  let out = "out";
  let deploy = false;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--deploy") deploy = true;
    else if (a === "--root") root = path.resolve(argv[++i] ?? "");
    else if (a === "--out") out = argv[++i] ?? "";
    else {
      log(`media-guard: unknown argument ${JSON.stringify(a)}`);
      deploy = false;
      break;
    }
  }
  if (!deploy) {
    log("usage: node scripts/media-guard.mjs --deploy [--out <dir>] [--root <dir>]");
    return 2;
  }
  const paths = defaultPaths(root);
  let base;
  try {
    base = assertMediaReady({ root: paths.root });
  } catch (err) {
    log(`media-guard: ${err.message}`);
    return 1;
  }
  const outDir = path.resolve(paths.root, out);
  if (!fs.existsSync(outDir)) {
    log(`media-guard: ${path.relative(paths.root, outDir) || out}/ is absent: run the assembler first`);
    return 1;
  }
  const { violations, documents, images } = scanOut(outDir, base, { documents: reactDocuments(readStaySlugs(paths.fixturesDir), readPostSlugs(paths.fixturesDir)) });
  if (violations.length) {
    for (const v of violations) log(`media-guard: ${v.document}: ${v.problem}`);
    log(`media-guard: ${violations.length} violation(s) in ${out}/`);
    return 1;
  }
  log(`media-guard: OK ${base}, ${documents} documents, ${images} image references`);
  return 0;
}

if (isMain(import.meta.url)) process.exitCode = main(process.argv.slice(2));
