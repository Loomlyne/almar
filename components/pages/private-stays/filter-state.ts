// The /private-stays list's filter state, as pure functions (phase 3.3 plan 05).
//
// No React and no "use client": node tests load this file directly. It holds no filter RULE: the rules live
// once, in lib/data/stay-filter.ts, which filterStays applies on the server (getStays) and in the browser.
// This file only maps the list's controls (a search box, a destination chip, a guests stepper, a bedroom
// chip) to a StayFilter, and the hero bar's handoff URL to the controls.

import type { IsoDate, StayFilter } from "../../../lib/data/types";
import { toStayQuery } from "../../../lib/data/stay-filter";

export type BedroomChoice = "any" | "1-4" | "5-8" | "9+";

/** What the four controls hold. "" is "All destinations", 0 is "Any number of guests". */
export type ListState = {
  query: string;
  destination: string;
  guests: number;
  bedrooms: BedroomChoice;
};

/** The hero bar's dates, carried through the page untouched so the URL keeps them while a filter changes. */
export type Carry = { from?: IsoDate; to?: IsoDate };

export const EMPTY_STATE: ListState = { query: "", destination: "", guests: 0, bedrooms: "any" };

/** The bedroom chips. The top bucket is open: 9 and more. */
export const BEDROOM_BUCKETS: Record<Exclude<BedroomChoice, "any">, Pick<StayFilter, "bedroomsMin" | "bedroomsMax">> = {
  "1-4": { bedroomsMin: 1, bedroomsMax: 4 },
  "5-8": { bedroomsMin: 5, bedroomsMax: 8 },
  "9+": { bedroomsMin: 9 },
};

/** Every empty control is left out, so an unfiltered list is the filter {}. */
export function toStayFilter(state: ListState): StayFilter {
  const filter: StayFilter = {};
  const query = state.query.trim();
  if (query) filter.query = query;
  if (state.destination) filter.destination = state.destination;
  if (state.guests > 0) filter.guests = state.guests;
  if (state.bedrooms !== "any") Object.assign(filter, BEDROOM_BUCKETS[state.bedrooms]);
  return filter;
}

/** True while any control narrows the list. A blank search box does not. */
export function isFiltered(state: ListState): boolean {
  return (
    state.query.trim() !== "" || state.destination !== "" || state.guests > 0 || state.bedrooms !== "any"
  );
}

function bucketOf(filter: StayFilter): BedroomChoice {
  for (const [bucket, range] of Object.entries(BEDROOM_BUCKETS)) {
    if (filter.bedroomsMin === range.bedroomsMin && filter.bedroomsMax === range.bedroomsMax) {
      return bucket as BedroomChoice;
    }
  }
  return "any";
}

/**
 * Turns parseStayQuery's result (already stripped of bad input) into the list's controls. A destination is kept
 * only if it is a chip the page renders; guests are clamped to the largest capacity on offer; a bedroom range
 * counts only when it is exactly one of the three buckets.
 */
export function stateFromQuery(
  parsed: StayFilter & { from?: IsoDate; to?: IsoDate },
  destinationSlugs: readonly string[],
  maxGuests: number,
): { state: ListState; carry: Carry } {
  const state: ListState = { ...EMPTY_STATE };
  if (parsed.destination && destinationSlugs.includes(parsed.destination)) state.destination = parsed.destination;
  if (parsed.guests !== undefined && Number.isFinite(parsed.guests) && parsed.guests > 0) {
    state.guests = Math.min(Math.floor(parsed.guests), Math.max(0, maxGuests));
  }
  state.bedrooms = bucketOf(parsed);
  if (parsed.query) state.query = parsed.query;
  const carry: Carry = {};
  if (parsed.from) carry.from = parsed.from;
  if (parsed.to) carry.to = parsed.to;
  return { state, carry };
}

/**
 * The query string the page writes back with history.replaceState: destination, the carried dates and guests.
 * Search and bedrooms have no key in the handoff URL, so they stay in the page.
 */
export function listQuery(state: ListState, carry: Carry): string {
  return toStayQuery({
    destination: state.destination || undefined,
    guests: state.guests || undefined,
    from: carry.from,
    to: carry.to,
  });
}
