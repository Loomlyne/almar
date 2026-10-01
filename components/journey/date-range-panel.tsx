"use client";

import {
  Fragment,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { CalendarDate, getDayOfWeek, getLocalTimeZone, today as todayFn } from "@internationalized/date";
import { cva } from "class-variance-authority";
import { Button } from "../ui/button";
import { ChevronIcon } from "../icons/icons";
import { cn } from "../../lib/cn";
import { formatPlural } from "../../lib/journey-format";
import type { JourneyCopy, Locale } from "./types";

// Latin numerals in every language; Arabic keeps the Gregorian calendar (D-40).
const INTL_TAG: Record<Locale, string> = {
  en: "en",
  ar: "ar-AE-u-ca-gregory-nu-latn",
  es: "es",
};
// Any locale whose week starts on Monday; index 0 is Monday (D-40).
const MONDAY_FIRST = "fr-FR";

export type DateRangeValue = { start: CalendarDate | null; end: CalendarDate | null };

export type DateRangePanelProps = {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
  onDone: () => void;
  onClear: () => void;
  locale: Locale;
  copy: JourneyCopy;
  /** 2 on desktop, 1 on tablet and phone. */
  months?: 1 | 2;
  /** Injectable for deterministic tests. */
  today?: CalendarDate;
  /** Booked or blocked days for one stay (D-63); shown unavailable and never a range end. */
  blocked?: CalendarDate[];
  /** "phone" uses text-body day numbers. */
  size?: "md" | "phone";
  /** false hides Clear and Done (the phone sheet has its own dock); the line stays for screen readers. */
  footer?: boolean;
  className?: string;
};

const pad = (n: number) => String(n).padStart(2, "0");
const fmt = (d: CalendarDate) => `${pad(d.day)}/${pad(d.month)}/${d.year}`;
const cmp = (a: CalendarDate, b: CalendarDate) => a.compare(b);
const key = (d: CalendarDate) => `${d.year}-${d.month}-${d.day}`;
const firstOf = (d: CalendarDate) => new CalendarDate(d.year, d.month, 1);
const utc = (d: CalendarDate) => new Date(Date.UTC(d.year, d.month - 1, d.day));

const dayCell = cva(
  "h-control w-full tabular-nums cursor-pointer rounded-none border-0 p-0 focus-visible:outline-2 focus-visible:outline-teal",
  {
    variants: {
      size: { md: "text-label", phone: "text-body" },
      state: {
        idle: "bg-surface text-ink hover:ring-1 hover:ring-inset hover:ring-teal",
        edge: "bg-teal text-ivory font-bold",
        range: "bg-teal-tint text-ink hover:ring-1 hover:ring-inset hover:ring-teal",
        past: "bg-surface text-muted cursor-default",
      },
      today: { true: "shadow-rule-today", false: "" },
    },
    defaultVariants: { size: "md", state: "idle", today: false },
  },
);

/** Fill `{slot}` markers with nodes so dates can sit in <bdi>. */
function fillNodes(template: string, slots: Record<string, ReactNode>): ReactNode {
  return template.split(/(\{\w+\})/g).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return <Fragment key={i}>{m && m[1] in slots ? slots[m[1]] : part}</Fragment>;
  });
}

export function DateRangePanel({
  value,
  onChange,
  onDone,
  onClear,
  locale,
  copy,
  months = 2,
  today,
  blocked,
  size = "md",
  footer = true,
  className,
}: DateRangePanelProps) {
  const now = useMemo(() => today ?? todayFn(getLocalTimeZone()), [today]);
  const tag = INTL_TAG[locale];
  const baseId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const pending = useRef<string | null>(null);
  const [cursor, setCursor] = useState<CalendarDate>(() => firstOf(value.start ?? now));
  const [focused, setFocused] = useState<CalendarDate | null>(null);
  const [tick, setTick] = useState(0);

  const blockedKeys = useMemo(() => new Set((blocked ?? []).map(key)), [blocked]);
  const isBlocked = (d: CalendarDate) => blockedKeys.has(key(d));
  const crossesBlocked = (a: CalendarDate, b: CalendarDate) => {
    for (let d = a.add({ days: 1 }); cmp(d, b) < 0; d = d.add({ days: 1 })) if (isBlocked(d)) return true;
    return false;
  };

  const shown = Array.from({ length: months }, (_, i) => cursor.add({ months: i }));
  const atCurrentMonth = cmp(cursor, firstOf(now)) <= 0;

  const weekdays = useMemo(() => {
    const monday = new CalendarDate(2026, 9, 28);
    const f = new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => f.format(utc(monday.add({ days: i }))));
  }, [tag]);

  const monthTitle = (d: CalendarDate) =>
    new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" }).format(utc(d));

  // Roving tabindex: one stop across the whole panel, always inside a visible month.
  const visible = (d: CalendarDate) => shown.some((m) => d.year === m.year && d.month === m.month);
  const candidate = focused ?? value.start ?? now;
  const inFirst = cmp(candidate, now) < 0 ? now : candidate;
  const tabDay = visible(inFirst) ? inFirst : cmp(cursor, now) < 0 ? now : cursor;

  useEffect(() => {
    const k = pending.current;
    if (!k || !rootRef.current) return;
    const el = rootRef.current.querySelector<HTMLElement>(`[data-date="${k}"]`);
    if (!el) return;
    pending.current = null;
    el.focus();
  }, [tick, cursor]);

  function moveTo(date: CalendarDate) {
    if (cmp(date, now) < 0) return;
    pending.current = key(date);
    setFocused(date);
    if (!visible(date)) {
      const first = firstOf(date);
      const last = cmp(date, cursor) > 0;
      setCursor(last ? first.subtract({ months: months - 1 }) : first);
    }
    setTick((t) => t + 1);
  }

  function pick(date: CalendarDate) {
    if (cmp(date, now) < 0 || isBlocked(date)) return;
    const { start, end } = value;
    if (!start || end) onChange({ start: date, end: null });
    else if (cmp(date, start) <= 0 || crossesBlocked(start, date)) onChange({ start: date, end: null });
    else onChange({ start, end: date });
  }

  function onKey(event: ReactKeyboardEvent<HTMLButtonElement>, date: CalendarDate) {
    const k = event.key;
    if (k === "Enter" || k === " ") {
      event.preventDefault();
      pick(date);
      return;
    }
    if (k === "PageUp" || k === "PageDown") {
      event.preventDefault();
      moveTo(date.add({ months: k === "PageUp" ? -1 : 1 }));
      return;
    }
    if (k === "Home" || k === "End") {
      event.preventDefault();
      const weekday = getDayOfWeek(date, MONDAY_FIRST);
      moveTo(k === "Home" ? date.subtract({ days: weekday }) : date.add({ days: 6 - weekday }));
      return;
    }
    const steps: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    const step = steps[k];
    if (step === undefined) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    moveTo(date.add({ days: rtl && (k === "ArrowLeft" || k === "ArrowRight") ? -step : step }));
  }

  function label(date: CalendarDate) {
    const { start, end } = value;
    const parts = [fmt(date)];
    if (start && cmp(date, start) === 0) parts.push(copy.dates.day.arrival);
    else if (end && cmp(date, end) === 0) parts.push(copy.dates.day.departure);
    else if (start && end && cmp(date, start) > 0 && cmp(date, end) < 0) parts.push(copy.dates.day.inRange);
    if (cmp(date, now) < 0 || isBlocked(date)) parts.push(copy.dates.day.unavailable);
    if (cmp(date, now) === 0) parts.push(copy.dates.day.today);
    return parts.join(", ");
  }

  const nights = value.start && value.end ? Math.round((utc(value.end).getTime() - utc(value.start).getTime()) / 86400000) : 0;
  const bdi = (d: CalendarDate) => <bdi dir="ltr">{fmt(d)}</bdi>;
  let line: ReactNode = copy.dates.line.none;
  if (value.start && value.end) {
    line = fillNodes(copy.dates.line.range, {
      start: bdi(value.start),
      end: bdi(value.end),
      nights: formatPlural(copy.dates.nights, nights, locale),
    });
  } else if (value.start) {
    line = fillNodes(copy.dates.line.start, { start: bdi(value.start) });
  }

  return (
    <div
      ref={rootRef}
      role="group"
      aria-label={copy.dates.label}
      className={cn(
        "bg-surface shadow-lg px-8 pt-8 pb-6 flex flex-col gap-6 animate-panel-in motion-reduce:animate-fade-in",
        months === 2 ? "w-calendar max-w-full" : "w-full",
        className,
      )}
    >
      <div className={cn("flex", months === 2 && "gap-12")}>
        {shown.map((month, mi) => {
          const titleId = `${baseId}-m${mi}`;
          const lead = getDayOfWeek(month, MONDAY_FIRST);
          const count = month.calendar.getDaysInMonth(month);
          const cells: Array<CalendarDate | null> = [
            ...Array.from({ length: lead }, () => null),
            ...Array.from({ length: count }, (_, i) => new CalendarDate(month.year, month.month, i + 1)),
          ];
          const rows: Array<Array<CalendarDate | null>> = [];
          for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
          return (
            <div key={key(month)} className="min-w-0 flex-1">
              <div className="flex min-h-control items-center justify-between">
                {mi === 0 ? (
                  <button
                    type="button"
                    className={cn(
                      "inline-flex size-control shrink-0 items-center justify-center rounded-none border-0 bg-transparent p-0",
                      atCurrentMonth ? "text-muted cursor-default" : "text-teal cursor-pointer",
                    )}
                    aria-label={copy.dates.prevMonth}
                    disabled={atCurrentMonth}
                    onClick={() => setCursor(cursor.subtract({ months: 1 }))}
                  >
                    <ChevronIcon size={20} className="-scale-x-100 rtl:scale-x-100" />
                  </button>
                ) : (
                  <span className="size-control shrink-0" aria-hidden="true" />
                )}
                <p id={titleId} className="m-0 flex-1 text-center font-display text-title text-teal">
                  {monthTitle(month)}
                </p>
                {mi === months - 1 ? (
                  <button
                    type="button"
                    className="inline-flex size-control shrink-0 cursor-pointer items-center justify-center rounded-none border-0 bg-transparent p-0 text-teal"
                    aria-label={copy.dates.nextMonth}
                    onClick={() => setCursor(cursor.add({ months: 1 }))}
                  >
                    <ChevronIcon size={20} className="rtl:-scale-x-100" />
                  </button>
                ) : (
                  <span className="size-control shrink-0" aria-hidden="true" />
                )}
              </div>
              <div role="grid" aria-labelledby={titleId}>
                <div role="row" className="grid grid-cols-7">
                  {weekdays.map((w, i) => (
                    <div
                      key={i}
                      role="columnheader"
                      className="flex h-control items-center justify-center text-caption text-muted"
                    >
                      {w}
                    </div>
                  ))}
                </div>
                {rows.map((row, ri) => (
                  <div key={ri} role="row" className="grid grid-cols-7">
                    {Array.from({ length: 7 }, (_, ci) => {
                      const date = row[ci] ?? null;
                      if (!date) return <div key={ci} role="gridcell" aria-hidden="true" />;
                      const past = cmp(date, now) < 0 || isBlocked(date);
                      const isStart = !!value.start && cmp(date, value.start) === 0;
                      const isEnd = !!value.end && cmp(date, value.end) === 0;
                      const inRange =
                        !!value.start && !!value.end && cmp(date, value.start) > 0 && cmp(date, value.end) < 0;
                      const state = past ? "past" : isStart || isEnd ? "edge" : inRange ? "range" : "idle";
                      const stop = cmp(date, tabDay) === 0;
                      return (
                        <div key={ci} role="gridcell" aria-selected={isStart || isEnd || inRange}>
                          <button
                            type="button"
                            data-date={key(date)}
                            aria-label={label(date)}
                            aria-disabled={past ? true : undefined}
                            aria-current={cmp(date, now) === 0 ? "date" : undefined}
                            tabIndex={stop ? 0 : -1}
                            className={dayCell({ size, state, today: cmp(date, now) === 0 })}
                            onClick={() => pick(date)}
                            onFocus={() => setFocused(date)}
                            onKeyDown={(e) => onKey(e, date)}
                          >
                            {date.day}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {footer ? (
        <div className="pt-4 border-t border-line flex items-center gap-6">
          <p aria-live="polite" className="m-0 flex-1 text-label text-ink">
            {line}
          </p>
          <Button variant="ghost" onClick={onClear}>
            {copy.dates.clear}
          </Button>
          <Button onClick={onDone}>{copy.done}</Button>
        </div>
      ) : (
        <p aria-live="polite" className="sr-only">
          {line}
        </p>
      )}
    </div>
  );
}
