"use client";

// Plan 03.2-15: the Rates, Availability and Access cards for 03.2-07's stay editor (kit EditPage, option B).
// Contract accepted by the controller (2026-10-15). stay-editor.tsx (03.2-07) spreads these after its own sections and
// ORs `onDirtyChange` into EditPage's `dirty`. Each card
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
  /** The base nightly rate the server took for a stay (null = cleared): the page updates that stay's price only. */
  onBaseSaved?: (stayId: string, base: string | null) => void;
};

export function stayTabSections({ stayId, locale, onDirtyChange, onBaseSaved }: StaySectionContext): EditSection[] {
  if (stayId === null) return [];
  const copy = OPS_STAY_TABS_COPY[locale];
  return [
    {
      key: "rates",
      title: copy.rates.title,
      // Main column: signed option B puts price in the side column, but the ranges table does not fit it at 1440 in
      // Spanish (335 px in a 323 px column, measured 2026-10-15), so Rates takes the wide column (controller's rule).
      column: "main",
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
      column: "side",
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
