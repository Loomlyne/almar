"use client";

import { forwardRef, type ReactNode } from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { LockIcon } from "../icons/icons";

export type JourneySegmentState = "empty" | "hover" | "open" | "filled" | "missing";

export type JourneySegmentProps = {
  label: string;
  /** The filled value; a node so dates can sit in <bdi>. Omit to show the placeholder. */
  value?: ReactNode;
  placeholder: string;
  state: JourneySegmentState;
  onClick?: () => void;
  /** Id of the alert line, set on the Missing state. */
  ariaDescribedBy?: string;
  expanded?: boolean;
  /** Locked by a pre-filled stay page (D-62): shown, not interactive. */
  locked?: boolean;
  /** Show the lock icon before the value (the private-stay bar). Off by default. */
  lockIcon?: boolean;
  id?: string;
  className?: string;
};

// The 3px in-segment rule is the only exception to the 2px outline focus rule (D-36).
const segment = cva(
  "h-full w-full min-w-0 px-6 flex flex-col justify-center gap-1 text-start rounded-none border-0 cursor-pointer transition-colors duration-fast ease-standard",
  {
    variants: {
      state: {
        empty:
          "bg-transparent hover:bg-surface focus-visible:bg-surface focus-visible:shadow-rule-primary focus-visible:outline-none",
        hover:
          "bg-surface focus-visible:shadow-rule-primary focus-visible:outline-none",
        open: "bg-surface shadow-rule-primary focus-visible:outline-none",
        filled:
          "bg-transparent hover:bg-surface focus-visible:bg-surface focus-visible:shadow-rule-primary focus-visible:outline-none",
        missing:
          "bg-transparent shadow-rule-error hover:bg-surface focus-visible:outline-2 focus-visible:outline-teal",
      },
      locked: { true: "cursor-default hover:bg-transparent", false: "" },
    },
    defaultVariants: { state: "empty", locked: false },
  },
);

export const JourneySegment = forwardRef<HTMLButtonElement, JourneySegmentProps>(function JourneySegment(
  { label, value, placeholder, state, onClick, ariaDescribedBy, expanded, locked = false, lockIcon = false, id, className },
  ref,
) {
  const missing = state === "missing";
  const filled = value !== undefined && value !== null && value !== "";
  return (
    <button
      ref={ref}
      id={id}
      type="button"
      aria-haspopup={locked ? undefined : "dialog"}
      aria-expanded={locked ? undefined : (expanded ?? state === "open")}
      aria-invalid={missing ? "true" : undefined}
      aria-describedby={missing ? ariaDescribedBy : undefined}
      aria-disabled={locked ? true : undefined}
      onClick={locked ? undefined : onClick}
      className={cn(segment({ state, locked }), className)}
    >
      <span className={cn("text-caption whitespace-nowrap", missing ? "text-error" : "text-muted")}>{label}</span>
      <span
        className={cn(
          "text-body whitespace-nowrap truncate max-w-full",
          filled ? "text-ink" : "text-muted",
        )}
      >
        {lockIcon ? (
          <span className="flex min-w-0 items-center gap-2">
            <LockIcon size={16} className="shrink-0 text-muted" />
            <span className="truncate">{filled ? value : placeholder}</span>
          </span>
        ) : filled ? (
          value
        ) : (
          placeholder
        )}
      </span>
    </button>
  );
});
