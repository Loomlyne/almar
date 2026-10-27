// What the Phase 6 page views (migration 20261025120000) return after scripts/import-site-content.mjs, built in memory
// from that script's payload (plan 06-01). The view column lists are the migration's; a change there changes this file.
// Used by tests/page-blocks.test.mjs and tests/data-source-site-cms.test.mjs to feed lib/data through a fake client.
import { build } from "esbuild";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const manifest = JSON.parse(readFileSync("lib/data/media-manifest.json", "utf8"));
const mediaById = new Map(manifest.flatMap((entry) => (entry.image_ids ?? []).map((id) => [id, entry])));

/** The views' image object: id, media_key, width, height, position (the 3.2 key order). */
export function imageObject(id, position) {
  const entry = mediaById.get(id);
  if (!entry) throw new Error(`no manifest entry for ${id}`);
  return { id, media_key: entry.key, width: entry.width ?? null, height: entry.height ?? null, position };
}

const TEXT_COLUMNS = ["kicker", "heading", "headline", "intro", "body", "statement", "salutation", "paragraphs", "sign_off", "signer", "signer_role", "cta_label"];

/** api_page_* rows from an import payload; `hide` lists "page/section" keys that are not shown. */
export function pageViews(payload, { hide = [] } = {}) {
  const shown = payload.page_sections.filter((s) => s.is_shown && !hide.includes(`${s.page}/${s.section}`));
  const ids = new Set(shown.map((s) => s.id));
  const sectionKey = new Map(payload.page_sections.map((s) => [s.id, s.section]));
  const items = payload.page_items.filter((i) => i.is_shown && ids.has(i.section_id));
  const itemIds = new Set(items.map((i) => i.id));
  return {
    api_page_sections: shown.map(({ id, page, section, video_url }) => ({ id, page, section, video_url })),
    api_page_section_translations: payload.page_section_translations
      .filter((t) => ids.has(t.section_id))
      .map((t) => ({ section_id: t.section_id, locale: t.locale, status: t.status, ...Object.fromEntries(TEXT_COLUMNS.map((c) => [c, t[c] ?? null])) })),
    api_page_section_media: payload.page_section_media
      .filter((m) => ids.has(m.section_id))
      .map((m) => ({ section_id: m.section_id, slot: m.slot, position: m.position, is_decorative: m.is_decorative, image: imageObject(m.media_id, m.position) })),
    api_page_items: items.map((i) => ({
      id: i.id,
      created_at: i.created_at,
      updated_at: i.updated_at,
      is_sample: i.is_sample,
      sample_fields: i.sample_fields,
      slug: i.slug,
      section: sectionKey.get(i.section_id),
      image: i.media_id ? imageObject(i.media_id, 0) : null,
      is_published: i.is_shown,
      position: i.position,
    })),
    api_page_item_translations: payload.page_item_translations
      .filter((t) => itemIds.has(t.item_id))
      .map((t) => ({ card_id: t.item_id, locale: t.locale, status: t.status, title: t.title, body: t.body })),
  };
}

/** Every other view a supabase-mode load reads, filled from the fixture files so the load passes its checks. */
export function catalogViews() {
  const fx = (name) => JSON.parse(readFileSync(`lib/data/fixtures/${name}.json`, "utf8"));
  return {
    api_destinations: fx("destinations"),
    api_destination_translations: fx("destination-translations"),
    api_stays: fx("stays"),
    api_stay_translations: fx("stay-translations"),
    api_catalog: fx("catalog"),
    api_catalog_translations: fx("catalog-translations"),
    api_team: fx("team"),
    api_team_translations: fx("team-translations"),
    api_journey_tiers: fx("home").tiers,
    api_journey_tier_translations: fx("home-translations").tiers,
    api_image_translations: fx("image-translations"),
    api_posts: fx("posts"),
    api_post_translations: fx("post-translations"),
    api_nav_links: [],
    api_nav_link_translations: [],
    api_legal_pages: [],
    api_legal_page_translations: [],
    api_journey_tier_legs: [],
    api_journey_tier_leg_translations: [],
    api_journey_tier_addons: [],
  };
}

/** A PostgREST-shaped fake answering every view from `tables` (a missing view is the PostgREST error). */
export function fakeClient(tables) {
  return {
    from(view) {
      const builder = {
        select: () => builder,
        order: () => builder,
        range(from, to) {
          const all = tables[view];
          if (!all) return Promise.resolve({ data: null, error: { message: `Could not find the table 'public.${view}'` }, count: null });
          return Promise.resolve({ data: all.slice(from, to + 1), error: null, count: all.length });
        },
      };
      return builder;
    },
  };
}

let counter = 0;

/** A fresh bundle of lib/data/page-blocks.ts with lib/data/source.ts (one shared state), supabase-js stubbed to throw. */
export async function loadPageBlocks() {
  const root = resolve(".");
  const out = await build({
    stdin: {
      contents: `export * from "./lib/data/page-blocks.ts"; export { __testing, loadSource, readSource } from "./lib/data/source.ts";`,
      resolveDir: root,
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    packages: "external",
    logLevel: "silent",
    plugins: [
      {
        name: "throwing-supabase-js",
        setup(b) {
          b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: "stub", namespace: "stub" }));
          b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: 'throw new Error("@supabase/supabase-js was imported");', loader: "js" }));
        },
      },
    ],
  });
  const dir = mkdtempSync(join(tmpdir(), "almar-page-blocks-"));
  const file = join(dir, `module-${counter++}.mjs`);
  writeFileSync(file, out.outputFiles[0].text);
  return import(pathToFileURL(file).href);
}

export const SUPABASE_ENV = {
  ALMAR_DATA_SOURCE: "supabase",
  NEXT_PUBLIC_SUPABASE_URL: "https://example-project.invalid",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-for-a-test",
};

const ENV_NAMES = ["ALMAR_DATA_SOURCE", "ALMAR_FIXTURE_DIR", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "ALMAR_BUILD_SUPABASE_URL", "ALMAR_BUILD_SUPABASE_ANON_KEY"];

/** Runs `fn` with exactly these variables set (the others of ENV_NAMES removed), then puts everything back. */
export async function withEnv(env, fn) {
  const saved = Object.fromEntries(ENV_NAMES.map((n) => [n, process.env[n]]));
  for (const n of ENV_NAMES) delete process.env[n];
  Object.assign(process.env, env);
  try {
    return await fn();
  } finally {
    for (const n of ENV_NAMES) {
      if (saved[n] === undefined) delete process.env[n];
      else process.env[n] = saved[n];
    }
  }
}
