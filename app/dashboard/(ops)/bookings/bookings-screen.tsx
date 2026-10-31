"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { DestinationSummary, ListReply } from "../../../../components/ops/api-types";
import { opsFetch } from "../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import { OPS_BOOKINGS_COPY } from "../../../../lib/copy/ops-bookings";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import { LIST_LIMIT, listSearch, parseListQuery, type OwnerItem } from "../../../../lib/ops/booking-rules";
import { putBookingsSearch, takeBookingsSearch } from "../../../../lib/ops/bookings-handoff";
import { bookingError } from "./bookings-errors";
import { BookingsList, type BookingsDestination, type BookingsQuery } from "./bookings-list";

// Plan 04-09 Task 7: the owner's Bookings list. This file owns the data: the controls (read once from the URL, kept in
// it with history.replaceState), a 300 ms wait on the search text, the latest-ticket rule so a slow older answer never
// replaces a newer one, Show more, and the destinations for the filter. BookingsList draws; nothing here draws a table.

const EMPTY: BookingsQuery = { q: "", status: "all", destination: null, from: null, to: null };
const QUIET_MS = 300;

function params(query: BookingsQuery, after: string | null): Record<string, string> {
  return Object.fromEntries(listSearch({ ...query, after, limit: LIST_LIMIT }));
}

export function BookingsScreen() {
  const locale = useDashboardLocale();
  const copy = OPS_BOOKINGS_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const router = useRouter();

  const [query, setQuery] = useState<BookingsQuery | null>(null);
  // What the list is fetched with: the controls, with the search text after its quiet time.
  const [applied, setApplied] = useState<BookingsQuery | null>(null);
  const [items, setItems] = useState<OwnerItem[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // The list endpoint carries every destination's English, Arabic and Spanish name.
  const [destinations, setDestinations] = useState<DestinationSummary[]>([]);
  const latest = useRef(0);
  // Plan 05-04: the text Customers handed over (a guest's email), read once; it stays out of the URL while it is the applied search.
  const handed = useRef<string | null | undefined>(undefined);
  // The sentences are read at answer time, so a language change after mount does not fetch the list again.
  const words = useRef({ copy, kit });
  words.current = { copy, kit };

  // The URL is read once. The handed text is taken once too, held in a ref: under strict mode this effect runs twice, and a second take would answer null.
  useEffect(() => {
    if (handed.current === undefined) handed.current = takeBookingsSearch();
    const parsed = parseListQuery(new URLSearchParams(window.location.search));
    const base = parsed.ok ? { q: parsed.query.q, status: parsed.query.status, destination: parsed.query.destination, from: parsed.query.from, to: parsed.query.to } : EMPTY;
    const start = handed.current !== null ? { ...base, q: handed.current } : base;
    setQuery(start);
    setApplied(start);
  }, []);

  // The search text waits 300 ms of quiet; every other control applies at once.
  useEffect(() => {
    if (query === null || applied === null || query === applied) return;
    const timer = window.setTimeout(() => setApplied(query), query.q === applied.q ? 0 : QUIET_MS);
    return () => window.clearTimeout(timer);
  }, [query, applied]);

  // Destinations for the filter, read once.
  useEffect(() => {
    let live = true;
    void opsFetch<ListReply<DestinationSummary>>("/api/ops/destinations").then((reply) => {
      if (live && reply.ok) setDestinations(reply.items);
    });
    return () => {
      live = false;
    };
  }, []);

  // The destination in the page's language; English only when that name is null.
  const shownDestinations: BookingsDestination[] = destinations.map((one) => ({
    id: one.id,
    name: (locale === "ar" ? one.name_ar : locale === "es" ? one.name_es : null) ?? one.name_en,
  }));

  // The first page for the applied controls; the URL follows.
  useEffect(() => {
    if (applied === null) return;
    const ticket = (latest.current += 1);
    // The handed text is left out of the address while it is the applied search; the fetch below keeps it.
    const shown = handed.current !== null && handed.current !== undefined && applied.q === handed.current ? { ...applied, q: "" } : applied;
    const search = listSearch({ ...shown, after: null, limit: LIST_LIMIT }).toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
    setLoading(true);
    void opsFetch<{ items: OwnerItem[]; next: string | null }>("/api/ops/bookings", params(applied, null)).then((reply) => {
      if (ticket !== latest.current) return;
      setLoading(false);
      if (!reply.ok) {
        // Never the last answer's rows under a failed one.
        setItems([]);
        setNext(null);
        setError(bookingError(words.current.copy, words.current.kit, reply.error, words.current.copy.errors.listFailed));
        return;
      }
      setError(null);
      setItems(reply.items);
      setNext(reply.next);
    });
  }, [applied]);

  function more() {
    if (applied === null || next === null || loading) return;
    const ticket = (latest.current += 1);
    setLoading(true);
    void opsFetch<{ items: OwnerItem[]; next: string | null }>("/api/ops/bookings", params(applied, next)).then((reply) => {
      if (ticket !== latest.current) return;
      setLoading(false);
      if (!reply.ok) {
        setError(bookingError(words.current.copy, words.current.kit, reply.error, words.current.copy.errors.listFailed));
        return;
      }
      setError(null);
      setItems((old) => [...old, ...reply.items]);
      setNext(reply.next);
    });
  }

  return (
    <BookingsList
      locale={locale}
      copy={copy}
      items={items}
      next={next}
      query={query ?? EMPTY}
      destinations={shownDestinations}
      loading={loading}
      error={error}
      onQuery={setQuery}
      onMore={more}
      onOpen={(item) => {
        // Back from the detail returns to this guest's bookings: the handed text goes back into storage.
        if (applied !== null && handed.current && applied.q === handed.current) putBookingsSearch(handed.current);
        router.push(`/dashboard/bookings/detail?ref=${encodeURIComponent(item.ref)}`);
      }}
    />
  );
}
