// lib/data/experiences.ts
//
// Server only. Experiences and services are one table with a `kind` discriminator (D-64, D-89).

import { filterCatalog } from "./catalog-filter";
import { image, readFixture, resolveRow, type RawImage, type StoredStatus } from "./resolve";
import type { CatalogItem, CatalogKind, CatalogUnit, Locale } from "./types";

type CatalogBase = {
  id: string;
  slug: string;
  created_at: string;
  updated_at: string;
  is_sample: boolean;
  sample_fields: string[];
  kind: CatalogKind;
  unit: CatalogUnit;
  price_aed: number | null;
  is_uae: boolean;
  image: RawImage | null;
  destination_ids: string[];
  stay_ids: string[];
  is_published: boolean;
  position: number;
};
type CatalogTranslation = {
  item_id: string;
  locale: Locale;
  status: StoredStatus;
  name: string;
  summary: string | null;
  duration_label: string | null;
};

function published(): CatalogBase[] {
  return readFixture<CatalogBase[]>("catalog")
    .filter((c) => c.is_published)
    .sort((a, b) => a.position - b.position);
}

/**
 * The slugs of the destinations or stays an item lists, in the item's id order. An id that matches no row is a data error
 * and throws; a row that is not published is left out, so the overlay never links to a stay page that is not built and the
 * kicker never names a place the filters do not offer (stays.ts and destinations.ts read published rows only).
 */
function slugsOf(table: "destinations" | "stays", ids: string[], itemSlug: string): string[] {
  const rows = readFixture<Array<{ id: string; slug: string; is_published: boolean }>>(table);
  return ids.flatMap((id) => {
    const hit = rows.find((r) => r.id === id);
    if (!hit) throw new Error(`catalog ${itemSlug}: unknown ${table === "stays" ? "stay" : "destination"} ${id}`);
    return hit.is_published ? [hit.slug] : [];
  });
}

function resolveItem(base: CatalogBase, locale: Locale): CatalogItem {
  const own = readFixture<CatalogTranslation[]>("catalog-translations").filter((t) => t.item_id === base.id);
  const row = resolveRow(base, own, locale);
  return {
    ...row,
    destination_slugs: slugsOf("destinations", base.destination_ids, base.slug),
    stay_slugs: slugsOf("stays", base.stay_ids, base.slug),
    image: image(base.image, locale),
  } as CatalogItem;
}

export async function getCatalogItems(
  locale: Locale,
  opts?: {
    kind?: CatalogKind;
    destinationSlug?: string;
    destinationSlugs?: string[];
    staySlug?: string;
    staySlugs?: string[];
    query?: string;
  },
): Promise<CatalogItem[]> {
  const items = published().map((c) => resolveItem(c, locale));
  return filterCatalog(items, {
    kind: opts?.kind,
    destinations: [...(opts?.destinationSlug ? [opts.destinationSlug] : []), ...(opts?.destinationSlugs ?? [])],
    stays: [...(opts?.staySlug ? [opts.staySlug] : []), ...(opts?.staySlugs ?? [])],
    query: opts?.query,
  });
}

export async function getCatalogItem(locale: Locale, slug: string): Promise<CatalogItem | null> {
  const base = published().find((c) => c.slug === slug);
  return base ? resolveItem(base, locale) : null;
}

/** The stay page's two sections, in one read, in the order the stay lists them. */
export async function getCatalogForStay(
  locale: Locale,
  staySlug: string,
): Promise<{ experiences: CatalogItem[]; services: CatalogItem[] }> {
  const stay = readFixture<Array<{ slug: string; experience_ids: string[]; service_ids: string[] }>>("stays").find(
    (s) => s.slug === staySlug,
  );
  if (!stay) return { experiences: [], services: [] };
  const byId = new Map(published().map((c) => [c.id, c]));
  const pick = (ids: string[]) =>
    ids.flatMap((id) => {
      const b = byId.get(id);
      return b ? [resolveItem(b, locale)] : [];
    });
  return { experiences: pick(stay.experience_ids), services: pick(stay.service_ids) };
}
