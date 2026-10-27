// Writes lib/data/site-nav.snapshot.json, the header and footer links the public build bakes (plan 06-02, CMS-09).
//
//   node scripts/write-site-nav.mjs            fixtures mode (default): today's links, defaultNavSnapshot()
//   ALMAR_DATA_SOURCE=supabase node scripts/write-site-nav.mjs
//                                              the published links from api_nav_links + api_nav_link_translations,
//                                              read through lib/data/source.ts with the anon key only (the same env
//                                              checks as every build read; never the service-role key)
//
// scripts/assemble-cloudflare.mjs runs it before `next build` with the build's own env. A link whose page is not on the
// site yet (targetAvailable: PUBLIC_PAGES, published legal kinds, published package slugs) is left out. Hidden links are
// already out of the view. A failed or truncated read throws: the build stops and the live site stays (C-03). An empty
// header is allowed: Login, currency and language are drawn in code.
//
// The TypeScript modules are bundled with esbuild (their imports have no file extension, which plain Node cannot load).

import { build } from "esbuild";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const SNAPSHOT = join(ROOT, "lib/data/site-nav.snapshot.json");
const AREAS = ["header", "footer"];
const LOCALES = ["en", "ar", "es"];
const LEGAL = ["privacy", "terms", "booking_terms", "waiver", "disclaimer"];

async function loadModules() {
  const out = await build({
    stdin: {
      contents: [
        'export { defaultNavSnapshot, navItem, targetAvailable } from "./lib/site-nav.ts";',
        'export { PUBLIC_PAGES } from "./lib/locale-path.ts";',
        'export { dataSource, loadSource, readSource } from "./lib/data/source.ts";',
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
  const dir = mkdtempSync(join(tmpdir(), "almar-site-nav-"));
  const file = join(dir, "site-nav.mjs");
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

/** A published record in this language, else the published English one (the site's fallback rule). */
function labelOf(records, locale) {
  const published = records.filter((r) => r.status === "published" && typeof r.label === "string" && r.label.trim() !== "");
  const hit = published.find((r) => r.locale === locale) ?? published.find((r) => r.locale === "en");
  return hit ? hit.label.trim() : null;
}

/** The kinds published in all three languages (a legal page exists only then, 06-04). */
function publishedLegal(pages, translations) {
  return pages
    .filter((p) => LEGAL.includes(p.kind))
    .filter((p) => LOCALES.every((l) => translations.some((t) => t.page_id === p.id && t.locale === l && t.status === "published")))
    .map((p) => p.kind);
}

/** The snapshot from the database rows (pure, so a node test feeds it rows). */
export function snapshotFromRows(mod, { links, translations, built }) {
  const out = { header: { en: [], ar: [], es: [] }, footer: { en: [], ar: [], es: [] } };
  const sorted = [...links].sort((a, b) => (a.area === b.area ? a.position - b.position : a.area.localeCompare(b.area)));
  for (const link of sorted) {
    if (!AREAS.includes(link.area)) throw new Error(`site-nav: unknown area ${JSON.stringify(String(link.area))}`);
    if (link.link_kind === "internal" && !mod.targetAvailable(link.target, built)) continue;
    const records = translations.filter((t) => t.link_id === link.id);
    for (const locale of LOCALES) {
      const label = labelOf(records, locale);
      if (label === null) throw new Error(`site-nav: link ${link.id} has no published English label`);
      out[link.area][locale].push(mod.navItem(locale, { link_kind: link.link_kind, target: link.target, label }));
    }
  }
  return out;
}

export async function writeSiteNav() {
  const mod = await loadModules();
  let snapshot;
  if (mod.dataSource() === "fixtures") {
    snapshot = mod.defaultNavSnapshot();
  } else {
    await mod.loadSource();
    const built = {
      pages: mod.PUBLIC_PAGES,
      legal: publishedLegal(mod.readSource("legal-pages"), mod.readSource("legal-page-translations")),
      packages: mod.readSource("journey-tiers").map((t) => t.slug),
    };
    snapshot = snapshotFromRows(mod, { links: mod.readSource("nav-links"), translations: mod.readSource("nav-link-translations"), built });
  }
  writeFileSync(SNAPSHOT, `${JSON.stringify(snapshot, null, 2)}\n`);
  return snapshot;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const snapshot = await writeSiteNav();
  const count = (area) => snapshot[area].en.length;
  console.log(`site-nav: header ${count("header")}, footer ${count("footer")} links -> lib/data/site-nav.snapshot.json`);
}
