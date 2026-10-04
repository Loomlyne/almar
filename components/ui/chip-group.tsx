"use client";

import { useId } from "react";
import { cn } from "../../lib/cn";
import { FILTER_LEGEND } from "./checkbox-group";
import { Chip } from "./chip";

export type ChipGroupOption = { value: string; label: string };

/**
 * One joined row of toggle chips where exactly one is pressed: the board 3a filter chip.
 * A visible label names a role="group" row. Pressing the pressed chip keeps it pressed: the "All" or
 * "Any" option is the way back, never a deselect. Every string arrives as a prop.
 *
 * Chips touch: each chip but the first pulls in by one border width on the inline start side (a logical
 * margin, so the row mirrors in Arabic), and the pressed chip is lifted so its teal edge is not covered.
 *
 * `orientation="vertical"` stacks full-width 44px toggles 8px apart under a 12px uppercase label (the
 * catalogue filter rail). It ignores `size`. Same single-pressed rule and same aria.
 */
export function ChipGroup({
  label,
  options,
  value,
  onChange,
  size = "default",
  orientation = "horizontal",
  className,
}: {
  /** Visible label and the group's accessible name. */
  label: string;
  options: readonly ChipGroupOption[];
  value: string;
  onChange: (next: string) => void;
  size?: "default" | "dense";
  orientation?: "horizontal" | "vertical";
  className?: string;
}) {
  const labelId = useId();
  const vertical = orientation === "vertical";
  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      <span id={labelId} className={vertical ? FILTER_LEGEND : "text-label text-muted"}>
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className={vertical ? "flex flex-col gap-2" : "flex flex-wrap"}>
        {options.map((option, index) => {
          const on = option.value === value;
          return (
            <span
              key={option.value}
              className={cn(
                "relative inline-flex max-w-full",
                vertical ? "w-full" : cn(index > 0 && "-ms-px", on && "z-10"),
              )}
            >
              <Chip
                on={on}
                size={vertical ? "default" : size}
                block={vertical}
                onClick={() => {
                  if (!on) onChange(option.value);
                }}
              >
                {option.label}
              </Chip>
            </span>
          );
        })}
      </div>
    </div>
  );
}
