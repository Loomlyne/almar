// Prints, as JSON, the public paths the published rows say must be pages (plan 06-04, SITE-11): every post and every
// legal page, in the English form ("/blog/<slug>", "/legal/<slug>"). scripts/assemble-cloudflare.mjs runs it with the
// build's own env (expectedPublicPaths) and checks the sitemap against the list (assertSitemapCovers). 06-06 adds its
// package slugs to the same list.
//
// The TypeScript modules are bundled with esbuild, as scripts/write-site-nav.mjs does (their imports have no file
// extension, which plain Node cannot load; the bundle sits under node_modules/.cache so a bare import resolves). A failed
// read throws: the build stops and the live site stays (C-03).

import { build } from "esbuild";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function loadReaders() {
  const out = await build({
    stdin: {
      contents: [
        'export { getPostSlugs } from "./lib/data/posts.ts";',
        'export { getPublishedLegalKinds } from "./lib/data/legal.ts";',
        'export { LEGAL_SLUGS } from "./lib/legal/kinds.ts";',
      ].join("\n"),
      resolveDir: ROOT,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    logLevel: "silent",
  });
  const cache = join(ROOT, "node_modules/.cache");
  mkdirSync(cache, { recursive: true });
  const dir = mkdtempSync(join(cache, "almar-expected-paths-"));
  const file = join(dir, "expected-paths.mjs");
  writeFileSync(file, out.outputFiles[0].text);
  try {
    return await import(pathToFileURL(file).href);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function readExpectedPublicPaths() {
  const { getPostSlugs, getPublishedLegalKinds, LEGAL_SLUGS } = await loadReaders();
  const posts = await getPostSlugs();
  const legal = await getPublishedLegalKinds();
  return [...posts.map((slug) => `/blog/${slug}`), ...legal.map((kind) => `/legal/${LEGAL_SLUGS[kind]}`)];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.stdout.write(`${JSON.stringify(await readExpectedPublicPaths())}\n`);
}
