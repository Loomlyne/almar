"use client";

import { useId } from "react";
import type { StaysListCopy } from "../../../lib/copy/stays-list";
import { ChipGroup } from "../../ui/chip-group";
import { Field } from "../../ui/field";
import { Stepper } from "../../ui/stepper";
import type { BedroomChoice, ListState } from "./filter-state";

/** The search field's id. The Clear control moves focus here, because the button it was pressed on goes away. */
export const SEARCH_ID = "stay-search";

/**
 * The four filter controls, controlled by the page: search, destination, guests, bedrooms. Every string arrives
 * through `copy`. It holds no filter rule and no state: the page applies the one StayFilter.
 */
export function StayFilters({
  copy,
  state,
  onChange,
  destinations,
  maxGuests,
}: {
  copy: StaysListCopy;
  state: ListState;
  onChange: (patch: Partial<ListState>) => void;
  /** The destinations that have a published stay, in the owner's order. */
  destinations: readonly { slug: string; name: string }[];
  /** The largest capacity on offer: the guests stepper stops here. */
  maxGuests: number;
}) {
  const guestsLabelId = useId();
  const destinationOptions = [
    { value: "", label: copy.destination.all },
    ...destinations.map((d) => ({ value: d.slug, label: d.name })),
  ];
  const bedroomOptions: { value: BedroomChoice; label: string }[] = [
    { value: "any", label: copy.bedrooms.options.any },
    { value: "1-4", label: copy.bedrooms.options["1-4"] },
    { value: "5-8", label: copy.bedrooms.options["5-8"] },
    { value: "9+", label: copy.bedrooms.options["9+"] },
  ];

  return (
    <div role="group" aria-label={copy.filtersLabel} className="grid gap-6">
      <Field
        id={SEARCH_ID}
        label={copy.search.label}
        search
        type="search"
        value={state.query}
        onChange={(event) => onChange({ query: event.target.value })}
        autoComplete="off"
        spellCheck={false}
        enterKeyHint="search"
        className="w-full max-w-none @6xl:w-1/2"
      />
      <div className="flex flex-wrap items-start gap-x-8 gap-y-6">
        <ChipGroup
          label={copy.destination.label}
          options={destinationOptions}
          value={state.destination}
          onChange={(destination) => onChange({ destination })}
        />
        <div className="grid min-w-0 gap-2">
          <span id={guestsLabelId} className="text-label text-muted">
            {copy.guests.label}
          </span>
          <div role="group" aria-labelledby={guestsLabelId} className="flex flex-wrap items-center gap-3">
            <Stepper
              value={state.guests}
              onChange={(guests) => onChange({ guests })}
              min={0}
              max={maxGuests}
              addLabel={copy.guests.add}
              removeLabel={copy.guests.remove}
              atMaxNote={copy.guests.atMax}
            />
            {state.guests === 0 ? <span className="text-label text-muted">{copy.guests.any}</span> : null}
          </div>
        </div>
        <ChipGroup
          label={copy.bedrooms.label}
          options={bedroomOptions}
          value={state.bedrooms}
          onChange={(bedrooms) => onChange({ bedrooms: bedrooms as BedroomChoice })}
        />
      </div>
    </div>
  );
}
