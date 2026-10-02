// lib/data/experiences.ts
//
// Server only. Experiences and services are one table with a `kind` discriminator (D-64, D-89).

import { foldText } from "./stay-filter";
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

function resolveItem(base: CatalogBase, locale: Locale): CatalogItem {
  const own = readFixture<CatalogTranslation[]>("catalog-translations").filter((t) => t.item_id === base.id);
  const row = resolveRow(base, own, locale);
  return { ...row, image: image(base.image, locale) } as CatalogItem;
}

function idOfDestination(slug: string): string | null {
  return readFixture<Array<{ id: string; slug: string }>>("destinations").find((d) => d.slug === slug)?.id ?? null;
}
function idOfStay(slug: string): string | null {
  return readFixture<Array<{ id: string; slug: string }>>("stays").find((s) => s.slug === slug)?.id ?? null;
}

export async function getCatalogItems(
  locale: Locale,
  opts?: {
    kind?: CatalogKind;
    destinationSlug?: string;
    staySlug?: string;
    query?: string;
  },
): Promise<CatalogItem[]> {
  let rows = published();
  if (opts?.kind) rows = rows.filter((c) => c.kind === opts.kind);
  if (opts?.destinationSlug) {
    const id = idOfDestination(opts.destinationSlug);
    rows = rows.filter((c) => id !== null && c.destination_ids.includes(id));
  }
  if (opts?.staySlug) {
    const id = idOfStay(opts.staySlug);
    rows = rows.filter((c) => id !== null && c.stay_ids.includes(id));
  }
  const items = rows.map((c) => resolveItem(c, locale));
  const q = opts?.query ? foldText(opts.query.trim()) : "";
  return q ? items.filter((i) => foldText(i.name).includes(q) || foldText(i.summary ?? "").includes(q)) : items;
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
