// Plan 06-03: the request validators of /api/ops/posts, in the style of validate-catalog.ts. Caps mirror migration
// 20261025120000_site_cms.sql: post_translations (title 300, excerpt 1000, seo_title 300, seo_description 1000),
// post_block_translations (text 20000), ops_save_post (at most 100 blocks, slug 80, kinds heading|paragraph|photo|quote,
// a photo block has a media_id and no text, every other block has English text and no media_id). is_sample and
// sample_fields are never accepted from the browser (C-16).

import type { PostsBody } from "./site-cms-api";
import { OpsInvalid } from "./route-core";
import { has, isoDay, isRecord, onlyKeys, record, slug, translations, uuid, uuidOrNull, type TextSpec } from "./validate";

/** The JSON body cap of /api/ops/posts (controller slot 2026-10-28): a post carries up to 100 body blocks in three
 * languages, more than the default 64 KiB. Passed to opsPost in app/api/ops/posts/route.ts only. */
export const POSTS_BODY_LIMIT = 256 * 1024;

export const POST_TEXT: TextSpec = {
  required: ["title", "excerpt"],
  fields: {
    title: { kind: "text", max: 300 },
    excerpt: { kind: "text", max: 1000 },
    seo_title: { kind: "text", max: 300 },
    seo_description: { kind: "text", max: 1000 },
  },
};

export const POST_BLOCK_TEXT: TextSpec = { required: ["text"], fields: { text: { kind: "text", max: 20000 } } };

const MAX_BLOCKS = 100;
const SLUG_MAX = 80;
const KINDS = ["heading", "paragraph", "photo", "quote"] as const;
type BlockKind = (typeof KINDS)[number];
type SaveBody = Extract<PostsBody, { action: "save" }>;

/** Today in Dubai as YYYY-MM-DD (the owner's day: a post may not be dated later). */
export function dubaiToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function parsePostsQuery(query: URLSearchParams): { id: string | null } {
  const id = query.get("id");
  return { id: id === null ? null : uuid(id, "id") };
}

function block(value: unknown, path: string): NonNullable<SaveBody["blocks"]>[number] {
  const b = record(value, path);
  onlyKeys(b, ["kind", "media_id", "translations"], `${path}.`);
  if (typeof b.kind !== "string" || !(KINDS as readonly string[]).includes(b.kind)) throw new OpsInvalid(`${path}.kind`);
  const kind = b.kind as BlockKind;
  if (kind === "photo") {
    if (has(b, "translations") && b.translations !== null) throw new OpsInvalid(`${path}.translations`);
    return { kind, media_id: uuid(b.media_id, `${path}.media_id`) };
  }
  if (has(b, "media_id") && b.media_id !== null) throw new OpsInvalid(`${path}.media_id`);
  try {
    // Every text block is written whole: English is required (create rules), ar/es as sent.
    return { kind, translations: translations(b.translations, POST_BLOCK_TEXT, { create: true }) as NonNullable<SaveBody["blocks"]>[number]["translations"] };
  } catch (error) {
    // The field path of a block names the block: blocks.3.translations.en.text.
    if (error instanceof OpsInvalid) throw new OpsInvalid(`${path}.${error.field}`, error.locale);
    throw error;
  }
}

export function parsePostAction(value: unknown, today: string = dubaiToday()): PostsBody {
  if (!isRecord(value)) throw new OpsInvalid("body");
  if (value.action === "delete") {
    onlyKeys(value, ["action", "id"]);
    return { action: "delete", id: uuid(value.id, "id") };
  }
  if (value.action !== "save") throw new OpsInvalid("action");
  onlyKeys(value, [
    "action",
    "id",
    "slug",
    "cover_media_id",
    "published_at",
    "destination_id",
    "featured_stay_id",
    "featured_experience_id",
    "blocks",
    "translations",
  ]);
  const create = value.id === undefined || value.id === null;
  const out: SaveBody = { action: "save" };
  if (!create) out.id = uuid(value.id, "id");
  if (has(value, "slug")) {
    const s = slug(value.slug, "slug");
    if (s.length > SLUG_MAX) throw new OpsInvalid("slug");
    out.slug = s;
  } else if (create) {
    throw new OpsInvalid("slug");
  }
  for (const key of ["cover_media_id", "destination_id", "featured_stay_id", "featured_experience_id"] as const) {
    if (has(value, key)) out[key] = uuidOrNull(value[key], key);
  }
  if (has(value, "published_at")) {
    if (value.published_at === null) {
      out.published_at = null;
    } else {
      const day = isoDay(value.published_at, "published_at");
      if (day > today) throw new OpsInvalid("published_at");
      out.published_at = day;
    }
  }
  if (has(value, "blocks")) {
    if (!Array.isArray(value.blocks) || value.blocks.length > MAX_BLOCKS) throw new OpsInvalid("blocks");
    out.blocks = value.blocks.map((b, i) => block(b, `blocks.${i}`));
  }
  if (has(value, "translations")) {
    out.translations = translations(value.translations, POST_TEXT, { create }) as SaveBody["translations"];
  } else if (create) {
    throw new OpsInvalid("translations.en", "en");
  }
  return out;
}
