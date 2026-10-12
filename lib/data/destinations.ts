// lib/data/destinations.ts
//
// Server only: reads through ./source at build time (JSON fixtures, or the Supabase views in an assembled build, plan
// 03.2-02). The /destinations page hero stays a fixture block (C-21).
// `locale` is the required first argument on every read: each page is built three times, so a caller that
// forgets it would silently ship English into an Arabic document.

import { image, readFixture, resolveRow, type RawImage, type StoredStatus } from "./resolve";
import { loadSource, readSource } from "./source";
import type { Destination, ImageRef, Locale } from "./types";

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
  return readSource<DestinationBase[]>("destinations");
}

function resolve(base: DestinationBase, locale: Locale): Destination {
  const own = readSource<DestinationTranslation[]>("destination-translations").filter(
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
  const stays = readSource<Array<{ destination_id: string; is_published: boolean }>>("stays");
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
  await loadSource();
  const withStays = slugsWithStays();
  return allBase()
    .filter((d) => d.is_published && (opts?.includeEmpty || withStays.has(d.slug)))
    .sort((a, b) => a.position - b.position)
    .map((d) => resolve(d, locale));
}

export async function getDestination(locale: Locale, slug: string): Promise<Destination | null> {
  await loadSource();
  const base = allBase().find((d) => d.slug === slug && d.is_published);
  return base ? resolve(base, locale) : null;
}

/** No locale: slugs do not translate. For generateStaticParams. */
export async function getDestinationSlugs(): Promise<string[]> {
  await loadSource();
  return allBase()
    .filter((d) => d.is_published)
    .sort((a, b) => a.position - b.position)
    .map((d) => d.slug);
}

/** The /destinations hero slideshow: three photos, in the owner's order (S2-16). Never null entries. */
export async function getDestinationsPageHero(locale: Locale): Promise<ImageRef[]> {
  await loadSource(); // the hero's alt texts come from the same source as every picture
  const raw = readFixture<{ hero: RawImage[] }>("destinations-page").hero;
  return [...raw]
    .sort((a, b) => a.position - b.position)
    .flatMap((r) => {
      const img = image(r, locale);
      return img ? [img] : [];
    });
}
