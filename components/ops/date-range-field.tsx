"use client";

import { useId, useState, type ReactNode } from "react";
import { CalendarDate, parseDate } from "@internationalized/date";
import { Popover } from "radix-ui";
import { CalendarIcon } from "../icons/icons";
import { CalendarPanel, formatDate } from "../ui/calendar";
import { cn } from "../../lib/cn";
import { OPS_KIT_COPY, fillCopy } from "../../lib/copy/ops-kit";
import { useDashboardLocale } from "./use-dashboard-locale";

type Range = { first: string | null; last: string | null };

/** Today in Dubai as YYYY-MM-DD: the earliest day a rate or a block may start, unless the caller says otherwise. */
function dubaiToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function toDate(iso: string | null): CalendarDate | null {
  if (!iso) return null;
  try {
    return parseDate(iso);
  } catch {
    return null;
  }
}

function show(date: CalendarDate | null): string {
  return date ? formatDate(date) : "";
}

/**
 * A first day and a last day, both inclusive (contract 1.2, 5.3, 5.4), picked on the design system's calendar.
 * The field reads "DD/MM/YYYY – DD/MM/YYYY" (one date when both are the same day). The first pick sets the first day,
 * the second sets the last; a second pick before the first starts again; the same day twice is one day. Escape closes
 * and returns focus to the field.
 */
export function DateRangeField({
  id,
  label,
  hint,
  value,
  onChange,
  min,
  error,
}: {
  id: string;
  label: string;
  hint?: string;
  value: Range;
  onChange: (next: Range) => void;
  min?: string;
  error?: string;
}) {
  const copy = OPS_KIT_COPY[useDashboardLocale()];
  const messageId = useId();
  const liveId = useId();
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<CalendarDate | null>(null);
  const [early, setEarly] = useState(false);

  const earliest = min ?? dubaiToday();
  const first = toDate(value.first);
  const last = toDate(value.last);
  const message = error || hint;

  let text: ReactNode = copy.chooseDates;
  if (first && last && first.compare(last) === 0) text = show(first);
  else if (first) text = `${show(first)} – ${show(last)}`.trimEnd();

  function pick(date: CalendarDate) {
    const iso = date.toString();
    if (iso < earliest) {
      setEarly(true);
      return;
    }
    setEarly(false);
    if (value.first && !value.last && iso >= value.first) {
      onChange({ first: value.first, last: iso });
      setOpen(false);
      return;
    }
    onChange({ first: iso, last: null });
  }

  const status = early
    ? fillCopy(copy.datePickAfter, { date: show(toDate(earliest)) })
    : first && !last
      ? copy.datePickLast
      : copy.datePickFirst;

  return (
    <div className="grid max-w-96 gap-2">
      <label className="text-label text-ink" htmlFor={id}>
        {label}
      </label>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) {
            setHover(null);
            setEarly(false);
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            aria-describedby={message ? messageId : undefined}
            aria-invalid={error ? true : undefined}
            className={cn(
              "flex min-h-control w-full cursor-pointer items-center justify-between gap-2 rounded-none border border-ink bg-surface px-4 py-2 text-start font-body text-body text-ink md:text-label",
              "aria-invalid:border-error focus-visible:border-teal focus-visible:shadow-selected focus-visible:outline-none",
              !first && "text-muted",
            )}
          >
            <bdi dir="ltr">{text}</bdi>
            <CalendarIcon size={20} className="shrink-0 text-teal" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            aria-label={copy.calendarLabel}
            align="start"
            sideOffset={4}
            className="z-80 flex w-max max-w-full flex-col gap-2 rounded-none border border-line bg-surface p-2 text-ink shadow-float"
          >
            <CalendarPanel start={first} end={last} hover={hover} onPick={pick} onHover={setHover} describedBy={liveId} />
            <p id={liveId} aria-live="polite" className="m-0 px-2 pb-2 text-label text-muted">
              {status}
            </p>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {message ? (
        <p id={messageId} className={cn("m-0 text-label", error ? "text-error" : "text-ink")}>
          {message}
        </p>
      ) : null}
    </div>
  );
}
