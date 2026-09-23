import type { ReactNode } from "react";

export function Chip({
  on = false,
  muted = false,
  children,
}: {
  on?: boolean;
  muted?: boolean;
  children: ReactNode;
}) {
  const classes = ["ui-chip", on ? "is-on" : "", muted ? "is-muted" : ""].filter(Boolean).join(" ");
  return (
    <button type="button" className={classes} aria-pressed={on} aria-disabled={muted || undefined}>
      {children}
    </button>
  );
}
