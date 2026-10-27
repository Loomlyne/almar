"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { Field } from "../../ui/field";
import { formatPlural, fill, type PluralForms } from "../../../lib/journey-format";
import type { Locale } from "../../../lib/locale-path";

// The search box of /<locale>/blog (plan 06-03, SITE-10; pictures signed 2026-10-27): a client island around the
// server-rendered cards. Before the page is interactive (and without script) every card is shown and no box is drawn, so
// there is never a box that cannot work. A query filters the cards by their text in the page's language (title, excerpt
// and every heading, paragraph and quote), case and accents ignored (Arabic marks drop with the accents). A result line
// counts the matches; no match says so with Clear; Escape clears.

export type BlogSearchCopy = { searchLabel: string; searchClear: string; searchNoMatch: string; searchCount: PluralForms };
export type BlogSearchCard = { slug: string; text: string; card: ReactNode };

const fold = (text: string) => text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();

/** The cards whose text holds every word of the query (folded). An empty query keeps all. */
export function matchingCards<T extends { text: string }>(cards: readonly T[], query: string): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...cards];
  return cards.filter((card) => {
    const text = fold(card.text);
    return words.every((word) => text.includes(word));
  });
}

const CLEAR =
  "m-0 inline-flex min-h-control cursor-pointer items-center border-0 bg-transparent p-0 font-body text-label text-teal underline decoration-transparent decoration-1 underline-offset-4 hover:decoration-gold focus-visible:decoration-gold";

export function BlogSearchList({ locale, cards, copy, listClassName }: { locale: Locale; cards: BlogSearchCard[]; copy: BlogSearchCopy; listClassName: string }) {
  const id = useId();
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  useEffect(() => setReady(true), []);

  const list = (items: readonly BlogSearchCard[]) => (
    <ul className={listClassName}>
      {items.map((card) => (
        <li key={card.slug} className="min-w-0">
          {card.card}
        </li>
      ))}
    </ul>
  );
  // Before the page is interactive: the list exactly as the server drew it, no box (same HTML as before this plan).
  if (!ready) return list(cards);

  const shown = matchingCards(cards, query);
  const searching = query.trim() !== "";
  const clear = () => {
    setQuery("");
    document.getElementById(id)?.focus();
  };

  return (
    <div className="grid gap-6">
      <div className="grid max-w-md gap-2">
        <Field
          id={id}
          label={copy.searchLabel}
          type="search"
          autoComplete="off"
          value={query}
          onChange={(event: { target: { value: string } }) => setQuery(event.target.value)}
          onKeyDown={(event: { key: string; preventDefault: () => void }) => {
            if (event.key === "Escape" && query !== "") {
              event.preventDefault();
              clear();
            }
          }}
        />
        <p role="status" className="m-0 text-label text-muted">
          {searching && shown.length > 0 ? formatPlural(copy.searchCount, shown.length, locale) : ""}
        </p>
      </div>
      {searching && shown.length === 0 ? (
        <div className="flex flex-wrap items-center gap-4">
          <p className="m-0 text-body text-ink">{fill(copy.searchNoMatch, { q: query.trim() })}</p>
          <button type="button" className={CLEAR} onClick={clear}>
            {copy.searchClear}
          </button>
        </div>
      ) : (
        list(shown)
      )}
    </div>
  );
}
