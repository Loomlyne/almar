// Plan 04-05 (Task 1): the two display formats 04-03's helpers do not give, for the booking emails and the booking
// page. Pure: no clock, no environment, no React. Western digits in every language. Single days and UAE times are
// 04-03's formatIsoDate and uaeDateTime (lib/booking/trip-format.ts, cross-plan decision 6), and every deadline
// sentence is fill(JOURNEY_COPY[locale].bookingStatus.payBy, uaeDateTime(iso)): nothing here formats a day or a time
// on its own.
import { formatIsoDate } from "./trip-format";
import { formatRange } from "../format";
import { formatGuestSummary, type GuestCounts } from "../journey-format";
import { JOURNEY_COPY } from "../copy/journey";

export type DisplayLocale = "en" | "ar" | "es";

function displayLocale(locale: string): DisplayLocale {
  return locale === "ar" || locale === "es" ? locale : "en";
}

/** The stay as a range of days: "10/12/2026 – 15/12/2026" (throws, as formatIsoDate does, on a day that is not ISO). */
export function stayDaysText(arrive: string, leave: string): string {
  return formatRange(formatIsoDate(arrive), formatIsoDate(leave));
}

/** The guests line of a stored booking in its language: "2 adults and 1 child" (non-zero groups only). */
export function guestsText(counts: GuestCounts, locale: string): string {
  const l = displayLocale(locale);
  return formatGuestSummary(counts, l, JOURNEY_COPY[l].guests.summary);
}
