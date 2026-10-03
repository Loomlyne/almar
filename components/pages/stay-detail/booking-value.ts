// The stay page's pre-fill and dock rules as pure functions (plan 03.3-06, design 1.3 and 4.1).
//
// No React, no browser access, no data-layer read: the booking island and the node tests both load this.
// The only link to lib/data is a type, so a Stay object can never reach the client through here.

import { CalendarDate } from "@internationalized/date";
import type { IsoDate } from "../../../lib/data/types";
import { formatDate } from "../../../lib/format";
import { formatGuestSummary } from "../../../lib/journey-format";
import type { JourneyChoice } from "../../../lib/journey-choice";
import type { JourneyCopy, JourneyValue, Locale } from "../../journey/types";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function parseIso(text: unknown): CalendarDate | null {
  if (typeof text !== "string" || !ISO.test(text)) return null;
  const date = new CalendarDate(Number(text.slice(0, 4)), Number(text.slice(5, 7)), Number(text.slice(8, 10)));
  // CalendarDate clamps (2026-02-30 becomes 2026-02-28), so a date is only real when it prints back as written.
  return date.toString() === text ? date : null;
}

/**
 * ISO dates from the data layer as calendar dates. A malformed entry throws: the dates are data, and a bad
 * fixture row has to fail the build, not quietly vanish from the calendar.
 */
export function toCalendarDates(dates: readonly IsoDate[]): CalendarDate[] {
  return dates.map((text) => {
    const date = parseIso(text);
    if (!date) throw new Error(`blocked date is not a calendar date YYYY-MM-DD: ${JSON.stringify(text)}`);
    return date;
  });
}

const keyOf = (d: CalendarDate) => `${d.year}-${d.month}-${d.day}`;

/**
 * True when any night of the stay is blocked: every day d with start <= d < end. The departure day itself may
 * be blocked, because the guest leaves that morning (the calendar panel applies the same rule when picking).
 */
export function rangeHitsBlocked(start: CalendarDate, end: CalendarDate, blocked: readonly CalendarDate[]): boolean {
  if (blocked.length === 0) return false;
  const set = new Set(blocked.map(keyOf));
  for (let d = start; d.compare(end) < 0; d = d.add({ days: 1 })) {
    if (set.has(keyOf(d))) return true;
  }
  return false;
}

const count = (value: unknown, min: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.max(min, Math.trunc(value)) : min;

/**
 * The bar's first value on a stay page, from what another page stored and from the stay itself.
 *  - The destination is always the stay's own: a Medellin choice made on the home page never leaks onto a
 *    Cartagena stay.
 *  - Guests are kept (adults at least 1, children and infants at least 0).
 *  - Dates are kept only as a whole: arrival is not in the past, departure is after arrival, and no night of
 *    the range is blocked. Anything else drops both.
 */
export function initialStayValue(
  stored: JourneyChoice | null,
  stay: { destinationSlug: string; blocked: readonly CalendarDate[] },
  today: CalendarDate,
): JourneyValue {
  let start: CalendarDate | null = null;
  let end: CalendarDate | null = null;
  const from = stored ? parseIso(stored.from) : null;
  const to = stored ? parseIso(stored.to) : null;
  if (from && to && from.compare(today) >= 0 && to.compare(from) > 0 && !rangeHitsBlocked(from, to, stay.blocked)) {
    start = from;
    end = to;
  }
  return {
    destinationId: stay.destinationSlug,
    start,
    end,
    adults: count(stored?.adults, 1),
    children: count(stored?.children, 0),
    infants: count(stored?.infants, 0),
  };
}

const fill = (template: string, slots: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (whole, name: string) => (name in slots ? slots[name] : whole));

const fmt = (d: CalendarDate) => formatDate(d.day, d.month, d.year);

/**
 * The dock's two lines. Line 1 names the stay: "<destination>, <title>" (an Arabic comma in Arabic).
 * Line 2 is the dates then the guests: "12/10/2026 – 17/10/2026 · 2 adults". Dates are DD/MM/YYYY with
 * Western digits in every language; before dates are chosen it reads the journey copy's empty Dates value.
 */
export function dockLines(
  value: JourneyValue,
  names: { destinationName: string; title: string },
  copy: JourneyCopy,
  locale: Locale,
): { line1: string; line2: string } {
  const dates =
    value.start && value.end
      ? `${fmt(value.start)} – ${fmt(value.end)}`
      : value.start
        ? fill(copy.bar.dates.partial, { start: fmt(value.start) })
        : copy.bar.dates.empty;
  const guests = formatGuestSummary(value, locale, copy.guests.summary);
  const comma = locale === "ar" ? "، " : ", ";
  return { line1: `${names.destinationName}${comma}${names.title}`, line2: `${dates} · ${guests}` };
}
