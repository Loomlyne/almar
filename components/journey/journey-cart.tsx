"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronIcon, CloseIcon } from "../icons/icons";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { cn } from "../../lib/cn";
import { fill, formatPlural } from "../../lib/journey-format";
import type { CartLine, ImageRef, JourneyCopy, Locale } from "./types";

export type CartStay = {
  image: ImageRef;
  name: string;
  // Display string, for example "12/10/2026 – 17/10/2026".
  dates: string;
  // Display string, for example "2 adults".
  guests: string;
  nights: number;
  // For example "AED [AMOUNT]".
  amount: string;
};

export type JourneyCartProps = {
  destinationName: string;
  stay: CartStay;
  lines: CartLine[];
  inclusionsCount: number;
  // Amounts arrive as display strings. The cart never adds, multiplies or rounds (D-52).
  subtotal: string;
  vat: string;
  total: string;
  onRemove: (id: string) => void;
  onContinue: () => void;
  variant?: "rail" | "phone";
  loading?: boolean;
  // Harness only: start the phone cart open.
  defaultOpen?: boolean;
  copy: JourneyCopy;
  locale: Locale;
  className?: string;
};

const KICKER = "text-caption text-muted uppercase tracking-kicker ar:normal-case ar:tracking-normal";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4 pt-3 border-t tabular-nums",
        strong ? "border-ink text-title font-bold" : "border-line text-label",
      )}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Skeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {[0, 1, 2].map((n) => (
        <div key={n} className="h-4 w-full bg-ivory animate-pulse motion-reduce:animate-none" />
      ))}
    </div>
  );
}

function CartBody({
  destinationName,
  stay,
  lines,
  inclusionsCount,
  subtotal,
  vat,
  total,
  onRemove,
  loading,
  copy,
  locale,
}: JourneyCartProps) {
  const c = copy.cart;
  const root = useRef<HTMLDivElement>(null);
  const kicker = useRef<HTMLParagraphElement>(null);
  const pending = useRef<string | null>(null);

  // After a removal, focus lands on the row that took its place, or on the group kicker.
  useEffect(() => {
    const target = pending.current;
    if (target === null) return;
    pending.current = null;
    const next = target === "" ? null : root.current?.querySelector<HTMLElement>(`[data-remove-id="${CSS.escape(target)}"]`);
    (next ?? kicker.current)?.focus();
  }, [lines]);

  const remove = (index: number) => {
    const rest = lines.filter((_, i) => i !== index);
    pending.current = (rest[index] ?? rest[index - 1])?.id ?? "";
    onRemove(lines[index].id);
  };

  return (
    <div ref={root} className="flex flex-col gap-4">
      <img
        src={stay.image.src}
        alt={stay.image.alt}
        className="w-full aspect-video object-cover outline outline-1 -outline-offset-1 outline-ink/10"
      />
      <div className="flex flex-col gap-1">
        <p className={cn("m-0", KICKER)}>{fill(c.kicker, { destination: destinationName })}</p>
        <h3 className="m-0 font-display text-title text-teal">{stay.name}</h3>
        <p className="m-0 text-label text-muted">
          {stay.dates} · {stay.guests}
        </p>
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-line text-label tabular-nums">
        {loading ? (
          <Skeleton />
        ) : (
          <>
            <div className="flex items-baseline justify-between gap-4">
              <span>{formatPlural(c.stay, stay.nights, locale)}</span>
              <span>{stay.amount}</span>
            </div>
            <p ref={kicker} tabIndex={-1} className={cn("m-0 pt-2 outline-none", KICKER)}>
              {formatPlural(c.addons, lines.length, locale)}
            </p>
            {lines.length === 0 ? (
              <p className="m-0 text-muted">{c.empty}</p>
            ) : (
              lines.map((line, i) => (
                <div key={line.id} className="flex items-center justify-between gap-3">
                  <span className="flex-1 min-w-0">
                    {line.name}
                    {line.quantity > 1 ? <span className="text-muted"> × {line.quantity}</span> : null}
                  </span>
                  <span>{line.amount}</span>
                  <button
                    type="button"
                    data-remove-id={line.id}
                    aria-label={fill(c.remove, { name: line.name })}
                    className="inline-flex size-control shrink-0 items-center justify-center border-0 bg-transparent text-muted hover:text-ink cursor-pointer"
                    onClick={() => remove(i)}
                  >
                    <CloseIcon size={20} />
                  </button>
                </div>
              ))
            )}
            {inclusionsCount > 0 ? (
              <div className="flex items-baseline justify-between gap-4 text-muted">
                <span>{formatPlural(c.inclusions, inclusionsCount, locale)}</span>
                <span>{c.included}</span>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Row label={c.subtotal} value={subtotal} />
        <Row label={c.vat} value={vat} />
        <Row label={c.total} value={total} strong />
      </div>
      <p className="m-0 text-caption text-muted">{c.note}</p>
    </div>
  );
}

// Desktop rail, or phone dock with a full-screen cart (D-50). Amounts are strings; no arithmetic.
export function JourneyCart(props: JourneyCartProps) {
  const { variant = "rail", copy, locale, lines, total, onContinue, defaultOpen = false, className } = props;
  const c = copy.cart;
  const [open, setOpen] = useState(defaultOpen);

  if (variant === "rail") {
    return (
      <aside
        aria-label={c.label}
        className={cn("w-rail bg-surface border border-line sticky top-rail-offset p-6", className)}
      >
        <CartBody {...props} />
      </aside>
    );
  }

  const caption = formatPlural(c.phoneTotal, lines.length, locale);
  const dock = (inDialog: boolean) => (
    <div
      className={cn(
        "h-dock px-4 border-t border-line bg-ivory flex items-center gap-4",
        inDialog ? "w-full" : "fixed inset-x-0 bottom-0 z-40",
      )}
    >
      {inDialog ? (
        <div className="flex-1 min-w-0 flex flex-col text-start">
          <span className="text-caption text-muted">{caption}</span>
          <span className="text-body font-bold tabular-nums">{total}</span>
        </div>
      ) : (
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex-1 min-w-0 h-action flex items-center gap-2 border-0 bg-transparent p-0 text-start text-ink cursor-pointer"
          onClick={() => setOpen(true)}
        >
          <span className="flex-1 min-w-0 flex flex-col">
            <span className="text-caption text-muted">{caption}</span>
            <span className="text-body font-bold tabular-nums">{total}</span>
          </span>
          <ChevronIcon size={20} className="shrink-0 text-teal -rotate-90" />
        </button>
      )}
      <Button size="lg" onClick={onContinue}>
        {c.continue}
      </Button>
    </div>
  );

  return (
    <>
      {dock(false)}
      <Dialog
        open={open}
        onOpenChange={setOpen}
        size="full"
        title={c.label}
        closeLabel={copy.sheet.close}
        footer={dock(true)}
      >
        <div className="p-4">
          <CartBody {...props} />
        </div>
      </Dialog>
    </>
  );
}
