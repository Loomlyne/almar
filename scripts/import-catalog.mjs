// scripts/import-catalog.mjs
//
// Loads today's published content (the lib/data fixtures) into the catalogue tables (plan 03.2-01, C-16). The
// controller runs it once against the live project, on the owner's word. Work sessions run only the dry form.
//
//   node scripts/import-catalog.mjs                      dry run: prints, per table, the rows it would write and every
//                                                        value it skips; touches no network, imports no client library
//   node scripts/import-catalog.mjs --out payload.json   also writes the payload it built
//   SUPABASE_URL=https://<ref>.supabase.co SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/import-catalog.mjs --apply --project-ref <ref>      the hosted project (the controller, in his terminal)
//   SUPABASE_URL=http://127.0.0.1:<port> SUPABASE_SERVICE_ROLE_KEY=... \
//     node scripts/import-catalog.mjs --apply --local                  this worktree's local stack
//
// Safety, enforced here and covered by tests/import-catalog.test.mjs:
//   - dry run by default; nothing is sent unless --apply;
//   - --apply needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment and exits 1 before any request unless the
//     URL host is exactly <ref>.supabase.co for the given --project-ref (https), or 127.0.0.1 / localhost with --local;
//   - one rpc call (import_catalog): one transaction, `on conflict do nothing`, so a second run writes nothing new;
//   - the key and the URL's query are never printed;
//   - no invented value: a rate, a team row, a sample value or a field this script does not know makes the build throw
//     with the slug named (C-12, C-16, C-17).
//
// This is the second file allowed to name the service-role key (tests/secrets.test.mjs).

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// ---------------------------------------------------------------------------------------------------------------
// The payload
// ---------------------------------------------------------------------------------------------------------------

export const PAYLOAD_TABLES = [
  "media",
  "image_translations",
  "destinations",
  "destination_translations",
  "stays",
  "stay_gallery",
  "stay_translations",
  "catalog_items",
  "catalog_translations",
  "catalog_item_destinations",
  "catalog_item_stays",
  "journey_tiers",
  "journey_tier_translations",
  "team_members",
  "team_member_translations",
];

const LOCALES = ["en", "ar", "es"];
const IMAGE_KEY = /^[a-z0-9][a-z0-9_-]*(\/[a-z0-9][a-z0-9_.-]*)*\.(webp|jpg|png)$/;

// Keys each fixture row may carry. A key outside the list is a new field the database does not hold yet: throw, so it
// is never dropped silently.
const BASE_KEYS = {
  destinations: ["id", "created_at", "updated_at", "is_sample", "sample_fields", "slug", "hero_image", "inset_image", "is_published", "position"],
  stays: [
    "id", "created_at", "updated_at", "is_sample", "sample_fields", "slug", "destination_id", "max_guests", "min_guests", "bedrooms", "bathrooms",
    "nightly_rate_aed", "min_nights", "blocked_dates", "experience_ids", "service_ids", "hero_image", "gallery", "is_published", "position",
  ],
  catalog: [
    "id", "created_at", "updated_at", "is_sample", "sample_fields", "slug", "kind", "unit", "price_aed", "is_uae", "image", "destination_ids",
    "stay_ids", "is_published", "position",
  ],
  tiers: ["id", "created_at", "updated_at", "is_sample", "sample_fields", "slug", "price_from", "price_estimate", "is_featured", "image", "is_published", "position"],
};
const TEXT_KEYS = {
  destination_translations: ["destination_id", "locale", "name", "short_line", "region", "summary", "nights_label", "status"],
  stay_translations: [
    "stay_id", "locale", "title", "tagline", "neighborhood", "guests_label", "bathrooms_label", "beds_label", "price_label", "price_note",
    "description", "amenities", "inclusions", "policy_headings", "status",
  ],
  catalog_translations: ["item_id", "locale", "name", "summary", "duration_label", "status"],
  journey_tier_translations: ["tier_id", "locale", "name", "price_label", "tagline", "duration_label", "ideal_for_label", "ideal_for", "body", "status"],
  image_translations: ["image_id", "locale", "alt", "status"],
};
// A sample value this script knows how to drop (C-16). Anything else listed in sample_fields is refused.
const DROPPABLE_SAMPLE_FIELDS = { stays: new Set(["blocked_dates"]) };

function fail(message) {
  throw new Error(`import-catalog: ${message}`);
}

function only(table, row, allowed, label) {
  for (const key of Object.keys(row)) {
    if (!allowed.includes(key)) fail(`${label}: unknown field "${key}" in ${table}; the database holds no column for it`);
  }
}

/**
 * Builds the import payload from the fixtures. Pure and offline. `root` is the repo; ALMAR_DATA_ROOT (a directory
 * holding lib/data/...) overrides it, which is how the tests point it at a scratch copy.
 * Returns { payload, counts, skipped } where payload has one array per table in foreign-key order.
 */
export function buildImportPayload({ root: repoRoot = process.cwd() } = {}) {
  const dataRoot = process.env.ALMAR_DATA_ROOT || repoRoot;
  const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(dataRoot, rel), "utf8"));
  const fx = (name) => readJson(`lib/data/fixtures/${name}.json`);
  const manifest = readJson("lib/data/media-manifest.json");
  const home = fx("home");
  const homeT = fx("home-translations");

  const skipped = [];

  // Media: one row per manifest image id (one file can carry two ids, each with its own alt text).
  const media = [];
  const mediaById = new Map();
  for (const entry of manifest) {
    if (!IMAGE_KEY.test(entry.key)) fail(`media key ${JSON.stringify(entry.key)} is outside the allowed shape`);
    for (const id of entry.image_ids ?? []) {
      if (mediaById.has(id)) fail(`image id ${id} appears twice in the media manifest`);
      const row = {
        id,
        key: entry.key,
        width: entry.width ?? null,
        height: entry.height ?? null,
        bytes: entry.bytes ?? null,
        content_type: entry.content_type ?? null,
        sha256: entry.sha256 ?? null,
        source: "import",
      };
      media.push(row);
      mediaById.set(id, row);
    }
  }

  // A fixture image object becomes a media id. A hero, inset or catalog image is always position 0 in the views.
  const imageId = (raw, label, { position0 = true } = {}) => {
    if (raw == null) return null;
    const row = mediaById.get(raw.id);
    if (!row) fail(`${label}: image ${raw.id} is not in the media manifest`);
    if (row.key !== raw.media_key) fail(`${label}: image ${raw.id} is ${raw.media_key} in the fixture but ${row.key} in the manifest`);
    if (row.width !== raw.width || row.height !== raw.height) {
      fail(`${label}: image ${raw.id} is ${raw.width}x${raw.height} in the fixture but ${row.width}x${row.height} in the manifest`);
    }
    if (position0 && raw.position !== 0) fail(`${label}: image ${raw.id} has position ${raw.position}; the database returns position 0 here`);
    return raw.id;
  };

  const checkText = (table, rows, parentKey, parents, label) => {
    const seen = new Set();
    for (const t of rows) {
      only(table, t, TEXT_KEYS[table], label);
      if (!LOCALES.includes(t.locale)) fail(`${label}: ${table} record with locale ${JSON.stringify(t.locale)}`);
      if (!parents.has(t[parentKey])) fail(`${label}: ${table} record for unknown ${parentKey} ${t[parentKey]}`);
      const k = `${t[parentKey]}:${t.locale}`;
      if (seen.has(k)) fail(`${label}: two ${t.locale} records for ${t[parentKey]} in ${table}`);
      seen.add(k);
    }
    for (const id of parents) {
      if (!seen.has(`${id}:en`)) fail(`${label}: ${id} has no English record in ${table}`);
    }
  };

  const baseCommon = (table, row, label) => {
    only(table, row, BASE_KEYS[table], label);
    // Sample rule (C-16): the listed values are dropped, the row is imported as a real one.
    const fields = row.sample_fields ?? [];
    if (Boolean(row.is_sample) !== fields.length > 0) fail(`${label}: is_sample and sample_fields disagree`);
    for (const f of fields) {
      if (!DROPPABLE_SAMPLE_FIELDS[table]?.has(f)) fail(`${label}: sample field "${f}" is not one this script knows how to drop`);
    }
    return fields;
  };

  // Image alt records: every record whose image is a media row; an orphan is a data error.
  const imageTranslations = fx("image-translations").map((t) => {
    only("image_translations", t, TEXT_KEYS.image_translations, `image ${t.image_id}`);
    if (!mediaById.has(t.image_id)) fail(`image_translations: alt record for ${t.image_id}, which is not in the media manifest`);
    return { image_id: t.image_id, locale: t.locale, alt: t.alt, status: t.status };
  });

  // Destinations
  const destFixture = fx("destinations");
  const destinations = destFixture.map((d) => {
    const label = `destination ${d.slug}`;
    baseCommon("destinations", d, label);
    return {
      id: d.id, slug: d.slug,
      hero_media_id: imageId(d.hero_image, `${label} hero`),
      inset_media_id: imageId(d.inset_image, `${label} inset`),
      is_published: d.is_published, position: d.position, is_sample: false, sample_fields: [],
      created_at: d.created_at, updated_at: d.updated_at,
    };
  });
  const destIds = new Set(destFixture.map((d) => d.id));
  const destT = fx("destination-translations");
  checkText("destination_translations", destT, "destination_id", destIds, "destinations");
  const destination_translations = destT.map((t) => ({
    destination_id: t.destination_id, locale: t.locale, status: t.status, name: t.name, short_line: t.short_line,
    region: t.region, summary: t.summary, nights_label: t.nights_label,
  }));

  // Stays
  const stayFixture = fx("stays");
  const catalogFixture = fx("catalog");
  const catalogById = new Map(catalogFixture.map((c) => [c.id, c]));
  let sampleDates = 0;
  let sampleStays = 0;
  let nullMinNights = 0;
  const stay_gallery = [];
  const catalog_item_stays = [];
  const stays = stayFixture.map((s) => {
    const label = `stay ${s.slug}`;
    const fields = baseCommon("stays", s, label);
    if (s.nightly_rate_aed != null) fail(`${label}: nightly_rate_aed is ${s.nightly_rate_aed}; rates are typed by the owner, never imported (C-12)`);
    if (!destIds.has(s.destination_id)) fail(`${label}: unknown destination ${s.destination_id}`);
    const blocked = s.blocked_dates ?? [];
    if (blocked.length > 0 && !fields.includes("blocked_dates")) {
      fail(`${label}: ${blocked.length} blocked_dates not listed in sample_fields; no real source of blocks exists`);
    }
    sampleDates += blocked.length;
    if (fields.length > 0) sampleStays += 1;
    if (s.min_nights == null) nullMinNights += 1;
    for (const g of s.gallery ?? []) {
      stay_gallery.push({ stay_id: s.id, media_id: imageId(g, `${label} gallery`, { position0: false }), position: g.position });
    }
    for (const [list, kind] of [[s.experience_ids ?? [], "experience"], [s.service_ids ?? [], "service"]]) {
      list.forEach((itemId, index) => {
        const item = catalogById.get(itemId);
        if (!item) fail(`${label}: ${kind} ${itemId} is not in the catalogue`);
        if (item.kind !== kind) fail(`${label}: ${item.slug} is a ${item.kind} but sits in the ${kind} list`);
        if (!(item.stay_ids ?? []).includes(s.id)) fail(`${label}: lists ${item.slug}, which does not list the stay in its stay_ids`);
        catalog_item_stays.push({ item_id: itemId, stay_id: s.id, position: index });
      });
    }
    const row = {
      id: s.id, slug: s.slug, destination_id: s.destination_id,
      max_guests: s.max_guests, min_guests: s.min_guests, bedrooms: s.bedrooms, bathrooms: s.bathrooms,
      base_nightly_rate_aed: null,
      hero_media_id: imageId(s.hero_image, `${label} hero`),
      is_published: s.is_published, position: s.position, is_sample: false, sample_fields: [],
      created_at: s.created_at, updated_at: s.updated_at,
    };
    // min_nights is the database default (1) unless a fixture ever carries a real value.
    if (s.min_nights != null) row.min_nights = s.min_nights;
    return row;
  });
  const stayIds = new Set(stayFixture.map((s) => s.id));
  const stayT = fx("stay-translations");
  checkText("stay_translations", stayT, "stay_id", stayIds, "stays");
  const stay_translations = stayT.map((t) => ({
    stay_id: t.stay_id, locale: t.locale, status: t.status, title: t.title, tagline: t.tagline, neighborhood: t.neighborhood,
    guests_label: t.guests_label, bathrooms_label: t.bathrooms_label, beds_label: t.beds_label, price_label: t.price_label,
    price_note: t.price_note, description: t.description, amenities: t.amenities, inclusions: t.inclusions, policy_headings: t.policy_headings,
  }));

  // Catalogue: experiences and services, with destination links; stay links were built from the stays' own lists.
  const destPos = new Map(destFixture.map((d) => [d.id, d.position]));
  const stayPos = new Map(stayFixture.map((s) => [s.id, s.position]));
  const catalog_item_destinations = [];
  const ascending = (ids, pos) => ids.every((id, i) => i === 0 || pos.get(ids[i - 1]) <= pos.get(id));
  let nullPrices = 0;
  const catalog_items = catalogFixture.map((c) => {
    const label = `catalog item ${c.slug}`;
    baseCommon("catalog", c, label);
    if (c.price_aed != null) fail(`${label}: price_aed is ${c.price_aed}; prices are typed by the owner, never imported (C-12)`);
    nullPrices += 1;
    for (const id of c.destination_ids ?? []) {
      if (!destIds.has(id)) fail(`${label}: unknown destination ${id}`);
      catalog_item_destinations.push({ item_id: c.id, destination_id: id });
    }
    if (!ascending(c.destination_ids ?? [], destPos)) fail(`${label}: destination_ids is not in destination position order; the database derives that order`);
    if (!ascending(c.stay_ids ?? [], stayPos)) fail(`${label}: stay_ids is not in stay position order; the database derives that order`);
    for (const id of c.stay_ids ?? []) {
      if (!stayIds.has(id)) fail(`${label}: unknown stay ${id}`);
      const stay = stayFixture.find((s) => s.id === id);
      const list = c.kind === "experience" ? stay.experience_ids : stay.service_ids;
      if (!(list ?? []).includes(c.id)) fail(`${label}: links stay ${stay.slug}, whose own ${c.kind} list does not hold it`);
    }
    return {
      id: c.id, slug: c.slug, kind: c.kind, unit: c.unit, price_aed: null, is_uae: c.is_uae,
      media_id: imageId(c.image, `${label} image`),
      is_published: c.is_published, position: c.position, is_sample: false, sample_fields: [],
      created_at: c.created_at, updated_at: c.updated_at,
    };
  });
  const catalogIds = new Set(catalogFixture.map((c) => c.id));
  const catalogT = fx("catalog-translations");
  checkText("catalog_translations", catalogT, "item_id", catalogIds, "catalog");
  const catalog_translations = catalogT.map((t) => ({
    item_id: t.item_id, locale: t.locale, status: t.status, name: t.name, summary: t.summary, duration_label: t.duration_label,
  }));

  // Journeys: the three home tiers. The rest of the home page stays in the fixtures (C-21).
  const journey_tiers = home.tiers.map((j) => {
    const label = `journey ${j.slug}`;
    baseCommon("tiers", j, label);
    const from = j.price_from;
    const est = j.price_estimate;
    return {
      id: j.id, slug: j.slug, is_featured: j.is_featured,
      media_id: imageId(j.image, `${label} image`),
      price_from_amount: from ? from.amount : null,
      price_from_currency: from ? from.currency : null,
      est_low: est ? est.low : null,
      est_high: est ? est.high : null,
      est_open_ended: est ? est.open_ended : null,
      is_published: j.is_published, position: j.position, is_sample: false, sample_fields: [],
      created_at: j.created_at, updated_at: j.updated_at,
    };
  });
  const tierIds = new Set(home.tiers.map((j) => j.id));
  checkText("journey_tier_translations", homeT.tiers, "tier_id", tierIds, "journeys");
  const journey_tier_translations = homeT.tiers.map((t) => ({
    tier_id: t.tier_id, locale: t.locale, status: t.status, name: t.name, price_label: t.price_label, tagline: t.tagline,
    duration_label: t.duration_label, ideal_for_label: t.ideal_for_label, ideal_for: t.ideal_for, body: t.body,
  }));

  // Team imports empty (C-17): the real members are the owner's to publish. A row here is an invented person.
  const team = fx("team");
  const teamT = fx("team-translations");
  if (team.length > 0) fail(`team: ${team.length} rows (${team.map((m) => m.slug).join(", ")}); the team imports empty (C-17)`);
  if (teamT.length > 0) fail(`team-translations: ${teamT.length} records; the team imports empty (C-17)`);

  const payload = {
    media,
    image_translations: imageTranslations,
    destinations,
    destination_translations,
    stays,
    stay_gallery,
    stay_translations,
    catalog_items,
    catalog_translations,
    catalog_item_destinations,
    catalog_item_stays,
    journey_tiers,
    journey_tier_translations,
    team_members: [],
    team_member_translations: [],
  };

  skipped.push(`stays.blocked_dates: ${sampleDates} sample dates on ${sampleStays} stays (is_sample cleared on those rows)`);
  skipped.push(`stays.nightly_rate_aed: null on ${stayFixture.length} stays (base rates are typed by the owner, C-12)`);
  skipped.push(`stays.min_nights: null on ${nullMinNights} stays (the database default is 1)`);
  skipped.push(`catalog.price_aed: null on ${nullPrices} items (prices are typed by the owner, C-12)`);
  skipped.push(`team: ${team.length} rows (C-17)`);
  skipped.push("home blocks (hero, begin, welcome, gallery, stories) and every other page block: stay in the fixtures (C-21); only the 3 journeys move");
  skipped.push("inclusions: seeded by the migration, not imported");

  const counts = Object.fromEntries(PAYLOAD_TABLES.map((t) => [t, payload[t].length]));
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

// ---------------------------------------------------------------------------------------------------------------
// --apply
// ---------------------------------------------------------------------------------------------------------------

const REF_RE = /^[a-z0-9]+$/;

/**
 * Whether --apply may send anything. Pure: no request is made here. Returns { ok: true, host } or { ok: false, error }.
 * The error never contains the key or the URL's path or query.
 */
export function checkApplyTarget({ url, key, projectRef, local }) {
  if (!url) return { ok: false, error: "SUPABASE_URL is not set" };
  if (!key) return { ok: false, error: "SUPABASE_SERVICE_ROLE_KEY is not set" };
  if (Boolean(projectRef) === Boolean(local)) return { ok: false, error: "give exactly one of --project-ref <ref> or --local" };
  let u;
  try {
    u = new URL(url);
  } catch {
    return { ok: false, error: "SUPABASE_URL is not a URL" };
  }
  if (u.username || u.password) return { ok: false, error: "SUPABASE_URL must not carry credentials" };
  if (local) {
    if (u.protocol !== "http:" && u.protocol !== "https:") return { ok: false, error: "--local needs an http(s) URL" };
    if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") return { ok: false, error: `--local refuses host ${u.hostname}; it must be 127.0.0.1 or localhost` };
    return { ok: true, host: u.host };
  }
  if (!REF_RE.test(projectRef)) return { ok: false, error: "--project-ref is not a project reference" };
  if (u.protocol !== "https:") return { ok: false, error: "SUPABASE_URL must be https for a hosted project" };
  if (u.hostname !== `${projectRef}.supabase.co`) {
    return { ok: false, error: `SUPABASE_URL host ${u.hostname} is not ${projectRef}.supabase.co` };
  }
  return { ok: true, host: u.host };
}

export function parseArgs(argv) {
  const out = { apply: false, local: false, projectRef: null, out: null, unknown: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--apply") out.apply = true;
    else if (a === "--local") out.local = true;
    else if (a === "--project-ref") out.projectRef = argv[++i] ?? "";
    else if (a === "--out") out.out = argv[++i] ?? "";
    else out.unknown.push(a);
  }
  return out;
}

async function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (args.unknown.length) {
    console.error(`import-catalog: unknown argument ${args.unknown[0]}`);
    return 2;
  }
  let built;
  try {
    built = buildImportPayload({ root });
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

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const target = checkApplyTarget({ url, key, projectRef: args.projectRef, local: args.local });
  if (!target.ok) {
    console.error(`import-catalog: refused: ${target.error}. Nothing was sent.`);
    return 1;
  }
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  console.log(`\nimporting into ${target.host} (one transaction)...`);
  const { data, error } = await client.rpc("import_catalog", { p: built.payload });
  if (error) {
    console.error(`import-catalog: the database refused: ${error.message}`);
    return 1;
  }
  const inserted = Object.values(data ?? {}).reduce((sum, n) => sum + Number(n), 0);
  console.log(formatReport({ counts: data ?? {}, skipped: [] }).split("\n\nskipped")[0].replace("rows", "inserted"));
  console.log(`\n${inserted} rows inserted${inserted === 0 ? " (everything was already there)" : ""}.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code));
}
