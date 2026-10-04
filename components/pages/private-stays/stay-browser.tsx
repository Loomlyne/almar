"use client";

import { useEffect, useMemo, useState } from "react";
import type { JourneyCopy } from "../../../lib/copy/journey";
import type { StaysListCopy } from "../../../lib/copy/stays-list";
import { formatPlural } from "../../../lib/journey-format";
import { filterStays, parseStayQuery } from "../../../lib/data/stay-filter";
import type { Stay } from "../../../lib/data/types";
import { Button } from "../../ui/button";
import { MediaCard } from "../../ui/card";
import { ResultCount } from "../../ui/result-count";
import {
  EMPTY_STATE,
  isFiltered,
  listQuery,
  stateFromQuery,
  toStayFilter,
  type ListState,
} from "./filter-state";
import { SEARCH_ID, StayFilters } from "./stay-filters";

/** What the list needs of a stay. Plain and small: the server page sends this, not the whole Stay record. */
export type ListStay = Pick<
  Stay,
  | "slug"
  | "title"
  | "neighborhood"
  | "guests_label"
  | "price_label"
  | "max_guests"
  | "bedrooms"
  | "destination_slug"
  | "destination_name"
  | "blocked_dates"
> & {
  /** The hero picture, already resolved for this language. Null: the card shows no picture at all. */
  image: { src: string; alt: string } | null;
};

const DETAIL_JOINER = " · ";
const GRID = "m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 @6xl:grid-cols-3 @6xl:gap-8";

/** One detail line under the title: the published neighbourhood, guests and price words, never an amount. */
function detailOf(stay: ListStay): string {
  return [stay.neighborhood, stay.guests_label, stay.price_label].filter(Boolean).join(DETAIL_JOINER);
}

/**
 * The list's state owner: filter state, the hero bar's handoff, the one filterStays call, the URL, the grid, the
 * count and the empty state. The first render is always the unfiltered list, so the static HTML is the 12 linked
 * cards and hydration matches; the URL is read once after mount.
 */
export function StayBrowser({
  locale,
  stays,
  destinations,
  hrefs,
  basePath,
  copy,
  journeyCopy,
  datesNote,
}: {
  locale: "en" | "ar" | "es";
  stays: readonly ListStay[];
  destinations: readonly { slug: string; name: string }[];
  /** slug -> the stay page address in this language, built on the server. */
  hrefs: Record<string, string>;
  /** This page's own address in this language: where the URL is rewritten to. */
  basePath: string;
  copy: StaysListCopy;
  /** The journey bar's copy: the calendar's strings, the Dates label and the "Add dates" text. */
  journeyCopy: JourneyCopy;
  /** "Blocked dates here are examples." while the blocked dates are sample data; null otherwise. */
  datesNote: string | null;
}) {
  const [state, setState] = useState<ListState>(EMPTY_STATE);

  const maxGuests = useMemo(() => Math.max(0, ...stays.map((s) => s.max_guests ?? 0)), [stays]);
  const results = useMemo(() => filterStays(stays, toStayFilter(state)), [stays, state]);

  // The hero bar's handoff (design 4.2). After mount, never during render, and read from window.location
  // rather than a router hook (which would force a client bailout), so the page stays static and the served
  // HTML is the unfiltered list.
  useEffect(() => {
    const parsed = parseStayQuery(new URLSearchParams(window.location.search));
    const next = stateFromQuery(
      parsed,
      destinations.map((d) => d.slug),
      maxGuests,
    );
    if (isFiltered(next.state)) setState(next.state);
    // Read once, when the page opens.
  }, []);

  function writeUrl(nextState: ListState) {
    const query = listQuery(nextState);
    window.history.replaceState(null, "", query ? `${basePath}?${query}` : basePath);
  }

  function change(patch: Partial<ListState>) {
    const next = { ...state, ...patch };
    setState(next);
    // Destination, guests and dates have a key in the handoff URL; search and bedrooms stay in the page.
    if ("destination" in patch || "guests" in patch || "from" in patch || "to" in patch) writeUrl(next);
  }

  function clear() {
    setState(EMPTY_STATE);
    window.history.replaceState(null, "", basePath);
    // The button that was pressed goes away with the filters: keep the keyboard where it can continue.
    document.getElementById(SEARCH_ID)?.focus();
  }

  const filtered = isFiltered(state);

  return (
    <div className="grid gap-6">
      <div data-stay-filters="" className="grid gap-6">
        <StayFilters
          copy={copy}
          state={state}
          onChange={change}
          destinations={destinations}
          maxGuests={maxGuests}
          locale={locale}
          datesLabels={{
            label: journeyCopy.bar.dates.label,
            empty: journeyCopy.bar.dates.empty,
            clear: journeyCopy.dates.clear,
          }}
          journeyCopy={journeyCopy}
          datesNote={datesNote}
        />
      </div>
      <ResultCount
        text={formatPlural(copy.count, results.length, locale)}
        clearLabel={copy.clear}
        onClear={filtered && results.length > 0 ? clear : undefined}
      />
      {results.length > 0 ? (
        <ul role="list" className={GRID}>
          {results.map((stay) => (
            <li key={stay.slug} className="min-w-0">
              {stay.image ? (
                <MediaCard
                  href={hrefs[stay.slug]}
                  image={stay.image}
                  title={stay.title}
                  detail={detailOf(stay)}
                />
              ) : (
                <a
                  href={hrefs[stay.slug]}
                  className="group grid min-w-0 content-start gap-1 border-t border-line pt-3 text-ink no-underline"
                >
                  <span className="font-display text-title text-teal decoration-gold decoration-1 underline-offset-4 group-hover:underline">
                    {stay.title}
                  </span>
                  <span className="text-label text-muted">{detailOf(stay)}</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="grid justify-items-start gap-3 border-t border-line pt-6">
          <p className="m-0 text-body text-ink">{copy.empty}</p>
          <Button variant="ghost" onClick={clear}>
            {copy.clear}
          </Button>
        </div>
      )}
    </div>
  );
}
