// lib/data/source.ts (plan 03.2-02)
//
// Server only, internal to lib/data (tests/data-boundary.test.mjs): nothing outside lib/data imports this file. It is
// the one place that decides where the public site's catalogue comes from:
//
//   ALMAR_DATA_SOURCE unset or "fixtures"   the JSON files in lib/data/fixtures (or ALMAR_FIXTURE_DIR). Local builds,
//                                           `next dev` and every node test.
//   ALMAR_DATA_SOURCE = "supabase"          the anon-readable api_* views of migration 20261005100000, read once per
//                                           process at build time. scripts/assemble-cloudflare.mjs sets this for every
//                                           assembled target and refuses to start without the two public settings.
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
};

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
 * tests and `next dev` set NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Names only in every message, never values.
 */
function publicSettings(): { url: string; anonKey: string } {
  const url = (process.env.ALMAR_BUILD_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL)?.trim();
  const anonKey = (process.env.ALMAR_BUILD_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)?.trim();
  const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY"].filter(Boolean);
  if (missing.length > 0 || !url || !anonKey) {
    throw new Error(`ALMAR_DATA_SOURCE=supabase needs ${missing.join(" and ")} in the build environment`);
  }
  return { url, anonKey };
}

// Why the build clears Next's fetch cache instead of this file asking for fresh reads (plan 03.2-02, Fable's review):
// supabase-js reads through `fetch`, and Next 15.5 stores every fetch of a build in .next/cache/fetch-cache with
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

type ImageAlt = { image_id: string; locale: string };

/**
 * Alt texts in supabase mode: every database record, plus the fixture records of images the database has no record of
 * (the pictures of the page blocks that stay in fixtures, C-21), so one (image_id, locale) is never present twice.
 */
function mergeImageTranslations(database: ImageAlt[]): ImageAlt[] {
  const known = new Set(database.map((r) => r.image_id));
  const fromFixtures = readFixtureFile<ImageAlt[]>("image-translations").filter((r) => !known.has(r.image_id));
  return [...database, ...fromFixtures];
}

async function readAll(): Promise<void> {
  const { url, anonKey } = publicSettings();
  const client = await makeClient(url, anonKey);
  const loaded = new Map<SourceName, unknown[]>();
  for (const name of Object.keys(SOURCE_VIEWS) as SourceName[]) loaded.set(name, await readView(client, name));
  if (loaded.get("stays")!.length === 0) {
    throw new Error("api_stays: no published stays (an empty catalogue never ships; the live site stays as it was)");
  }
  loaded.set("image-translations", mergeImageTranslations(loaded.get("image-translations") as ImageAlt[]));
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

// Supabase mode: the load is part of importing this module, so it has finished before any page that imports lib/data
// starts to render. A page that waited for the network itself would stream its React Flight rows in another order than
// the same page built from fixtures, and the built bytes would differ for nothing a visitor can see (parity-build).
// Fixtures mode and the Worker at request time (no ALMAR_DATA_SOURCE there) do nothing here. A failed load rejects the
// import: the build stops.
if (process.env.ALMAR_DATA_SOURCE === "supabase") await loadSource();

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
