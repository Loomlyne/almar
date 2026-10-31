"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Locale3 } from "../../../../components/ops/api-types";
import { DateRangeField } from "../../../../components/ops/date-range-field";
import { opsFetch } from "../../../../components/ops/ops-client";
import { readError } from "../../../../components/ops/read-error";
import { useDashboardLocale } from "../../../../components/ops/use-dashboard-locale";
import { Chip } from "../../../../components/ui/chip";
import { CARD_TITLE, CardTitleWords } from "../../../../components/ui/link";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { OPS_HOME_COPY } from "../../../../lib/copy/ops-home";
import { OPS_KIT_COPY } from "../../../../lib/copy/ops-kit";
import type { HomeNumbers, HomeRange } from "../../../../lib/ops/home-contract";
import { numberLinks, signedAed } from "../../../../lib/ops/home-rules";
import { uaeDate } from "../../../../lib/ops/booking-rules";
import { daysBetween } from "../../../../lib/money/dates";

// Plan 05-04 (P5-08, P5-12): the owner's Home. Three numbers (Bookings, Recorded money, Outstanding) for This month, Last 30
// days or Custom, read from /api/ops/home. The v1.1 slots are not drawn. A number above zero
// links to the plain Bookings list; zero is plain text. The latest-ticket rule of bookings-screen.tsx keeps a slow older
// answer from replacing a newer one.

/** ops_home_numbers refuses a range longer than this many days (05-01 item 12). */
const MAX_RANGE_DAYS = 3660;
const EARLIEST_DAY = "2020-01-01";

const CARD = "flex min-w-0 flex-col gap-1 rounded-none border border-line bg-surface p-4";
const VALUE = "self-start font-display text-heading text-teal tabular-nums";

type Custom = { first: string | null; last: string | null };

function Card({
  label,
  value,
  note,
  linked,
  bookingsHref,
}: {
  label: string;
  value: ReactNode;
  note: string;
  linked: boolean;
  bookingsHref: string;
}) {
  const body = (
    <>
      <span className="text-label text-ink">{linked ? <span className={CARD_TITLE}><CardTitleWords>{label}</CardTitleWords></span> : label}</span>
      <bdi dir="ltr" className={VALUE}>
        {value}
      </bdi>
      <span className="text-caption text-muted">{note}</span>
    </>
  );
  if (linked) {
    return (
      <Link href={bookingsHref} className={`group ${CARD} hover:bg-teal-tint focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal`}>
        {body}
      </Link>
    );
  }
  return (
    <section className={CARD} aria-label={label}>
      {body}
    </section>
  );
}

export function HomeScreen() {
  const locale: Locale3 = useDashboardLocale();
  const copy = OPS_HOME_COPY[locale].home;
  const dash = DASHBOARD_COPY[locale];
  const kit = OPS_KIT_COPY[locale];

  const [range, setRange] = useState<HomeRange>("month");
  const [custom, setCustom] = useState<Custom>({ first: null, last: null });
  const [answer, setAnswer] = useState<HomeNumbers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(0);
  // The sentences are read at answer time, so a language change after mount does not fetch again.
  const words = useRef({ copy, kit });
  words.current = { copy, kit };

  const tooLong =
    range === "custom" && custom.first !== null && custom.last !== null && daysBetween(custom.first, custom.last) > MAX_RANGE_DAYS;

  useEffect(() => {
    let query: Record<string, string>;
    if (range === "month") query = { range: "month" };
    else if (range === "30d") query = { range: "30d" };
    else if (custom.first !== null && custom.last !== null && !tooLong) query = { from: custom.first, to: custom.last };
    else return; // Custom waits for two good days; the numbers stay on the last answer, with its own dates.
    const ticket = (latest.current += 1);
    setLoading(true);
    setError(null);
    void opsFetch<HomeNumbers>("/api/ops/home", query).then((reply) => {
      if (ticket !== latest.current) return;
      setLoading(false);
      if (!reply.ok) {
        // Never the last answer's numbers under a failed one.
        setAnswer(null);
        setError(readError(words.current.kit, reply.error, words.current.copy.failed));
        return;
      }
      setError(null);
      setAnswer({
        from: reply.from,
        to: reply.to,
        bookings: reply.bookings,
        received_fils: reply.received_fils,
        refunded_fils: reply.refunded_fils,
        recorded_fils: reply.recorded_fils,
        outstanding_fils: reply.outstanding_fils,
        outstanding_count: reply.outstanding_count,
      });
    });
  }, [range, custom.first, custom.last, tooLong]);

  const options: ReadonlyArray<{ key: HomeRange; label: string }> = [
    { key: "month", label: dash.thisMonth },
    { key: "30d", label: dash.last30 },
    { key: "custom", label: dash.custom },
  ];
  const links = answer ? numberLinks(answer) : null;
  const href = "/dashboard/bookings";

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{dash.rail.home}</h1>

      <div className="flex flex-wrap items-end gap-2" role="group" aria-label={copy.dateRange}>
        {options.map((option) => (
          <Chip key={option.key} on={range === option.key} onClick={() => setRange(option.key)}>
            {option.label}
          </Chip>
        ))}
      </div>

      {range === "custom" ? (
        <DateRangeField
          id="home-range"
          label={copy.customDates}
          min={EARLIEST_DAY}
          hint={custom.first !== null && custom.last !== null ? undefined : copy.pickDates}
          error={tooLong ? copy.rangeTooLong : undefined}
          value={custom}
          onChange={setCustom}
        />
      ) : null}

      {answer ? (
        <p className="m-0 text-body text-muted">
          <bdi dir="ltr">{uaeDate(answer.from)}</bdi> – <bdi dir="ltr">{uaeDate(answer.to)}</bdi>
        </p>
      ) : null}

      {error ? (
        <p className="m-0 text-label text-error" role="alert">
          {error}
        </p>
      ) : null}

      {answer && links ? (
        <div className={`grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3${loading ? " opacity-60" : ""}`} aria-busy={loading}>
          <Card label={copy.bookings} value={answer.bookings} note={copy.bookingsNote} linked={links.bookings} bookingsHref={href} />
          <Card label={copy.recorded} value={signedAed(answer.recorded_fils)} note={copy.recordedNote} linked={links.recorded} bookingsHref={href} />
          <Card label={copy.outstanding} value={signedAed(answer.outstanding_fils)} note={copy.outstandingNote} linked={links.outstanding} bookingsHref={href} />
        </div>
      ) : loading && !error ? (
        <p className="m-0 text-body text-muted" role="status">
          {copy.loading}
        </p>
      ) : null}

      <p className="m-0 text-caption text-muted">{copy.foot}</p>
    </div>
  );
}
