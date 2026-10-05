// Runs every exported read of lib/data in en, ar and es and writes the results as JSON (plan 03.2-02).
//
//   node tests/helpers/data-reads.mjs <out.json>
//
// It is a child process on purpose: ALMAR_DATA_SOURCE, ALMAR_FIXTURE_DIR and the public Supabase settings are read per
// process, so the parity test runs it once in fixtures mode (a live-shaped fixture folder) and once in supabase mode
// (the local stack) and compares the two files. The lib/data modules are bundled with esbuild into a folder under the
// repo's ignored .tmp/ so that `@supabase/supabase-js` resolves from the repo's node_modules. Run from the repo root.
//
// Output: { reads: { "<read>:<arg>:<locale>": result, ... }, counts: { "<source name>": rows } } where counts are the
// rows each source returned (supabase mode: rows read from the views, after the alt-text merge).
import { build } from "esbuild";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = process.cwd();
const outFile = process.argv[2];
if (!outFile) {
  console.error("usage: node tests/helpers/data-reads.mjs <out.json>");
  process.exit(2);
}

const entry = `
import * as stays from "./lib/data/stays";
import * as destinations from "./lib/data/destinations";
import * as experiences from "./lib/data/experiences";
import * as home from "./lib/data/home";
import * as team from "./lib/data/team";
import * as posts from "./lib/data/posts";
import * as about from "./lib/data/about";
import * as contact from "./lib/data/contact";
import * as source from "./lib/data/source";
export { stays, destinations, experiences, home, team, posts, about, contact, source };
`;

mkdirSync(join(root, ".tmp"), { recursive: true });
const dir = mkdtempSync(join(root, ".tmp", "data-reads-"));
try {
  const built = await build({
    stdin: { contents: entry, resolveDir: root, loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    logLevel: "silent",
  });
  const file = join(dir, "reads.mjs");
  writeFileSync(file, built.outputFiles[0].text);
  const m = await import(pathToFileURL(file).href);

  const LOCALES = ["en", "ar", "es"];
  const reads = {};
  const put = async (name, fn) => {
    reads[name] = await fn();
  };

  // Slug lists first: the per-slug reads below walk what this source says exists.
  const staySlugs = await m.stays.getStaySlugs();
  const destinationSlugs = await m.destinations.getDestinationSlugs();
  const items = await m.experiences.getCatalogItems("en");
  reads["getStaySlugs"] = staySlugs;
  reads["getDestinationSlugs"] = destinationSlugs;
  reads["getPostSlugs"] = await m.posts.getPostSlugs();

  for (const locale of LOCALES) {
    await put(`getStays::${locale}`, () => m.stays.getStays(locale));
    for (const slug of staySlugs) {
      await put(`getStay:${slug}:${locale}`, () => m.stays.getStay(locale, slug));
      await put(`getRelatedStays:${slug}:${locale}`, () => m.stays.getRelatedStays(locale, slug));
      await put(`getRelatedStays:${slug}:limit2:${locale}`, () => m.stays.getRelatedStays(locale, slug, { limit: 2 }));
      await put(`getCatalogForStay:${slug}:${locale}`, () => m.experiences.getCatalogForStay(locale, slug));
      await put(`getCatalogItems:staySlug=${slug}:${locale}`, () => m.experiences.getCatalogItems(locale, { staySlug: slug }));
    }
    await put(`getStay:no-such-stay:${locale}`, () => m.stays.getStay(locale, "no-such-stay"));
    await put(`getCatalogForStay:no-such-stay:${locale}`, () => m.experiences.getCatalogForStay(locale, "no-such-stay"));

    await put(`getDestinations::${locale}`, () => m.destinations.getDestinations(locale));
    await put(`getDestinations:includeEmpty:${locale}`, () => m.destinations.getDestinations(locale, { includeEmpty: true }));
    for (const slug of destinationSlugs) {
      await put(`getDestination:${slug}:${locale}`, () => m.destinations.getDestination(locale, slug));
      await put(`getCatalogItems:destinationSlug=${slug}:${locale}`, () => m.experiences.getCatalogItems(locale, { destinationSlug: slug }));
    }
    await put(`getDestination:no-such-place:${locale}`, () => m.destinations.getDestination(locale, "no-such-place"));
    await put(`getDestinationsPageHero::${locale}`, () => m.destinations.getDestinationsPageHero(locale));

    await put(`getCatalogItems::${locale}`, () => m.experiences.getCatalogItems(locale));
    await put(`getCatalogItems:kind=experience:${locale}`, () => m.experiences.getCatalogItems(locale, { kind: "experience" }));
    await put(`getCatalogItems:kind=service:${locale}`, () => m.experiences.getCatalogItems(locale, { kind: "service" }));
    await put(`getCatalogItems:destinationSlugs:${locale}`, () => m.experiences.getCatalogItems(locale, { destinationSlugs }));
    await put(`getCatalogItems:staySlugs:${locale}`, () => m.experiences.getCatalogItems(locale, { staySlugs }));
    await put(`getCatalogItems:query:${locale}`, () => m.experiences.getCatalogItems(locale, { query: "private" }));
    for (const item of items) {
      await put(`getCatalogItem:${item.slug}:${locale}`, () => m.experiences.getCatalogItem(locale, item.slug));
    }
    await put(`getCatalogItem:no-such-item:${locale}`, () => m.experiences.getCatalogItem(locale, "no-such-item"));

    await put(`getTeam::${locale}`, () => m.team.getTeam(locale));
    await put(`getJourneyTiers::${locale}`, () => m.home.getJourneyTiers(locale));
    await put(`getHomeBlocks::${locale}`, () => m.home.getHomeBlocks(locale));

    // Page blocks that stay in fixtures: they only share the picture alt texts, which is what the merge protects.
    await put(`getPosts::${locale}`, () => m.posts.getPosts(locale));
    for (const slug of reads["getPostSlugs"]) await put(`getPost:${slug}:${locale}`, () => m.posts.getPost(locale, slug));
    await put(`getAboutBlocks::${locale}`, () => m.about.getAboutBlocks(locale));
    await put(`getContactDetails::${locale}`, () => m.contact.getContactDetails(locale));
  }
  for (const slug of staySlugs) {
    await put(`getBlockedDates:${slug}`, () => m.stays.getBlockedDates(slug));
  }
  await put("getBlockedDates:no-such-stay", () => m.stays.getBlockedDates("no-such-stay"));

  // Row counts of every source (after loading), so a truncated read is a number the test can compare.
  await m.source.loadSource();
  const counts = {};
  for (const name of Object.keys(m.source.SOURCE_VIEWS)) counts[name] = m.source.readSource(name).length;

  writeFileSync(resolve(outFile), JSON.stringify({ mode: m.source.dataSource(), reads, counts }));
} finally {
  rmSync(dir, { recursive: true, force: true });
}
