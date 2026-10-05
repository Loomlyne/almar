"use client";

import { cn } from "../../lib/cn";
import { Checkbox } from "./checkbox";

export type CheckboxGroupOption = { value: string; label: string };

/** The 12px uppercase muted label of a filter control (normal case in Arabic). Shared with the vertical ChipGroup. */
export const FILTER_LEGEND = "text-caption uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal";

/**
 * A multi-select over native checkboxes: a <fieldset> named by its <legend>, one row of at least 44px per option.
 * `onChange` receives the checked values in `options` order; values that are not in `options` are dropped.
 * Zero options render nothing. Every string arrives as a prop.
 */
export function CheckboxGroup({
  legend,
  options,
  value,
  onChange,
  className,
}: {
  legend: string;
  options: readonly CheckboxGroupOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  className?: string;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className={cn("m-0 min-w-0 border-0 p-0", className)}>
      <legend className={cn("mb-2 p-0", FILTER_LEGEND)}>{legend}</legend>
      <div className="flex flex-col">
        {options.map((option) => (
          <Checkbox
            key={option.value}
            className="flex w-full gap-3 text-label"
            label={option.label}
            value={option.value}
            checked={value.includes(option.value)}
            onChange={(event) => {
              const set = new Set(value);
              if (event.target.checked) set.add(option.value);
              else set.delete(option.value);
              onChange(options.filter((o) => set.has(o.value)).map((o) => o.value));
            }}
          />
        ))}
      </div>
    </fieldset>
  );
}
