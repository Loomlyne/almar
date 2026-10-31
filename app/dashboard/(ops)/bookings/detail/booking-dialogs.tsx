"use client";

import type { ReactNode } from "react";
import { Button } from "../../../../../components/ui/button";
import { Checkbox } from "../../../../../components/ui/checkbox";
import { ConfirmDialog } from "../../../../../components/ui/confirm-dialog";
import { Dialog } from "../../../../../components/ui/dialog";
import { Field } from "../../../../../components/ui/field";
import { fillCopy } from "../../../../../lib/copy/ops-kit";
import type { OpsBookingsCopy } from "../../../../../lib/copy/ops-bookings";
import {
  canAcceptShort,
  dubaiDayOf,
  parseAedAmount,
  settlePreview,
  voidPreview,
  type OwnerDetail,
  type OwnerPayment,
  type StatusAction,
} from "../../../../../lib/ops/booking-rules";
import { aedIn, dayIn, timeIn } from "../bookings-text";

// Plan 04-09 Task 2: the owner's dialogs on a booking (signed 2026-10-25, all option A). Props in, callbacks out: no
// fetch, no router, no clock (`today` is a prop). Every dialog is a confirm: Escape and the scrim do not close it, and
// `busy` turns its confirm off. Sentences come from the pure previews in lib/ops/booking-rules.ts; the SQL decides.

export function ErrorLine({ children }: { children: ReactNode }) {
  return (
    <p className="m-0 flex items-center gap-1 text-label text-error" role="alert">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
        <path d="M12 3l10 18H2z" />
        <path d="M12 10v5M12 17.5v.5" />
      </svg>
      {children}
    </p>
  );
}

export function Sentences({ lines }: { lines: string[] }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0 text-body text-ink">
      {lines.map((line, at) => (
        <li key={at}>{line}</li>
      ))}
    </ul>
  );
}

// ------------------------------------------------------------------------------------------------------------
// Record payment
// ------------------------------------------------------------------------------------------------------------

export type RecordValues = { amount: string; date: string; reference: string; acceptShort: boolean; reason: string };
export type RecordErrors = Partial<Record<"amount" | "date" | "reference" | "reason", boolean>>;

const REFERENCE_MAX = 100;

export function reasonOk(text: string, max: number): boolean {
  const length = Array.from(text.trim()).length;
  return length >= 3 && length <= max;
}

export function RecordPaymentDialog({
  open,
  copy,
  closeLabel,
  booking,
  today,
  values,
  step,
  errors,
  busy,
  error,
  onChange,
  onReview,
  onBack,
  onConfirm,
  onClose,
}: {
  open: boolean;
  copy: OpsBookingsCopy;
  closeLabel: string;
  booking: OwnerDetail;
  /** Today in Dubai, YYYY-MM-DD. */
  today: string;
  values: RecordValues;
  step: "form" | "review";
  errors: RecordErrors;
  busy: boolean;
  /** The last refusal or failure sentence, or null. */
  error: string | null;
  onChange: (patch: Partial<RecordValues>) => void;
  onReview: () => void;
  onBack: () => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const R = copy.record;
  const E = copy.errors;
  const D = copy.detail;
  const b = booking;
  const first = dubaiDayOf(b.created_at);
  const amountFils = parseAedAmount(values.amount);

  const base = {
    status: b.status,
    plan: b.plan,
    grandFils: b.money.grand_fils,
    depositFils: b.money.deposit_fils,
    paidFils: b.money.paid_fils,
    writtenOffFils: b.money.written_off_fils,
    refundedFils: b.money.refunded_fils,
    attentionReason: b.flags.attention_reason,
  };
  const gap = amountFils === null ? null : settlePreview({ ...base, amountFils, acceptShort: false }).gapFils;
  const showAccept = canAcceptShort(b.status) && gap !== null && gap > 0;
  const accept = showAccept && values.acceptShort;
  const preview = amountFils === null ? null : settlePreview({ ...base, amountFils, acceptShort: accept });

  const amountBad = errors.amount === true || (values.amount.trim() !== "" && amountFils === null);
  const dateOk = values.date !== "" && values.date >= first && values.date <= today;
  const dateBad = errors.date === true || (values.date !== "" && !dateOk);
  const referenceLength = Array.from(values.reference.trim()).length;
  const referenceBad = errors.reference === true || referenceLength > REFERENCE_MAX;
  const reasonBad = accept && (errors.reason === true || (values.reason !== "" && !reasonOk(values.reason, 300)));
  const refusal = preview?.refusal ?? null;
  const valid =
    amountFils !== null &&
    dateOk &&
    referenceLength >= 1 &&
    !referenceBad &&
    (!accept || reasonOk(values.reason, 300)) &&
    refusal === null &&
    !errors.amount &&
    !errors.date &&
    !errors.reference &&
    !errors.reason;

  let body: ReactNode;
  let footer: ReactNode;
  if (step === "form") {
    body = (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 md:grid-cols-2">
          <Field
            id="record-amount"
            label={R.amount}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            required
            className="max-w-none"
            value={values.amount}
            hint={fillCopy(R.amountDueHint, { hint: R.amountHint, label: D.dueNow, amount: aedIn(b.flags.due_now_fils) })}
            error={amountBad ? E.amount : undefined}
            onChange={(event) => onChange({ amount: event.target.value })}
          />
          <Field
            id="record-date"
            label={R.receivedOn}
            type="date"
            required
            className="max-w-none"
            min={first}
            max={today}
            value={values.date}
            error={dateBad ? fillCopy(E.date, { first: dayIn(first) }) : undefined}
            onChange={(event) => onChange({ date: event.target.value })}
          />
          <Field
            id="record-reference"
            label={R.bankReference}
            type="text"
            autoComplete="off"
            required
            className="max-w-none"
            value={values.reference}
            error={referenceBad ? E.reference : undefined}
            onChange={(event) => onChange({ reference: event.target.value })}
          />
        </div>
        {showAccept ? (
          <div className="flex flex-col gap-2">
            <Checkbox label={R.acceptShort} checked={values.acceptShort} onChange={(event) => onChange({ acceptShort: event.target.checked })} />
            {values.acceptShort ? (
              <Field
                id="record-reason"
                label={R.acceptReason}
                type="text"
                autoComplete="off"
                required
                className="max-w-none"
                value={values.reason}
                error={reasonBad ? E.reason : undefined}
                onChange={(event) => onChange({ reason: event.target.value })}
              />
            ) : null}
          </div>
        ) : null}
        {refusal ? <ErrorLine>{E[refusal]}</ErrorLine> : null}
        {error ? <ErrorLine>{error}</ErrorLine> : null}
      </div>
    );
    footer = (
      <>
        <Button variant="secondary" onClick={onClose}>
          {R.back}
        </Button>
        <Button disabled={!valid || busy} onClick={onReview}>
          {R.review}
        </Button>
      </>
    );
  } else {
    const lines: string[] = [];
    if (preview && amountFils !== null) {
      const statusWord = copy.statuses[preview.statusAfter];
      lines.push(fillCopy(R.line, { amount: aedIn(amountFils), date: dayIn(values.date), reference: values.reference.trim() }));
      lines.push(fillCopy(preview.statusAfter !== b.status ? R.becomes : R.stays, { status: statusWord }));
      if (preview.partReceived && b.deadline) {
        lines.push(fillCopy(R.partReceived, { due: aedIn(preview.depositLeftFils), deadline: timeIn(b.deadline, D.uaeTime) }), R.partPaidHeld);
      }
      if (preview.writeOffFils > 0) lines.push(fillCopy(R.writeOff, { gap: aedIn(preview.writeOffFils), reason: values.reason.trim() }));
      if (preview.overpaidFils > 0) lines.push(fillCopy(R.overpaid, { extra: aedIn(preview.overpaidFils) }));
      if (b.status === "expired" || b.status === "cancelled") lines.push(fillCopy(R.deadBooking, { status: copy.statuses[b.status] }));
      if (preview.nightsKept && b.status === "awaiting_payment" && !preview.partReceived) lines.push(R.nightsKept);
      if (preview.attentionCleared) lines.push(R.clearsFlag);
      lines.push(R.receipt);
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
          {R.back}
        </Button>
        <Button busy={busy} onClick={onConfirm}>
          {R.record}
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
      title={R.title}
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
// Void a payment
// ------------------------------------------------------------------------------------------------------------

export function VoidPaymentDialog({
  open,
  copy,
  closeLabel,
  booking,
  payment,
  reason,
  busy,
  error,
  onReason,
  onConfirm,
  onClose,
}: {
  open: boolean;
  copy: OpsBookingsCopy;
  closeLabel: string;
  booking: OwnerDetail;
  payment: OwnerPayment | null;
  reason: string;
  busy: boolean;
  error: string | null;
  onReason: (text: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const V = copy.void;
  const E = copy.errors;
  const b = booking;
  const preview = payment
    ? voidPreview({
        status: b.status,
        plan: b.plan,
        grandFils: b.money.grand_fils,
        depositFils: b.money.deposit_fils,
        depositBp: b.money.deposit_bp,
        paidFils: b.money.paid_fils,
        writtenOffFils: b.money.written_off_fils,
        refundedFils: b.money.refunded_fils,
        attentionReason: b.flags.attention_reason,
        payment: { amountFils: payment.amount_fils, writeOffFils: payment.write_off_fils },
      })
    : null;

  const lines: string[] = [];
  if (preview && !preview.refusal) {
    lines.push(fillCopy(preview.statusAfter !== b.status ? V.becomes : V.stays, { status: copy.statuses[preview.statusAfter] }));
    const deadline = b.deadline ? timeIn(b.deadline, copy.detail.uaeTime) : "";
    if (preview.deadline === "fresh") lines.push(V.fresh);
    if (preview.deadline === "later_of") lines.push(fillCopy(V.laterOf, { deadline }));
    if (preview.deadline === "unchanged" && b.deadline) lines.push(fillCopy(V.unchanged, { deadline }));
    if (preview.nights === "kept") lines.push(V.kept);
    if (preview.nights === "until_deadline") lines.push(V.untilDeadline);
    if (preview.attentionCleared) lines.push(V.cleared);
  }
  const reasonLength = Array.from(reason.trim()).length;
  const reasonBad = reason !== "" && (reasonLength < 3 || reasonLength > 300);
  const canConfirm = payment !== null && preview !== null && preview.refusal === null && reasonLength >= 3 && reasonLength <= 300 && !busy;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={V.title}
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
        {payment ? (
          <p className="m-0 flex flex-wrap justify-between gap-2 text-body text-ink">
            <span>
              {payment.received_on ? dayIn(payment.received_on) : ""}
              {payment.bank_reference ? ` · ${payment.bank_reference}` : ""}
            </span>
            <span>{aedIn(payment.amount_fils)}</span>
          </p>
        ) : null}
        <Field
          id="void-reason"
          label={V.reason}
          type="text"
          autoComplete="off"
          required
          className="max-w-none"
          value={reason}
          error={reasonBad ? E.reason : undefined}
          onChange={(event) => onReason(event.target.value)}
        />
        {preview?.refusal ? <ErrorLine>{preview.refusal === "refund_first" ? E.refund_first : E.cancel_first}</ErrorLine> : <Sentences lines={lines} />}
        <p className="m-0 text-label text-muted">{V.line}</p>
        {error ? <ErrorLine>{error}</ErrorLine> : null}
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------------------------
// Confirm, Mark completed and Cancel
// ------------------------------------------------------------------------------------------------------------

export function StatusDialog({
  action,
  copy,
  closeLabel,
  booking,
  busy,
  error,
  onConfirm,
  onClose,
}: {
  /** The action being asked about, or null when no dialog is open. */
  action: StatusAction | null;
  copy: OpsBookingsCopy;
  closeLabel: string;
  booking: OwnerDetail;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const S = copy.status;
  const A = copy.actions;
  if (action === null) return null;

  if (action === "cancel") {
    const spec = booking.money.paid_fils > 0 ? S.cancelPaid : S.cancel;
    return (
      <ConfirmDialog
        open
        onOpenChange={(next) => {
          if (!next) onClose();
        }}
        title={spec.title}
        description={
          <>
            {fillCopy(spec.body, { paid: aedIn(booking.money.paid_fils) })}
            {error ? <span className="mt-2 block text-error">{error}</span> : null}
          </>
        }
        confirmLabel={A.cancel}
        cancelLabel={A.keep}
        busy={busy}
        onConfirm={() => {
          if (!busy) onConfirm();
        }}
      />
    );
  }

  const spec = action === "confirm" ? S.confirm : S.complete;
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={spec.title}
      closeLabel={closeLabel}
      dismiss="confirm"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {A.back}
          </Button>
          <Button busy={busy} onClick={onConfirm}>
            {action === "confirm" ? A.confirm : A.complete}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-body text-ink">{spec.body}</p>
        {error ? <ErrorLine>{error}</ErrorLine> : null}
      </div>
    </Dialog>
  );
}

// ------------------------------------------------------------------------------------------------------------
// Resolve Needs attention
// ------------------------------------------------------------------------------------------------------------

export function ResolveAttentionDialog({
  open,
  copy,
  closeLabel,
  note,
  busy,
  error,
  onNote,
  onConfirm,
  onClose,
}: {
  open: boolean;
  copy: OpsBookingsCopy;
  closeLabel: string;
  note: string;
  busy: boolean;
  error: string | null;
  onNote: (text: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const T = copy.attention;
  const length = Array.from(note.trim()).length;
  const bad = note !== "" && (length < 3 || length > 500);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={T.title}
      closeLabel={closeLabel}
      dismiss="confirm"
      footer={
        <>
          <Button variant="secondary" disabled={busy} onClick={onClose}>
            {copy.actions.back}
          </Button>
          <Button busy={busy} disabled={length < 3 || length > 500} onClick={onConfirm}>
            {T.resolve}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="m-0 text-body text-ink">{T.body}</p>
        <Field
          id="resolve-note"
          multiline
          label={T.note}
          required
          className="max-w-none"
          value={note}
          error={bad ? copy.errors.attentionNote : undefined}
          onChange={(event) => onNote(event.target.value)}
        />
        {error ? <ErrorLine>{error}</ErrorLine> : null}
      </div>
    </Dialog>
  );
}
