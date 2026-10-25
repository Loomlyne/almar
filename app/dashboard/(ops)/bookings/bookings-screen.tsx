"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { DestinationDetail, DestinationSummary, DetailReply, ListReply } from "../../../../components/ops/api-types";
import { opsFetch } from "../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import { OPS_BOOKINGS_COPY } from "../../../../lib/copy/ops-bookings";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import { LIST_LIMIT, listSearch, parseListQuery, type OwnerItem } from "../../../../lib/ops/booking-rules";
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
  const [destinations, setDestinations] = useState<BookingsDestination[]>([]);
  // Each destination's Arabic and Spanish name, read from its detail the first time the page is not in English.
  const [localNames, setLocalNames] = useState<Record<string, { ar: string | null; es: string | null }>>({});
  const namesAsked = useRef(false);
  const latest = useRef(0);
  // The sentences are read at answer time, so a language change after mount does not fetch the list again.
  const words = useRef({ copy, kit });
  words.current = { copy, kit };

  // The URL is read once.
  useEffect(() => {
    const parsed = parseListQuery(new URLSearchParams(window.location.search));
    const start = parsed.ok ? { q: parsed.query.q, status: parsed.query.status, destination: parsed.query.destination, from: parsed.query.from, to: parsed.query.to } : EMPTY;
    setQuery(start);
    setApplied(start);
  }, []);

  // The search text waits 300 ms of quiet; every other control applies at once.
  useEffect(() => {
    if (query === null || applied === null || query === applied) return;
    const timer = window.setTimeout(() => setApplied(query), query.q === applied.q ? 0 : QUIET_MS);
    return () => window.clearTimeout(timer);
  }, [query, applied]);

  // Destinations for the filter. The list endpoint carries the English name only.
  useEffect(() => {
    let live = true;
    void opsFetch<ListReply<DestinationSummary>>("/api/ops/destinations").then((reply) => {
      if (live && reply.ok) setDestinations(reply.items.map((one) => ({ id: one.id, name: one.name_en })));
    });
    return () => {
      live = false;
    };
  }, []);

  // In Arabic or Spanish, each destination's own name comes from its detail (a handful of rows, read once, and only
  // when the page is not in English). A failed read or a missing translation keeps the English name.
  useEffect(() => {
    if (locale === "en" || destinations.length === 0 || namesAsked.current) return;
    namesAsked.current = true;
    void Promise.all(
      destinations.map((one) => opsFetch<DetailReply<DestinationDetail>>("/api/ops/destinations", { id: one.id })),
    ).then((replies) => {
      const found: Record<string, { ar: string | null; es: string | null }> = {};
      for (const reply of replies) {
        if (!reply.ok || !reply.item?.translations) continue;
        const t = reply.item.translations;
        found[reply.item.id] = { ar: t.ar?.name || null, es: t.es?.name || null };
      }
      setLocalNames(found);
    });
  }, [locale, destinations]);

  const shownDestinations: BookingsDestination[] =
    locale === "en" ? destinations : destinations.map((one) => ({ id: one.id, name: localNames[one.id]?.[locale] ?? one.name }));

  // The first page for the applied controls; the URL follows.
  useEffect(() => {
    if (applied === null) return;
    const ticket = (latest.current += 1);
    const search = listSearch({ ...applied, after: null, limit: LIST_LIMIT }).toString();
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
      onOpen={(item) => router.push(`/dashboard/bookings/detail?ref=${encodeURIComponent(item.ref)}`)}
    />
  );
}
