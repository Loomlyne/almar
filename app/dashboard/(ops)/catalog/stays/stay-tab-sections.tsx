"use client";

// Plan 03.2-15: the Rates, Availability and Access cards for 03.2-07's stay editor (kit EditPage, option B).
// Contract accepted by the controller (2026-10-15); 03.2-07 lands first, then this job adds the spread line: the stay editor spreads these after its own
// sections, `sections={[...own, ...stayTabSections(ctx)]}`, and ORs `onDirtyChange` into EditPage's `dirty`. Each card
// saves on its own route; none is translated. A new stay (no id yet) gets none of them: they appear after the first Save.

import type { EditSection } from "../../../../../components/ops/edit-page";
import type { Locale3 } from "../../../../../components/ops/api-types";
import { OPS_STAY_TABS_COPY } from "../../../../../lib/copy/ops-stay-tabs";
import { StayAccessSection } from "./stay-access-section";
import { StayAvailabilitySection } from "./stay-availability-section";
import { StayRatesSection } from "./stay-rates-section";

export type StaySectionKey = "rates" | "availability" | "access";

export type StaySectionContext = {
  /** The open stay's id; null on a new stay before its first Save. */
  stayId: string | null;
  locale: Locale3;
  /** A card has typing its route has not taken (the page's Discard guard covers it); false again when it unmounts. */
  onDirtyChange?: (key: StaySectionKey, dirty: boolean) => void;
  /** The base nightly rate was saved: the stay's "bookable" follows it, so the page may reload the stay. */
  onBaseSaved?: () => void;
};

export function stayTabSections({ stayId, locale, onDirtyChange, onBaseSaved }: StaySectionContext): EditSection[] {
  if (stayId === null) return [];
  const copy = OPS_STAY_TABS_COPY[locale];
  return [
    {
      key: "rates",
      title: copy.rates.title,
      // Signed option B: price and settings sit in the side column (controller, 2026-10-15).
      column: "side",
      content: (
        <StayRatesSection
          key={`rates-${stayId}`}
          stayId={stayId}
          locale={locale}
          onDirtyChange={onDirtyChange ? (dirty) => onDirtyChange("rates", dirty) : undefined}
          onBaseSaved={onBaseSaved}
        />
      ),
    },
    {
      key: "availability",
      title: copy.availability.title,
      column: "main",
      content: <StayAvailabilitySection key={`availability-${stayId}`} stayId={stayId} locale={locale} />,
    },
    {
      key: "access",
      title: copy.access.title,
      column: "main",
      content: (
        <StayAccessSection
          key={`access-${stayId}`}
          stayId={stayId}
          locale={locale}
          onDirtyChange={onDirtyChange ? (dirty) => onDirtyChange("access", dirty) : undefined}
        />
      ),
    },
  ];
}
