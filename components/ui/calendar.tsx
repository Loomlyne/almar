"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  CalendarDate,
  getDayOfWeek,
  getLocalTimeZone,
  today,
} from "@internationalized/date";
import { ChevronIcon } from "../icons/icons";

function pad(value: number) {
  return String(value).padStart(2, "0");
}

export function formatDate(date: CalendarDate) {
  return `${pad(date.day)}/${pad(date.month)}/${date.year}`;
}

function monthLabel(date: CalendarDate) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    new Date(date.year, date.month - 1, 1),
  );
}

function spokenDate(date: CalendarDate) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date.year, date.month - 1, date.day));
}

function compare(a: CalendarDate, b: CalendarDate) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

function dateKey(date: CalendarDate) {
  return `${date.year}-${date.month}-${date.day}`;
}

function nightsBetween(start: CalendarDate, end: CalendarDate) {
  const ms = end.toDate(getLocalTimeZone()).getTime() - start.toDate(getLocalTimeZone()).getTime();
  return Math.max(0, Math.round(ms / 86_400_000));
}

function rangeStatus(start: CalendarDate | null, end: CalendarDate | null) {
  if (!start) return "No range yet";
  if (!end) return "Select check-out";
  const count = nightsBetween(start, end);
  if (count === 0) return "Same day";
  return count === 1 ? "1 night" : `${count} nights`;
}

export function CalendarPanel({
  start,
  end,
  hover,
  onPick,
  onHover,
  describedBy,
}: {
  start: CalendarDate | null;
  end: CalendarDate | null;
  hover: CalendarDate | null;
  onPick: (date: CalendarDate) => void;
  onHover: (date: CalendarDate | null) => void;
  describedBy?: string;
}) {
  const now = today(getLocalTimeZone());
  const titleId = useId();
  const gridRef = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const [cursor, setCursor] = useState(() => new CalendarDate(now.year, now.month, 1));
  const [focused, setFocused] = useState<CalendarDate | null>(null);
  const [focusTick, setFocusTick] = useState(0);
  const first = new CalendarDate(cursor.year, cursor.month, 1);
  const lead = getDayOfWeek(first, "en-GB");
  const count = first.calendar.getDaysInMonth(first);
  const days = useMemo(() => {
    const cells: Array<CalendarDate | null> = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= count; day += 1) {
      cells.push(new CalendarDate(cursor.year, cursor.month, day));
    }
    return cells;
  }, [cursor.year, cursor.month, count, lead]);

  const previewEnd = end ?? hover;
  const preferred = focused ?? start ?? now;
  const tabDay = compare(preferred, now) < 0 ? now : preferred;

  useEffect(() => {
    const key = pendingFocus.current;
    if (!key || !gridRef.current) return;
    const button = gridRef.current.querySelector<HTMLButtonElement>(`[data-date="${key}"]`);
    if (!button || button.disabled) return;
    pendingFocus.current = null;
    button.focus();
  }, [focusTick, cursor.year, cursor.month]);

  function moveTo(date: CalendarDate) {
    if (compare(date, now) < 0) return;
    pendingFocus.current = dateKey(date);
    setFocused(date);
    if (date.year !== cursor.year || date.month !== cursor.month) {
      setCursor(new CalendarDate(date.year, date.month, 1));
    }
    setFocusTick((value) => value + 1);
  }

  function onDayKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, date: CalendarDate) {
    const key = event.key;
    if (key === "PageUp" || key === "PageDown") {
      event.preventDefault();
      moveTo(date.add({ months: key === "PageUp" ? -1 : 1 }));
      return;
    }
    if (key === "Home" || key === "End") {
      event.preventDefault();
      const weekday = getDayOfWeek(date, "en-GB");
      moveTo(key === "Home" ? date.subtract({ days: weekday }) : date.add({ days: 6 - weekday }));
      return;
    }
    const steps: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const step = steps[key];
    if (step == null) return;
    event.preventDefault();
    const rtl = getComputedStyle(event.currentTarget).direction === "rtl";
    const delta = rtl && (key === "ArrowLeft" || key === "ArrowRight") ? -step : step;
    moveTo(date.add({ days: delta }));
  }

  return (
    <div className="calendar">
      <div className="calendar-bar">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous month"
          onClick={() => setCursor(cursor.subtract({ months: 1 }))}
        >
          <ChevronIcon size={20} className="icon-back" />
        </button>
        <p className="calendar-title" id={titleId}>
          {monthLabel(cursor)}
        </p>
        <button
          type="button"
          className="icon-button"
          aria-label="Next month"
          onClick={() => setCursor(cursor.add({ months: 1 }))}
        >
          <ChevronIcon size={20} className="icon-forward" />
        </button>
      </div>
      <div className="calendar-week" aria-hidden="true">
        {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div
        ref={gridRef}
        className="calendar-grid"
        role="grid"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
      >
        {days.map((date, index) => {
          if (!date) return <span key={`pad-${index}`} />;
          const past = compare(date, now) < 0;
          const inRange = Boolean(
            start && previewEnd && compare(date, start) >= 0 && compare(previewEnd, date) >= 0,
          );
          const isStart = Boolean(start && compare(date, start) === 0);
          const isEnd = Boolean(end && compare(date, end) === 0);
          const isPreviewEnd = Boolean(
            !end &&
              hover &&
              start &&
              compare(date, hover) === 0 &&
              compare(hover, start) > 0,
          );
          const isToday = compare(date, now) === 0;
          const single = Boolean(
            (isStart && isEnd) ||
              (isStart && !end && (!hover || (start && compare(hover, start) === 0))),
          );
          const rangeEnd = (isEnd || isPreviewEnd) && !single;
          const rangeStart = isStart && !single;
          const inMiddle = inRange && !single && !rangeStart && !rangeEnd;
          const tab = compare(date, tabDay) === 0 && !past;
          const isHot = Boolean(hover && !past && compare(date, hover) === 0);
          const role = [isStart ? "check-in" : "", isEnd ? "check-out" : ""].filter(Boolean).join(", ");
          return (
            <button
              key={date.toString()}
              type="button"
              role="gridcell"
              data-date={dateKey(date)}
              className={[
                "calendar-day",
                inMiddle ? "is-range" : "",
                rangeStart ? "is-start" : "",
                rangeEnd ? "is-end" : "",
                isToday ? "is-today" : "",
                !end && hover && inMiddle ? "is-preview" : "",
                isPreviewEnd ? "is-preview-end" : "",
                isHot ? "is-hot" : "",
                single ? "is-single" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={past}
              tabIndex={tab ? 0 : -1}
              aria-label={role ? `${spokenDate(date)}, ${role}` : spokenDate(date)}
              aria-selected={isStart || isEnd || (Boolean(end) && inMiddle) || undefined}
              aria-current={isToday ? "date" : undefined}
              onMouseEnter={() => onHover(date)}
              onMouseLeave={() => onHover(null)}
              onFocus={() => onHover(date)}
              onBlur={(event) => {
                const next = event.relatedTarget;
                if (next instanceof Node && event.currentTarget.parentElement?.contains(next)) return;
                onHover(null);
              }}
              onKeyDown={(event) => onDayKeyDown(event, date)}
              onClick={() => onPick(date)}
            >
              {date.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
