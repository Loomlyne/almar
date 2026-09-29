import { cva } from "class-variance-authority";
import type { ReactNode } from "react";

const chip = cva(
  "ui-chip relative h-chip w-max max-w-full shrink-0 px-4 border font-body text-label rounded-none cursor-pointer after:absolute after:-inset-y-0.5 after:inset-x-0 hover:bg-ivory",
  {
    variants: {
      on: {
        true: "bg-teal border-teal text-ivory hover:bg-teal-hover",
        false: "border-muted text-ink bg-transparent",
      },
      muted: { true: "is-muted text-muted", false: "" },
    },
    defaultVariants: { on: false, muted: false },
  },
);

export function Chip({
  on = false,
  muted = false,
  children,
}: {
  on?: boolean;
  muted?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={chip({ on, muted }) + (on ? " is-on" : "")}
      aria-pressed={on}
      aria-disabled={muted || undefined}
    >
      {children}
    </button>
  );
}
