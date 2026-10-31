"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ListTable, type Column } from "../../../../components/ops/list-table";
import { opsFetch } from "../../../../components/ops/ops-client";
import { readError } from "../../../../components/ops/read-error";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import { Button } from "../../../../components/ui/button";
import { Field } from "../../../../components/ui/field";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { OPS_HOME_COPY } from "../../../../lib/copy/ops-home";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import { LIST_LIMIT, uaeDate } from "../../../../lib/ops/booking-rules";
import { putBookingsSearch } from "../../../../lib/ops/bookings-handoff";
import type { CustomerRow } from "../../../../lib/ops/home-contract";
import { customerSearchText } from "../../../../lib/ops/home-rules";

// Plan 05-04 (P5-09): the owner's Customers, a read-only list grouped by guest email. This file owns the data: a 300 ms wait
// on the search text, the latest-ticket rule so a slow older answer never replaces a newer one, and Show more. ListTable
// draws. The search text lives in state only, never in the URL. A row hands its email to Bookings through session storage
// (lib/ops/bookings-handoff.ts), so the address never carries it. Read-only: no create action.

const QUIET_MS = 300;

type Row = CustomerRow & { id: string };

function Bdi({ children }: { children: string }) {
  return <bdi dir="ltr">{children}</bdi>;
}

export function CustomersScreen() {
  const locale = useDashboardLocale();
  const words = OPS_HOME_COPY[locale].customers;
  const dash = DASHBOARD_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const router = useRouter();

  const [text, setText] = useState("");
  // What the list is fetched with: the search text after its quiet time.
  const [applied, setApplied] = useState("");
  const [items, setItems] = useState<Row[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  // The sentences are read at answer time, so a language change after mount does not fetch the list again.
  const spoken = useRef({ words, kit });
  spoken.current = { words, kit };

  useEffect(() => {
    if (text === applied) return;
    const timer = window.setTimeout(() => setApplied(text), QUIET_MS);
    return () => window.clearTimeout(timer);
  }, [text, applied]);

  function query(after: string | null): Record<string, string | undefined> {
    return { q: applied === "" ? undefined : applied, after: after ?? undefined, limit: String(LIST_LIMIT) };
  }

  function rows(list: CustomerRow[]): Row[] {
    return list.map((row) => ({ ...row, id: row.email }));
  }

  // The first page for the applied text.
  useEffect(() => {
    const ticket = (latest.current += 1);
    setLoading(true);
    void opsFetch<{ items: CustomerRow[]; next: string | null }>("/api/ops/customers", {
      q: applied === "" ? undefined : applied,
      limit: String(LIST_LIMIT),
    }).then((reply) => {
      if (ticket !== latest.current) return;
      setLoading(false);
      if (!reply.ok) {
        // Never the last answer's rows under a failed one.
        setItems([]);
        setNext(null);
        setError(readError(spoken.current.kit, reply.error, spoken.current.words.failed));
        return;
      }
      setError(null);
      setItems(rows(reply.items));
      setNext(reply.next);
    });
  }, [applied]);

  function more() {
    if (next === null || loading) return;
    const ticket = (latest.current += 1);
    setLoading(true);
    void opsFetch<{ items: CustomerRow[]; next: string | null }>("/api/ops/customers", query(next)).then((reply) => {
      if (ticket !== latest.current) return;
      setLoading(false);
      if (!reply.ok) {
        setError(readError(spoken.current.kit, reply.error, spoken.current.words.failed));
        return;
      }
      setError(null);
      setItems((old) => [...old, ...rows(reply.items)]);
      setNext(reply.next);
    });
  }

  const columns: Column<Row>[] = [
    { key: "name", label: words.name, phone: "title", render: (row) => <bdi>{row.name}</bdi> },
    { key: "email", label: words.email, phone: "meta", render: (row) => <Bdi>{row.email}</Bdi> },
    { key: "phone", label: words.phone, phone: "meta", render: (row) => <Bdi>{row.phone}</Bdi> },
    { key: "bookings", label: words.bookings, phone: "meta", render: (row) => <span className="tabular-nums">{row.bookings}</span> },
    { key: "last_arrive", label: words.lastArrival, phone: "meta", render: (row) => <Bdi>{uaeDate(row.last_arrive)}</Bdi> },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{dash.rail.customers}</h1>

      <Field
        id="customers-search"
        label={words.search}
        search
        type="search"
        autoComplete="off"
        placeholder={words.searchHint}
        value={text}
        maxLength={100}
        onChange={(event) => setText(event.target.value)}
      />

      {error ? (
        <p className="m-0 text-label text-error" role="alert">
          {error}
        </p>
      ) : null}

      {error !== null && items.length === 0 ? null : loading && items.length === 0 ? (
        <p className="m-0 text-body text-muted" role="status">
          {words.loading}
        </p>
      ) : (
        <ListTable
          caption={dash.rail.customers}
          columns={columns}
          rows={items}
          onOpen={(row) => {
            putBookingsSearch(customerSearchText(row.email));
            router.push("/dashboard/bookings");
          }}
          empty={<p className="m-0 text-body text-ink">{applied === "" ? dash.noCustomersYet : words.noMatch}</p>}
        />
      )}

      {next !== null ? (
        <div>
          <Button variant="secondary" busy={loading} onClick={more}>
            {words.showMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
