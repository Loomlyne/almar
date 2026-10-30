// lib/data/journeys.ts (plan 06-06, CMS-03, ADDN-03)
//
// Server only. The published packages for the public page /<locale>/journeys/<slug>: the tier (./home), its cities and its
// included add-ons, through ./source. A package with no legs is normal, and fixtures mode has none (06-01's fixtureSource gives
// [] for the three). The price line stays the owner's text: nothing here reads or computes an amount.

import { getCatalogItems } from "./experiences";
import { getDestinations } from "./destinations";
import { getJourneyTiers } from "./home";
import { loadSource, readSource } from "./source";
import { getStays } from "./stays";
import type { JourneyTier, Locale, PackageAddOn, PackageLeg } from "./types";

type LegRow = Omit<PackageLeg, "nights_label"> & { tier_id: string };
type LegText = { leg_id: string; locale: Locale; status: "published" | "draft"; nights_label: string | null };
type AddOnRow = PackageAddOn & { tier_id: string };

export type PublicPackageLeg = PackageLeg & {
  destination_name: string;
  destination_slug: string;
  stay_title: string | null;
  stay_slug: string | null;
};
export type PublicPackageAddOn = PackageAddOn & { name: string };
export type PublicPackage = JourneyTier & { legs: PublicPackageLeg[]; addons: PublicPackageAddOn[] };

/** No locale: slugs do not translate. Published packages only, in their order. */
export async function getPackageSlugs(): Promise<string[]> {
  await loadSource();
  return readSource<Array<{ slug: string; is_published: boolean; position: number }>>("journey-tiers")
    .filter((tier) => tier.is_published)
    .sort((a, b) => a.position - b.position)
    .map((tier) => tier.slug);
}

/** For each route's generateStaticParams. */
export async function generatePackageParams(): Promise<Array<{ journey: string }>> {
  return (await getPackageSlugs()).map((journey) => ({ journey }));
}

const filled = (value: string | null | undefined) => (value && value.trim() !== "" ? value : null);

/** The locale's nights line when that language is published and has one, else the English. */
function nightsLabel(records: readonly LegText[], locale: Locale): string | null {
  const own = records.find((record) => record.locale === locale && record.status === "published");
  return filled(own?.nights_label) ?? filled(records.find((record) => record.locale === "en")?.nights_label);
}

/** The published package with this slug in this language, or null for an unknown or hidden one. */
export async function getPackage(locale: Locale, slug: string): Promise<PublicPackage | null> {
  await loadSource();
  const tier = (await getJourneyTiers(locale)).find((row) => row.slug === slug);
  if (!tier) return null;

  const rows = readSource<LegRow[]>("journey-tier-legs")
    .filter((leg) => leg.tier_id === tier.id)
    .sort((a, b) => a.position - b.position);
  const texts = readSource<LegText[]>("journey-tier-leg-translations");
  const addOnRows = readSource<AddOnRow[]>("journey-tier-addons")
    .filter((addon) => addon.tier_id === tier.id)
    .sort((a, b) => a.position - b.position);

  const [destinations, stays, items] = await Promise.all([
    rows.length > 0 ? getDestinations(locale, { includeEmpty: true }) : Promise.resolve([]),
    rows.some((leg) => leg.stay_id) ? getStays(locale) : Promise.resolve([]),
    addOnRows.length > 0 ? getCatalogItems(locale) : Promise.resolve([]),
  ]);

  const legs = rows.flatMap((leg): PublicPackageLeg[] => {
    const destination = destinations.find((one) => one.id === leg.destination_id);
    if (!destination) return [];
    const stay = leg.stay_id ? stays.find((one) => one.id === leg.stay_id) : undefined;
    return [
      {
        id: leg.id,
        position: leg.position,
        destination_id: leg.destination_id,
        stay_id: stay?.id ?? null,
        nights_label: nightsLabel(texts.filter((text) => text.leg_id === leg.id), locale),
        destination_name: destination.name,
        destination_slug: destination.slug,
        stay_title: stay?.title ?? null,
        stay_slug: stay?.slug ?? null,
      },
    ];
  });
  const addons = addOnRows.flatMap((addon): PublicPackageAddOn[] => {
    const item = items.find((one) => one.id === addon.item_id);
    return item ? [{ item_id: addon.item_id, position: addon.position, name: item.name }] : [];
  });

  return { ...tier, legs, addons };
}
