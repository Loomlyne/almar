"use client";

import { useId } from "react";
import { cn } from "../../lib/cn";
import { Chip } from "./chip";

export type ChipGroupOption = { value: string; label: string };

/**
 * One joined row of toggle chips where exactly one is pressed: the board 3a filter chip.
 * A visible label names a role="group" row. Pressing the pressed chip keeps it pressed: the "All" or
 * "Any" option is the way back, never a deselect. Every string arrives as a prop.
 *
 * Chips touch: each chip but the first pulls in by one border width on the inline start side (a logical
 * margin, so the row mirrors in Arabic), and the pressed chip is lifted so its teal edge is not covered.
 */
export function ChipGroup({
  label,
  options,
  value,
  onChange,
  size = "default",
  className,
}: {
  /** Visible label and the group's accessible name. */
  label: string;
  options: readonly ChipGroupOption[];
  value: string;
  onChange: (next: string) => void;
  size?: "default" | "dense";
  className?: string;
}) {
  const labelId = useId();
  return (
    <div className={cn("grid min-w-0 gap-2", className)}>
      <span id={labelId} className="text-label text-muted">
        {label}
      </span>
      <div role="group" aria-labelledby={labelId} className="flex flex-wrap">
        {options.map((option, index) => {
          const on = option.value === value;
          return (
            <span key={option.value} className={cn("relative inline-flex max-w-full", index > 0 && "-ms-px", on && "z-10")}>
              <Chip
                on={on}
                size={size}
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
