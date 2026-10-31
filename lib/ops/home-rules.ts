// Plan 05-04 (P5-08, P5-09): the pure rules behind Home and Customers. Dubai-day ranges, the query of GET /api/ops/home,
// a money text that can read below zero, which Home numbers link to Bookings, and the text a customer row hands to Bookings.
// Imports only lib/money and types, so node tests load it as it is.
import { addDays, dubaiToday, isIsoDate } from "../money/dates";
import { formatAed } from "../money/format";
import type { HomeNumbers } from "./home-contract";

export type HomeQueryField = "range" | "from" | "to";

/** "This month" is the 1st of the Dubai month to the Dubai today; "Last 30 days" is 30 days counting both ends. */
export function homeRange(range: "month" | "30d", now: Date): { from: string; to: string } {
  const today = dubaiToday(now);
  if (range === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  return { from: addDays(today, -29), to: today };
}

/**
 * The query of GET /api/ops/home: `range=month|30d`, or `from` and `to` together (Custom). Nothing else.
 * No span check here: ops_home_numbers owns the 3660-day cap.
 */
export function parseHomeQuery(
  params: URLSearchParams,
  now: Date,
): { ok: true; from: string; to: string } | { ok: false; field: HomeQueryField } {
  const range = params.get("range");
  const from = params.get("from");
  const to = params.get("to");
  const hasRange = range !== null && range !== "";
  const hasFrom = from !== null && from !== "";
  const hasTo = to !== null && to !== "";
  if (hasRange) {
    if (hasFrom || hasTo) return { ok: false, field: "range" };
    if (range !== "month" && range !== "30d") return { ok: false, field: "range" };
    return { ok: true, ...homeRange(range, now) };
  }
  if (!hasFrom && !hasTo) return { ok: false, field: "range" };
  if (!hasFrom) return { ok: false, field: "from" };
  if (!hasTo) return { ok: false, field: "to" };
  if (!isIsoDate(from)) return { ok: false, field: "from" };
  if (!isIsoDate(to)) return { ok: false, field: "to" };
  if (from > to) return { ok: false, field: "to" };
  return { ok: true, from, to };
}

/** "-AED 50.00": formatAed throws on a negative, and Recorded money can be below zero (refunds above receipts). */
export function signedAed(fils: number): string {
  return fils < 0 ? `-${formatAed(-fils)}` : formatAed(fils);
}

/** Which Home numbers are "filled" and so link to Bookings (P5-08). Zero is plain text. */
export function numberLinks(numbers: HomeNumbers): { bookings: boolean; recorded: boolean; outstanding: boolean } {
  return {
    bookings: numbers.bookings > 0,
    recorded: numbers.received_fils > 0 || numbers.refunded_fils > 0,
    outstanding: numbers.outstanding_count > 0,
  };
}

const SEARCH_MAX = 100;

/** The text a customer row hands to Bookings: the email, or its first 100 characters (counted by code point). */
export function customerSearchText(email: string): string {
  const chars = Array.from(email);
  return chars.length <= SEARCH_MAX ? email : chars.slice(0, SEARCH_MAX).join("");
}
