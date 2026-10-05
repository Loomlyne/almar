import { cva } from "class-variance-authority";
import type { ReactNode } from "react";
import { cn } from "../../lib/cn";
import { CloseIcon } from "../icons/icons";

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

type ToggleProps = {
  on?: boolean;
  muted?: boolean;
  children: ReactNode;
  onClick?: () => void;
  interactive?: boolean;
  size?: "default" | "dense";
  /** Toggle form only: full width, 44px minimum height, surface ground when off (the vertical ChipGroup). */
  block?: boolean;
  onRemove?: undefined;
  removeLabel?: undefined;
};

type RemovableProps = {
  children: ReactNode;
  /** Removes the filter this chip stands for. */
  onRemove: () => void;
  /** The accessible name; it must contain the visible text. */
  removeLabel: string;
  on?: never;
  muted?: never;
  onClick?: never;
  interactive?: never;
  size?: never;
  block?: never;
};

/**
 * `interactive` (default true) is a toggle button with aria-pressed. `interactive={false}` is a
 * plain <span> for static facts such as "Most Popular" or a status. `size="dense"` is the 24px chip.
 * `onRemove` + `removeLabel` is the removable form: one button on the teal-tint ground (a ground, never
 * text) with a close glyph at the inline end and no pressed state.
 */
export function Chip(props: ToggleProps | RemovableProps) {
  if (props.onRemove) {
    const { onRemove, removeLabel } = props;
    return (
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="ui-chip relative inline-flex h-chip w-max max-w-full shrink-0 cursor-pointer items-center gap-2 rounded-none border-0 bg-teal-tint ps-4 pe-3 font-body text-label text-teal after:absolute after:-inset-y-0.5 after:inset-x-0"
      >
        <span>{props.children}</span>
        <CloseIcon size={16} />
      </button>
    );
  }
  const { on = false, muted = false, children, onClick, interactive = true, size = "default", block = false } = props;
  const dense = size === "dense";
  if (!interactive) {
    return <span className={cn(label({ on, muted }), dense && "h-chip-dense px-2 text-caption")}>{children}</span>;
  }
  return (
    <button
      type="button"
      className={
        cn(
          chip({ on, muted }),
          dense && "h-chip-dense px-2 text-caption",
          block && "flex h-auto min-h-control w-full max-w-none items-center text-start",
          block && !on && "bg-surface",
        ) + (on ? " is-on" : "")
      }
      aria-pressed={on}
      aria-disabled={muted || undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
