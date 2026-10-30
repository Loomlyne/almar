// The pure side of Content -> Blog (plan 06-03, SITE-10, F-08): a post and its body blocks as form state, the save body
// of POST /api/ops/posts (flat, as lib/ops/site-cms-api.ts PostsBody), the kit's translation fields (block texts are
// named by each block's key, `block_<k>`), the Publish gaps and the list search. No React, no fetch, no directive.
//
// Translation is automatic (owner, 2026-10-14): the owner writes English; the kit fills Arabic and Spanish on Save. A
// block text fixed by hand is locked like any field (I18N-04): the kit's lock on the block's field is saved as that
// block's `locked_fields: ["text"]`. The field is named by the block's key, not its place, so a lock stays on its block
// when blocks move (the kit keeps its locks by name while the page is open); postForm(detail, keys) keeps the keys
// across a read-back.

import type { Locale3, MediaRef, PostBlockKind, PostDetail, PostSummary, TextStatus } from "../../../../../components/ops/api-types";
import type { Fields, LiveFields, Target } from "../../../../../components/ops/auto-translate";
import type { TranslatableField } from "../../../../../components/ops/edit-page";
import type { MissingItem } from "../../../../../components/ops/publish-check";
import type { OpsBlogCopy } from "../../../../../lib/copy/ops-blog";
import { locksOf, noLocks, type Locks } from "../../catalog/catalog-forms";

const TARGETS: readonly Target[] = ["ar", "es"];
const LOCALES: readonly Locale3[] = ["en", "ar", "es"];

/** The caps of migration 20261025120000 (post_translations, post_block_translations, ops_save_post). */
export const POST_CAPS = { title: 300, excerpt: 1000, seo_title: 300, seo_description: 1000, block: 20000, blocks: 100, slug: 80 } as const;
/**
 * The translate route takes at most 8,000 characters in one field (TRANSLATE_LIMITS.chars): a longer block could never
 * be translated, so the editor caps a block's English there (review of a1261025), below the database's 20,000.
 */
export const BLOCK_MAX = 8000;

export const POST_TEXT_FIELDS = ["title", "excerpt", "seo_title", "seo_description"] as const;
export type PostTextField = (typeof POST_TEXT_FIELDS)[number];
export type PostText = Record<PostTextField, string>;

export type FormBlock = {
  /** The block's identity while blocks are added, moved and deleted, and its translate field name (block_<k>). */
  key: string;
  kind: PostBlockKind;
  /** Photo blocks only. */
  media: MediaRef | null;
  /** Text blocks only; "" = not set. */
  text: Record<Locale3, string>;
  /** The Arabic and Spanish texts the owner fixed by hand. */
  locked: Record<Target, boolean>;
};

export type PostForm = {
  id: string | null;
  slug: string;
  published: boolean;
  cover: MediaRef | null;
  /** YYYY-MM-DD; "" = not set (the server keeps or sets its own). */
  date: string;
  /** "" = none. */
  destinationId: string;
  stayId: string;
  experienceId: string;
  text: Record<Locale3, PostText>;
  status: Record<Locale3, TextStatus>;
  blocks: FormBlock[];
  /** The post's own Arabic and Spanish fields fixed by hand (block locks live on each block). */
  locked: Locks;
};

let count = 0;
export const blockKey = () => `block_${++count}`;

const blankText = (): PostText => ({ title: "", excerpt: "", seo_title: "", seo_description: "" });
const blankBlockText = (): Record<Locale3, string> => ({ en: "", ar: "", es: "" });

export function emptyPostForm(): PostForm {
  return {
    id: null,
    slug: "",
    published: false,
    cover: null,
    date: "",
    destinationId: "",
    stayId: "",
    experienceId: "",
    text: { en: blankText(), ar: blankText(), es: blankText() },
    status: { en: "published", ar: "draft", es: "draft" },
    blocks: [],
    locked: noLocks(),
  };
}

export function newBlock(kind: PostBlockKind): FormBlock {
  return { key: blockKey(), kind, media: null, text: blankBlockText(), locked: { ar: false, es: false } };
}

/**
 * The form for a post as ops_get('post') answers it. `keys`: the block keys to reuse, in order (the blocks just saved,
 * empty rows left out): a read-back after Save keeps each block's field name, so the kit's locks stay on their blocks.
 */
export function postForm(detail: PostDetail, keys: readonly string[] = []): PostForm {
  const text = (locale: Locale3): PostText => {
    const record = detail.translations[locale];
    return { title: record?.title ?? "", excerpt: record?.excerpt ?? "", seo_title: record?.seo_title ?? "", seo_description: record?.seo_description ?? "" };
  };
  const status = (locale: Locale3): TextStatus => (locale === "en" ? "published" : (detail.translations[locale]?.status ?? "draft"));
  return {
    id: detail.id,
    slug: detail.slug,
    published: detail.is_published,
    cover: detail.cover,
    date: detail.published_at ? detail.published_at.slice(0, 10) : "",
    destinationId: detail.destination_id ?? "",
    stayId: detail.featured_stay_id ?? "",
    experienceId: detail.featured_experience_id ?? "",
    text: { en: text("en"), ar: text("ar"), es: text("es") },
    status: { en: "published", ar: status("ar"), es: status("es") },
    blocks: detail.blocks
      .slice()
      .sort((a, b) => a.position - b.position)
      .map((block, i) => ({
        key: keys[i] ?? blockKey(),
        kind: block.kind,
        media: block.image,
        text: { en: block.translations.en?.text ?? "", ar: block.translations.ar?.text ?? "", es: block.translations.es?.text ?? "" },
        locked: {
          ar: (block.translations.ar?.locked_fields ?? []).includes("text"),
          es: (block.translations.es?.locked_fields ?? []).includes("text"),
        },
      })),
    locked: locksOf(detail.translations),
  };
}

/** The translate field of a block: its key (block_<k>, the translate route's name rule), stable while it moves. */
export const blockFieldName = (block: Pick<FormBlock, "key">) => block.key;

const fillLine = (line: string, values: Record<string, string | number>) => line.replace(/\{(\w+)\}/g, (all, key: string) => (key in values ? String(values[key]) : all));

/** "Paragraph 2": a block's name in the translation boxes. */
export const blockName = (copy: OpsBlogCopy, block: Pick<FormBlock, "kind">, index: number) => fillLine(copy.blockLabel, { kind: copy.kinds[block.kind], n: index + 1 });

/** The kit's translated fields: the post's four, then one per text block (photos have no text). */
export function blockTranslationFields(blocks: readonly FormBlock[], copy: OpsBlogCopy): TranslatableField[] {
  const post: TranslatableField[] = [
    { name: "title", label: copy.f.title, maxLength: POST_CAPS.title },
    { name: "excerpt", label: copy.f.excerpt, multiline: true, maxLength: POST_CAPS.excerpt },
    { name: "seo_title", label: copy.f.seoTitle, maxLength: POST_CAPS.seo_title },
    { name: "seo_description", label: copy.f.seoDescription, multiline: true, maxLength: POST_CAPS.seo_description },
  ];
  const body = blocks.flatMap((block, i) =>
    block.kind === "photo" ? [] : [{ name: blockFieldName(block), label: blockName(copy, block, i), multiline: block.kind !== "heading", maxLength: BLOCK_MAX }],
  );
  return [...post, ...body];
}

/** One language's values for the kit: the post's fields plus `block_<n>` for each text block. */
export function postFields(form: PostForm, locale: Locale3): Fields {
  const out: Fields = { ...form.text[locale] };
  form.blocks.forEach((block, i) => {
    if (block.kind !== "photo") out[blockFieldName(block)] = block.text[locale];
  });
  return out;
}

/** The kit's lock lists: the post's own, plus `block_<n>` for each locked block text. */
export function postLocks(form: PostForm): Record<Target, string[]> {
  const out: Record<Target, string[]> = { ar: [...form.locked.ar], es: [...form.locked.es] };
  form.blocks.forEach((block, i) => {
    for (const target of TARGETS) if (block.kind !== "photo" && block.locked[target]) out[target].push(blockFieldName(block));
  });
  out.ar.sort();
  out.es.sort();
  return out;
}

const asText = (value: Fields[string] | undefined, fallback: string) => (value === undefined ? fallback : Array.isArray(value) ? value.join(" ") : (value ?? ""));

/** The Arabic and Spanish the kit handed back, and its lock lists, split back into the post and its blocks. */
export function postWithTranslations(form: PostForm, translations: Record<Target, Fields>, locked: Record<Target, string[]>): PostForm {
  const text = { ...form.text };
  for (const target of TARGETS) {
    const next = { ...form.text[target] };
    for (const field of POST_TEXT_FIELDS) next[field] = asText(translations[target][field], next[field]);
    text[target] = next;
  }
  const blocks = form.blocks.map((block, i) => {
    if (block.kind === "photo") return block;
    const name = blockFieldName(block);
    return {
      ...block,
      text: { en: block.text.en, ar: asText(translations.ar[name], block.text.ar), es: asText(translations.es[name], block.text.es) },
      locked: { ar: locked.ar.includes(name), es: locked.es.includes(name) },
    };
  });
  const own = (target: Target) => locked[target].filter((field) => (POST_TEXT_FIELDS as readonly string[]).includes(field)).sort();
  return { ...form, text, blocks, locked: { ar: own("ar"), es: own("es") } };
}

/** Lowercase letters, numbers and dashes, at most 80 (the server's rule). */
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export function slugOk(slug: string): boolean {
  const value = slug.trim();
  return value.length > 0 && value.length <= POST_CAPS.slug && SLUG.test(value);
}

/** A date later than today (in Dubai, as the server checks) cannot be saved. */
export const futureDate = (date: string, today: string) => date !== "" && date > today;

const statusFor = (form: PostForm, target: Target, publish: boolean): TextStatus => (publish || form.status[target] === "published" ? "published" : "draft");

type SentRecord = Record<string, unknown>;

function postRecord(text: PostText, status: TextStatus, english: boolean, locked?: string[]): SentRecord | null | undefined {
  const title = text.title.trim();
  const excerpt = text.excerpt.trim();
  const optional = (value: string) => (value.trim() === "" ? null : value.trim());
  if (!english && title === "" && excerpt === "" && text.seo_title.trim() === "" && text.seo_description.trim() === "") return null;
  // The server needs a title and an excerpt in a record: a language without both stays as it is.
  if (!english && (title === "" || excerpt === "")) return undefined;
  const out: SentRecord = { title, excerpt, seo_title: optional(text.seo_title), seo_description: optional(text.seo_description), status };
  if (!english) out.locked_fields = (locked ?? []).filter((field) => (POST_TEXT_FIELDS as readonly string[]).includes(field));
  return out;
}

export type PostRefusal = "slug" | "published_at" | "translations.en.title" | "translations.en.excerpt" | "blocks";

/**
 * The flat `save` body of POST /api/ops/posts, or the field the screen refuses before any request. The address is sent
 * as typed until the post is published, never after (it is locked). The body is replaced whole, in order: a photo block
 * with its media id and no text; a text block with its English text and, in Arabic and Spanish, the text with its lock.
 */
export function postPayload(form: PostForm, { publish, today }: { publish: boolean; today: string }): { ok: true; body: Record<string, unknown> } | { ok: false; field: PostRefusal } {
  if (!form.published && !slugOk(form.slug)) return { ok: false, field: "slug" };
  if (futureDate(form.date, today)) return { ok: false, field: "published_at" };
  if (form.text.en.title.trim() === "") return { ok: false, field: "translations.en.title" };
  if (form.text.en.excerpt.trim() === "") return { ok: false, field: "translations.en.excerpt" };
  if (form.blocks.length > POST_CAPS.blocks) return { ok: false, field: "blocks" };
  const body: Record<string, unknown> = { action: "save" };
  if (form.id !== null) body.id = form.id;
  if (!form.published) body.slug = form.slug.trim();
  body.cover_media_id = form.cover?.id ?? null;
  if (form.date !== "") body.published_at = form.date;
  body.destination_id = form.destinationId || null;
  body.featured_stay_id = form.stayId || null;
  body.featured_experience_id = form.experienceId || null;
  const blocks: SentRecord[] = [];
  for (const block of form.blocks) {
    if (block.kind === "photo") {
      if (!block.media) continue; // an empty photo row is not a block yet
      blocks.push({ kind: "photo", media_id: block.media.id });
      continue;
    }
    if (block.text.en.trim() === "") continue; // an empty text row is not a block yet
    const translations: Record<string, SentRecord | null> = { en: { text: block.text.en.trim(), status: "published" } };
    for (const target of TARGETS) {
      const value = block.text[target].trim();
      translations[target] = value === "" ? null : { text: value, status: statusFor(form, target, publish), locked_fields: block.locked[target] ? ["text"] : [] };
    }
    blocks.push({ kind: block.kind, translations });
  }
  body.blocks = blocks;
  const translations: Record<string, SentRecord | null> = { en: postRecord(form.text.en, "published", true) as SentRecord };
  for (const target of TARGETS) {
    const record = postRecord(form.text[target], statusFor(form, target, publish), false, form.locked[target]);
    if (record !== undefined) translations[target] = record;
  }
  body.translations = translations;
  return { ok: true, body };
}

/** The `field` of a missing block text in Arabic or Spanish; the screen names it with the signed line. */
export const missingBlockField = (target: Target, block: Pick<FormBlock, "key">) => `${blockFieldName(block)}_${target}`;

/**
 * What Publish waits for: the cover, the English title and excerpt, every text block's English, and the Arabic and
 * Spanish title, excerpt and block texts (the site shows a language only when it is whole).
 */
export function missingForPost(form: PostForm): MissingItem[] {
  const out: MissingItem[] = [];
  if (!form.cover) out.push({ locale: null, field: "cover" });
  for (const locale of LOCALES) {
    for (const field of ["title", "excerpt"] as const) if (form.text[locale][field].trim() === "") out.push({ locale, field });
  }
  form.blocks.forEach((block, i) => {
    if (block.kind === "photo") {
      if (!block.media) out.push({ locale: null, field: blockFieldName(block) });
      return;
    }
    if (block.text.en.trim() === "") out.push({ locale: "en", field: blockFieldName(block) });
    for (const target of TARGETS) if (block.text[target].trim() === "") out.push({ locale: null, field: missingBlockField(target, block) });
  });
  return out;
}

/** The Arabic and Spanish fields on the site now: a published post's published languages, as last saved. */
export function livePostFields(saved: PostForm): LiveFields {
  if (!saved.published) return {};
  const live: LiveFields = {};
  for (const target of TARGETS) {
    if (saved.status[target] !== "published") continue;
    const fields = POST_TEXT_FIELDS.filter((field) => saved.text[target][field].trim() !== "") as string[];
    saved.blocks.forEach((block, i) => {
      if (block.kind !== "photo" && block.text[target].trim() !== "") fields.push(blockFieldName(block));
    });
    live[target] = fields;
  }
  return live;
}

/** The list search: case and accents do not matter, over the English title (as matchesSearch on Stays). */
export function matchesPostSearch(row: Pick<PostSummary, "title_en">, query: string): boolean {
  const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
  const wanted = fold(query.trim());
  return wanted === "" || fold(row.title_en).includes(wanted);
}

/** The keys of the blocks a save sends, in order (empty rows are not sent): for postForm's read-back. */
export function sentBlockKeys(form: PostForm): string[] {
  return form.blocks.filter((block) => (block.kind === "photo" ? block.media !== null : block.text.en.trim() !== "")).map((block) => block.key);
}

/** The body after moving one block up or down; out of range: unchanged. */
export function movedBlocks(blocks: readonly FormBlock[], key: string, by: -1 | 1): FormBlock[] {
  const at = blocks.findIndex((b) => b.key === key);
  const to = at + by;
  if (at < 0 || to < 0 || to >= blocks.length) return [...blocks];
  const next = [...blocks];
  [next[at], next[to]] = [next[to], next[at]];
  return next;
}
