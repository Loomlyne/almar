// lib/data/destinations.ts
//
// Server only: reads the fixtures at build time. Phase 3.2 swaps readFixture for a Supabase query here.
// `locale` is the required first argument on every read: each page is built three times, so a caller that
// forgets it would silently ship English into an Arabic document.

import { image, readFixture, resolveRow, type RawImage, type StoredStatus } from "./resolve";
import type { Destination, Locale } from "./types";

type DestinationBase = {
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
  is_sample: boolean;
  sample_fields: string[];
  hero_image: RawImage | null;
  inset_image: RawImage | null;
  is_published: boolean;
  position: number;
};
type DestinationTranslation = {
  destination_id: string;
  locale: Locale;
  name: string;
  short_line: string | null;
  region: string | null;
  summary: string | null;
  nights_label: string | null;
  status: StoredStatus;
};

function allBase(): DestinationBase[] {
  return readFixture<DestinationBase[]>("destinations");
}

function resolve(base: DestinationBase, locale: Locale): Destination {
  const own = readFixture<DestinationTranslation[]>("destination-translations").filter(
    (t) => t.destination_id === base.id,
  );
  const row = resolveRow(base, own, locale);
  return {
    ...row,
    hero_image: image(base.hero_image, locale),
    inset_image: image(base.inset_image, locale),
  } as Destination;
}

/** The slugs of the destinations that have at least one published stay. */
function slugsWithStays(): Set<string> {
  const stays = readFixture<Array<{ destination_id: string; is_published: boolean }>>("stays");
  const ids = new Set(stays.filter((s) => s.is_published).map((s) => s.destination_id));
  return new Set(allBase().filter((d) => ids.has(d.id)).map((d) => d.slug));
}

export async function getDestinations(
  locale: Locale,
  opts?: {
    /** Default false: only destinations that have at least one published stay. */
    includeEmpty?: boolean;
  },
): Promise<Destination[]> {
  const withStays = slugsWithStays();
  return allBase()
    .filter((d) => d.is_published && (opts?.includeEmpty || withStays.has(d.slug)))
    .sort((a, b) => a.position - b.position)
    .map((d) => resolve(d, locale));
}

export async function getDestination(locale: Locale, slug: string): Promise<Destination | null> {
  const base = allBase().find((d) => d.slug === slug && d.is_published);
  return base ? resolve(base, locale) : null;
}

/** No locale: slugs do not translate. For generateStaticParams. */
export async function getDestinationSlugs(): Promise<string[]> {
  return allBase()
    .filter((d) => d.is_published)
    .sort((a, b) => a.position - b.position)
    .map((d) => d.slug);
}
