"use client";

import { useState } from "react";
import type { ExperiencesPageCopy } from "../../../lib/copy/experiences-page";
import { formatPlural } from "../../../lib/journey-format";
import type { CatalogKind } from "../../../lib/data/types";
import { Button } from "../../ui/button";
import { CheckboxGroup } from "../../ui/checkbox-group";
import { ChipGroup } from "../../ui/chip-group";
import { CountBadge } from "../../ui/count-badge";
import { Dialog } from "../../ui/dialog";
import { Field } from "../../ui/field";
import { sheetFilterCount, type CatalogState } from "./filter-state";

/** The search fields' ids (the rail's and the toolbar's). Clear moves focus to whichever is showing. */
export const SEARCH_ID = "catalog-search";
export const SEARCH_ID_COMPACT = "catalog-search-compact";
/** The Filters button's id: the sheet hands focus back here when it closes. */
export const FILTERS_BUTTON_ID = "catalog-filters-button";

/**
 * The page's filter controls, controlled by CatalogBrowser: it holds no filter rule and no state of its own beyond the
 * Filters sheet's open flag. Three surfaces, one set of callbacks: the desktop rail (from the lg breakpoint), the compact toolbar
 * (search, Filters button with its count, type chips) and the Filters sheet that holds Destination and Private stay.
 */
export function CatalogFilters({
  copy,
  locale,
  state,
  count,
  filtered,
  destinations,
  stays,
  onQuery,
  onKind,
  onDestinations,
  onStays,
  onClear,
}: {
  copy: ExperiencesPageCopy;
  locale: "en" | "ar" | "es";
  state: CatalogState;
  /** How many items the current filters leave. */
  count: number;
  filtered: boolean;
  destinations: readonly { slug: string; name: string }[];
  /** The stays on offer, already narrowed by the checked destinations. */
  stays: readonly { slug: string; title: string }[];
  onQuery: (query: string) => void;
  onKind: (kind: "all" | CatalogKind) => void;
  onDestinations: (next: string[]) => void;
  onStays: (next: string[]) => void;
  onClear: () => void;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  const typeOptions = [
    { value: "all", label: copy.type.all },
    { value: "experience", label: copy.type.experiences },
    { value: "service", label: copy.type.services },
  ];
  const destinationOptions = destinations.map((d) => ({ value: d.slug, label: d.name }));
  const stayOptions = stays.map((s) => ({ value: s.slug, label: s.title }));
  const badge = sheetFilterCount(state);

  const checkboxes = (
    <>
      <CheckboxGroup legend={copy.destination.label} options={destinationOptions} value={state.destinations} onChange={onDestinations} />
      <CheckboxGroup legend={copy.stay.label} options={stayOptions} value={state.stays} onChange={onStays} />
    </>
  );

  function onSheetOpenChange(open: boolean) {
    setSheetOpen(open);
    // The dialog has no trigger element to hand focus back to (Button takes no ref): return it by id, after the dialog's own cleanup.
    if (!open) window.setTimeout(() => document.getElementById(FILTERS_BUTTON_ID)?.focus(), 0);
  }

  return (
    <div data-catalog-filters="" className="lg:shrink-0">
      <aside aria-label={copy.filters.label} className="hidden w-70 content-start gap-6 lg:grid">
        <Field
          id={SEARCH_ID}
          label={copy.search.label}
          search
          type="search"
          value={state.query}
          onChange={(event) => onQuery(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="w-full max-w-none"
        />
        <ChipGroup
          orientation="vertical"
          label={copy.type.label}
          options={typeOptions}
          value={state.kind}
          onChange={(next) => onKind(next as "all" | CatalogKind)}
        />
        {checkboxes}
        {filtered && count > 0 ? (
          <Button variant="ghost" onClick={onClear}>
            {copy.clear}
          </Button>
        ) : null}
      </aside>

      <div className="grid gap-4 lg:hidden">
        <Field
          id={SEARCH_ID_COMPACT}
          label={copy.search.label}
          search
          type="search"
          value={state.query}
          onChange={(event) => onQuery(event.target.value)}
          autoComplete="off"
          spellCheck={false}
          enterKeyHint="search"
          className="w-full max-w-none"
        />
        <div className="flex flex-wrap items-center gap-4">
          <Button id={FILTERS_BUTTON_ID} variant="secondary" onClick={() => setSheetOpen(true)}>
            {copy.filters.button}
            <CountBadge count={badge} label={formatPlural(copy.badge, badge, locale)} />
          </Button>
          <ChipGroup
            label={copy.type.label}
            options={typeOptions}
            value={state.kind}
            onChange={(next) => onKind(next as "all" | CatalogKind)}
          />
        </div>
      </div>

      <Dialog
        size="full"
        open={sheetOpen}
        onOpenChange={onSheetOpenChange}
        title={copy.filters.title}
        closeLabel={copy.overlay.close}
        dismiss="picker"
        footer={
          <div className="flex h-dock w-full items-center gap-4 border-t border-line bg-ivory px-4">
            {filtered ? (
              <Button variant="ghost" onClick={onClear}>
                {copy.clear}
              </Button>
            ) : null}
            <Button className="ms-auto" onClick={() => onSheetOpenChange(false)}>
              {formatPlural(copy.showResults, count, locale)}
            </Button>
          </div>
        }
      >
        <div className="grid gap-6 p-4">{checkboxes}</div>
      </Dialog>
    </div>
  );
}
