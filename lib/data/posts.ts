// lib/data/posts.ts
//
// Server only, build time. Storage shape A: base rows in posts.json, one text record per post per locale in
// post-translations.json. Since plan 06-01 both are read through ./source: the fixture files, or the published views
// api_posts / api_post_translations in supabase mode (same columns, same order).

import { getDestinations } from "./destinations";
import { getCatalogItems } from "./experiences";
import { dateLabel, parseBody, readingMinutes } from "./post-body";
import { image, resolveRow, type RawImage, type StoredStatus } from "./resolve";
import { loadSource, readSource } from "./source";
import { getStays } from "./stays";
import type { Locale, Post, PostBodyBlock } from "./types";

type PostBase = {
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
  is_sample: boolean;
  sample_fields: string[];
  destination_id: string | null;
  featured_stay_id: string | null;
  featured_experience_id: string | null;
  cover_image: RawImage | null;
  published_at: string;
  is_published: boolean;
};
type PostTranslation = {
  post_id: string;
  locale: Locale;
  status: StoredStatus;
  title: string;
  excerpt: string;
  body: unknown;
  seo_title: string | null;
  seo_description: string | null;
};

/** A post shows when it is published and its date has come. */
export function isLive(row: { is_published: boolean; published_at: string }, now: Date = new Date()): boolean {
  return row.is_published && new Date(row.published_at).getTime() <= now.getTime();
}

function liveBase(): PostBase[] {
  return readSource<PostBase[]>("posts")
    .filter((p) => isLive(p))
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

/** A stored photo (the view's `{ id, media_key, … }`) as an image with its alt text in `locale`. */
const photoIn = (locale: Locale) => (raw: unknown) => image(raw as RawImage, locale);

/**
 * The records the page may use (plan 06-03): an Arabic or Spanish record whose body does not parse, or has another
 * number of blocks than the English one, is treated as absent, so resolveRow falls back to English ("English only" on
 * the page) and the build goes on; one log line names the post and the language. A bad English body still fails the
 * build (C-03: the live site stays).
 */
function usableRecords(base: PostBase, own: readonly PostTranslation[], locale: Locale): PostTranslation[] {
  const en = own.find((t) => t.locale === "en");
  const enCount = en && Array.isArray(en.body) ? en.body.length : null;
  return own.filter((t) => {
    if (t.locale === "en") return true;
    try {
      parseBody(t.body, photoIn(locale));
      if (enCount !== null && Array.isArray(t.body) && t.body.length !== enCount) throw new Error("block count differs from English");
      return true;
    } catch (error) {
      if (t.locale === locale) console.warn(`post ${base.slug}: ${t.locale} body left out, English shown (${(error as Error).message})`);
      return false;
    }
  });
}

async function resolvePost(base: PostBase, locale: Locale): Promise<Post> {
  await loadSource();
  const own = usableRecords(
    base,
    readSource<PostTranslation[]>("post-translations").filter((t) => t.post_id === base.id),
    locale,
  );
  const row = resolveRow(base, own, locale);
  const body: PostBodyBlock[] = parseBody(row.body, photoIn(locale));

  const dest = base.destination_id
    ? ((await getDestinations(locale, { includeEmpty: true })).find((d) => d.id === base.destination_id) ?? null)
    : null;
  if (base.destination_id && !dest) throw new Error(`post ${base.slug}: unknown destination ${base.destination_id}`);
  const stay = base.featured_stay_id
    ? ((await getStays(locale)).find((s) => s.id === base.featured_stay_id) ?? null)
    : null;
  if (base.featured_stay_id && !stay) throw new Error(`post ${base.slug}: unknown stay ${base.featured_stay_id}`);
  const exp = base.featured_experience_id
    ? ((await getCatalogItems(locale)).find((c) => c.id === base.featured_experience_id) ?? null)
    : null;
  if (base.featured_experience_id && !exp) {
    throw new Error(`post ${base.slug}: unknown experience ${base.featured_experience_id}`);
  }

  // Every post has a cover: the list, the post page, the sitemap, the home stories and the media guard all keep a post,
  // so a post without one stops the build here instead of vanishing from one page only.
  const cover = image(base.cover_image, locale);
  if (!cover) throw new Error(`post ${base.slug}: no cover image`);

  // Storage ids (featured_*_id) and the raw image shape are not part of the returned row.
  const { featured_stay_id: _s, featured_experience_id: _e, cover_image: _c, ...rest } = row;
  void _s;
  void _e;
  void _c;
  return {
    ...rest,
    body,
    date_label: dateLabel(base.published_at, locale),
    reading_minutes: readingMinutes(body, locale),
    destination_slug: dest?.slug ?? null,
    destination_name: dest?.name ?? null,
    featured_stay_slug: stay?.slug ?? null,
    featured_experience_slug: exp?.slug ?? null,
    cover_image: cover,
  } as Post;
}

export async function getPosts(locale: Locale, opts?: { limit?: number }): Promise<Post[]> {
  await loadSource();
  const rows = liveBase();
  const picked = opts?.limit !== undefined ? rows.slice(0, opts.limit) : rows;
  return Promise.all(picked.map((b) => resolvePost(b, locale)));
}

export async function getPost(locale: Locale, slug: string): Promise<Post | null> {
  await loadSource();
  const base = liveBase().find((p) => p.slug === slug);
  return base ? resolvePost(base, locale) : null;
}

/** No locale: slugs do not translate. For generateStaticParams. Newest first. */
export async function getPostSlugs(): Promise<string[]> {
  await loadSource();
  return liveBase().map((p) => p.slug);
}

/** Other posts: the same destination first, then newest. Never the post asked about. */
export async function getRelatedPosts(locale: Locale, slug: string, opts?: { limit?: number }): Promise<Post[]> {
  await loadSource();
  const rows = liveBase();
  const current = rows.find((p) => p.slug === slug);
  const others = rows.filter((p) => p.slug !== slug);
  const sameDest = (p: PostBase) => (current?.destination_id && p.destination_id === current.destination_id ? 0 : 1);
  // Array.prototype.sort is stable: ties keep the newest-first order.
  const ordered = [...others].sort((a, b) => sameDest(a) - sameDest(b));
  const picked = opts?.limit !== undefined ? ordered.slice(0, opts.limit) : ordered;
  return Promise.all(picked.map((b) => resolvePost(b, locale)));
}
