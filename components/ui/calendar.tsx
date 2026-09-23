"use client";

import { useMemo, useState } from "react";
import {
  CalendarDate,
  getDayOfWeek,
  getLocalTimeZone,
  today,
} from "@internationalized/date";
import { KitDialog } from "./dialog";
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

function compare(a: CalendarDate, b: CalendarDate) {
  if (a.year !== b.year) return a.year - b.year;
  if (a.month !== b.month) return a.month - b.month;
  return a.day - b.day;
}

export function CalendarPanel({
  start,
  end,
  hover,
  onPick,
  onHover,
}: {
  start: CalendarDate | null;
  end: CalendarDate | null;
  hover: CalendarDate | null;
  onPick: (date: CalendarDate) => void;
  onHover: (date: CalendarDate | null) => void;
}) {
  const now = today(getLocalTimeZone());
  const [cursor, setCursor] = useState(() => new CalendarDate(now.year, now.month, 1));
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
        <p className="calendar-title">{monthLabel(cursor)}</p>
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
      <div className="calendar-grid" role="grid" aria-label="Date range">
        {days.map((date, index) => {
          if (!date) return <span key={`pad-${index}`} />;
          const past = compare(date, now) < 0;
          const inRange = Boolean(
            start && previewEnd && compare(date, start) >= 0 && compare(previewEnd, date) >= 0,
          );
          const isStart = Boolean(start && compare(date, start) === 0);
          const isEnd = Boolean(end && compare(date, end) === 0);
          const isToday = compare(date, now) === 0;
          const focusedDay = start ?? now;
          const tab = compare(date, focusedDay) === 0;
          return (
            <button
              key={date.toString()}
              type="button"
              role="gridcell"
              className={[
                "calendar-day",
                inRange ? "is-range" : "",
                isStart || isEnd ? "is-end" : "",
                isToday ? "is-today" : "",
                !end && hover && inRange ? "is-preview" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              disabled={past}
              tabIndex={tab && !past ? 0 : -1}
              aria-label={formatDate(date)}
              aria-selected={isStart || isEnd || undefined}
              onMouseEnter={() => onHover(date)}
              onMouseLeave={() => onHover(null)}
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

export function DateRangeField() {
  const [start, setStart] = useState<CalendarDate | null>(null);
  const [end, setEnd] = useState<CalendarDate | null>(null);
  const [hover, setHover] = useState<CalendarDate | null>(null);

  function pick(date: CalendarDate) {
    if (!start || end) {
      setStart(date);
      setEnd(null);
      return;
    }
    if (compare(date, start) < 0) {
      setEnd(start);
      setStart(date);
    } else {
      setEnd(date);
    }
  }

  return (
    <div className="date-range">
      <KitDialog trigger="When" title="Choose dates">
        <CalendarPanel start={start} end={end} hover={hover} onPick={pick} onHover={setHover} />
      </KitDialog>
      <CalendarPanel start={start} end={end} hover={hover} onPick={pick} onHover={setHover} />
      <div className="date-pair">
        <label>
          Check-in
          <input readOnly value={start ? formatDate(start) : ""} placeholder="DD/MM/YYYY" />
        </label>
        <span className="date-nights">0 nights</span>
        <label>
          Check-out
          <input readOnly value={end ? formatDate(end) : ""} placeholder="DD/MM/YYYY" />
        </label>
      </div>
    </div>
  );
}
