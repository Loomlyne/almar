"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDate, getDayOfWeek, today } from "@internationalized/date";
import { formatDate } from "../../../../components/ui/calendar";
import { Button } from "../../../../components/ui/button";
import { Field } from "../../../../components/ui/field";
import { Sidebar } from "../../../../components/ui/sidebar";
import { ChevronIcon } from "../../../../components/icons/icons";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";

const DUBAI_TIME_ZONE = "Asia/Dubai";
const WEEKDAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type SidebarView = "day" | "newBooking";

function readLocale(): DocumentLocale {
  const matched = document.cookie.match(/(?:^|;\s*)almar-locale=([^;]*)/);
  const value = matched ? decodeURIComponent(matched[1] ?? "") : "";
  return isDocumentLocale(value) ? value : "en";
}

function monthLabel(date: CalendarDate) {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(
    new Date(date.year, date.month - 1, 1),
  );
}

function isSameDate(a: CalendarDate, b: CalendarDate) {
  return a.year === b.year && a.month === b.month && a.day === b.day;
}

export function CalendarScreen() {
  const [locale, setLocale] = useState<DocumentLocale>("en");
  const [now, setNow] = useState<CalendarDate | null>(null);
  const [cursor, setCursor] = useState<CalendarDate | null>(null);
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<CalendarDate | null>(null);
  const [view, setView] = useState<SidebarView>("day");
  const copy = DASHBOARD_COPY[locale];

  useEffect(() => {
    setLocale(readLocale());
    const dubaiToday = today(DUBAI_TIME_ZONE);
    setNow(dubaiToday);
    setCursor(new CalendarDate(dubaiToday.year, dubaiToday.month, 1));
  }, []);

  const cells = useMemo(() => {
    if (!cursor) return [];
    const first = new CalendarDate(cursor.year, cursor.month, 1);
    const lead = getDayOfWeek(first, "en-GB");
    const count = first.calendar.getDaysInMonth(first);
    const days: Array<CalendarDate | null> = Array.from({ length: lead }, () => null);
    for (let day = 1; day <= count; day += 1) {
      days.push(new CalendarDate(cursor.year, cursor.month, day));
    }
    while (days.length % 7 !== 0) {
      days.push(null);
    }
    return days;
  }, [cursor]);

  function openDay(date: CalendarDate) {
    setSelectedDate(date);
    setView("day");
    setOpen(true);
  }

  const title = selectedDate
    ? view === "newBooking"
      ? copy.newBooking
      : formatDate(selectedDate)
    : "";

  if (!cursor || !now) {
    return <div className="flex min-w-0 flex-col gap-6" />;
  }

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.rail.calendar}</h1>
      <div className="flex min-h-control items-center justify-between">
        <button
          type="button"
          className="icon-button"
          aria-label="Previous month"
          onClick={() => setCursor((value) => (value ? value.subtract({ months: 1 }) : value))}
        >
          <ChevronIcon size={20} className="icon-back" />
        </button>
        <p className="m-0 flex-1 text-center font-body text-body tabular-nums text-teal">{monthLabel(cursor)}</p>
        <button
          type="button"
          className="icon-button"
          aria-label="Next month"
          onClick={() => setCursor((value) => (value ? value.add({ months: 1 }) : value))}
        >
          <ChevronIcon size={20} className="icon-forward" />
        </button>
      </div>
      <div className="grid grid-cols-7 justify-items-center font-body text-label text-muted" aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 justify-items-center gap-2" role="grid">
        {cells.map((date, index) =>
          date ? (
            <button
              key={date.toString()}
              type="button"
              role="gridcell"
              className="relative flex size-control cursor-pointer flex-col items-center justify-center gap-1 rounded-none border border-ink bg-surface font-body text-ink hover:bg-ivory focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal"
              aria-label={formatDate(date)}
              onClick={() => openDay(date)}
            >
              <span className="text-label tabular-nums">{date.day}</span>
              {isSameDate(date, now) ? <span className="size-1 bg-ink" aria-hidden="true" /> : null}
            </button>
          ) : (
            <span key={`pad-${index}`} className="size-control" />
          ),
        )}
      </div>
      <Sidebar open={open} onOpenChange={setOpen} title={title} closeLabel={copy.close}>
        {view === "newBooking" ? (
          <>
            <Field id="calendar-booking-guest" label="Guest" name="guest" />
            <Field id="calendar-booking-destination" label="Destination" name="destination" />
            <Field
              id="calendar-booking-dates"
              label="Dates"
              name="dates"
              placeholder="DD/MM/YYYY"
              defaultValue={selectedDate ? formatDate(selectedDate) : undefined}
            />
            <Field id="calendar-booking-status" label="Status" name="status" />
          </>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <p className="m-0 text-pretty text-body text-ink">{copy.noBookingsYet}</p>
            <div className="flex gap-2">
              <Button onClick={() => setView("newBooking")}>{copy.newBooking}</Button>
              <Button variant="secondary">{copy.block}</Button>
            </div>
          </div>
        )}
      </Sidebar>
    </div>
  );
}
