"use client";

import type { ReactNode } from "react";
import { ChevronIcon } from "../../../../../components/icons/icons";
import { Button } from "../../../../../components/ui/button";
import { Chip } from "../../../../../components/ui/chip";
import { Field } from "../../../../../components/ui/field";
import { fillCopy } from "../../../../../lib/copy/ops-kit";
import type { OpsBookingsCopy, OpsBookingsLocale } from "../../../../../lib/copy/ops-bookings";
import { formatAed } from "../../../../../lib/money/format";
import {
  actorKind,
  canRecordPayment,
  canResendReceipt,
  canResendRequest,
  canVoid,
  receiptMail,
  requestMail,
  statusActions,
  uaeDate,
  uaeDateTimeText,
  type OwnerDetail,
  type OwnerEvent,
  type OwnerPayment,
  type StatusAction,
} from "../../../../../lib/ops/booking-rules";
import { BookingStatusChip } from "../bookings-list";
import { aedIn, timeIn } from "../bookings-text";

// Plan 04-09 Task 2: one booking as the owner sees it (signed 2026-10-25, all option A): three stacked sections
// Overview, Payments, History, with Resend request email beside the other actions when the server would send it.
// Drawn from props only: no fetch, no router, no clock. The screen that owns the data is 04-09 Task 7.
// Not drawn on purpose: the canvas controls the plan lists as not built (see 04-09-PLAN Task 2 read_first).

const SECTION = "flex min-w-0 flex-col gap-2 border-t border-line pt-4";
const SECTION_TITLE = "m-0 font-display text-title font-normal text-teal";
const BLOCK_TITLE = "m-0 font-display text-body font-normal text-teal";

function Bdi({ children }: { children: ReactNode }) {
  return <bdi dir="ltr">{children}</bdi>;
}

function Amount({ fils }: { fils: number }) {
  return <Bdi>{formatAed(fils)}</Bdi>;
}

function Day({ day }: { day: string }) {
  return <Bdi>{uaeDate(day)}</Bdi>;
}

function When({ iso, copy }: { iso: string; copy: OpsBookingsCopy }) {
  return (
    <>
      <Bdi>{uaeDateTimeText(iso)}</Bdi>
      {copy.detail.uaeTime}
    </>
  );
}

function Rows({ rows }: { rows: [ReactNode, ReactNode][] }) {
  return (
    <dl className="m-0 grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-4 gap-y-1 text-label">
      {rows.map(([label, value], at) => (
        <div key={at} className="contents">
          <dt className="text-muted">{label}</dt>
          <dd className="m-0 min-w-0 break-words text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <h3 className={BLOCK_TITLE}>{title}</h3>
      {children}
    </div>
  );
}

function WarnIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
      <path d="M12 3l10 18H2z" />
      <path d="M12 10v5M12 17.5v.5" />
    </svg>
  );
}

/** One History sentence: the action in words, then "by Owner / System / Guest". Raw detail JSON is never printed. */
function eventLine(copy: OpsBookingsCopy, event: OwnerEvent): string {
  const h = copy.history;
  const detail = event.detail ?? {};
  const template = typeof detail.template === "string" && detail.template in copy.templates
    ? copy.templates[detail.template as keyof OpsBookingsCopy["templates"]]
    : null;
  const amount = typeof detail.amount_fils === "number" ? aedIn(detail.amount_fils) : null;
  let action: string;
  switch (event.action) {
    case "created":
      action = h.created;
      break;
    case "status": {
      const to = event.to_status;
      action = to !== null && to in copy.statuses ? fillCopy(h.status, { status: copy.statuses[to as keyof OpsBookingsCopy["statuses"]] }) : h.fallback;
      break;
    }
    case "hold_expired":
      action = h.hold_expired;
      break;
    case "request_sent":
      action = h.request_sent;
      break;
    case "payment_recorded":
      action = amount ? fillCopy(h.payment_recorded, { amount }) : h.fallback;
      break;
    case "payment_voided":
      action = amount ? fillCopy(h.payment_voided, { amount }) : h.fallback;
      break;
    case "note_added":
      action = h.note_added;
      break;
    case "needs_attention":
      action = h.needs_attention;
      break;
    case "attention_resolved":
      action = h.attention_resolved;
      break;
    case "request_withdrawn":
      action = h.request_withdrawn;
      break;
    case "resend_requested":
      action = template ? fillCopy(h.resend_requested, { template }) : h.fallback;
      break;
    case "email_sent":
    case "email_pending":
    case "email_failed":
      action = template ? fillCopy(h[event.action], { template }) : h.fallback;
      break;
    default:
      action = h.fallback;
  }
  const who = event.action === "request_withdrawn" ? h.actors.guest : h.actors[actorKind(event.actor)];
  return fillCopy(h.by, { action, who });
}

export function BookingDetail({
  locale,
  copy,
  booking,
  busy,
  notice,
  error,
  noteDraft,
  onBack,
  onNoteDraft,
  onAction,
  onRecord,
  onVoid,
  onResendReceipt,
  onResendRequest,
  onAddNote,
  onResolve,
}: {
  locale: OpsBookingsLocale;
  copy: OpsBookingsCopy;
  booking: OwnerDetail;
  busy: boolean;
  /** The last success line (note added, sent again, ...), or null. */
  notice: string | null;
  /** The last refusal or failure sentence, or null. */
  error: string | null;
  noteDraft: string;
  onBack: () => void;
  onNoteDraft: (text: string) => void;
  onAction: (action: StatusAction) => void;
  onRecord: () => void;
  onVoid: (payment: OwnerPayment) => void;
  onResendReceipt: (payment: OwnerPayment) => void;
  onResendRequest: () => void;
  onAddNote: () => void;
  onResolve: () => void;
}) {
  const D = copy.detail;
  const P = copy.payments;
  const A = copy.actions;
  const b = booking;
  const m = b.money;
  const flags = b.flags;
  const guests = b.adults + b.children + b.infants;
  const awaiting = b.status === "awaiting_payment";
  const showResend = canResendRequest(b.status, flags);

  const actionButtons: ReactNode[] = [];
  if (canRecordPayment(b.status)) {
    actionButtons.push(
      <Button key="record" disabled={busy} onClick={onRecord}>
        {A.recordPayment}
      </Button>,
    );
  }
  for (const action of statusActions(b.status)) {
    actionButtons.push(
      <Button key={action} variant={action === "cancel" ? "danger" : "primary"} disabled={busy} onClick={() => onAction(action)}>
        {action === "confirm" ? A.confirm : action === "complete" ? A.complete : A.cancel}
      </Button>,
    );
  }
  if (showResend) {
    actionButtons.push(
      <Button key="resend" variant="secondary" disabled={busy} onClick={onResendRequest}>
        {P.resendRequest}
      </Button>,
    );
  }

  const moneyRows: [ReactNode, ReactNode][] = [
    [D.nights, <Amount key="n" fils={m.nights_fils} />],
    [D.addOns, <Amount key="a" fils={m.addons_fils} />],
    [D.subtotal, <Amount key="s" fils={m.subtotal_fils} />],
    [fillCopy(D.vat, { rate: String(m.vat_bp / 100) }), <Amount key="v" fils={m.vat_fils} />],
    [D.total, <Amount key="t" fils={m.grand_fils} />],
    [D.deposit, <Amount key="d" fils={m.deposit_fils} />],
    [D.paid, <Amount key="p" fils={m.paid_fils} />],
  ];
  if (m.written_off_fils > 0) moneyRows.push([D.writtenOff, <Amount key="w" fils={m.written_off_fils} />]);
  moneyRows.push([D.dueNow, <Amount key="due" fils={flags.due_now_fils} />], [D.stillDue, <Amount key="still" fils={flags.still_due_fils} />]);
  if (b.status === "deposit_paid" && m.balance_due_date) moneyRows.push([D.balanceDueBy, <Day key="bd" day={m.balance_due_date} />]);

  const latestNotes = b.notes.slice(0, 5);
  const noteTooLong = noteDraft.length > 2000;

  return (
    <div data-booking-detail className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Button variant="ghost" className="self-start px-0" onClick={onBack}>
          <ChevronIcon size={16} className={locale === "ar" ? "rotate-0" : "rotate-180"} aria-hidden="true" />
          {D.back}
        </Button>
        <div className="flex flex-wrap items-center gap-4">
          <h1 className="m-0 font-display text-heading font-normal text-teal" dir="ltr">
            {b.ref}
          </h1>
          {b.is_test ? (
            <Chip interactive={false} size="dense">
              {copy.flags.test}
            </Chip>
          ) : null}
          <BookingStatusChip status={b.status} copy={copy} />
        </div>
        <p className="m-0 text-body text-ink">
          {b.stay.title} · {b.destination.name}
        </p>
        <p className="m-0 text-label text-muted">
          <Day day={b.arrive} /> – <Day day={b.leave} /> · {b.guest.name} · {b.source === "web" ? D.madeOnSite : D.madeInDashboard}
        </p>
      </div>

      {error ? (
        <p className="m-0 flex items-center gap-1 text-label text-error" role="alert">
          <WarnIcon />
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="m-0 text-label text-success" role="status">
          {notice}
        </p>
      ) : null}

      {flags.needs_attention ? (
        <div className="flex flex-col items-start gap-2 border border-gold bg-surface p-4">
          <p className="m-0 flex items-center gap-2 text-body font-bold text-ink">
            <WarnIcon />
            {flags.attention_reason === "deadline_passed_part_paid" ? copy.flags.deadlinePassedPartPaid : copy.flags.needsAttention}
          </p>
          {flags.attention_reason ? <p className="m-0 text-label text-ink">{copy.flags.reasons[flags.attention_reason]}</p> : null}
          <Button variant="secondary" disabled={busy} onClick={onResolve}>
            {A.resolve}
          </Button>
        </div>
      ) : null}

      {actionButtons.length > 0 ? <div className="flex flex-wrap items-center gap-2">{actionButtons}</div> : null}
      {awaiting ? <p className="m-0 text-caption text-muted">{P.requestMail[requestMail(b)]}</p> : null}

      <section className={SECTION} aria-labelledby="booking-overview">
        <h2 id="booking-overview" className={SECTION_TITLE}>
          {D.overview}
        </h2>
        <div className="grid gap-6 md:grid-cols-2">
          <Block title={D.stayDates}>
            <Rows
              rows={[
                [D.arrive, <Day key="a" day={b.arrive} />],
                [D.leave, <Day key="l" day={b.leave} />],
                [D.nights, <Bdi key="n">{b.nights}</Bdi>],
                [D.guests, <Bdi key="g">{guests}</Bdi>],
                [D.adults, <Bdi key="ad">{b.adults}</Bdi>],
                [D.children, <Bdi key="ch">{b.children}</Bdi>],
                [D.infants, <Bdi key="in">{b.infants}</Bdi>],
                [D.airport, D.airports[b.airport ?? "none"]],
                [D.pickupAddress, b.pickup_address ?? "-"],
              ]}
            />
          </Block>
          <Block title={D.guest}>
            <Rows
              rows={[
                [D.guest, b.guest.name],
                [D.email, <Bdi key="e">{b.guest.email}</Bdi>],
                [D.phone, b.guest.phone ? <Bdi key="p">{b.guest.phone}</Bdi> : "-"],
                [D.nationality, b.guest.nationality ?? "-"],
                [D.specialRequests, b.guest.special_requests ?? "-"],
                [
                  D.emergencyContact,
                  b.guest.emergency_name || b.guest.emergency_phone ? (
                    <span key="em">
                      {b.guest.emergency_name ?? ""} {b.guest.emergency_phone ? <Bdi>{b.guest.emergency_phone}</Bdi> : null}
                    </span>
                  ) : (
                    "-"
                  ),
                ],
                [D.language, <bdi key="lang">{D.languages[b.guest.locale]}</bdi>],
              ]}
            />
          </Block>
          <Block title={D.travellers}>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-label text-ink">
              {b.travellers.map((traveller, at) => (
                <li key={at}>
                  {traveller.full_name} · {D.travellerKinds[traveller.kind]}
                  {traveller.is_booker ? ` · ${D.booker}` : ""}
                  {traveller.age !== null ? (
                    <>
                      {" · "}
                      {D.age} <Bdi>{traveller.age}</Bdi>
                    </>
                  ) : null}
                  {traveller.not_staying ? ` · ${D.notStaying}` : ""}
                </li>
              ))}
            </ul>
          </Block>
          <Block title={D.addOns}>
            {b.lines.length === 0 ? (
              <p className="m-0 text-label text-muted">{D.noAddOns}</p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-2 p-0 text-label text-ink">
                {b.lines.map((line, at) => (
                  <li key={at} className="flex flex-wrap items-baseline justify-between gap-x-4">
                    <span className="min-w-0">
                      {line.name}
                      <span className="block text-caption text-muted">
                        <Amount fils={line.unit_price_fils} /> {D.lineUnit[line.unit]} · {D.quantity} <Bdi>{line.quantity}</Bdi>
                      </span>
                    </span>
                    <Amount fils={line.line_fils} />
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block title={D.total}>
            <Rows rows={moneyRows} />
            {awaiting && b.deadline ? <p className="m-0 text-label text-ink">{fillCopy(D.payBy, { date: timeIn(b.deadline, D.uaeTime) })}</p> : null}
            {flags.balance_overdue ? <p className="m-0 text-label text-ink">{copy.flags.balanceOverdue}</p> : null}
          </Block>
          <Block title={D.guestSees}>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-label text-ink">
              <li className="font-bold">{copy.statuses[b.status]}</li>
              {awaiting ? (
                <>
                  <li>
                    {D.dueNow}: <Amount fils={flags.due_now_fils} />
                  </li>
                  {b.deadline ? (
                    <li>
                      {fillCopy(D.payBy, { date: timeIn(b.deadline, D.uaeTime) })}
                      {flags.deadline_passed ? ` · ${copy.flags.deadlinePassed}` : ""}
                    </li>
                  ) : null}
                </>
              ) : null}
              {b.status === "deposit_paid" ? (
                <>
                  <li>
                    {D.stillDue}: <Amount fils={flags.still_due_fils} />
                  </li>
                  {m.balance_due_date ? (
                    <li>
                      {D.balanceDueBy} <Day day={m.balance_due_date} />
                    </li>
                  ) : null}
                </>
              ) : null}
            </ul>
          </Block>
        </div>
        <Block title={D.latestNotes}>
          {latestNotes.length === 0 ? (
            <p className="m-0 text-label text-muted">{copy.notes.empty}</p>
          ) : (
            <ul className="m-0 flex list-none flex-col p-0 text-label text-ink">
              {latestNotes.map((note) => (
                <li key={note.id} className="border-b border-line py-2">
                  <span className="block text-caption text-muted">
                    <When iso={note.at} copy={copy} />
                    {note.actor_email ? <> · <Bdi>{note.actor_email}</Bdi></> : null}
                  </span>
                  <span className="whitespace-pre-wrap break-words">{note.body}</span>
                </li>
              ))}
            </ul>
          )}
          <Field
            id="booking-note"
            multiline
            label={copy.notes.label}
            className="max-w-none"
            value={noteDraft}
            maxLength={2100}
            error={noteTooLong ? copy.errors.note : undefined}
            onChange={(event) => onNoteDraft(event.target.value)}
          />
          <div>
            <Button variant="secondary" disabled={busy || noteDraft.trim() === "" || noteTooLong} onClick={onAddNote}>
              {copy.notes.add}
            </Button>
          </div>
        </Block>
      </section>

      <section className={SECTION} aria-labelledby="booking-payments">
        <h2 id="booking-payments" className={SECTION_TITLE}>
          {D.payments}
        </h2>
        <h3 className="m-0 text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">{P.transactions}</h3>
        {b.payments.length === 0 ? (
          <p className="m-0 text-label text-muted">{P.none}</p>
        ) : (
          <>
            <div className="hidden min-w-0 overflow-x-auto md:block">
              <table className="w-full border-collapse font-body">
                <thead>
                  <tr className="border-b border-line">
                    {[P.date, P.method, P.reference, P.amount, P.recordedBy].map((label, at) => (
                      <th key={at} scope="col" className="px-2 py-2 text-start text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal">
                        {label}
                      </th>
                    ))}
                    <th scope="col" className="px-2 py-2">
                      <span className="sr-only">{P.actionsColumn}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {b.payments.map((payment) => (
                    <tr key={payment.id} className="border-b border-line align-top">
                      <td className="px-2 py-2 text-label text-ink">{payment.received_on ? <Day day={payment.received_on} /> : "-"}</td>
                      <td className="px-2 py-2 text-label text-ink">{payment.method === "card" ? P.card : P.bankTransfer}</td>
                      <td className="px-2 py-2 text-label text-ink">{payment.bank_reference ?? "-"}</td>
                      <td className="px-2 py-2 text-label text-ink">
                        <PaymentAmount payment={payment} copy={copy} />
                      </td>
                      <td className="px-2 py-2 text-label text-ink">{payment.recorded_by_email ? <Bdi>{payment.recorded_by_email}</Bdi> : "-"}</td>
                      <td className="px-2 py-2">
                        <PaymentActions booking={b} payment={payment} copy={copy} busy={busy} onVoid={onVoid} onResendReceipt={onResendReceipt} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
              {b.payments.map((payment) => (
                <li key={payment.id} className="flex flex-col gap-2 border border-line bg-surface p-4 text-label text-ink">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span>
                      {payment.received_on ? <Day day={payment.received_on} /> : "-"} · {payment.method === "card" ? P.card : P.bankTransfer}
                    </span>
                    <PaymentAmount payment={payment} copy={copy} />
                  </div>
                  {payment.bank_reference ? (
                    <span className="text-caption text-muted">
                      {P.reference}: {payment.bank_reference}
                    </span>
                  ) : null}
                  {payment.recorded_by_email ? (
                    <span className="text-caption text-muted">
                      {P.recordedBy}: <Bdi>{payment.recorded_by_email}</Bdi>
                    </span>
                  ) : null}
                  <PaymentActions booking={b} payment={payment} copy={copy} busy={busy} onVoid={onVoid} onResendReceipt={onResendReceipt} />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>

      <section className={SECTION} aria-labelledby="booking-history">
        <h2 id="booking-history" className={SECTION_TITLE}>
          {D.history}
        </h2>
        <ul className="m-0 flex list-none flex-col p-0 text-label text-ink">
          {b.events.map((event) => (
            <li key={event.id} className="flex flex-wrap gap-x-4 border-b border-line py-2">
              <time dateTime={event.at} className="shrink-0 text-muted">
                <When iso={event.at} copy={copy} />
              </time>
              <span className="min-w-0 break-words">{eventLine(copy, event)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function PaymentAmount({ payment, copy }: { payment: OwnerPayment; copy: OpsBookingsCopy }) {
  const P = copy.payments;
  return (
    <div className="flex flex-col gap-1">
      <span className={payment.status === "voided" ? "line-through" : undefined}>
        <Amount fils={payment.amount_fils} />
      </span>
      {payment.write_off_fils > 0 ? (
        <span className="text-caption text-muted">
          {fillCopy(P.writtenOff, { amount: aedIn(payment.write_off_fils), reason: payment.write_off_reason ?? "" })}
        </span>
      ) : null}
      {payment.status === "voided" ? (
        <span className="text-caption text-muted">
          {fillCopy(P.voided, { reason: payment.void_reason ?? "" })}
          {payment.voided_at ? <> · <When iso={payment.voided_at} copy={copy} /></> : null}
          {payment.voided_by_email ? <> · <Bdi>{payment.voided_by_email}</Bdi></> : null}
        </span>
      ) : null}
    </div>
  );
}

function PaymentActions({
  booking,
  payment,
  copy,
  busy,
  onVoid,
  onResendReceipt,
}: {
  booking: OwnerDetail;
  payment: OwnerPayment;
  copy: OpsBookingsCopy;
  busy: boolean;
  onVoid: (payment: OwnerPayment) => void;
  onResendReceipt: (payment: OwnerPayment) => void;
}) {
  const showVoid = canVoid(payment);
  const showReceipt = canResendReceipt(payment);
  return (
    <div className="flex flex-col items-start gap-2">
      {showReceipt ? <span className="text-caption text-muted">{copy.payments.receipt[receiptMail(booking, payment.id)]}</span> : null}
      {showVoid || showReceipt ? (
        <div className="flex flex-wrap gap-2">
          {showVoid ? (
            <Button variant="danger" disabled={busy} onClick={() => onVoid(payment)}>
              {copy.actions.void}
            </Button>
          ) : null}
          {showReceipt ? (
            <Button variant="ghost" disabled={busy} onClick={() => onResendReceipt(payment)}>
              {copy.payments.resendReceipt}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
