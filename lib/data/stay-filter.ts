// lib/data/stay-filter.ts
//
// The one implementation of StayFilter (design 4.2). Pure: no fs, no imports but types. Used by getStays on
// the server and by the client filters of the home and list pages, so server and client can never disagree.
// This and ./types are the only lib/data modules a "use client" file may import.

import type { IsoDate, Stay, StayFilter } from "./types";

/** The part of a stay the filter reads; a list card or a full Stay both satisfy it. */
export type StayFilterable = Pick<
  Stay,
  "destination_slug" | "destination_name" | "title" | "neighborhood" | "max_guests" | "bedrooms"
> & {
  /** Booked or blocked days (D-63). A card or object that does not carry them is treated as free. */
  blocked_dates?: readonly IsoDate[];
};

/**
 * True when no blocked date d satisfies from <= d < to: the nights from arrival to the night before
 * departure are all free. The departure day itself may be blocked. ISO dates compare as strings.
 */
export function isFreeBetween(blocked: readonly IsoDate[], from: IsoDate, to: IsoDate): boolean {
  return !blocked.some((d) => d >= from && d < to);
}

/** Lower-cases and strips combining marks: "Getsemaní" -> "getsemani", "MEDELLÍN" -> "medellin". */
export function foldText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesStayFilter(stay: StayFilterable, filter: StayFilter = {}): boolean {
  if (filter.destination && stay.destination_slug !== filter.destination) return false;
  if (filter.guests !== undefined && filter.guests > 0) {
    // A stay with no known capacity cannot be shown to hold the party, so it is kept only when guests is unset.
    if (stay.max_guests === null || stay.max_guests < filter.guests) return false;
  }
  if (filter.bedroomsMin !== undefined || filter.bedroomsMax !== undefined) {
    if (stay.bedrooms === null) return false;
    if (filter.bedroomsMin !== undefined && stay.bedrooms < filter.bedroomsMin) return false;
    if (filter.bedroomsMax !== undefined && stay.bedrooms > filter.bedroomsMax) return false;
  }
  if (filter.from && filter.to && filter.from < filter.to) {
    if (!isFreeBetween(stay.blocked_dates ?? [], filter.from, filter.to)) return false;
  }
  const q = filter.query ? foldText(filter.query.trim()) : "";
  if (q) {
    const hay = [stay.title, stay.neighborhood ?? "", stay.destination_name].map(foldText);
    if (!hay.some((h) => h.includes(q))) return false;
  }
  return true;
}

export function filterStays<T extends StayFilterable>(stays: readonly T[], filter: StayFilter = {}): T[] {
  return stays.filter((s) => matchesStayFilter(s, filter));
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(v: string | null | undefined): IsoDate | undefined {
  if (!v || !ISO_DATE.test(v)) return undefined;
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v ? undefined : v;
}

/**
 * The hero bar's handoff URL query: "destination=cartagena&from=2026-10-12&to=2026-10-17&guests=2".
 * Empty values are omitted.
 */
export function toStayQuery(v: {
  destination?: string | null;
  from?: IsoDate | null;
  to?: IsoDate | null;
  guests?: number | null;
}): string {
  const p = new URLSearchParams();
  if (v.destination) p.set("destination", v.destination);
  if (v.from) p.set("from", v.from);
  if (v.to) p.set("to", v.to);
  if (v.guests !== undefined && v.guests !== null && v.guests > 0) p.set("guests", String(v.guests));
  return p.toString();
}

/**
 * Reads the handoff query back. Ignores a destination that is not a slug (or, when `destinations` is given,
 * is not one of them), a guests value that is not a positive whole number, and a malformed or impossible date.
 */
export function parseStayQuery(
  params: URLSearchParams,
  opts: { destinations?: readonly string[] } = {},
): StayFilter {
  const out: StayFilter = {};
  const destination = params.get("destination");
  if (destination && SLUG.test(destination) && (!opts.destinations || opts.destinations.includes(destination))) {
    out.destination = destination;
  }
  const guests = params.get("guests");
  if (guests && /^\d{1,3}$/.test(guests) && Number(guests) > 0) out.guests = Number(guests);
  const from = validDate(params.get("from"));
  const to = validDate(params.get("to"));
  // A date range is a pair: one date alone, or an arrival that is not before the departure, is ignored.
  if (from && to && from < to) {
    out.from = from;
    out.to = to;
  }
  return out;
}
