"use client";

import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";

const stepButton = cva(
  "inline-flex size-control shrink-0 items-center justify-center border p-0 text-body leading-none rounded-none transition-colors duration-fast ease-standard",
  {
    variants: {
      off: {
        true: "border-line text-muted bg-surface cursor-default",
        false: "border-teal text-teal bg-surface cursor-pointer hover:bg-ivory",
      },
    },
    defaultVariants: { off: false },
  },
);

type StepperProps = {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max?: number;
  addLabel: string;
  removeLabel: string;
  /** Reason line shown beside the control while value is at max. */
  atMaxNote?: string;
  className?: string;
};

/** Controlled [-] n [+]. Every string comes from props. */
export function Stepper({
  value,
  onChange,
  min,
  max,
  addLabel,
  removeLabel,
  atMaxNote,
  className,
}: StepperProps) {
  const atMin = value <= min;
  const atMax = max !== undefined && value >= max;
  return (
    <div className={cn("inline-flex max-w-full flex-wrap items-center gap-2", className)}>
      <button
        type="button"
        className={stepButton({ off: atMin })}
        aria-label={removeLabel}
        disabled={atMin}
        onClick={() => onChange(Math.max(min, value - 1))}
      >
        <span aria-hidden="true">−</span>
      </button>
      <span aria-live="polite" className="w-7 text-center text-body font-bold tabular-nums">
        {value}
      </span>
      <button
        type="button"
        className={stepButton({ off: atMax })}
        aria-label={addLabel}
        disabled={atMax}
        onClick={() => onChange(max === undefined ? value + 1 : Math.min(max, value + 1))}
      >
        <span aria-hidden="true">+</span>
      </button>
      {atMax && atMaxNote ? <span className="text-caption text-muted">{atMaxNote}</span> : null}
    </div>
  );
}
