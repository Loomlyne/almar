// lib/data/stays.ts
//
// Server only: reads the fixtures at build time. Phase 3.2 swaps readFixture for a Supabase query here;
// every field of StayFilter then becomes a `where` clause and no component changes.

import { filterStays } from "./stay-filter";
import { image, readFixture, resolveRow, type RawImage, type StoredStatus } from "./resolve";
import type { IsoDate, Locale, Stay, StayFilter } from "./types";

export type { StayFilter };

type StayBase = {
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
  is_sample: boolean;
  sample_fields: string[];
  destination_id: string;
  max_guests: number | null;
  min_guests: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  nightly_rate_aed: number | null;
  min_nights: number | null;
  blocked_dates: string[];
  experience_ids: string[];
  service_ids: string[];
  hero_image: RawImage | null;
  gallery: RawImage[];
  is_published: boolean;
  position: number;
};
type StayTranslation = {
  stay_id: string;
  locale: Locale;
  status: StoredStatus;
  title: string;
  tagline: string | null;
  neighborhood: string | null;
  guests_label: string | null;
  bathrooms_label: string | null;
  beds_label: string | null;
  price_label: string | null;
  price_note: string | null;
  description: string[];
  amenities: string[];
  inclusions: string[];
  policy_headings: string[];
};

function published(): StayBase[] {
  return readFixture<StayBase[]>("stays")
    .filter((s) => s.is_published)
    .sort((a, b) => a.position - b.position);
}

function resolveStay(base: StayBase, locale: Locale): Stay {
  const own = readFixture<StayTranslation[]>("stay-translations").filter((t) => t.stay_id === base.id);
  const row = resolveRow(base, own, locale);
  // The destination's name is joined in the stay's own locale, so the locked bar reads in one language.
  const dest = readFixture<Array<{ id: string; slug: string }>>("destinations").find(
    (d) => d.id === base.destination_id,
  );
  if (!dest) throw new Error(`stay ${base.slug}: unknown destination ${base.destination_id}`);
  const destT = readFixture<Array<{ destination_id: string; locale: Locale; name: string }>>(
    "destination-translations",
  ).filter((t) => t.destination_id === dest.id);
  const destName = (destT.find((t) => t.locale === locale) ?? destT.find((t) => t.locale === "en"))?.name ?? dest.slug;
  return {
    ...row,
    destination_slug: dest.slug,
    destination_name: destName,
    hero_image: image(base.hero_image, locale),
    gallery: base.gallery.map((g) => image(g, locale)!).sort((a, b) => a.position - b.position),
  } as Stay;
}

export async function getStays(locale: Locale, filter?: StayFilter): Promise<Stay[]> {
  return filterStays(
    published().map((b) => resolveStay(b, locale)),
    filter,
  );
}

export async function getStay(locale: Locale, slug: string): Promise<Stay | null> {
  const base = published().find((s) => s.slug === slug);
  return base ? resolveStay(base, locale) : null;
}

/** No locale: slugs do not translate. For generateStaticParams. Published stays only. */
export async function getStaySlugs(): Promise<string[]> {
  return published().map((s) => s.slug);
}

/**
 * Excludes `slug`, prefers the same destination, falls back to the newest published. Replaces the live
 * pages' bug of listing the same three stays on every page, the current one included.
 */
export async function getRelatedStays(
  locale: Locale,
  slug: string,
  opts?: { limit?: number },
): Promise<Stay[]> {
  const limit = opts?.limit ?? 3;
  const all = published();
  const self = all.find((s) => s.slug === slug);
  const others = all.filter((s) => s.slug !== slug);
  const rank = (s: StayBase) => (self && s.destination_id === self.destination_id ? 0 : 1);
  others.sort((a, b) => rank(a) - rank(b) || b.updated_at.localeCompare(a.updated_at) || a.position - b.position);
  return others.slice(0, limit).map((b) => resolveStay(b, locale));
}

/** D-63. Read through the data layer so Phase 3.2 can move it to a bookings join with no page change. */
export async function getBlockedDates(slug: string): Promise<IsoDate[]> {
  const base = published().find((s) => s.slug === slug);
  return base ? [...base.blocked_dates].sort() : [];
}
