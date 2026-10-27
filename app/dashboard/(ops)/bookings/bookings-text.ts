// Plan 04-09: small text helpers the bookings list, detail and dialogs share. Pure; no clock.
// Amounts, days and times inside a sentence are wrapped in left-to-right isolates so they keep their order in Arabic.
import { formatAed } from "../../../../lib/money/format";
import { uaeDate, uaeDateTimeText } from "../../../../lib/ops/booking-rules";

const LRI = "⁦";
const PDI = "⁩";

/** Text kept left to right inside a right-to-left sentence. */
export function ltr(text: string): string {
  return `${LRI}${text}${PDI}`;
}

/** "AED 1,050.00" as sentence text. */
export function aedIn(fils: number): string {
  return ltr(formatAed(fils));
}

/** A day "YYYY-MM-DD" as sentence text "DD/MM/YYYY". */
export function dayIn(day: string): string {
  return ltr(uaeDate(day));
}

/** An ISO time as sentence text "DD/MM/YYYY HH:MM" plus the UAE time suffix. */
export function timeIn(iso: string, suffix: string): string {
  return `${ltr(uaeDateTimeText(iso))}${suffix}`;
}
