// The /experiences page's filter state, as pure functions (phase 3.3 plan 14).
//
// No React and no client directive: node tests load this file directly. It holds no filter RULE: the rule lives once, in
// lib/data/catalog-filter.ts, which the server read (getCatalogItems) and the browser both apply. This file only maps the
// page's controls (a search box, a type, destination and private-stay checkboxes) to a CatalogFilter, and the address's
// ?type / ?destination / ?stay / ?item to the controls and back.

import type { CatalogKind } from "../../../lib/data/types";
import { toCatalogQuery, type CatalogFilter, type CatalogQuery } from "../../../lib/data/catalog-filter";

/** What the controls hold. "all" is every type; empty lists are no constraint. */
export type CatalogState = {
  query: string;
  kind: "all" | CatalogKind;
  destinations: string[];
  stays: string[];
};

export const EMPTY_STATE: CatalogState = { query: "", kind: "all", destinations: [], stays: [] };

/** A stay as the page offers it: its slug and the destination it stands in. */
export type StayRef = { slug: string; destination_slug: string };

/** Every empty control is left out, so EMPTY_STATE is the filter {}. The query is trimmed. */
export function toCatalogFilter(state: CatalogState): CatalogFilter {
  const filter: CatalogFilter = {};
  const query = state.query.trim();
  if (query) filter.query = query;
  if (state.kind !== "all") filter.kind = state.kind;
  if (state.destinations.length > 0) filter.destinations = [...state.destinations];
  if (state.stays.length > 0) filter.stays = [...state.stays];
  return filter;
}

/** True while any control narrows the list. A blank search box does not. */
export function isFiltered(state: CatalogState): boolean {
  return (
    state.query.trim() !== "" ||
    state.kind !== "all" ||
    state.destinations.length > 0 ||
    state.stays.length > 0
  );
}

/** The Filters button's badge: what the sheet holds. Type and search sit outside the sheet. */
export function sheetFilterCount(state: CatalogState): number {
  return state.destinations.length + state.stays.length;
}

/** The stays on offer: all of them with no destination checked, else those standing in a checked destination. */
export function stayOptions<T extends StayRef>(stays: readonly T[], destinations: readonly string[]): T[] {
  if (destinations.length === 0) return [...stays];
  return stays.filter((stay) => destinations.includes(stay.destination_slug));
}

/** `values` plus or minus `slug`, kept in the order of `order` when one is given (unknown values go last, in their order). */
function toggled(values: readonly string[], slug: string, order?: readonly string[]): string[] {
  const next = values.includes(slug) ? values.filter((v) => v !== slug) : [...values, slug];
  if (!order) return next;
  const rank = (v: string) => {
    const i = order.indexOf(v);
    return i === -1 ? order.length : i;
  };
  return next.map((v, i) => ({ v, i })).sort((a, b) => rank(a.v) - rank(b.v) || a.i - b.i).map(({ v }) => v);
}

/**
 * Sets the checked destinations and drops every checked stay that no longer stands in one of them (design 3.2).
 * With no destination left the stays are kept: the stay list is then every stay again.
 */
export function setDestinations(state: CatalogState, next: readonly string[], stays: readonly StayRef[]): CatalogState {
  const destinations = [...next];
  if (destinations.length === 0) return { ...state, destinations, stays: [...state.stays] };
  const kept = state.stays.filter((slug) => {
    const stay = stays.find((s) => s.slug === slug);
    return !!stay && destinations.includes(stay.destination_slug);
  });
  return { ...state, destinations, stays: kept };
}

export function setStays(state: CatalogState, next: readonly string[]): CatalogState {
  return { ...state, stays: [...next] };
}

export function toggleDestination(
  state: CatalogState,
  slug: string,
  stays: readonly StayRef[],
  order?: readonly string[],
): CatalogState {
  return setDestinations(state, toggled(state.destinations, slug, order), stays);
}

export function toggleStay(state: CatalogState, slug: string, order?: readonly string[]): CatalogState {
  return setStays(state, toggled(state.stays, slug, order));
}

/**
 * Turns parseCatalogQuery's result into the controls. A destination is kept only if the page offers it, a stay only if the
 * page offers it and it stands in a kept destination (when any is kept), an item only if it is a known slug. The search
 * text is never in the address, so it stays "".
 */
export function stateFromQuery(
  parsed: CatalogQuery,
  ctx: { destinations: readonly string[]; stays: readonly StayRef[]; items: readonly string[] },
): { state: CatalogState; item: string | null } {
  const destinations = [...new Set(parsed.destinations)].filter((slug) => ctx.destinations.includes(slug));
  const stays = [...new Set(parsed.stays)].filter((slug) => {
    const stay = ctx.stays.find((s) => s.slug === slug);
    if (!stay) return false;
    return destinations.length === 0 || destinations.includes(stay.destination_slug);
  });
  const kind = parsed.kind === "experience" || parsed.kind === "service" ? parsed.kind : "all";
  const item = parsed.item && ctx.items.includes(parsed.item) ? parsed.item : null;
  return { state: { query: "", kind, destinations, stays }, item };
}

/** "" or "?type=…&destination=…&stay=…&item=…": what the page writes back with history.replaceState. */
export function urlQuery(state: CatalogState, item: string | null): string {
  return toCatalogQuery({
    kind: state.kind === "all" ? undefined : state.kind,
    destinations: state.destinations,
    stays: state.stays,
    item: item ?? undefined,
  });
}

export type ActiveChip = {
  /** Unique across chips: "type:service", "destination:cartagena", "stay:<slug>". */
  key: string;
  group: "type" | "destination" | "stay";
  value: string;
  label: string;
};

/** One chip per active type, destination and stay, in that order. The search text is not a chip. */
export function activeChips(
  state: CatalogState,
  names: {
    kinds: Record<CatalogKind, string>;
    destinations: Record<string, string>;
    stays: Record<string, string>;
  },
): ActiveChip[] {
  const chips: ActiveChip[] = [];
  if (state.kind !== "all") {
    chips.push({ key: `type:${state.kind}`, group: "type", value: state.kind, label: names.kinds[state.kind] });
  }
  for (const slug of state.destinations) {
    chips.push({ key: `destination:${slug}`, group: "destination", value: slug, label: names.destinations[slug] ?? slug });
  }
  for (const slug of state.stays) {
    chips.push({ key: `stay:${slug}`, group: "stay", value: slug, label: names.stays[slug] ?? slug });
  }
  return chips;
}

/** The state without exactly that chip's filter. Removing the type goes back to "all". */
export function removeChip(state: CatalogState, chip: Pick<ActiveChip, "group" | "value">): CatalogState {
  if (chip.group === "type") return { ...state, kind: "all" };
  if (chip.group === "destination") return { ...state, destinations: state.destinations.filter((v) => v !== chip.value) };
  return { ...state, stays: state.stays.filter((v) => v !== chip.value) };
}

/** The results in the page's two groups, each in input order. */
export function splitGroups<T extends { kind: CatalogKind }>(results: readonly T[]): { experiences: T[]; services: T[] } {
  return {
    experiences: results.filter((item) => item.kind === "experience"),
    services: results.filter((item) => item.kind === "service"),
  };
}
