"use client";

import { cva } from "class-variance-authority";
import { CheckIcon } from "../icons/icons";
import { Chip } from "../ui/chip";
import { Stepper } from "../ui/stepper";
import { cn } from "../../lib/cn";
import { fill } from "../../lib/journey-format";
import type { AddOnItem, JourneyCopy } from "./types";

export type AddOnFilter = "all" | "experiences" | "services";

export type AddOnRowProps = {
  item: AddOnItem;
  quantity: number;
  /** Guests total incl. infants for per person, nights for per night; ignored for per trip. */
  max: number;
  onChange: (quantity: number) => void;
  size?: "row" | "phone";
  copy: JourneyCopy;
};

const row = cva("bg-surface", {
  variants: {
    size: {
      row: "flex items-center gap-6 p-3 pe-6",
      phone: "flex flex-wrap items-center gap-3 p-2",
    },
    added: { true: "shadow-selected", false: "ring-1 ring-inset ring-line" },
  },
});

const toggle = cva(
  "inline-flex items-center justify-center gap-2 border border-teal rounded-none cursor-pointer transition-colors duration-fast ease-standard",
  {
    variants: {
      on: {
        true: "bg-teal text-ivory hover:bg-teal-hover",
        false: "bg-surface text-teal hover:bg-teal-tint",
      },
      size: {
        row: "h-control w-full text-label uppercase tracking-kicker ar:normal-case ar:tracking-normal",
        phone: "size-control shrink-0 text-title leading-none",
      },
    },
  },
);

/** One experience or service with its image and the control for its unit (D-46, D-47). */
export function AddOnRow({ item, quantity, max, onChange, size = "row", copy }: AddOnRowProps) {
  const a = copy.addons;
  const added = quantity > 0;
  const kind =
    item.kind === "experience" ? a.kind.experience : item.region === "uae" ? a.kind.serviceUae : a.kind.service;
  const addName = fill(a.addName, { name: item.name });
  const cap = Math.max(0, max);
  const clamp = (n: number) => Math.min(Math.max(0, n), item.unit === "trip" ? 1 : cap);

  const control =
    item.unit === "trip" ? (
      <button
        type="button"
        aria-pressed={added}
        aria-label={addName}
        className={toggle({ on: added, size })}
        onClick={() => onChange(added ? 0 : 1)}
      >
        {size === "phone" ? (
          added ? (
            <CheckIcon size={20} />
          ) : (
            <span aria-hidden="true">+</span>
          )
        ) : (
          <>
            {added ? <CheckIcon size={16} /> : null}
            <span aria-hidden="true">{added ? a.added : a.add}</span>
          </>
        )}
      </button>
    ) : (
      <Stepper
        value={quantity}
        min={0}
        max={cap}
        onChange={(n) => onChange(clamp(n))}
        addLabel={fill(a.addOne, { name: item.name })}
        removeLabel={fill(a.removeOne, { name: item.name })}
        atMaxNote={item.unit === "person" ? a.max.person : a.max.night}
      />
    );

  const image = (
    <img
      src={item.image.src}
      alt={item.image.alt}
      loading="lazy"
      className={cn(
        "object-cover outline outline-1 -outline-offset-1 outline-ink/10",
        size === "row" ? "w-34 aspect-4/3" : "size-21",
      )}
    />
  );

  if (size === "phone") {
    return (
      <article className={row({ size, added })} data-added={added}>
        {image}
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-caption text-muted uppercase tracking-kicker ar:normal-case ar:tracking-normal">
            {kind}
          </span>
          <h3 className="m-0 font-display text-title text-teal line-clamp-2">{item.name}</h3>
          <span className="text-label tabular-nums">
            {item.price} <span className="text-caption text-muted">{a.unit[item.unit]}</span>
          </span>
        </div>
        {item.unit === "trip" ? control : <div className="basis-full flex justify-end">{control}</div>}
      </article>
    );
  }

  return (
    <article className={row({ size, added })} data-added={added}>
      {image}
      <div className="flex-1 min-w-0 flex flex-col">
        <span className="text-caption text-muted uppercase tracking-kicker ar:normal-case ar:tracking-normal">
          {kind}
        </span>
        <h3 className="m-0 font-display text-title text-teal line-clamp-2">{item.name}</h3>
      </div>
      <div className="w-38 text-end flex flex-col">
        <span className="text-body tabular-nums">{item.price}</span>
        <span className="text-caption text-muted">{a.unit[item.unit]}</span>
      </div>
      <div className="w-31 shrink-0 flex justify-end">{control}</div>
    </article>
  );
}

export type AddOnListProps = {
  items: AddOnItem[];
  /** Quantity by item id; missing means 0. */
  quantities: Record<string, number>;
  onChange: (id: string, quantity: number) => void;
  guestsTotal: number;
  nights: number;
  destinationName: string;
  filter: AddOnFilter;
  onFilterChange: (filter: AddOnFilter) => void;
  loading?: boolean;
  size?: "row" | "phone";
  copy: JourneyCopy;
  className?: string;
};

const FILTERS: AddOnFilter[] = ["all", "experiences", "services"];

function Skeleton({ size }: { size: "row" | "phone" }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "bg-surface ring-1 ring-inset ring-line flex items-center gap-6",
        size === "row" ? "p-3 pe-6" : "p-2 gap-3",
      )}
    >
      <div
        className={cn(
          "bg-ivory animate-pulse motion-reduce:animate-none",
          size === "row" ? "w-34 aspect-4/3" : "size-21",
        )}
      />
      <div className="flex-1 flex flex-col gap-2">
        <div className="h-4 w-1/3 bg-ivory animate-pulse motion-reduce:animate-none" />
        <div className="h-4 w-2/3 bg-ivory animate-pulse motion-reduce:animate-none" />
      </div>
    </div>
  );
}

/** Header, filter chips and the scrolling list. Takes only the items it is given (D-45, D-47). */
export function AddOnList({
  items,
  quantities,
  onChange,
  guestsTotal,
  nights,
  destinationName,
  filter,
  onFilterChange,
  loading = false,
  size = "row",
  copy,
  className,
}: AddOnListProps) {
  const a = copy.addons;
  const shown = items.filter((i) =>
    filter === "all" ? true : filter === "experiences" ? i.kind === "experience" : i.kind === "service",
  );
  const added = shown.filter((i) => (quantities[i.id] ?? 0) > 0).length;
  const chipLabel: Record<AddOnFilter, string> = {
    all: a.filter.all,
    experiences: a.filter.experiences,
    services: a.filter.services,
  };

  return (
    <div className={cn("flex flex-col gap-4 min-h-0", className)}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col">
          <h2 className="m-0">{fill(a.section, { destination: destinationName })}</h2>
          <p className="m-0 text-caption text-muted" aria-live="polite">
            {fill(a.count, { shown: shown.length, added })}
          </p>
        </div>
        <div role="group" aria-label={a.filter.label} className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <Chip key={f} on={filter === f} onClick={() => onFilterChange(f)}>
              {chipLabel[f]}
            </Chip>
          ))}
        </div>
      </div>
      <div
        tabIndex={0}
        role="region"
        aria-label={a.listLabel}
        aria-busy={loading || undefined}
        className="overflow-y-auto flex flex-col gap-3"
      >
        {loading ? (
          [0, 1, 2].map((n) => <Skeleton key={n} size={size} />)
        ) : shown.length === 0 ? (
          <p className="m-0 text-caption text-muted">{a.empty[filter]}</p>
        ) : (
          shown.map((item) => (
            <AddOnRow
              key={item.id}
              item={item}
              quantity={quantities[item.id] ?? 0}
              max={item.unit === "person" ? guestsTotal : nights}
              onChange={(q) => onChange(item.id, q)}
              size={size}
              copy={copy}
            />
          ))
        )}
      </div>
    </div>
  );
}
