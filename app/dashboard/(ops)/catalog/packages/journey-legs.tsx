"use client";

import { useEffect, useRef } from "react";
import { ArrowIcon, PlusIcon } from "../../../../../components/icons/icons";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { Button } from "../../../../../components/ui/button";
import { Field } from "../../../../../components/ui/field";
import { LINK_BUTTON_DANGER, RemoveMark } from "../../../../../components/ui/link";
import { Select } from "../../../../../components/ui/select";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { OPS_TEAM_COPY, fillTeamCopy } from "../../../../../lib/copy/ops-team";
import { MAX_FORM_LEGS, blankJourneyLeg, legWithDestination, movedLegs, type JourneyLegForm } from "./journey-forms";

export type LegOption = { id: string; name: string };

/** No suggested stay is a real choice: a sentinel, never "" (the kit Select draws "" as blank). */
const NO_STAY = "none";

const SQUARE = "w-control px-0";

/**
 * Cities on this journey (pictures/06-06 journey-editor-legs), props only: one block per city with Destination, an optional
 * Suggested stay of that destination, the English Nights line, Move up and Move down (off at the ends, focus stays on the moved
 * row) and Remove city; Add a city at the end, up to six. The Arabic and Spanish nights lines are the kit's, in Edit translations.
 */
export function JourneyLegs({
  legs,
  destinations,
  staysByDestination,
  onChange,
  idBase,
}: {
  legs: JourneyLegForm[];
  destinations: LegOption[];
  staysByDestination: Record<string, LegOption[]>;
  onChange: (legs: JourneyLegForm[]) => void;
  idBase: string;
}) {
  const loc = useDashboardLocale();
  const copy = OPS_TEAM_COPY[loc].journeys;
  const kit = OPS_KIT_COPY[loc];
  const dir = loc === "ar" ? "rtl" : "ltr";
  const rows = useRef<HTMLDivElement>(null);
  const addRow = useRef<HTMLDivElement>(null);
  // After a move, focus stays with the leg; after a remove it goes to Add a city.
  const moved = useRef<{ key: string; by: -1 | 1 } | null>(null);
  const removed = useRef(false);

  useEffect(() => {
    if (removed.current) {
      removed.current = false;
      addRow.current?.querySelector("button")?.focus();
      return;
    }
    const last = moved.current;
    moved.current = null;
    if (!last || !rows.current) return;
    const row = [...rows.current.querySelectorAll<HTMLElement>("[data-leg-row]")].find((el) => el.dataset.legRow === last.key);
    const button = (way: "up" | "down") => row?.querySelector<HTMLButtonElement>(`button[data-move="${way}"]`);
    const same = button(last.by === -1 ? "up" : "down");
    const other = button(last.by === -1 ? "down" : "up");
    (same && !same.disabled ? same : other)?.focus();
  }, [legs]);

  const update = (key: string, next: (leg: JourneyLegForm) => JourneyLegForm) => onChange(legs.map((leg) => (leg.key === key ? next(leg) : leg)));
  const full = legs.length >= MAX_FORM_LEGS;
  const first = destinations[0]?.id;

  return (
    <>
      <div ref={rows} className="flex min-w-0 flex-col gap-4">
        {legs.map((leg, index) => {
          const name = fillTeamCopy(copy.city, { n: index + 1 });
          const destinationId = `${idBase}-${leg.key}-destination`;
          const stayId = `${idBase}-${leg.key}-stay`;
          const stays = staysByDestination[leg.destination_id] ?? [];
          const destinationOptions = destinations.map((one) => ({ value: one.id, label: one.name }));
          return (
            <div key={leg.key} data-leg-row={leg.key} className="grid min-w-0 gap-3 border border-line bg-ivory p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="m-0 font-display text-body font-normal text-teal">{name}</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="secondary"
                    className={SQUARE}
                    data-move="up"
                    aria-label={`${kit.moveUp}: ${name}`}
                    title={kit.moveUp}
                    disabled={index === 0}
                    onClick={() => {
                      moved.current = { key: leg.key, by: -1 };
                      onChange(movedLegs(legs, leg.key, -1));
                    }}
                  >
                    <ArrowIcon size={16} className="-rotate-90" aria-hidden="true" />
                  </Button>
                  <Button
                    variant="secondary"
                    className={SQUARE}
                    data-move="down"
                    aria-label={`${kit.moveDown}: ${name}`}
                    title={kit.moveDown}
                    disabled={index === legs.length - 1}
                    onClick={() => {
                      moved.current = { key: leg.key, by: 1 };
                      onChange(movedLegs(legs, leg.key, 1));
                    }}
                  >
                    <ArrowIcon size={16} className="rotate-90" aria-hidden="true" />
                  </Button>
                  <button
                    type="button"
                    className={LINK_BUTTON_DANGER}
                    aria-label={`${copy.removeCity}: ${name}`}
                    onClick={() => {
                      removed.current = true;
                      onChange(legs.filter((other) => other.key !== leg.key));
                    }}
                  >
                    <RemoveMark />
                    {copy.removeCity}
                  </button>
                </div>
              </div>
              <div className="grid min-w-0 gap-3 md:grid-cols-[1fr_1fr_160px]">
                <div className="grid min-w-0 content-start gap-2">
                  <label className="field-label text-label text-ink" htmlFor={destinationId}>
                    {copy.destination}
                  </label>
                  <Select
                    id={destinationId}
                    value={leg.destination_id}
                    options={destinationOptions}
                    onChange={(next) => update(leg.key, (was) => legWithDestination(was, next, staysByDestination[next] ?? []))}
                    label={`${copy.destination}: {name}`}
                    dir={dir}
                    className="w-full"
                  />
                </div>
                <div className="grid min-w-0 content-start gap-2">
                  <label className="field-label text-label text-ink" htmlFor={stayId}>
                    {copy.stay}
                  </label>
                  <Select
                    id={stayId}
                    value={leg.stay_id ?? NO_STAY}
                    options={[{ value: NO_STAY, label: copy.noStay }, ...stays.map((stay) => ({ value: stay.id, label: stay.name }))]}
                    onChange={(next) => update(leg.key, (was) => ({ ...was, stay_id: next === NO_STAY ? null : next }))}
                    label={`${copy.stay}: {name}`}
                    dir={dir}
                    className="w-full"
                  />
                </div>
                <Field
                  id={`${idBase}-${leg.key}-nights`}
                  label={copy.nights}
                  className="max-w-none"
                  lang="en"
                  dir="ltr"
                  required
                  autoComplete="off"
                  maxLength={120}
                  value={leg.text.en}
                  onChange={(event) => {
                    const value = event.target.value;
                    update(leg.key, (was) => ({ ...was, text: { ...was.text, en: value } }));
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div ref={addRow} className="flex flex-wrap items-center gap-4">
        <Button
          variant="secondary"
          disabled={full || !first}
          onClick={() => {
            if (first) onChange([...legs, blankJourneyLeg(first)]);
          }}
        >
          <PlusIcon size={16} aria-hidden="true" />
          {copy.addCity}
        </Button>
      </div>
    </>
  );
}
