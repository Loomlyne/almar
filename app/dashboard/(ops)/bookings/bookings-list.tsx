"use client";

import type { ReactNode } from "react";
import { ListTable, type Column } from "../../../../components/ops/list-table";
import { DateRangeField } from "../../../../components/ops/date-range-field";
import { Button, LinkButton } from "../../../../components/ui/button";
import { Chip } from "../../../../components/ui/chip";
import { Field } from "../../../../components/ui/field";
import { Select, type SelectOption } from "../../../../components/ui/select";
import { DASHBOARD_COPY } from "../../../../lib/copy/dashboard";
import { fillCopy } from "../../../../lib/copy/ops-kit";
import type { OpsBookingsCopy, OpsBookingsLocale } from "../../../../lib/copy/ops-bookings";
import { formatAed } from "../../../../lib/money/format";
import { aedIn } from "./bookings-text";
import {
  BOOKING_STATUSES,
  uaeDate,
  uaeDateTimeText,
  type OwnerItem,
  type StatusFilter,
} from "../../../../lib/ops/booking-rules";

// Plan 04-09 Task 2: the owner's bookings list, drawn from props only (no fetch, no router, no clock). The screen that
// owns the data and the handlers is 04-09 Task 7. Signed pictures: .planning/phases/04-book-and-pay/pictures/04-09.

/** The list's controls as the screen holds them (the status "all" is the non-empty sentinel of the Select). */
export type BookingsQuery = {
  q: string;
  status: StatusFilter;
  destination: string | null;
  from: string | null;
  to: string | null;
};

export type BookingsDestination = { id: string; name: string };

const ALL = "all";
/** Arrival dates may be in the past, so the range field's own "from today" floor is moved back. */
const EARLIEST_ARRIVAL = "2020-01-01";

/** A static status label: filled for a live booking, an outline for held, cancelled and expired. */
export function BookingStatusChip({ status, copy }: { status: OwnerItem["status"]; copy: OpsBookingsCopy }) {
  const live = status !== "held" && status !== "cancelled" && status !== "expired";
  return (
    <Chip interactive={false} size="dense" on={live}>
      {copy.statuses[status]}
    </Chip>
  );
}

function Bdi({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}

function Flag({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span className={strong ? "border-b border-gold text-ink" : "border-b border-gold text-muted"}>{children}</span>
  );
}

function ItemFlags({ item, copy }: { item: OwnerItem; copy: OpsBookingsCopy }) {
  const f = item.flags;
  const words = copy.flags;
  const flags: ReactNode[] = [];
  if (f.needs_attention) {
    flags.push(
      <Flag key="attention" strong>
        {f.attention_reason === "deadline_passed_part_paid" ? words.deadlinePassedPartPaid : words.needsAttention}
      </Flag>,
    );
  }
  if (f.part_received) flags.push(<Flag key="part">{words.partReceived}</Flag>);
  if (f.overpaid) flags.push(<Flag key="over">{words.overpaid}</Flag>);
  if (item.written_off_fils > 0) {
    flags.push(
      <Flag key="off">{fillCopy(words.writtenOff, { amount: aedIn(item.written_off_fils) })}</Flag>,
    );
  }
  if (f.balance_overdue) {
    flags.push(
      <Flag key="balance" strong>
        {words.balanceOverdue}
      </Flag>,
    );
  }
  if (f.deadline_passed && f.attention_reason !== "deadline_passed_part_paid") {
    flags.push(
      <Flag key="deadline">
        {words.deadlinePassed}
        {item.deadline ? (
          <>
            {" · "}
            <Bdi>{uaeDateTimeText(item.deadline)}</Bdi>
          </>
        ) : null}
      </Flag>,
    );
  }
  if (flags.length === 0) return null;
  return <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-caption">{flags}</div>;
}

export function BookingsList({
  locale,
  copy,
  items,
  next,
  query,
  destinations,
  loading,
  error,
  onQuery,
  onMore,
  onOpen,
}: {
  locale: OpsBookingsLocale;
  copy: OpsBookingsCopy;
  items: OwnerItem[];
  /** The `after` of the next page, null on the last page. */
  next: string | null;
  query: BookingsQuery;
  destinations: BookingsDestination[];
  loading: boolean;
  error: string | null;
  onQuery: (next: BookingsQuery) => void;
  onMore: () => void;
  onOpen: (item: OwnerItem) => void;
}) {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const statusOptions: SelectOption[] = [
    { value: ALL, label: copy.list.allStatuses },
    ...BOOKING_STATUSES.map((status) => ({ value: status, label: copy.statuses[status] })),
    { value: "attention", label: copy.filters.attention },
  ];
  const destinationOptions: SelectOption[] = [
    { value: ALL, label: copy.list.allDestinations },
    ...destinations.map((destination) => ({ value: destination.id, label: destination.name })),
  ];
  const filtered = query.q !== "" || query.status !== "all" || query.destination !== null || query.from !== null || query.to !== null;

  const columns: Column<OwnerItem>[] = [
    {
      key: "ref",
      label: copy.list.columns.ref,
      phone: "title",
      render: (item) => (
        <span className="inline-flex items-center gap-2">
          <Bdi>{item.ref}</Bdi>
          {item.is_test ? (
            <Chip interactive={false} size="dense">
              {copy.flags.test}
            </Chip>
          ) : null}
        </span>
      ),
    },
    {
      key: "guest",
      label: copy.list.columns.guestDates,
      phone: "title",
      render: (item) => (
        <div className="flex flex-col">
          <span>{item.guest_name}</span>
          <span className="text-caption text-muted">
            <Bdi>{uaeDate(item.arrive)}</Bdi> – <Bdi>{uaeDate(item.leave)}</Bdi> · {fillCopy(copy.list.guests, { count: item.guests })}
          </span>
          <ItemFlags item={item} copy={copy} />
        </div>
      ),
    },
    { key: "stay", label: copy.list.columns.stay, phone: "meta", render: (item) => item.stay_title },
    { key: "status", label: copy.list.columns.status, phone: "meta", render: (item) => <BookingStatusChip status={item.status} copy={copy} /> },
    { key: "paid", label: copy.list.columns.paid, phone: "meta", render: (item) => <Bdi>{formatAed(item.paid_fils)}</Bdi> },
    { key: "total", label: copy.list.columns.total, phone: "meta", render: (item) => <Bdi>{formatAed(item.grand_fils)}</Bdi> },
  ];

  return (
    <div data-bookings-list className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="m-0 text-balance font-display text-heading font-normal text-teal">{copy.list.title}</h1>
        <LinkButton href="/dashboard/bookings/new">{DASHBOARD_COPY[locale].newBooking}</LinkButton>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field
          id="bookings-search"
          label={copy.list.search}
          search
          type="search"
          autoComplete="off"
          placeholder={copy.list.searchHint}
          value={query.q}
          maxLength={100}
          onChange={(event) => onQuery({ ...query, q: event.target.value })}
        />
        <div className="grid gap-2">
          <span className="text-label text-ink">{copy.list.columns.status}</span>
          <Select
            value={query.status}
            options={statusOptions}
            dir={dir}
            label={copy.list.statusPicked}
            onChange={(value) => {
              const status = (value === ALL || value === "attention" || (BOOKING_STATUSES as readonly string[]).includes(value) ? value : ALL) as StatusFilter;
              onQuery({ ...query, status });
            }}
          />
        </div>
        <div className="grid gap-2">
          <span className="text-label text-ink">{copy.list.destination}</span>
          <Select
            value={query.destination ?? ALL}
            options={destinationOptions}
            dir={dir}
            label={copy.list.destinationPicked}
            onChange={(value) => onQuery({ ...query, destination: value === ALL ? null : value })}
          />
        </div>
        <DateRangeField
          id="bookings-arrival"
          label={copy.list.arrival}
          min={EARLIEST_ARRIVAL}
          value={{ first: query.from, last: query.to }}
          onChange={(range) => onQuery({ ...query, from: range.first, to: range.last })}
        />
      </div>

      {error ? (
        <p className="m-0 text-label text-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading && items.length === 0 ? (
        <p className="m-0 text-body text-muted" role="status">
          {copy.list.loading}
        </p>
      ) : (
        <ListTable
          caption={copy.list.title}
          columns={columns}
          rows={items}
          onOpen={onOpen}
          empty={<p className="m-0 text-body text-ink">{filtered ? copy.list.noMatch : copy.list.empty}</p>}
        />
      )}

      {next !== null ? (
        <div>
          <Button variant="secondary" busy={loading} onClick={onMore}>
            {copy.list.showMore}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
