import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";

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

// A label, not a control: same look, no hover, no hit area, no focus stop, no pressed state.
const label = cva(
  "inline-flex h-chip w-max max-w-full shrink-0 items-center border px-4 font-body text-label rounded-none",
  {
    variants: {
      on: {
        true: "bg-teal border-teal text-ivory",
        false: "border-muted text-ink bg-transparent",
      },
      muted: { true: "text-muted", false: "" },
    },
    defaultVariants: { on: false, muted: false },
  },
);

/**
 * `interactive` (default true) is a toggle button with aria-pressed. `interactive={false}` is a
 * plain <span> for static facts such as "Most Popular" or a status. `size="dense"` is the 24px chip.
 */
export function Chip({
  on = false,
  muted = false,
  children,
  onClick,
  interactive = true,
  size = "default",
}: {
  on?: boolean;
  muted?: boolean;
  children: ReactNode;
  onClick?: () => void;
  interactive?: boolean;
  size?: "default" | "dense";
}) {
  const dense = size === "dense";
  if (!interactive) {
    return <span className={cn(label({ on, muted }), dense && "h-chip-dense px-2 text-caption")}>{children}</span>;
  }
  return (
    <button
      type="button"
      className={cn(chip({ on, muted }), dense && "h-chip-dense px-2 text-caption") + (on ? " is-on" : "")}
      aria-pressed={on}
      aria-disabled={muted || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
