// scripts/import-site-content.mjs (plan 06-01, Task 4)
//
// Loads today's page blocks, the three posts and the section texts held in lib/copy into the Phase 6 tables (migration
// 20261025120000_site_cms.sql), so the public site reads them from the database with the same output (F-09, F-08).
// The controller runs it once against the live project, on the owner's word, after the migration is applied. Work
// sessions run only the dry form.
//
//   node scripts/import-site-content.mjs                      dry run: prints, per table, the rows it would write and
//                                                             every value it skips; no network, no client library
//   node scripts/import-site-content.mjs --out payload.json   also writes the payload it built
//   node scripts/import-site-content.mjs --apply --project-ref <ref>   the hosted project (the controller's terminal)
//   node scripts/import-site-content.mjs --apply --local               this worktree's local stack
//
// --apply takes the same two environment settings, the same host guard and the same client as
// scripts/import-catalog.mjs (its exported applyImport): the key is named only there (tests/secrets.test.mjs).
//
// Safety, covered by tests/site-cms-import.test.mjs:
//   - dry run by default; nothing is sent unless --apply;
//   - one rpc (import_site_content): one transaction, `on conflict do nothing`, so a second run writes nothing new;
//   - ids are the fixture ids where a fixture has one, otherwise uuid v5 of a fixed name (page/section, post id + block
//     position), so two builds give the same payload;
//   - nothing is invented: a sample row, a photo that is not in the media manifest, a copy text missing in one language,
//     a fixture field the section does not use, or a post whose languages disagree on the body's blocks stops the build;
//   - photos and their alt texts are not written here (the 3.2 import wrote every manifest image and alt);
//   - nav links are not built here: 06-02 supplies them with job 21's header.

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyImport, checkApplyTarget, parseArgs } from "./import-catalog.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const SITE_PAYLOAD_TABLES = [
  "page_sections",
  "page_section_translations",
  "page_section_media",
  "page_items",
  "page_item_translations",
  "posts",
  "post_translations",
  "post_blocks",
  "post_block_translations",
  "nav_links",
  "nav_link_translations",
];

const LOCALES = ["en", "ar", "es"];

/** The fixed namespace of every id this script makes (uuid v5, RFC 9562). Never change it: ids would move. */
export const SITE_NAMESPACE = "6f0e3c7a-5d1b-5e4a-9c2f-0a6b1e7d3c11";

/** uuid v5 of `name` in `namespace`. */
export function uuidV5(name, namespace = SITE_NAMESPACE) {
  const ns = Buffer.from(namespace.replace(/-/g, ""), "hex");
  const hash = createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export const sectionId = (page, section) => uuidV5(`page-section:${page}/${section}`);
export const postBlockId = (postId, position) => uuidV5(`post-block:${postId}/${position}`);

function fail(message) {
  throw new Error(`import-site-content: ${message}`);
}

const at = (value, dotted) => dotted.split(".").reduce((v, k) => (v == null ? undefined : v[k]), value);

/**
 * Builds the import payload from lib/data/fixtures, lib/data/page-sections.ts and the lib/copy page files (Node >= 22.18
 * imports the .ts files directly). ALMAR_DATA_ROOT points the reads at a scratch copy (the tests).
 */
export async function buildSiteContentPayload({ root: repoRoot = root } = {}) {
  const dataRoot = process.env.ALMAR_DATA_ROOT || repoRoot;
  const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(dataRoot, rel), "utf8"));
  const fx = (name) => readJson(`lib/data/fixtures/${name}.json`);
  const importTs = (rel) => import(pathToFileURL(path.join(dataRoot, rel)).href);

  const { PAGE_KEYS, PAGE_SECTIONS, LIST_TEXT_COLUMNS } = await importTs("lib/data/page-sections.ts");
  const manifest = readJson("lib/data/media-manifest.json");
  const mediaIds = new Set(manifest.flatMap((entry) => entry.image_ids ?? []));
  const skipped = [];

  const mediaId = (raw, label, { position0 = false } = {}) => {
    if (raw == null) return null;
    if (!mediaIds.has(raw.id)) fail(`${label}: image ${raw.id} is not in the media manifest (the 3.2 import wrote every manifest image)`);
    if (position0 && raw.position !== 0) fail(`${label}: image ${raw.id} has position ${raw.position}; the view returns position 0 here`);
    return raw.id;
  };
  const noSample = (row, label) => {
    if (row.is_sample || (row.sample_fields ?? []).length > 0) fail(`${label}: a sample row is never imported (C-16)`);
  };
  const checkText = (value, column, label) => {
    const list = LIST_TEXT_COLUMNS.includes(column);
    if (list ? !Array.isArray(value) || value.some((v) => typeof v !== "string" || v.trim() === "") : typeof value !== "string" || value.trim() === "") {
      fail(`${label}: ${column} is empty or not ${list ? "a list of texts" : "a text"}`);
    }
  };

  const copyModules = new Map();
  const copyOf = async (module, name) => {
    const key = `${module}#${name}`;
    if (!copyModules.has(key)) {
      const mod = await importTs(`lib/copy/${module}.ts`);
      if (!mod[name]) fail(`lib/copy/${module}.ts has no export ${name}`);
      copyModules.set(key, mod[name]);
    }
    return copyModules.get(key);
  };

  const page_sections = [];
  const page_section_translations = [];
  const page_section_media = [];

  for (const page of PAGE_KEYS) {
    for (const spec of PAGE_SECTIONS[page]) {
      const id = sectionId(page, spec.section);
      const label = `${page}/${spec.section}`;
      // Every hero's video starts empty: the fixtures hold no video (video_key null) and a media key is not an https URL.
      for (const [slot, source] of Object.entries(spec.mediaFrom)) {
        if (!spec.media.some((m) => m.slot === slot)) fail(`${label}: photos from ${source.file}.${source.path} for slot ${slot}, which the section does not have`);
      }
      if (spec.video && page === "home") {
        const key = at(fx("home"), `${spec.section}.video_key`);
        if (key != null) fail(`${label}: home.json has video_key ${JSON.stringify(key)}; a media key is not a video URL, so the owner sets it in the Pages editor`);
      }
      page_sections.push({ id, page, section: spec.section, is_shown: true, video_url: null });

      // Photos.
      for (const slot of spec.media) {
        const source = spec.mediaFrom[slot.slot];
        if (!source) {
          skipped.push(`${label}.${slot.slot}: no photo today (optional slot, empty)`);
          continue;
        }
        const value = at(fx(source.file), source.path);
        const list = value == null ? [] : Array.isArray(value) ? value : [value];
        if (!slot.many && list.length > 1) fail(`${label}.${slot.slot}: ${list.length} photos on a single slot`);
        const positions = new Set();
        for (const raw of list) {
          if (positions.has(raw.position)) fail(`${label}.${slot.slot}: two photos at position ${raw.position}`);
          positions.add(raw.position);
          page_section_media.push({
            section_id: id,
            slot: slot.slot,
            position: raw.position,
            media_id: mediaId(raw, `${label}.${slot.slot}`),
            is_decorative: slot.decorative,
          });
        }
      }

      // Texts.
      const from = spec.textFrom;
      if (!from) continue;
      if (from.kind === "fixture") {
        const records = fx(from.file)[from.block];
        if (!Array.isArray(records)) fail(`${label}: ${from.file}.json has no block ${from.block}`);
        for (const locale of LOCALES) {
          const record = records.find((r) => r.locale === locale);
          if (!record) {
            skipped.push(`${label}: no ${locale} record in ${from.file}.json (the site shows English there today)`);
            continue;
          }
          const row = { section_id: id, locale, status: record.status };
          for (const [key, value] of Object.entries(record)) {
            if (key === "locale" || key === "status") continue;
            if (!spec.text.includes(key)) fail(`${label}: ${from.file}.json field ${key} is not a text column of this section`);
            checkText(value, key, `${label} (${locale})`);
            row[key] = value;
          }
          page_section_translations.push(row);
        }
      } else {
        const copy = await copyOf(from.module, from.name);
        for (const locale of LOCALES) {
          const words = copy[locale];
          if (!words) fail(`lib/copy/${from.module}.ts ${from.name} has no ${locale}`);
          // The copy's own status where it has one (destinations-page); every other page file is published wording.
          const status = words.status === "draft" ? "draft" : "published";
          const row = { section_id: id, locale, status };
          for (const [column, dotted] of Object.entries(from.paths)) {
            if (!spec.text.includes(column)) fail(`${label}: copy path ${dotted} feeds ${column}, which is not a text column of this section`);
            const value = at(words, dotted);
            checkText(value, column, `${label} (${locale}, lib/copy/${from.module}.ts ${dotted})`);
            row[column] = value;
          }
          page_section_translations.push(row);
        }
      }
    }
  }

  // About cards (Our Story, Our Values).
  const about = fx("about");
  const aboutT = fx("about-translations");
  const itemSections = new Set(PAGE_SECTIONS.about.filter((s) => s.items).map((s) => s.section));
  const page_items = (about.cards ?? []).map((card) => {
    const label = `about card ${card.slug}`;
    noSample(card, label);
    if (!itemSections.has(card.section)) fail(`${label}: section ${card.section} holds no cards`);
    return {
      id: card.id,
      section_id: sectionId("about", card.section),
      slug: card.slug,
      media_id: mediaId(card.image, label, { position0: true }),
      is_shown: card.is_published,
      position: card.position,
      is_sample: false,
      sample_fields: [],
      created_at: card.created_at,
      updated_at: card.updated_at,
    };
  });
  const cardIds = new Set(page_items.map((c) => c.id));
  const page_item_translations = (aboutT.cards ?? []).map((t) => {
    if (!cardIds.has(t.card_id)) fail(`about-translations: record for unknown card ${t.card_id}`);
    checkText(t.title, "title", `about card ${t.card_id} (${t.locale})`);
    checkText(t.body, "body", `about card ${t.card_id} (${t.locale})`);
    return { item_id: t.card_id, locale: t.locale, status: t.status, title: t.title, body: t.body };
  });

  // Posts, their texts and their body blocks (one block row per position, one text per language).
  const postFixture = fx("posts");
  const postT = fx("post-translations");
  const posts = postFixture.map((p) => {
    const label = `post ${p.slug}`;
    noSample(p, label);
    const cover = mediaId(p.cover_image, label, { position0: true });
    if (!cover) fail(`${label}: no cover image (every post has one)`);
    return {
      id: p.id,
      slug: p.slug,
      cover_media_id: cover,
      published_at: p.published_at,
      destination_id: p.destination_id,
      featured_stay_id: p.featured_stay_id,
      featured_experience_id: p.featured_experience_id,
      is_published: p.is_published,
      is_sample: false,
      sample_fields: [],
      created_at: p.created_at,
      updated_at: p.updated_at,
    };
  });
  const post_translations = [];
  const post_blocks = [];
  const post_block_translations = [];
  for (const p of posts) {
    const own = postT.filter((t) => t.post_id === p.id);
    const en = own.find((t) => t.locale === "en");
    if (!en) fail(`post ${p.slug}: no English text`);
    const shape = (body) => (Array.isArray(body) ? body.map((b) => b.type).join(",") : null);
    en.body.forEach((block, index) => {
      if (!["heading", "paragraph", "quote"].includes(block.type)) fail(`post ${p.slug}: body block ${index} has type ${block.type}`);
      post_blocks.push({ id: postBlockId(p.id, index + 1), post_id: p.id, position: index + 1, kind: block.type, media_id: null });
    });
    for (const t of own) {
      if (shape(t.body) !== shape(en.body)) fail(`post ${p.slug}: the ${t.locale} body's blocks differ from the English (${shape(t.body)} vs ${shape(en.body)})`);
      checkText(t.title, "title", `post ${p.slug} (${t.locale})`);
      checkText(t.excerpt, "excerpt", `post ${p.slug} (${t.locale})`);
      post_translations.push({
        post_id: p.id,
        locale: t.locale,
        status: t.status,
        title: t.title,
        excerpt: t.excerpt,
        seo_title: t.seo_title ?? null,
        seo_description: t.seo_description ?? null,
      });
      t.body.forEach((block, index) => {
        checkText(block.text, "text", `post ${p.slug} block ${index + 1} (${t.locale})`);
        post_block_translations.push({ block_id: postBlockId(p.id, index + 1), locale: t.locale, status: t.status, text: block.text });
      });
    }
  }

  const payload = {
    page_sections,
    page_section_translations,
    page_section_media,
    page_items,
    page_item_translations,
    posts,
    post_translations,
    post_blocks,
    post_block_translations,
    nav_links: [],
    nav_link_translations: [],
  };
  skipped.push("nav links: none here; 06-02 supplies them with the header job 21 landed");
  skipped.push("hero videos: none (no video in the fixtures); the owner adds an https URL in the Pages editor");
  skipped.push("photos and alt texts: already in media / image_translations from the 3.2 import");
  skipped.push("contact details (contact.json, SITE-13): fixed in code, not a section");

  const counts = Object.fromEntries(SITE_PAYLOAD_TABLES.map((t) => [t, payload[t].length]));
  return { payload, counts, skipped };
}

export function formatReport({ counts, skipped }) {
  const width = Math.max(...Object.keys(counts).map((t) => t.length));
  const lines = ["table".padEnd(width) + "  rows", "-".repeat(width + 7)];
  for (const [table, n] of Object.entries(counts)) lines.push(table.padEnd(width) + "  " + String(n).padStart(4));
  lines.push("", "skipped on purpose:");
  for (const s of skipped) lines.push(`  - ${s}`);
  return lines.join("\n");
}

export { checkApplyTarget, parseArgs };

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.unknown.length) {
    console.error(`import-site-content: unknown argument ${args.unknown[0]}`);
    return 2;
  }
  let built;
  try {
    built = await buildSiteContentPayload({ root });
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  console.log(formatReport(built));
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), JSON.stringify(built.payload, null, 2));
    console.log(`\npayload written to ${args.out}`);
  }
  if (!args.apply) {
    console.log("\ndry run: nothing was sent. Add --apply (with --project-ref <ref> or --local) to import.");
    return 0;
  }
  return applyImport({ rpc: "import_site_content", payload: built.payload, args, name: "import-site-content", formatReport });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
