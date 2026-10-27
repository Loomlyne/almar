"use client";

import { useState } from "react";
import { Button } from "../ui/button";
import { AddOnList, type AddOnFilter } from "./add-on-row";
import { InclusionsList } from "./inclusions-list";
import type { AddOnItem, Inclusion, JourneyCopy, Locale } from "./types";

// Plan 04-03 (signed 2026-10-25), step 2: the kit's add-on list (rows from md, the phone rows below), the inclusions
// (panel from md, compact below) and the step's buttons. The page and the harness scenes share it. Prices arrive as
// display strings from the server's quote; quantities go out through onChange.

export type AddonsStepProps = {
  items: AddOnItem[];
  quantities: Record<string, number>;
  onChange: (id: string, quantity: number) => void;
  guestsTotal: number;
  nights: number;
  destinationName: string;
  inclusions: Inclusion[];
  loading?: boolean;
  onBack: () => void;
  onContinue: () => void;
  /** Below md the cart dock's Continue replaces this one. */
  hideContinueOnPhone?: boolean;
  copy: JourneyCopy;
  locale: Locale;
};

export function AddonsStep({
  items,
  quantities,
  onChange,
  guestsTotal,
  nights,
  destinationName,
  inclusions,
  loading = false,
  onBack,
  onContinue,
  hideContinueOnPhone = true,
  copy,
  locale,
}: AddonsStepProps) {
  const a = copy.addons;
  const [filter, setFilter] = useState<AddOnFilter>("all");
  const list = (size: "row" | "phone") => (
    <AddOnList
      items={items}
      quantities={quantities}
      onChange={onChange}
      guestsTotal={guestsTotal}
      nights={nights}
      destinationName={destinationName}
      filter={filter}
      onFilterChange={setFilter}
      loading={loading}
      size={size}
      copy={copy}
    />
  );
  return (
    <section className="flex flex-col gap-6" aria-labelledby="trip-step-addons">
      <div className="flex flex-col gap-1">
        <h2 id="trip-step-addons" className="m-0 font-display text-title text-teal">
          {a.title}
        </h2>
        <p className="m-0 text-label text-muted">{a.intro}</p>
      </div>
      <div className="hidden md:block">{list("row")}</div>
      <div className="md:hidden">{list("phone")}</div>
      <InclusionsList items={inclusions} variant="panel" locale={locale} copy={copy} className="hidden md:flex" />
      <InclusionsList items={inclusions} variant="compact" locale={locale} copy={copy} className="md:hidden" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Button variant="ghost" onClick={onBack}>
          {a.back}
        </Button>
        <Button onClick={onContinue} className={hideContinueOnPhone ? "hidden md:inline-flex" : undefined}>
          {a.continue}
        </Button>
      </div>
    </section>
  );
}
