"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDate, getDayOfWeek, today } from "@internationalized/date";
import { formatDate } from "../../../../components/ui/calendar";
import { Field } from "../../../../components/ui/field";
import { Sidebar } from "../../../../components/ui/sidebar";
import { ChevronIcon } from "../../../../components/icons/icons";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { isDocumentLocale, type DocumentLocale } from "../../../../lib/set-document-locale";
import styles from "./calendar.module.css";

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
    return <div className={styles.screen} />;
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>{copy.rail.calendar}</h1>
      <div className={styles.bar}>
        <button
          type="button"
          className="icon-button"
          aria-label="Previous month"
          onClick={() => setCursor((value) => (value ? value.subtract({ months: 1 }) : value))}
        >
          <ChevronIcon size={20} className="icon-back" />
        </button>
        <p className={styles.monthLabel}>{monthLabel(cursor)}</p>
        <button
          type="button"
          className="icon-button"
          aria-label="Next month"
          onClick={() => setCursor((value) => (value ? value.add({ months: 1 }) : value))}
        >
          <ChevronIcon size={20} className="icon-forward" />
        </button>
      </div>
      <div className={styles.week} aria-hidden="true">
        {WEEKDAY_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className={styles.grid} role="grid">
        {cells.map((date, index) =>
          date ? (
            <button
              key={date.toString()}
              type="button"
              role="gridcell"
              className={styles.day}
              aria-label={formatDate(date)}
              onClick={() => openDay(date)}
            >
              <span className={styles.dayNumber}>{date.day}</span>
              {isSameDate(date, now) ? <span className={styles.todayDot} aria-hidden="true" /> : null}
            </button>
          ) : (
            <span key={`pad-${index}`} className={styles.pad} />
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
          <div className={styles.empty}>
            <p className={styles.emptyText}>{copy.noBookingsYet}</p>
            <div className={styles.actions}>
              <button
                type="button"
                className="hero-search-submit"
                onClick={() => setView("newBooking")}
              >
                {copy.newBooking}
              </button>
              <button type="button" className={styles.block}>
                {copy.block}
              </button>
            </div>
          </div>
        )}
      </Sidebar>
    </div>
  );
}
