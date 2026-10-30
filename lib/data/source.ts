// lib/data/source.ts (plan 03.2-02)
//
// Server only, internal to lib/data (tests/data-boundary.test.mjs): nothing outside lib/data imports this file. It is
// the one place that decides where the public site's catalogue comes from:
//
//   ALMAR_DATA_SOURCE unset or "fixtures"   the JSON files in lib/data/fixtures (or ALMAR_FIXTURE_DIR). Local builds,
//                                           `next dev` and every node test.
//   ALMAR_DATA_SOURCE = "supabase"          the anon-readable api_* views of migration 20261005100000, read once per
//                                           process at build time. scripts/assemble-cloudflare.mjs sets this for every
//                                           preview and production build (--target=ops reads fixtures) and refuses to start
//                                           without the two public settings or with a URL that is not the live project's.
//
// Any other value throws: a typo never means fixtures. A failed read throws, so the build fails and the live site stays
// as it was (C-03); there is never a silent fall back to fixtures. Build-time reads use the PUBLIC (anon) key only (C-04):
// this file never imports lib/supabase/clients, which reads cookies and holds the service-role key.
//
// The views return exactly the fixture shapes, so rows are kept as they come back (no reshaping). The modules in
// lib/data call `await loadSource()` once at the top of every exported read, then `readSource(name)` (sync) inside.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertAnonKey } from "./anon-key";

export type DataSourceMode = "fixtures" | "supabase";

/** Fixture file name -> the view that replaces it. The journey tiers live inside home.json / home-translations.json. */
export const SOURCE_VIEWS = {
  destinations: "api_destinations",
  "destination-translations": "api_destination_translations",
  stays: "api_stays",
  "stay-translations": "api_stay_translations",
  catalog: "api_catalog",
  "catalog-translations": "api_catalog_translations",
  team: "api_team",
  "team-translations": "api_team_translations",
  "journey-tiers": "api_journey_tiers",
  "journey-tier-translations": "api_journey_tier_translations",
  "image-translations": "api_image_translations",
  // Phase 6 (plan 06-01, migration 20261025120000). The page blocks and posts leave the fixtures in supabase mode;
  // lib/data/page-blocks.ts reads the five page-* views (fixtures mode reads the files themselves, never these names).
  "page-sections": "api_page_sections",
  "page-section-translations": "api_page_section_translations",
  "page-section-media": "api_page_section_media",
  "page-items": "api_page_items",
  "page-item-translations": "api_page_item_translations",
  posts: "api_posts",
  "post-translations": "api_post_translations",
  // Named here up front so 06-02, 06-04 and 06-06 never edit this map. No fixture file: fixtures mode returns [].
  "nav-links": "api_nav_links",
  "nav-link-translations": "api_nav_link_translations",
  "legal-pages": "api_legal_pages",
  "legal-page-translations": "api_legal_page_translations",
  "journey-tier-legs": "api_journey_tier_legs",
  "journey-tier-leg-translations": "api_journey_tier_leg_translations",
  "journey-tier-addons": "api_journey_tier_addons",
} as const;

export type SourceName = keyof typeof SOURCE_VIEWS;

/**
 * The sort that makes paging stable and gives the reads the same order the views define: entity views by (position, slug)
 * (slug is unique), translation views by (parent id, locale), which is their primary key.
 */
const ORDER: Record<SourceName, readonly string[]> = {
  destinations: ["position", "slug"],
  "destination-translations": ["destination_id", "locale"],
  stays: ["position", "slug"],
  "stay-translations": ["stay_id", "locale"],
  catalog: ["position", "slug"],
  "catalog-translations": ["item_id", "locale"],
  team: ["position", "slug"],
  "team-translations": ["member_id", "locale"],
  "journey-tiers": ["position", "slug"],
  "journey-tier-translations": ["tier_id", "locale"],
  "image-translations": ["image_id", "locale"],
  "page-sections": ["page", "section"],
  "page-section-translations": ["section_id", "locale"],
  "page-section-media": ["section_id", "slot", "position"],
  "page-items": ["position", "id"],
  "page-item-translations": ["card_id", "locale"],
  posts: ["slug"],
  "post-translations": ["post_id", "locale"],
  "nav-links": ["area", "position", "id"],
  "nav-link-translations": ["link_id", "locale"],
  "legal-pages": ["kind"],
  "legal-page-translations": ["page_id", "locale"],
  "journey-tier-legs": ["tier_id", "position", "id"],
  "journey-tier-leg-translations": ["leg_id", "locale"],
  "journey-tier-addons": ["tier_id", "position", "item_id"],
};

/** Phase 6 sources with no fixture file: fixtures mode returns [] for them and reads no file. */
const NO_FIXTURE: ReadonlySet<SourceName> = new Set([
  "nav-links",
  "nav-link-translations",
  "legal-pages",
  "legal-page-translations",
  "journey-tier-legs",
  "journey-tier-leg-translations",
  "journey-tier-addons",
]);

/** Read through lib/data/page-blocks.ts only, which reads the fixture files itself in fixtures mode. */
const PAGE_VIEWS: ReadonlySet<SourceName> = new Set([
  "page-sections",
  "page-section-translations",
  "page-section-media",
  "page-items",
  "page-item-translations",
]);

/** PostgREST answers at most 1,000 rows a request by default (research pitfall 6): read in pages of this size. */
const PAGE = 1000;

// ---------------------------------------------------------------------------------------------------------------
// Mode
// ---------------------------------------------------------------------------------------------------------------

export function dataSource(): DataSourceMode {
  const value = process.env.ALMAR_DATA_SOURCE;
  if (value === undefined || value === "" || value === "fixtures") return "fixtures";
  if (value === "supabase") return "supabase";
  throw new Error(`ALMAR_DATA_SOURCE must be "fixtures" or "supabase" (got ${JSON.stringify(value.slice(0, 40))})`);
}

// ---------------------------------------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------------------------------------

/** lib/data/fixtures, or the folder ALMAR_FIXTURE_DIR names (the parity tests build from a live-shaped copy). */
export function fixtureDir(): string {
  return process.env.ALMAR_FIXTURE_DIR || join(process.cwd(), "lib", "data", "fixtures");
}

const fileCache = new Map<string, unknown>();

/** Reads <fixture folder>/<name>.json (cached by full path). The build and the tests run from the repo root. */
export function readFixtureFile<T>(name: string): T {
  const file = join(fixtureDir(), `${name}.json`);
  let hit = fileCache.get(file);
  if (hit === undefined) {
    hit = JSON.parse(readFileSync(file, "utf8"));
    fileCache.set(file, hit);
  }
  return hit as T;
}

function fixtureSource<T>(name: SourceName): T {
  if (NO_FIXTURE.has(name)) return [] as T;
  if (PAGE_VIEWS.has(name)) throw new Error(`readSource("${name}") in fixtures mode: page blocks are read through lib/data/page-blocks.ts`);
  if (name === "journey-tiers") return readFixtureFile<{ tiers: unknown }>("home").tiers as T;
  if (name === "journey-tier-translations") return readFixtureFile<{ tiers: unknown }>("home-translations").tiers as T;
  return readFixtureFile<T>(name);
}

// ---------------------------------------------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------------------------------------------

/** The slice of the supabase-js query builder this file uses; a fake of it is injected by the node tests. */
type ViewQuery = {
  select(columns: string, options?: { count: "exact" }): ViewQuery;
  order(column: string): ViewQuery;
  range(from: number, to: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null; count?: number | null }>;
};
type ViewClient = { from(view: string): ViewQuery };
type ClientFactory = (url: string, anonKey: string) => ViewClient | Promise<ViewClient>;

let clientFactory: ClientFactory | null = null;
let loading: Promise<void> | null = null;
let rows: Map<SourceName, unknown[]> | null = null;

/**
 * The public project URL and anon key. In an assembled build the assembler hands them over as ALMAR_BUILD_SUPABASE_URL and
 * ALMAR_BUILD_SUPABASE_ANON_KEY (names Next does not inline; see nextBuildEnv in scripts/assemble-cloudflare.mjs); node
 * tests and `next dev` set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. The key's value must be an anon key
 * (lib/data/anon-key.ts). Names only in every message, never values.
 */
function publicSettings(): { url: string; anonKey: string } {
  const url = (process.env.ALMAR_BUILD_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const keyName = process.env.ALMAR_BUILD_SUPABASE_ANON_KEY ? "ALMAR_BUILD_SUPABASE_ANON_KEY" : "NEXT_PUBLIC_SUPABASE_ANON_KEY";
  const anonKey = process.env[keyName]?.trim();
  const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(Boolean);
  if (missing.length > 0 || !url || !anonKey) {
    throw new Error(`ALMAR_DATA_SOURCE=supabase needs ${missing.join(" and ")} in the build environment`);
  }
  return { url, anonKey: assertAnonKey(keyName, anonKey) };
}

// Why the build clears Next's fetch cache instead of this file asking for fresh reads (plan 03.2-02, Fable's review):
// supabase-js reads through `fetch`, and Next (15.5 and 16) stores every fetch of a build in .next/cache/fetch-cache with
// revalidate 31536000, so a second build in the same checkout serves the OLD rows. Fresh reads cannot be asked for from
// here: `cache: "no-store"` makes the force-static prerenders fail, and `next: { revalidate: 0 }` stops some routes
// prerendering. scripts/assemble-cloudflare.mjs therefore deletes .next/cache/fetch-cache before every build
// (clearFetchCache); tests/rebuild-fresh.test.mjs proves a changed title reaches the second build.
async function makeClient(url: string, anonKey: string): Promise<ViewClient> {
  if (clientFactory) return clientFactory(url, anonKey);
  // Lazy: fixtures mode (every node test, `next dev`, local builds) never loads supabase-js from here.
  const { createClient } = await import("@supabase/supabase-js");
  const client: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return client as unknown as ViewClient;
}

/**
 * Every row of one view. Pages of PAGE rows, each asking for the exact total; the next page starts after the rows read
 * so far, so a server that caps a page below PAGE is still read completely. A page that stops short of the total, or a
 * total that changed while reading, throws: a truncated read must never become a smaller site (T-3.2-11).
 */
async function readView(client: ViewClient, name: SourceName): Promise<unknown[]> {
  const view = SOURCE_VIEWS[name];
  const out: unknown[] = [];
  let total: number | null = null;
  for (;;) {
    let query = client.from(view).select("*", { count: "exact" });
    for (const column of ORDER[name]) query = query.order(column);
    const { data, error, count } = await query.range(out.length, out.length + PAGE - 1);
    if (error) throw new Error(`${view}: ${error.message}`);
    if (!Array.isArray(data)) throw new Error(`${view}: the read returned no rows array`);
    out.push(...data);
    if (typeof count === "number") {
      total = count;
      if (out.length >= count) break;
      if (data.length === 0) throw new Error(`${view}: truncated read (${out.length} of ${count} rows)`);
    } else if (data.length < PAGE) {
      break;
    }
  }
  if (total !== null && out.length !== total) {
    throw new Error(`${view}: ${out.length} rows read but the count was ${total} (the data changed while it was read)`);
  }
  return out;
}

type ImageAlt = { image_id: string; locale: string; alt?: string };

/** The ids of every image (an object with a string `id` and `media_key`) inside `value`. */
function collectImageIds(value: unknown, into: Set<string>): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectImageIds(item, into);
  } else if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.id === "string" && typeof record.media_key === "string") into.add(record.id);
    for (const item of Object.values(record)) collectImageIds(item, into);
  }
  return into;
}

/**
 * Alt texts in supabase mode: the database records only. Since plan 06-01 the page blocks and posts are read from the
 * database too, so no fixture file is read at all in this mode. No record at all, while stays exist, is a broken read (the
 * imports write every image's alts): it throws.
 */
function checkImageTranslations(database: ImageAlt[]): ImageAlt[] {
  if (database.length === 0) {
    throw new Error("api_image_translations: no alt texts while stays exist (an empty read never ships; the live site stays as it was)");
  }
  return database;
}

/** The views that must hold at least one published row: an empty one ships a site with no stays, journeys, destinations or catalogue. The team may be empty (C-17). */
const MUST_HAVE_ROWS: readonly SourceName[] = ["stays", "catalog", "journey-tiers", "destinations", "page-sections"];

/** The pictures every published picture needs an alt text for (03.2-02b: a missing one never becomes `alt=""` or an English alt on /ar and /es). */
const ALT_LOCALES = ["en", "ar", "es"] as const;

/**
 * The rows whose pictures are published through the database. Decorative page photos (the About collage and the Get In
 * Touch still, `is_decorative`) are drawn with alt="" in every language on purpose and are skipped.
 */
const PICTURE_SOURCES: readonly SourceName[] = ["stays", "destinations", "catalog", "team", "journey-tiers", "page-section-media", "page-items", "posts", "post-translations"];

/** The six About story and values pictures imported with no alt text: each sits beside its card's title and renders alt="" today. Any other page item's picture still needs its alts. */
const NO_ALT_PAGE_ITEM_PICTURES: ReadonlySet<string> = new Set([
  "0ef47bf1-b746-598d-9180-3fc172e4914b",
  "1493a030-7ae7-5c4c-949d-1dffeb451b9b",
  "1e06f20e-03da-5c9f-b6f9-eea7cde2b73f",
  "3293b75c-05a3-5c9e-87ad-a10800211432",
  "87bed148-2b68-55ee-96ed-de615e445b43",
  "b42c46da-536d-5cc7-8bd1-2cca4a021e43",
]);

/** A source's rows as the alt check sees them: decorative page photos and the six known About pictures left out. */
function pictureRows(name: SourceName, rows: unknown[] | undefined): unknown[] {
  if (name === "page-items" && rows) return rows.filter((row) => !NO_ALT_PAGE_ITEM_PICTURES.has((row as { image?: { id?: string } }).image?.id ?? ""));
  if (name !== "page-section-media" || !rows) return rows ?? [];
  return rows.filter((row) => !(row as { is_decorative?: boolean }).is_decorative);
}

/** Throws, naming the pictures, when a published picture lacks a non-empty alt text in en, ar or es. */
function assertAltTexts(loaded: Map<SourceName, unknown[]>, alts: ImageAlt[]): void {
  const ids = new Set<string>();
  for (const name of PICTURE_SOURCES) collectImageIds(pictureRows(name, loaded.get(name)), ids);
  const have = new Set(alts.filter((r) => typeof r.alt === "string" && r.alt.trim() !== "").map((r) => `${r.image_id}:${r.locale}`));
  const missing: string[] = [];
  for (const id of [...ids].sort()) for (const locale of ALT_LOCALES) if (!have.has(`${id}:${locale}`)) missing.push(`${id} (${locale})`);
  if (missing.length > 0) {
    const shown = missing.slice(0, 10).join(", ");
    throw new Error(`api_image_translations: ${missing.length} alt text(s) missing for published pictures, ${shown}${missing.length > 10 ? ", …" : ""}`);
  }
}

async function readAll(): Promise<void> {
  const { url, anonKey } = publicSettings();
  const client = await makeClient(url, anonKey);
  const loaded = new Map<SourceName, unknown[]>();
  for (const name of Object.keys(SOURCE_VIEWS) as SourceName[]) loaded.set(name, await readView(client, name));
  // No publish-sequence check here: Next caches every fetch of a static build, so a second read in this process would be a
  // cache hit. scripts/assemble-cloudflare.mjs (guardPublishSequence) reads api_site_version before and after the build.
  for (const name of MUST_HAVE_ROWS) {
    if (loaded.get(name)!.length === 0) {
      throw new Error(`${SOURCE_VIEWS[name]}: no published rows (an empty ${name} never ships; the live site stays as it was)`);
    }
  }
  const alts = checkImageTranslations(loaded.get("image-translations") as ImageAlt[]);
  assertAltTexts(loaded, alts);
  loaded.set("image-translations", alts);
  rows = loaded;
}

/**
 * Loads every view once per process (memoised, concurrent callers share one load; a failure stays failed so every later
 * caller gets the same error). Fixtures mode: resolves at once. Call it at the top of every exported read.
 */
export async function loadSource(): Promise<void> {
  if (dataSource() === "fixtures") return;
  if (rows) return; // once loaded: the same path, with the same microtask ticks, as fixtures mode (see tests/parity)
  loading ??= readAll();
  await loading;
}

// Supabase mode: the load starts as this module is imported, so it is usually done before a page that imports lib/data
// starts to render (a page that waited for the network itself streams its React Flight rows in another order than the
// same page built from fixtures; parity-build lists that as ORDER ONLY). No top-level await: the Playwright build specs
// load lib/data as CommonJS, where it is a syntax error. The rejection is caught here only so an import never raises an
// unhandled rejection; every read still awaits the same memoised promise, gets the same error, and the build stops.
// Fixtures mode and the Worker at request time (no ALMAR_DATA_SOURCE there) do nothing here.
if (process.env.ALMAR_DATA_SOURCE === "supabase") loadSource().catch(() => {});

/**
 * The rows of one source, under the fixture file's name. Sync; in supabase mode `await loadSource()` must have resolved
 * (a read that skipped it throws instead of quietly returning fixtures).
 */
export function readSource<T>(name: SourceName): T {
  if (dataSource() === "fixtures") return fixtureSource<T>(name);
  if (!rows) throw new Error(`readSource("${name}") before loadSource() resolved: await loadSource() at the top of the read`);
  return rows.get(name) as T;
}

/** For node tests only: production code never calls this. */
export const __testing = {
  setClientFactory(factory: ClientFactory | null): void {
    clientFactory = factory;
  },
  reset(): void {
    clientFactory = null;
    loading = null;
    rows = null;
    fileCache.clear();
  },
};
