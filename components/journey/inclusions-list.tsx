import { useId } from "react";
import { CheckIcon } from "../icons/icons";
import { cn } from "../../lib/cn";
import type { Inclusion, JourneyCopy, Locale } from "./types";

export type InclusionsListProps = {
  items: Inclusion[];
  variant?: "panel" | "compact";
  locale: Locale;
  copy: JourneyCopy;
  className?: string;
};

/** Locked-on inclusions, no price, no control (D-49). Renders nothing with zero items. */
export function InclusionsList({ items, variant = "panel", locale, copy, className }: InclusionsListProps) {
  const headId = useId();
  if (items.length === 0) return null;
  const c = copy.inclusions;

  if (variant === "compact") {
    const line = new Intl.ListFormat(locale, { style: "short", type: "unit" }).format(
      items.map((i) => i.label),
    );
    return (
      <section
        aria-labelledby={headId}
        className={cn("bg-teal-tint px-4 py-3 flex flex-col gap-1", className)}
      >
        <h2
          id={headId}
          className="m-0 text-caption font-body text-teal uppercase tracking-kicker ar:normal-case ar:tracking-normal"
        >
          {c.title}
        </h2>
        <p className="m-0 text-label text-teal">{line}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby={headId} className={cn("bg-teal-tint px-6 py-6 flex flex-col gap-4", className)}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={headId} className="m-0 font-display text-title text-teal">
          {c.title}
        </h2>
        <span className="text-label text-teal">{c.note}</span>
      </div>
      <ul className="m-0 p-0 list-none flex flex-wrap gap-x-6 gap-y-3">
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-2 text-label text-teal">
            <CheckIcon size={16} className="shrink-0" />
            <span>{i.label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
