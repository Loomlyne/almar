// Plan 04-03, Task 3: the /booking/trip address. Pure: no React, no window, no clock.
//
// The stay page's Book builds the link with tripHref; the trip page reads it back with parseTripQuery, which accepts
// only the exact six keys in their exact shape and returns null for anything else (never repaired, T-04-03-02). Every
// locale is prefixed (job 21, #33): /en/booking/trip, /ar/booking/trip, /es/booking/trip. No amount and no link token
// ever goes into a URL built here (cross-plan decision 8).
import { localePath, type Locale } from "../locale-path";
import { isIsoDate } from "../money/dates";
import { fill } from "../journey-format";
import { stayRequestHref } from "../whatsapp-request";
import { isBookingRef } from "./ref";
import { formatIsoDate } from "./trip-format";

/** The page's English path; localePath prefixes it. */
export const TRIP_PATH = "/booking/trip";

export type TripQuery = {
  stay: string;
  from: string;
  to: string;
  adults: number;
  children: number;
  infants: number;
};

/** The keys, in the order the link writes them. */
export const TRIP_QUERY_KEYS = ["stay", "from", "to", "adults", "children", "infants"] as const;

// The stay slug rule of lib/booking/validate.ts (SLUG, at most 80 characters).
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_SLUG = 80;
// A count: digits only, no sign, no decimal, no leading zero.
const COUNT = /^(?:0|[1-9][0-9]?)$/;

function search(q: TripQuery): string {
  const params = new URLSearchParams();
  params.set("stay", q.stay);
  params.set("from", q.from);
  params.set("to", q.to);
  params.set("adults", String(q.adults));
  params.set("children", String(q.children));
  params.set("infants", String(q.infants));
  return params.toString();
}

/** `/<locale>/booking/trip?stay=…&from=…&to=…&adults=…&children=…&infants=…`. */
export function tripHref(locale: Locale, q: TripQuery): string {
  return `${localePath(locale, TRIP_PATH)}?${search(q)}`;
}

/** The trip page in the three languages with the same query (the language control keeps the trip). */
export function tripLocaleHrefs(q: TripQuery): Record<Locale, string> {
  return { en: tripHref("en", q), ar: tripHref("ar", q), es: tripHref("es", q) };
}

function readCount(value: string, min: number, max: number): number | null {
  if (!COUNT.test(value)) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

/**
 * The trip query of a URL, or null: a missing, repeated or unknown key (the legacy `?where=&check-in=` query included),
 * a bad slug, a non-ISO or impossible date, `to` not after `from`, adults outside 1..99, children or infants outside
 * 0..99, or a count with a sign, a decimal or a leading zero.
 */
export function parseTripQuery(input: string | URLSearchParams): TripQuery | null {
  const params = typeof input === "string" ? new URLSearchParams(input.startsWith("?") ? input.slice(1) : input) : input;
  const seen = new Map<string, string>();
  for (const [key, value] of params) {
    if (!(TRIP_QUERY_KEYS as readonly string[]).includes(key)) return null;
    if (seen.has(key)) return null;
    seen.set(key, value);
  }
  if (seen.size !== TRIP_QUERY_KEYS.length) return null;

  const stay = seen.get("stay") ?? "";
  if (stay.length > MAX_SLUG || !SLUG.test(stay)) return null;
  const from = seen.get("from") ?? "";
  const to = seen.get("to") ?? "";
  if (!isIsoDate(from) || !isIsoDate(to) || to <= from) return null;
  const adults = readCount(seen.get("adults") ?? "", 1, 99);
  const children = readCount(seen.get("children") ?? "", 0, 99);
  const infants = readCount(seen.get("infants") ?? "", 0, 99);
  if (adults === null || children === null || infants === null) return null;
  return { stay, from, to, adults, children, infants };
}

export type SecondCityInput = {
  locale: Locale;
  title: string;
  destinationName: string;
  from: string;
  to: string;
  /** The hold's booking reference, once there is one. */
  ref?: string | null;
};

export type SecondCityCopy = { greeting: string; dates: string; ref: string; ask: string };

/**
 * BOOK-04: one destination per booking; a second city is a WhatsApp message. The lines: greeting, the dates as
 * DD/MM/YYYY, "My reference" only when a valid reference is given, and the ask. Never an amount, never a token.
 */
export function secondCityHref(input: SecondCityInput, copy: SecondCityCopy): string {
  const lines = [
    fill(copy.greeting, { title: input.title, destination: input.destinationName }),
    fill(copy.dates, { from: formatIsoDate(input.from), to: formatIsoDate(input.to) }),
  ];
  if (isBookingRef(input.ref)) lines.push(fill(copy.ref, { ref: input.ref }));
  lines.push(copy.ask);
  return stayRequestHref(lines.join("\n"));
}
