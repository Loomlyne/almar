"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { ExperiencesPageCopy } from "../../../lib/copy/experiences-page";
import { filterCatalog, parseCatalogQuery } from "../../../lib/data/catalog-filter";
import type { CatalogItem } from "../../../lib/data/types";
import { fill, formatPlural } from "../../../lib/journey-format";
import { Button } from "../../ui/button";
import { MediaCard } from "../../ui/card";
import { Chip } from "../../ui/chip";
import { ResultCount } from "../../ui/result-count";
import { CatalogFilters, SEARCH_ID, SEARCH_ID_COMPACT } from "./catalog-filters";
import {
  EMPTY_STATE,
  activeChips,
  isFiltered,
  removeChip,
  setDestinations,
  setStays,
  splitGroups,
  stateFromQuery,
  stayOptions,
  toCatalogFilter,
  urlQuery,
  type CatalogState,
} from "./filter-state";
import { ItemOverlay } from "./item-overlay";

/** What the page needs of a catalogue item. Plain and small: the server page sends this, not the whole record. */
export type BrowserItem = Pick<
  CatalogItem,
  "slug" | "kind" | "name" | "summary" | "duration_label" | "destination_slugs" | "stay_slugs"
> & {
  /** The picture, already resolved for this language. */
  image: { src: string; alt: string };
};

const GRID = "m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 xl:grid-cols-3 xl:gap-8";

/** The search field that is showing now (the rail's or the toolbar's): the other one is display:none. */
function visibleSearch(): HTMLElement | null {
  for (const id of [SEARCH_ID, SEARCH_ID_COMPACT]) {
    const el = document.getElementById(id);
    if (el && el.offsetParent !== null) return el;
  }
  return null;
}

/**
 * The catalogue's state owner: filter state, the open item, the one filterCatalog call, the address, the results head,
 * the two groups, the empty state and the overlay. The first render is always the unfiltered list, so the static HTML is
 * the 45 cards and hydration matches; the address is read once after mount (a router hook would force a client bailout).
 */
export function CatalogBrowser({
  locale,
  items,
  destinations,
  stays,
  stayHrefs,
  inquiryHref,
  basePath,
  copy,
}: {
  locale: "en" | "ar" | "es";
  items: readonly BrowserItem[];
  /** The places that hold at least one item, in the owner's order. */
  destinations: readonly { slug: string; name: string }[];
  /** The stays that offer at least one item, in position order. */
  stays: readonly { slug: string; title: string; destination_slug: string }[];
  /** slug -> the stay page address in this language, built on the server. */
  stayHrefs: Record<string, string>;
  /** Where Request Inquiry goes, built on the server. */
  inquiryHref: string;
  /** This page's own address in this language: where the address is rewritten to. */
  basePath: string;
  copy: ExperiencesPageCopy;
}) {
  const [state, setState] = useState<CatalogState>(EMPTY_STATE);
  const [item, setItem] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const headingId = useId();

  const results = useMemo(() => filterCatalog(items, toCatalogFilter(state)), [items, state]);
  const groups = useMemo(() => splitGroups(results), [results]);
  const stayChoices = useMemo(() => stayOptions(stays, state.destinations), [stays, state.destinations]);
  const names = useMemo(
    () => ({
      kinds: { experience: copy.type.experiences, service: copy.type.services },
      destinations: Object.fromEntries(destinations.map((d) => [d.slug, d.name])),
      stays: Object.fromEntries(stays.map((s) => [s.slug, s.title])),
    }),
    [copy, destinations, stays],
  );

  // The card buttons by slug, and where focus goes when the overlay closes (a card, or the search field when that card is
  // hidden by the filters the address asked for).
  const openers = useRef(new Map<string, HTMLButtonElement>());
  const lastOpenerRef = useRef<HTMLElement | null>(null);

  // The address, read once when the page opens: after mount, from window.location, so the page stays static and the
  // served HTML is the unfiltered list. Bad values were dropped by parseCatalogQuery and stateFromQuery.
  useEffect(() => {
    const parsed = parseCatalogQuery(new URLSearchParams(window.location.search));
    const next = stateFromQuery(parsed, {
      destinations: destinations.map((d) => d.slug),
      stays,
      items: items.map((i) => i.slug),
    });
    if (isFiltered(next.state)) setState(next.state);
    if (next.item) setItem(next.item);
    setReady(true);
    // Read once, when the page opens.
  }, []);

  // Opening: remember what had focus's home. After the render that shows the overlay, so the cards the address's filters
  // left are registered. A card hidden by those filters hands focus back to the search field.
  useEffect(() => {
    if (item === null) return;
    lastOpenerRef.current = openers.current.get(item) ?? visibleSearch();
  }, [item]);

  function writeUrl(nextState: CatalogState, nextItem: string | null) {
    window.history.replaceState(null, "", basePath + urlQuery(nextState, nextItem));
  }

  function change(next: CatalogState, urlToo = true) {
    setState(next);
    if (urlToo) writeUrl(next, item);
  }

  function open(slug: string) {
    lastOpenerRef.current = openers.current.get(slug) ?? visibleSearch();
    setItem(slug);
    writeUrl(state, slug);
  }

  function onOverlayChange(isOpen: boolean) {
    if (isOpen) return;
    setItem(null);
    writeUrl(state, null);
  }

  function clear() {
    setState(EMPTY_STATE);
    writeUrl(EMPTY_STATE, item);
    // The button that was pressed goes away with the filters: keep the keyboard where it can continue.
    visibleSearch()?.focus();
  }

  function removeOne(chip: ReturnType<typeof activeChips>[number]) {
    if (chip.group === "destination") {
      change(setDestinations(state, state.destinations.filter((slug) => slug !== chip.value), stays));
    } else {
      change(removeChip(state, chip));
    }
  }

  const filtered = isFiltered(state);
  const chips = activeChips(state, names);
  const openItem = item ? (items.find((i) => i.slug === item) ?? null) : null;

  const group = (kind: "experiences" | "services", list: readonly BrowserItem[]) => {
    if (list.length === 0) return null;
    const id = `${headingId}-${kind}`;
    return (
      <section key={kind} aria-labelledby={id} className="grid gap-6">
        <h2 id={id} className="m-0 flex items-baseline gap-3 font-display text-title font-normal text-teal md:text-heading">
          {copy.groups[kind]}
          <bdi className="font-body text-label text-muted">{formatPlural({ other: "#" }, list.length, locale)}</bdi>
        </h2>
        <ul role="list" className={GRID}>
          {list.map((entry) => (
            <li key={entry.slug} className="min-w-0">
              <MediaCard
                image={entry.image}
                title={entry.name}
                detail={
                  entry.summary ? (
                    <span data-clamp="" className="line-clamp-2">
                      {entry.summary}
                    </span>
                  ) : undefined
                }
                onOpen={() => open(entry.slug)}
                openRef={(el) => {
                  if (el) openers.current.set(entry.slug, el);
                  else openers.current.delete(entry.slug);
                }}
              />
            </li>
          ))}
        </ul>
      </section>
    );
  };

  return (
    <div data-catalog-ready={ready ? "true" : undefined} className="grid gap-8 lg:flex lg:items-start lg:gap-12">
      <CatalogFilters
        copy={copy}
        locale={locale}
        state={state}
        count={results.length}
        filtered={filtered}
        destinations={destinations}
        stays={stayChoices}
        onQuery={(query) => change({ ...state, query }, false)}
        onKind={(kind) => change({ ...state, kind })}
        onDestinations={(next) => change(setDestinations(state, next, stays))}
        onStays={(next) => change(setStays(state, next))}
        onClear={clear}
      />
      <div className="grid min-w-0 flex-1 gap-8">
        <div className="grid gap-4">
          <ResultCount text={formatPlural(copy.count, results.length, locale)} />
          {chips.length > 0 || (filtered && results.length > 0) ? (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <Chip key={chip.key} onRemove={() => removeOne(chip)} removeLabel={fill(copy.removeFilter, { name: chip.label })}>
                  {chip.label}
                </Chip>
              ))}
              {filtered && results.length > 0 ? (
                <span className="lg:hidden">
                  <Button variant="ghost" onClick={clear}>
                    {copy.clear}
                  </Button>
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        {results.length > 0 ? (
          <>
            {group("experiences", groups.experiences)}
            {group("services", groups.services)}
          </>
        ) : (
          <div className="grid justify-items-start gap-3 border-t border-line pt-6">
            <p className="m-0 text-body text-ink">{copy.empty}</p>
            <Button variant="ghost" onClick={clear}>
              {copy.clear}
            </Button>
          </div>
        )}
      </div>
      <ItemOverlay
        item={openItem}
        open={openItem !== null}
        onOpenChange={onOverlayChange}
        copy={copy}
        destinationNames={names.destinations}
        stayNames={names.stays}
        stayHrefs={stayHrefs}
        inquiryHref={inquiryHref}
        returnFocusRef={lastOpenerRef}
      />
    </div>
  );
}
