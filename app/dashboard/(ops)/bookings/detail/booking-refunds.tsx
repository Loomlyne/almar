"use client";

import type { ReactNode } from "react";
import { Button } from "../../../../../components/ui/button";
import { Dialog } from "../../../../../components/ui/dialog";
import { Field } from "../../../../../components/ui/field";
import { OPS_REFUNDS_COPY, type OpsRefundsCopy } from "../../../../../lib/copy/ops-refunds";
import { fillCopy } from "../../../../../lib/copy/ops-kit";
import type { OpsBookingsCopy, OpsBookingsLocale } from "../../../../../lib/copy/ops-bookings";
import {
  canVoidRefund,
  dubaiDayOf,
  parseAedAmount,
  refundMail,
  refundPreview,
  refundableFils,
  type OwnerDetail,
  type OwnerRefund,
} from "../../../../../lib/ops/booking-rules";
import { aedIn, dayIn, timeIn } from "../bookings-text";
import { ErrorLine, reasonOk, Sentences } from "./booking-dialogs";

// Plan 05-03 (PAY-12, B-31, B-25): the refund list and both refund dialogs on a booking. This file and
// lib/copy/ops-refunds.ts are a lazy chunk: the detail and its screen load them through next/dynamic with ssr: false, so
// neither enters the server bundle. Props in, callbacks out: no fetch, no router, no clock (`today` is a prop). A refund
// is recorded from the bank, never sent from here: the only verbs on a button are Record and Void (and Resend for the
// guest's email). Every dialog is a confirm: Escape and the scrim do not close it, and `busy` turns its confirm off.

export type RefundValues = { amount: string; date: string; reference: string; reason: string };

const REFERENCE_MAX = 100;
const REASON_MAX = 300;
const KICKER = "m-0 text-caption font-normal uppercase tracking-kicker text-muted ar:normal-case ar:tracking-normal";

// ------------------------------------------------------------------------------------------------------------
// The list, in the Payments section
// ------------------------------------------------------------------------------------------------------------

function RefundAmount({ refund, copy, R }: { refund: OwnerRefund; copy: OpsBookingsCopy; R: OpsRefundsCopy }) {
  const voided = refund.status === "voided";
  return (
    <div className="flex flex-col gap-1">
      <span className={voided ? "line-through" : undefined}>
        <bdi dir="ltr">{aedIn(refund.amount_fils)}</bdi>
      </span>
      {refund.reason ? <span className="text-caption text-muted">{fillCopy(R.reasonLine, { reason: refund.reason })}</span> : null}
      {voided ? (
        <span className="text-caption text-muted">
          {fillCopy(copy.payments.voided, { reason: refund.void_reason ?? "" })}
          {refund.voided_at ? <> · {timeIn(refund.voided_at, copy.detail.uaeTime)}</> : null}
          {refund.voided_by_email ? <> · <bdi dir="ltr">{refund.voided_by_email}</bdi></> : null}
        </span>
      ) : null}
    </div>
  );
}

function RefundActions({
  booking,
  refund,
  copy,
  R,
  busy,
  onVoid,
  onResend,
}: {
  booking: OwnerDetail;
  refund: OwnerRefund;
  copy: OpsBookingsCopy;
  R: OpsRefundsCopy;
  busy: boolean;
  onVoid: (refund: OwnerRefund) => void;
  onResend: (refund: OwnerRefund) => void;
}) {
  if (!canVoidRefund(refund)) return null;
  return (
    <div className="flex flex-col items-start gap-2">
      <span className="text-caption text-muted">{copy.payments.refundMail[refundMail(booking, refund.id)]}</span>
      <div className="flex flex-wrap gap-2">
        <Button variant="danger" disabled={busy} onClick={() => onVoid(refund)}>
          {copy.actions.void}
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => onResend(refund)}>
          {R.resend}
        </Button>
      </div>
    </div>
  );
}

export function RefundsBlock({
  locale,
  copy,
  booking,
  busy,
  onVoid,
  onResend,
}: {
  locale: OpsBookingsLocale;
  copy: OpsBookingsCopy;
  booking: OwnerDetail;
  busy: boolean;
  onVoid: (refund: OwnerRefund) => void;
  onResend: (refund: OwnerRefund) => void;
}) {
  const R = OPS_REFUNDS_COPY[locale];
  const P = copy.payments;
  const rows = booking.refunds;
  return (
    <div data-booking-refunds className="flex min-w-0 flex-col gap-2">
      <h3 className={KICKER}>{R.heading}</h3>
      <div className="hidden min-w-0 overflow-x-auto md:block">
        <table className="w-full border-collapse font-body">
          <thead>
            <tr className="border-b border-line">
              {[R.dateRefunded, P.reference, P.amount, P.recordedBy].map((label, at) => (
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
            {rows.map((refund) => (
              <tr key={refund.id} className="border-b border-line align-top">
                <td className="px-2 py-2 text-label text-ink">{dayIn(refund.refunded_on)}</td>
                <td className="px-2 py-2 text-label text-ink">{refund.bank_reference}</td>
                <td className="px-2 py-2 text-label text-ink">
                  <RefundAmount refund={refund} copy={copy} R={R} />
                </td>
                <td className="px-2 py-2 text-label text-ink">{refund.recorded_by_email ? <bdi dir="ltr">{refund.recorded_by_email}</bdi> : "-"}</td>
                <td className="px-2 py-2">
                  <RefundActions booking={booking} refund={refund} copy={copy} R={R} busy={busy} onVoid={onVoid} onResend={onResend} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 md:hidden">
        {rows.map((refund) => (
          <li key={refund.id} className="flex flex-col gap-2 border border-line bg-surface p-4 text-label text-ink">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span>{dayIn(refund.refunded_on)}</span>
              <RefundAmount refund={refund} copy={copy} R={R} />
            </div>
            <span className="text-caption text-muted">{fillCopy(P.referenceLine, { reference: refund.bank_reference })}</span>
            {refund.recorded_by_email ? <span className="text-caption text-muted">{fillCopy(P.recordedByLine, { email: refund.recorded_by_email })}</span> : null}
            <RefundActions booking={booking} refund={refund} copy={copy} R={R} busy={busy} onVoid={onVoid} onResend={onResend} />
          </li>
        ))}
      </ul>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------------------
// Record refund
// ------------------------------------------------------------------------------------------------------------

export function RecordRefundDialog({
  open,
  locale,
  copy,
  closeLabel,
  booking,
  today,
  values,
  step,
  busy,
  error,
  onChange,
  onReview,
  onBack,
  onConfirm,
  onClose,
}: {
  open: boolean;
  locale: OpsBookingsLocale;
  copy: OpsBookingsCopy;
  closeLabel: string;
  booking: OwnerDetail;
  /** Today in Dubai, YYYY-MM-DD. */
  today: string;
  values: RefundValues;
  step: "form" | "review";
  busy: boolean;
  /** The last refusal or failure sentence, or null. */
  error: string | null;
  onChange: (patch: Partial<RefundValues>) => void;
  onReview: () => void;
  onBack: () => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const L = OPS_REFUNDS_COPY[locale];
  const RR = copy.record;
  const E = copy.errors;
  const b = booking;
  const first = dubaiDayOf(b.created_at);
  const amountFils = parseAedAmount(values.amount);
  const preview =
    amountFils === null
      ? null
      : refundPreview({
          status: b.status,
          grandFils: b.money.grand_fils,
          paidFils: b.money.paid_fils,
          refundedFils: b.money.refunded_fils,
          attentionReason: b.flags.attention_reason,
          amountFils,
        });
  const left = refundableFils(b.money.paid_fils, b.money.refunded_fils);

  const amountBad = values.amount.trim() !== "" && amountFils === null;
  const dateOk = values.date !== "" && values.date >= first && values.date <= today;
  const dateBad = values.date !== "" && !dateOk;
  const referenceLength = Array.from(values.reference.trim()).length;
  const referenceBad = referenceLength > REFERENCE_MAX;
  const reasonGiven = values.reason.trim() !== "";
  const reasonBad = reasonGiven && !reasonOk(values.reason, REASON_MAX);
  const refusal = preview?.refusal ?? null;
  const valid = amountFils !== null && dateOk && referenceLength >= 1 && !referenceBad && !reasonBad && refusal === null;

  let body: ReactNode;
  let footer: ReactNode;
  if (step === "form") {
    body = (
      <div className="flex flex-col gap-4">
        <p className="m-0 text-body text-ink">{L.record.intro}</p>
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id="refund-amount"
            label={L.record.amount}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required
            className="max-w-none"
            value={values.amount}
            hint={fillCopy(L.record.amountHint, { amount: aedIn(left) })}
            error={amountBad ? E.refund_amount : undefined}
            onChange={(event) => onChange({ amount: event.target.value })}
          />
          <Field
            id="refund-date"
            label={L.dateRefunded}
            type="date"
            required
            className="max-w-none"
            min={first}
            max={today}
            value={values.date}
            error={dateBad ? E.refund_date : undefined}
            onChange={(event) => onChange({ date: event.target.value })}
          />
          <Field
            id="refund-reference"
            label={RR.bankReference}
            type="text"
            autoComplete="off"
            required
            className="max-w-none"
            value={values.reference}
            error={referenceBad ? E.reference : undefined}
            onChange={(event) => onChange({ reference: event.target.value })}
          />
          <Field
            id="refund-reason"
            label={L.record.reason}
            type="text"
            autoComplete="off"
            className="max-w-none"
            value={values.reason}
            error={reasonBad ? E.reason : undefined}
            onChange={(event) => onChange({ reason: event.target.value })}
          />
        </div>
        {refusal ? <ErrorLine>{E[refusal]}</ErrorLine> : null}
        {error ? <ErrorLine>{error}</ErrorLine> : null}
      </div>
    );
    footer = (
      <>
        <Button variant="secondary" onClick={onClose}>
          {RR.back}
        </Button>
        <Button disabled={!valid || busy} onClick={onReview}>
          {RR.review}
        </Button>
      </>
    );
  } else {
    const lines: string[] = [];
    if (preview && amountFils !== null && refusal === null) {
      lines.push(fillCopy(L.record.line, { amount: aedIn(amountFils), date: dayIn(values.date), reference: values.reference.trim() }));
      if (reasonGiven) lines.push(fillCopy(L.reasonLine, { reason: values.reason.trim() }));
      lines.push(fillCopy(RR.stays, { status: copy.statuses[preview.statusAfter] }));
      lines.push(fillCopy(L.record.money, { paid: aedIn(b.money.paid_fils), refunded: aedIn(preview.refundedAfterFils), net: aedIn(preview.netPaidAfterFils) }));
      lines.push(fillCopy(L.record.stillDue, { amount: aedIn(b.flags.still_due_fils) }));
      if (preview.overpaidAfter) lines.push(L.record.overpaid);
      if (preview.attentionCleared) lines.push(copy.void.cleared);
      lines.push(L.record.guest, L.record.noMoney);
    }
    body = (
      <div className="flex flex-col gap-4">
        <Sentences lines={lines} />
        {error ? <ErrorLine>{error}</ErrorLine> : null}
      </div>
    );
    footer = (
      <>
        <Button variant="secondary" disabled={busy} onClick={onBack}>
          {RR.back}
        </Button>
        <Button busy={busy} disabled={refusal !== null} onClick={onConfirm}>
          {copy.actions.recordRefund}
        </Button>
      </>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={copy.actions.recordRefund}
      closeLabel={closeLabel}
      dismiss="confirm"
      size="wide"
      footer={footer}
    >
      {body}
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------------------------
// Void a refund record
// ------------------------------------------------------------------------------------------------------------

export function VoidRefundDialog({
  open,
  locale,
  copy,
  closeLabel,
  booking,
  refund,
  reason,
  busy,
  error,
  onReason,
  onConfirm,
  onClose,
}: {
  open: boolean;
  locale: OpsBookingsLocale;
  copy: OpsBookingsCopy;
  closeLabel: string;
  booking: OwnerDetail;
  refund: OwnerRefund | null;
  reason: string;
  busy: boolean;
  error: string | null;
  onReason: (text: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const L = OPS_REFUNDS_COPY[locale];
  const E = copy.errors;
  const reasonLength = Array.from(reason.trim()).length;
  const reasonBad = reason !== "" && (reasonLength < 3 || reasonLength > REASON_MAX);
  const canConfirm = refund !== null && canVoidRefund(refund) && reasonLength >= 3 && reasonLength <= REASON_MAX && !busy;
  const after = refund ? Math.max(0, booking.money.refunded_fils - refund.amount_fils) : 0;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={L.void.title}
      closeLabel={closeLabel}
      dismiss="confirm"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {copy.actions.back}
          </Button>
          <Button variant="danger" busy={busy} disabled={!canConfirm} onClick={onConfirm}>
            {copy.actions.void}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {refund ? (
          <p className="m-0 flex flex-wrap justify-between gap-2 text-body text-ink">
            <span>
              {dayIn(refund.refunded_on)}
              {refund.bank_reference ? ` · ${refund.bank_reference}` : ""}
            </span>
            <span>{aedIn(refund.amount_fils)}</span>
          </p>
        ) : null}
        <Field
          id="void-refund-reason"
          label={copy.void.reason}
          type="text"
          autoComplete="off"
          required
          className="max-w-none"
          value={reason}
          error={reasonBad ? E.reason : undefined}
          onChange={(event) => onReason(event.target.value)}
        />
        <Sentences lines={[fillCopy(L.void.money, { refunded: aedIn(after) }), L.void.guest]} />
        <p className="m-0 text-label text-muted">{L.void.line}</p>
        {error ? <ErrorLine>{error}</ErrorLine> : null}
      </div>
    </Dialog>
  );
}
