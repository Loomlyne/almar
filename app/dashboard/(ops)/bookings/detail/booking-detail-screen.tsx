"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { opsFetch, opsSend, type OpsError } from "../../../../../components/ops/ops-client";
import { useDashboardLocale } from "../../../../../components/ops/use-dashboard-locale";
import { Button } from "../../../../../components/ui/button";
import { DASHBOARD_COPY } from "../../../../../lib/copy/dashboard";
import { OPS_BOOKINGS_COPY } from "../../../../../lib/copy/ops-bookings";
import { OPS_KIT_COPY } from "../../../../../lib/copy/ops-kit";
import { isBookingRef } from "../../../../../lib/booking/ref";
import { dubaiToday } from "../../../../../lib/money/dates";
import {
  aedText,
  canAcceptShort,
  parseAedAmount,
  settlePreview,
  type OwnerDetail,
  type OwnerPayment,
  type OwnerRefund,
  type StatusAction,
} from "../../../../../lib/ops/booking-rules";
import { bookingError } from "../bookings-errors";
import { BookingDetail } from "./booking-detail";
import { RecordPaymentDialog, ResolveAttentionDialog, StatusDialog, VoidPaymentDialog, type RecordValues } from "./booking-dialogs";
import type { RefundValues } from "./booking-refunds";

// Plan 05-03: the two refund dialogs load in the browser only, and only while one is open (Worker size). The type import
// above is erased; nothing else of the chunk is imported here.
const RecordRefundDialog = dynamic(() => import("./booking-refunds").then((m) => m.RecordRefundDialog), { ssr: false });
const VoidRefundDialog = dynamic(() => import("./booking-refunds").then((m) => m.VoidRefundDialog), { ssr: false });

// Plan 04-09 Task 7: one booking for the owner. This file owns the data and the writes: the reference (read once from
// the URL, the only value ever in it), the detail from /api/ops/booking, the dialogs' values, one request_id per Record
// (made when the dialog opens, kept across retries of that dialog) and per Resend (made on the first click for that mail,
// kept across retries until a 2xx, then dropped so the next click is a new send), and the six POSTs. After any 2xx write
// the detail is read again. BookingDetail and the dialogs draw; nothing here draws a field.

type Dialog =
  | { kind: "record" }
  | { kind: "void"; payment: OwnerPayment }
  | { kind: "refund" }
  | { kind: "voidRefund"; refund: OwnerRefund }
  | { kind: "status"; action: StatusAction }
  | { kind: "resolve" };

type MailAnswer = "sent" | "pending" | "failed" | "unknown" | "skipped";
type MailCopyKey = "sent" | "pending" | "failed";

/** An answer that tells the owner the booking he was looking at is not the one on the server. */
const RELOAD_CODES = new Set(["changed", "not_allowed", "not_found"]);

/** Refund answers that say the numbers on screen are old: the dialog stays open with its sentence and the booking is read again. */
const REFRESH_CODES = new Set(["above_paid", "nothing_to_refund", "refund_first"]);

const NO_RECORD: RecordValues = { amount: "", date: "", reference: "", acceptShort: false, reason: "" };
const NO_REFUND: RefundValues = { amount: "", date: "", reference: "", reason: "" };

export function BookingDetailScreen() {
  const locale = useDashboardLocale();
  const copy = OPS_BOOKINGS_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const closeLabel = DASHBOARD_COPY[locale].close;
  const router = useRouter();

  const [ref, setRef] = useState<string | null | undefined>(undefined);
  const [booking, setBooking] = useState<OwnerDetail | null>(null);
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [busy, setBusy] = useState(false);

  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const [values, setValues] = useState<RecordValues>(NO_RECORD);
  const [refundValues, setRefundValues] = useState<RefundValues>(NO_REFUND);
  const [step, setStep] = useState<"form" | "review">("form");
  const [reason, setReason] = useState("");
  const [resolveNote, setResolveNote] = useState("");

  const inFlight = useRef(false);
  const requestId = useRef("");
  // One request_id per Resend target ("request", "receipt:<payment id>" or "refund:<refund id>"), reused by a retry after a failed or timed-out
  // call so the server's mail key (resend/<booking_id>/<request_id>) sends it once; dropped after a 2xx.
  const resendIds = useRef(new Map<string, string>());
  // The note composer's request_id and the text it was sent with: a retry of the same text reuses it (the server answers
  // the stored note, first_time false, instead of a second row); a 2xx drops it, so the next note is a new one. A text
  // edited after a failure is a new note and gets a new id (one id is never sent with two texts: that would be changed).
  const noteRequest = useRef<{ id: string; body: string } | null>(null);
  const latest = useRef(0);
  const words = useRef({ copy, kit });
  words.current = { copy, kit };

  // The reference is read once: upper-cased, and refused before any request when it is not a reference.
  useEffect(() => {
    const raw = new URLSearchParams(window.location.search).get("ref") ?? "";
    const upper = raw.trim().toUpperCase();
    setRef(isBookingRef(upper) ? upper : null);
  }, []);

  useEffect(() => {
    if (!ref) return;
    const ticket = (latest.current += 1);
    void opsFetch<{ booking: OwnerDetail }>("/api/ops/booking", { ref }).then((reply) => {
      if (ticket !== latest.current) return;
      setLoading(false);
      if (!reply.ok) {
        setLoadError(bookingError(words.current.copy, words.current.kit, reply.error, words.current.copy.errors.loadFailed));
        return;
      }
      setLoadError(null);
      setBooking(reply.booking);
    });
  }, [ref, reload]);

  const say = (e: OpsError) => bookingError(copy, kit, e, copy.errors.saveFailed);

  function closeDialog() {
    if (inFlight.current) return;
    setDialog(null);
    setDialogError(null);
  }

  /**
   * One write. A second call while one is in flight does nothing (a double click posts once). Returns the reply's body on
   * success and null on failure, after saying why in the dialog when one is open, else on the page.
   */
  async function write<T>(path: `/api/ops/${string}`, body: unknown, inDialog: boolean, speak: (e: OpsError) => string = say): Promise<T | null> {
    if (inFlight.current) return null;
    inFlight.current = true;
    setBusy(true);
    setNotice(null);
    setError(null);
    setDialogError(null);
    try {
      const reply = await opsSend<T>(path, body);
      if (!reply.ok) {
        const sentence = speak(reply.error);
        if (RELOAD_CODES.has(reply.error.code)) {
          // The booking on screen is out of date: close, say so, read it again.
          setDialog(null);
          setError(sentence);
          setReload((n) => n + 1);
        } else if (REFRESH_CODES.has(reply.error.code)) {
          // The numbers behind the dialog are old: keep it open with the sentence and read the booking again.
          setDialogError(sentence);
          setReload((n) => n + 1);
        } else if (inDialog) setDialogError(sentence);
        else setError(sentence);
        return null;
      }
      setDialog(null);
      setReload((n) => n + 1);
      return reply as unknown as T;
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  if (ref === undefined) return null;
  if (ref === null) {
    return (
      <div data-booking-detail-missing className="flex flex-col items-start gap-4">
        <Button variant="ghost" className="px-0" onClick={() => router.push("/dashboard/bookings")}>
          {copy.detail.back}
        </Button>
        <p className="m-0 text-body text-ink" role="alert">
          {copy.errors.not_found}
        </p>
      </div>
    );
  }
  if (!booking) {
    return loading ? (
      <p className="m-0 text-body text-muted" role="status">
        {copy.list.loading}
      </p>
    ) : (
      <div className="flex flex-col items-start gap-4">
        <Button variant="ghost" className="px-0" onClick={() => router.push("/dashboard/bookings")}>
          {copy.detail.back}
        </Button>
        <p className="m-0 text-body text-ink" role="alert">
          {loadError}
        </p>
      </div>
    );
  }

  const b = booking;
  const mailWord = (state: MailAnswer | undefined): string => copy.payments.receipt[state === "sent" || state === "pending" || state === "failed" || state === "unknown" ? state : "none"];

  const refundMailWord = (state: MailAnswer | undefined): string => copy.payments.refundMail[state === "sent" || state === "pending" || state === "failed" || state === "unknown" ? state : "none"];

  function openRecord() {
    requestId.current = crypto.randomUUID();
    setToday(dubaiToday(new Date()));
    setValues({ ...NO_RECORD, date: dubaiToday(new Date()), amount: b.flags.due_now_fils > 0 ? aedText(b.flags.due_now_fils) : "" });
    setStep("form");
    setDialogError(null);
    setDialog({ kind: "record" });
  }

  // The refund writes say their own refusals; everything else is the page's sentence.
  const sayRefund = (e: OpsError): string => {
    if (e.code === "not_voidable") return copy.errors.refund_not_voidable;
    if (e.code === "invalid" && e.field === "amount") return copy.errors.refund_amount;
    if (e.code === "invalid" && e.field === "refunded_on") return copy.errors.refund_date;
    return say(e);
  };

  function openRefund() {
    requestId.current = crypto.randomUUID();
    const day = dubaiToday(new Date());
    setToday(day);
    setRefundValues({ ...NO_REFUND, date: day });
    setStep("form");
    setDialogError(null);
    setDialog({ kind: "refund" });
  }

  async function confirmRefund() {
    const reply = await write<{ mail?: MailAnswer }>(
      "/api/ops/booking/refund",
      {
        booking_id: b.id,
        request_id: requestId.current,
        amount: refundValues.amount.trim(),
        refunded_on: refundValues.date,
        bank_reference: refundValues.reference.trim(),
        reason: refundValues.reason.trim() === "" ? null : refundValues.reason.trim(),
      },
      true,
      sayRefund,
    );
    if (reply) setNotice(`${copy.payments.refundRecorded} ${refundMailWord(reply.mail)}`);
  }

  async function confirmVoidRefund(refund: OwnerRefund) {
    const reply = await write("/api/ops/booking/refund-void", { refund_id: refund.id, reason: reason.trim() }, true, sayRefund);
    if (reply) setNotice(copy.payments.refundVoided);
  }

  async function confirmRecord() {
    const amount = values.amount.trim();
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
    // Accept as paid is sent only while the dialog still offers it: the amount is short and the status allows it.
    const fils = parseAedAmount(amount);
    const short = fils !== null && canAcceptShort(b.status) && settlePreview({ ...base, amountFils: fils, acceptShort: false }).gapFils > 0;
    const accept = short && values.acceptShort;
    const reply = await write<{ mail?: { receipt?: MailAnswer } }>(
      "/api/ops/booking/payment",
      {
        booking_id: b.id,
        request_id: requestId.current,
        expected_status: b.status,
        amount,
        received_on: values.date,
        bank_reference: values.reference.trim(),
        ...(accept ? { accept_short: true, accept_reason: values.reason.trim() } : {}),
      },
      true,
    );
    if (reply) setNotice(`${copy.record.recorded} ${mailWord(reply.mail?.receipt)}`);
  }

  async function confirmVoid(payment: OwnerPayment) {
    const reply = await write("/api/ops/booking/void", { payment_id: payment.id, reason: reason.trim() }, true);
    if (reply) setNotice(copy.void.voided);
  }

  async function confirmStatus(action: StatusAction) {
    const reply = await write("/api/ops/booking/status", { booking_id: b.id, action, expected_status: b.status }, true);
    if (reply) setNotice(copy.status.changed);
  }

  async function confirmResolve() {
    const reply = await write("/api/ops/booking/attention", { booking_id: b.id, note: resolveNote.trim() }, true);
    if (reply) setNotice(copy.attention.resolved);
  }

  // One request_id per open note composer (noteRequest), reused by a retry after a failed or timed-out call, so a note
  // that did land is answered again rather than added twice. Also: one call in flight (write), Add note off while busy,
  // the draft kept until a 2xx, and the booking read again after a failure so a note that landed shows in the list.
  async function addNote() {
    if (inFlight.current) return;
    const body = noteDraft.trim();
    const kept = noteRequest.current;
    const request = kept && kept.body === body ? kept : { id: crypto.randomUUID(), body };
    noteRequest.current = request;
    const reply = await write("/api/ops/booking/note", { booking_id: b.id, body, request_id: request.id }, false);
    if (reply) {
      noteRequest.current = null;
      setNoteDraft("");
      setNotice(copy.notes.added);
    } else setReload((n) => n + 1);
  }

  async function resend(body: { kind: "receipt"; payment_id: string } | { kind: "request" } | { kind: "refund"; refund_id: number }) {
    if (inFlight.current) return;
    const key = body.kind === "receipt" ? `receipt:${body.payment_id}` : body.kind === "refund" ? `refund:${body.refund_id}` : "request";
    const id = resendIds.current.get(key) ?? crypto.randomUUID();
    resendIds.current.set(key, id);
    const reply = await write<{ mail?: MailAnswer }>("/api/ops/booking/resend", { ref: b.ref, ...body, request_id: id }, false);
    if (reply) {
      resendIds.current.delete(key);
      const state: MailCopyKey = reply.mail === "sent" || reply.mail === "pending" ? reply.mail : "failed";
      setNotice(copy.payments.resent[state]);
    }
  }

  return (
    <>
      <BookingDetail
        locale={locale}
        copy={copy}
        booking={b}
        busy={busy}
        notice={notice}
        error={error ?? loadError}
        noteDraft={noteDraft}
        onBack={() => router.push("/dashboard/bookings")}
        onNoteDraft={setNoteDraft}
        onAction={(action) => {
          setDialogError(null);
          setDialog({ kind: "status", action });
        }}
        onRecord={openRecord}
        onRecordRefund={openRefund}
        onVoid={(payment) => {
          setReason("");
          setDialogError(null);
          setDialog({ kind: "void", payment });
        }}
        onVoidRefund={(refund) => {
          setReason("");
          setDialogError(null);
          setDialog({ kind: "voidRefund", refund });
        }}
        onResendReceipt={(payment) => void resend({ kind: "receipt", payment_id: payment.id })}
        onResendRefund={(refund) => void resend({ kind: "refund", refund_id: refund.id })}
        onResendRequest={() => void resend({ kind: "request" })}
        onAddNote={() => void addNote()}
        onResolve={() => {
          setResolveNote("");
          setDialogError(null);
          setDialog({ kind: "resolve" });
        }}
      />
      <RecordPaymentDialog
        open={dialog?.kind === "record"}
        copy={copy}
        closeLabel={closeLabel}
        booking={b}
        today={today}
        values={values}
        step={step}
        errors={{}}
        busy={busy}
        error={dialogError}
        onChange={(patch) => setValues((old) => ({ ...old, ...patch }))}
        onReview={() => setStep("review")}
        onBack={() => setStep("form")}
        onConfirm={() => void confirmRecord()}
        onClose={closeDialog}
      />
      <VoidPaymentDialog
        open={dialog?.kind === "void"}
        copy={copy}
        closeLabel={closeLabel}
        booking={b}
        payment={dialog?.kind === "void" ? dialog.payment : null}
        reason={reason}
        busy={busy}
        error={dialogError}
        onReason={setReason}
        onConfirm={() => (dialog?.kind === "void" ? void confirmVoid(dialog.payment) : undefined)}
        onClose={closeDialog}
      />
      {dialog?.kind === "refund" ? (
        <RecordRefundDialog
          open
          locale={locale}
          copy={copy}
          closeLabel={closeLabel}
          booking={b}
          today={today}
          values={refundValues}
          step={step}
          busy={busy}
          error={dialogError}
          onChange={(patch) => setRefundValues((old) => ({ ...old, ...patch }))}
          onReview={() => setStep("review")}
          onBack={() => setStep("form")}
          onConfirm={() => void confirmRefund()}
          onClose={closeDialog}
        />
      ) : null}
      {dialog?.kind === "voidRefund" ? (
        <VoidRefundDialog
          open
          locale={locale}
          copy={copy}
          closeLabel={closeLabel}
          booking={b}
          refund={dialog.refund}
          reason={reason}
          busy={busy}
          error={dialogError}
          onReason={setReason}
          onConfirm={() => void confirmVoidRefund(dialog.refund)}
          onClose={closeDialog}
        />
      ) : null}
      <StatusDialog
        action={dialog?.kind === "status" ? dialog.action : null}
        copy={copy}
        closeLabel={closeLabel}
        booking={b}
        busy={busy}
        error={dialogError}
        onConfirm={() => (dialog?.kind === "status" ? void confirmStatus(dialog.action) : undefined)}
        onClose={closeDialog}
      />
      <ResolveAttentionDialog
        open={dialog?.kind === "resolve"}
        copy={copy}
        closeLabel={closeLabel}
        note={resolveNote}
        busy={busy}
        error={dialogError}
        onNote={setResolveNote}
        onConfirm={() => void confirmResolve()}
        onClose={closeDialog}
      />
    </>
  );
}
