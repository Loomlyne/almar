"use client";

import { Button } from "../ui/button";
import { Stepper } from "../ui/stepper";
import { cn } from "../../lib/cn";
import { fill, formatGuestSummary } from "../../lib/journey-format";
import type { JourneyCopy, Locale } from "./types";

export type GuestCounts = { adults: number; children: number; infants: number };

export type GuestPanelProps = {
  counts: GuestCounts;
  onChange: (next: GuestCounts) => void;
  onDone: () => void;
  locale: Locale;
  copy: JourneyCopy;
  className?: string;
};

type Group = "adults" | "children" | "infants";

const GROUPS: Array<{ id: Group; unit: "adult" | "child" | "infant"; min: number }> = [
  { id: "adults", unit: "adult", min: 1 },
  { id: "children", unit: "child", min: 0 },
  { id: "infants", unit: "infant", min: 0 },
];

/** Adults floor 1, children and infants floor 0, no maximum; never blocks (D-41). */
export function GuestPanel({ counts, onChange, onDone, locale, copy, className }: GuestPanelProps) {
  const g = copy.guests;
  const label: Record<Group, string> = { adults: g.adults, children: g.children, infants: g.infants };
  const hint: Record<Group, string> = { adults: g.adultsHint, children: g.childrenHint, infants: g.infantsHint };
  const summary = formatGuestSummary(counts, locale, g.summary);

  function set(group: Group, min: number, next: number) {
    onChange({ ...counts, [group]: Math.max(min, next) });
  }

  return (
    <div
      role="group"
      aria-label={g.label}
      className={cn(
        "bg-surface shadow-lg w-menu max-w-full px-6 pt-3 pb-6 animate-panel-in motion-reduce:animate-fade-in",
        className,
      )}
    >
      {GROUPS.map(({ id, unit, min }) => {
        const name = g.group[unit];
        return (
          <div key={id} className="py-4 border-b border-line flex items-center justify-between gap-4">
            <div className="flex flex-col">
              <span className="text-label text-ink">{label[id]}</span>
              <span className="text-caption text-muted">
                <bdi>{hint[id]}</bdi>
              </span>
            </div>
            <Stepper
              value={counts[id]}
              min={min}
              onChange={(n) => set(id, min, n)}
              addLabel={fill(g.add, { group: name })}
              removeLabel={fill(g.remove, { group: name })}
            />
          </div>
        );
      })}
      <p data-testid="guest-summary" aria-live="polite" className="sr-only">
        {summary}
      </p>
      <div className="pt-6 flex items-center justify-between gap-4">
        <span className="text-caption text-muted">{g.floor}</span>
        <Button onClick={onDone}>{copy.done}</Button>
      </div>
    </div>
  );
}
