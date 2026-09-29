"use client";

import { useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { cva } from "class-variance-authority";
import { CheckIcon, ChevronIcon } from "../icons/icons";
import { cn } from "../../lib/cn";
import type { Destination, JourneyCopy, Locale } from "./types";

export type DestinationMenuProps = {
  destinations: Destination[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  state?: "ready" | "loading";
  /** "sheet" renders phone rows with a chevron instead of the check. */
  variant?: "menu" | "sheet";
  locale: Locale;
  copy: JourneyCopy;
  className?: string;
};

const row = cva(
  "min-h-16 px-6 py-2 flex items-center justify-between gap-4 cursor-pointer focus-visible:outline-2 focus-visible:outline-teal",
  {
    variants: {
      selected: { true: "bg-teal-tint", false: "bg-surface hover:bg-ivory" },
      sheet: { true: "border-b border-line", false: "" },
    },
    defaultVariants: { selected: false, sheet: false },
  },
);

/** One destination per journey: listbox with roving focus and typeahead (D-39). */
export function DestinationMenu({
  destinations,
  selectedId,
  onSelect,
  state = "ready",
  variant = "menu",
  locale,
  copy,
  className,
}: DestinationMenuProps) {
  const sheet = variant === "sheet";
  const selectedIndex = destinations.findIndex((d) => d.id === selectedId);
  const [active, setActive] = useState(selectedIndex >= 0 ? selectedIndex : 0);
  const listRef = useRef<HTMLDivElement>(null);
  const buffer = useRef({ text: "", at: 0 });

  function focusIndex(i: number) {
    const next = Math.max(0, Math.min(destinations.length - 1, i));
    setActive(next);
    listRef.current?.querySelectorAll<HTMLElement>('[role="option"]')[next]?.focus();
  }

  function onKey(event: ReactKeyboardEvent<HTMLDivElement>) {
    const k = event.key;
    if (k === "ArrowDown" || k === "ArrowUp") {
      event.preventDefault();
      focusIndex(active + (k === "ArrowDown" ? 1 : -1));
    } else if (k === "Home" || k === "End") {
      event.preventDefault();
      focusIndex(k === "Home" ? 0 : destinations.length - 1);
    } else if (k === "Enter" || k === " ") {
      event.preventDefault();
      const d = destinations[active];
      if (d) onSelect(d.id);
    } else if (k.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      const now = Date.now();
      const b = buffer.current;
      b.text = now - b.at > 700 ? k : b.text + k;
      b.at = now;
      const q = b.text.toLocaleLowerCase(locale);
      const hit = destinations.findIndex((d) =>
        d.name.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase(locale).startsWith(
          q.normalize("NFD").replace(/\p{M}/gu, ""),
        ),
      );
      if (hit >= 0) focusIndex(hit);
    }
  }

  return (
    <div
      className={cn(
        "bg-surface animate-panel-in motion-reduce:animate-fade-in",
        sheet ? "w-full" : "shadow-lg w-menu max-w-full py-3",
        className,
      )}
    >
      {!sheet ? (
        <p className="m-0 px-6 pb-2 text-caption text-muted uppercase tracking-kicker ar:normal-case ar:tracking-normal">
          {copy.menu.head}
        </p>
      ) : null}
      {state === "loading" ? (
        <div aria-busy="true" data-testid="menu-loading">
          {[0, 1, 2].map((i) => (
            <div key={i} className={row({ sheet })}>
              <div className="flex flex-1 flex-col gap-2 animate-pulse motion-reduce:animate-none">
                <span className="h-5 w-40 bg-line" />
                <span className="h-4 w-24 bg-line" />
              </div>
            </div>
          ))}
        </div>
      ) : destinations.length === 0 ? (
        <p className="m-0 px-6 py-4 text-label text-muted">{copy.menu.empty}</p>
      ) : (
        <div
          ref={listRef}
          role="listbox"
          aria-label={copy.menu.label}
          onKeyDown={onKey}
        >
          {destinations.map((d, i) => {
            const selected = d.id === selectedId;
            return (
              <div
                key={d.id}
                role="option"
                aria-selected={selected}
                tabIndex={i === active ? 0 : -1}
                className={row({ selected, sheet })}
                onClick={() => {
                  setActive(i);
                  onSelect(d.id);
                }}
                onFocus={() => setActive(i)}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="font-display text-title text-teal">{d.name}</span>
                  <span className={cn("text-caption", selected ? "text-ink" : "text-muted")}>
                    {d.shortLine}
                  </span>
                </span>
                {sheet ? (
                  <ChevronIcon size={20} className="shrink-0 text-teal rtl:-scale-x-100" />
                ) : selected ? (
                  <CheckIcon size={20} className="shrink-0 text-teal rtl:-scale-x-100" />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
