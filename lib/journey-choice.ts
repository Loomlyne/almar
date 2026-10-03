// The journey bar's Where / When / Who value, carried between public pages in sessionStorage.
//
// Pure: no imports, no `window` access, no React, so Node tests load it directly. The client
// provider (plan 04) owns the actual sessionStorage read and write and converts the ISO dates to
// CalendarDate; this file owns the key, the shape, and what a stored string may be.
//
// A stored value is untrusted (a tab can edit it): anything that is not exactly this shape is
// rejected as null, never repaired and never rendered.

/** The sessionStorage key. One value for the whole site: home and the stay pages read it. */
export const JOURNEY_CHOICE_KEY = "almar-journey-choice";

/** The value as stored. Dates are ISO `YYYY-MM-DD`; `guests_set` is true once Who was touched. */
export type JourneyChoice = {
  destination_id: string | null;
  from: string | null;
  to: string | null;
  adults: number;
  children: number;
  infants: number;
  guests_set: boolean;
};

/** What a stay-list query needs from a journey choice (the input of `toStayQuery`, plan 01). */
export type JourneyStayQuery = { destination?: string; from?: string; to?: string; guests?: number };

const KEYS = ["destination_id", "from", "to", "adults", "children", "infants", "guests_set"] as const;
const ID = /^[A-Za-z0-9_-]{1,80}$/;
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const MAX_GUESTS = 99;

/** True for a real calendar date written `YYYY-MM-DD`. */
export function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = ISO.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** `YYYY-MM-DD` from anything with year, month and day (a CalendarDate fits). */
export function isoOf(date: { year: number; month: number; day: number }): string {
  const p = (n: number, w: number) => String(n).padStart(w, "0");
  return `${p(date.year, 4)}-${p(date.month, 2)}-${p(date.day, 2)}`;
}

/** The stored shape from a journey bar value. `guestsSet` is whether the Who step was touched. */
export function choiceFromValue(
  value: {
    destinationId: string | null;
    start: { year: number; month: number; day: number } | null;
    end: { year: number; month: number; day: number } | null;
    adults: number;
    children: number;
    infants: number;
  },
  guestsSet: boolean,
): JourneyChoice {
  return {
    destination_id: value.destinationId,
    from: value.start ? isoOf(value.start) : null,
    to: value.end ? isoOf(value.end) : null,
    adults: value.adults,
    children: value.children,
    infants: value.infants,
    guests_set: guestsSet,
  };
}

export function serializeJourneyChoice(choice: JourneyChoice): string {
  return JSON.stringify({
    destination_id: choice.destination_id,
    from: choice.from,
    to: choice.to,
    adults: choice.adults,
    children: choice.children,
    infants: choice.infants,
    guests_set: choice.guests_set,
  });
}

const isCount = (v: unknown, min: number): v is number =>
  typeof v === "number" && Number.isInteger(v) && v >= min && v <= MAX_GUESTS;

/**
 * The stored string back to a choice, or null for anything else: malformed JSON, a value that is
 * not a plain object, a missing, extra or wrongly typed key, an impossible date, adults below 1, a
 * negative count, or arrival not before departure. With `todayIso`, an arrival in the past is
 * dropped too.
 */
export function parseJourneyChoice(text: string | null | undefined, todayIso?: string): JourneyChoice | null {
  if (typeof text !== "string") return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== KEYS.length || !KEYS.every((k) => k in o)) return null;

  const destination = o.destination_id;
  if (destination !== null && !(typeof destination === "string" && ID.test(destination))) return null;
  const { from, to } = o;
  if (from !== null && !isIsoDate(from)) return null;
  if (to !== null && !isIsoDate(to)) return null;
  if (typeof from === "string" && typeof to === "string" && from >= to) return null;
  if (typeof from === "string" && todayIso !== undefined && from < todayIso) return null;
  if (!isCount(o.adults, 1) || !isCount(o.children, 0) || !isCount(o.infants, 0)) return null;
  if (typeof o.guests_set !== "boolean") return null;

  return {
    destination_id: destination,
    from,
    to,
    adults: o.adults,
    children: o.children,
    infants: o.infants,
    guests_set: o.guests_set,
  };
}

/**
 * The stay-list filter a choice stands for. `destinationSlugById` maps the bar's destination id to
 * the slug the list uses; an id with no slug adds no destination. Guests are the whole party, and
 * only when the Who step was touched: an untouched default adds no guests filter.
 */
export function journeyChoiceToStayQuery(
  choice: JourneyChoice,
  destinationSlugById: Record<string, string>,
): JourneyStayQuery {
  const query: JourneyStayQuery = {};
  const id = choice.destination_id;
  // Own keys only: an id such as "constructor" must not resolve through the prototype.
  const slug = id !== null && Object.prototype.hasOwnProperty.call(destinationSlugById, id) ? destinationSlugById[id] : undefined;
  if (slug) query.destination = slug;
  if (choice.from) query.from = choice.from;
  if (choice.to) query.to = choice.to;
  if (choice.guests_set) query.guests = choice.adults + choice.children + choice.infants;
  return query;
}
