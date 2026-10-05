"use client";

import { useRef, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "../../lib/cn";

export type TabItem = {
  key: string;
  label: ReactNode;
  /** A status chip after the label. A plain element: it sits inside the tab button. */
  adornment?: ReactNode;
};

/** The id of the tab button for `key`, so a tab panel can name it. */
export function tabId(idBase: string, key: string): string {
  return `${idBase}-tab-${key}`;
}

export function panelId(idBase: string): string {
  return `${idBase}-panel`;
}

/**
 * A WAI-ARIA tab list for the kit: one Tab stop, arrow keys move and select, Home and End jump. Left and Right follow
 * the reading direction, so it mirrors in Arabic. Buttons, never radio inputs.
 */
export function TabList({
  idBase,
  label,
  items,
  value,
  onChange,
}: {
  idBase: string;
  label: string;
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  function move(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    let next = index;
    if (event.key === "ArrowRight") next = rtl ? index - 1 : index + 1;
    else if (event.key === "ArrowLeft") next = rtl ? index + 1 : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else return;
    event.preventDefault();
    const target = items[(next + items.length) % items.length];
    if (!target) return;
    onChange(target.key);
    refs.current.get(target.key)?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="flex min-w-0 flex-wrap border-b border-line">
      {items.map((item, index) => {
        const selected = item.key === value;
        return (
          <button
            key={item.key}
            ref={(node) => {
              if (node) refs.current.set(item.key, node);
              else refs.current.delete(item.key);
            }}
            id={tabId(idBase, item.key)}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={panelId(idBase)}
            tabIndex={selected ? 0 : -1}
            className={cn(
              "inline-flex min-h-control cursor-pointer items-center gap-2 rounded-none border-0 bg-transparent px-4 font-body text-label transition-colors duration-fast ease-standard hover:bg-ivory",
              selected ? "text-teal shadow-rule-primary" : "text-ink",
            )}
            onClick={() => onChange(item.key)}
            onKeyDown={(event) => move(event, index)}
          >
            <span>{item.label}</span>
            {item.adornment}
          </button>
        );
      })}
    </div>
  );
}
