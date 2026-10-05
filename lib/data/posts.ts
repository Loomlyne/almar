// lib/data/posts.ts
//
// Server only: reads the fixtures at build time. Phase 3.2 swaps readFixture for a Supabase query here.
// Storage shape A: base rows in posts.json, one text record per post per locale in post-translations.json.

import { getDestinations } from "./destinations";
import { getCatalogItems } from "./experiences";
import { dateLabel, parseBody, readingMinutes } from "./post-body";
import { image, readFixture, resolveRow, type RawImage, type StoredStatus } from "./resolve";
import { getStays } from "./stays";
import type { Locale, Post, PostBlock } from "./types";

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
  return readFixture<PostBase[]>("posts")
    .filter((p) => isLive(p))
    .sort((a, b) => b.published_at.localeCompare(a.published_at));
}

async function resolvePost(base: PostBase, locale: Locale): Promise<Post> {
  const own = readFixture<PostTranslation[]>("post-translations").filter((t) => t.post_id === base.id);
  const row = resolveRow(base, own, locale);
  const body: PostBlock[] = parseBody(row.body);

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
  const rows = liveBase();
  const picked = opts?.limit !== undefined ? rows.slice(0, opts.limit) : rows;
  return Promise.all(picked.map((b) => resolvePost(b, locale)));
}

export async function getPost(locale: Locale, slug: string): Promise<Post | null> {
  const base = liveBase().find((p) => p.slug === slug);
  return base ? resolvePost(base, locale) : null;
}

/** No locale: slugs do not translate. For generateStaticParams. Newest first. */
export async function getPostSlugs(): Promise<string[]> {
  return liveBase().map((p) => p.slug);
}

/** Other posts: the same destination first, then newest. Never the post asked about. */
export async function getRelatedPosts(locale: Locale, slug: string, opts?: { limit?: number }): Promise<Post[]> {
  const rows = liveBase();
  const current = rows.find((p) => p.slug === slug);
  const others = rows.filter((p) => p.slug !== slug);
  const sameDest = (p: PostBase) => (current?.destination_id && p.destination_id === current.destination_id ? 0 : 1);
  // Array.prototype.sort is stable: ties keep the newest-first order.
  const ordered = [...others].sort((a, b) => sameDest(a) - sameDest(b));
  const picked = opts?.limit !== undefined ? ordered.slice(0, opts.limit) : ordered;
  return Promise.all(picked.map((b) => resolvePost(b, locale)));
}
