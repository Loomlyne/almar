import type { ReactNode } from "react";

export function Chip({
  on = false,
  children,
}: {
  on?: boolean;
  children: ReactNode;
}) {
  return (
    <button type="button" className={on ? "ui-chip is-on" : "ui-chip"} aria-pressed={on}>
      {children}
    </button>
  );
}
