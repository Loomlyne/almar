"use client";

import { cva } from "class-variance-authority";
import { CheckIcon } from "../icons/icons";
import { Button } from "../ui/button";
import { cn } from "../../lib/cn";
import { fill } from "../../lib/journey-format";
import type { JourneyCopy } from "./types";

export type StepNumber = 1 | 2 | 3 | 4;

export type StepRailProps = {
  current: StepNumber;
  /** Called from the Change link on a finished step. */
  onChange?: (step: StepNumber) => void;
  copy: JourneyCopy;
  layout?: "rail" | "phone";
  className?: string;
};

const mark = cva("inline-flex size-mark shrink-0 items-center justify-center", {
  variants: {
    state: {
      done: "bg-teal text-ivory",
      current: "border border-teal text-teal",
      upcoming: "border border-muted text-muted",
    },
  },
});

const item = cva("pb-4 flex items-center gap-3 text-label", {
  variants: {
    state: {
      done: "text-teal",
      current: "text-teal shadow-rule-primary",
      upcoming: "text-muted",
    },
  },
});

const bar = cva("h-0.75", {
  variants: { on: { true: "bg-teal", false: "bg-line" } },
});

const STEPS = [1, 2, 3, 4] as const;

/** Four steps: check on done, number on the rest, 3px teal rule under the current one (D-51). */
export function StepRail({ current, onChange, copy, layout = "rail", className }: StepRailProps) {
  const s = copy.steps;
  const names: Record<StepNumber, string> = {
    1: s.stay,
    2: s.addons,
    3: s.travelers,
    4: s.pay,
  };
  const state = (n: StepNumber) => (n < current ? "done" : n === current ? "current" : "upcoming");

  if (layout === "phone") {
    return (
      <div className={cn("flex flex-col gap-2", className)}>
        <ol aria-label={s.label} className="m-0 p-0 list-none grid grid-cols-4 gap-1">
          {STEPS.map((n) => (
            <li
              key={n}
              className={bar({ on: n <= current })}
              aria-current={n === current ? "step" : undefined}
            >
              <span className="sr-only">{names[n]}</span>
            </li>
          ))}
        </ol>
        <p className="m-0 text-caption text-muted">
          {fill(s.phone, { n: current, name: names[current] })}
        </p>
      </div>
    );
  }

  return (
    <ol aria-label={s.label} className={cn("m-0 p-0 list-none grid grid-cols-4 border-b border-line", className)}>
      {STEPS.map((n) => {
        const st = state(n);
        return (
          <li key={n} className={item({ state: st })} aria-current={st === "current" ? "step" : undefined}>
            <span className={mark({ state: st })} aria-hidden="true">
              {st === "done" ? <CheckIcon size={16} /> : <span className="text-caption tabular-nums">{n}</span>}
            </span>
            <span>{names[n]}</span>
            {st === "done" && onChange ? (
              <Button
                variant="ghost"
                className="px-2"
                onClick={() => onChange(n)}
                aria-label={`${s.change} ${names[n]}`}
              >
                {s.change}
              </Button>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
