// The email seam (plan 04-08, section F). Every booking mail goes through a BookingNotifier, and every delivery is
// written to the booking's events by deliverMail. Today getNotifier() returns NOT_READY_NOTIFIER: nothing is sent,
// each delivery is logged `email_pending`, and production requests stay closed (the request gate needs a ready
// sender, P-13). 04-05 changes only the body of getNotifier() to return its own notifier, which decides `ready`
// itself from its key; this file reads no environment and logs nothing to the console.
//
// A mail outcome never changes an answer: a sender that is not ready, refuses or throws is an event, never an error.
// The error stored is a short name (`not_ready`, `no_key`, `http_429`, `threw`), never a message, an address or a
// payload.
import type { BookingDb } from "./server";
import type { BookingStatus, BookingView } from "./types";

/** The six booking mails. `request_withdrawn_owner` is the owner's notice of a guest's withdraw (P-19). */
export type MailTemplate =
  | "request_received"
  | "request_owner"
  | "payment_receipt"
  | "payment_owner"
  | "request_lapsed"
  | "request_withdrawn_owner";

/** What a send answers. `error` is a short name, never a message, an address or a payload. */
export type MailOutcome = { ok: true } | { ok: false; error: string };

/** What happened to one mail: sent, pending (the sender is not ready) or failed. */
export type MailDelivery = "sent" | "pending" | "failed";

/** The request mails (guest and owner) and the withdraw notice. The withdraw notice's link carries no token. */
export type RequestMailJob = { bookingId: string; view: BookingView; isTest: boolean; bookingUrl: string };

/** The receipt and the owner's payment notice; 04-09 builds it after ops_record_payment (a null view means no mail). */
export type PaymentMailJob = {
  bookingId: string;
  paymentId: string;
  view: BookingView;
  isTest: boolean;
  bookingUrl: string | null;
  amountFils: number;
  receivedOn: string;
  statusBefore: BookingStatus;
  statusAfter: BookingStatus;
  attentionReason: string | null;
  recordedByEmail: string | null;
};

/** The lapse mail: it links to the stay page, so the cron needs no link secret. */
export type LapseMailJob = {
  bookingId: string;
  ref: string;
  email: string;
  guestName: string;
  locale: string;
  isTest: boolean;
  staySlug: string;
  stayTitle: string;
  arrive: string;
  leave: string;
  deadline: string;
};

export type MailOptions = { idempotencyKey: string };

export type BookingNotifier = {
  readonly ready: boolean;
  requestReceived(job: RequestMailJob, opts: MailOptions): Promise<MailOutcome>;
  ownerRequest(job: RequestMailJob, opts: MailOptions): Promise<MailOutcome>;
  paymentReceipt(job: PaymentMailJob, opts: MailOptions): Promise<MailOutcome>;
  ownerPayment(job: PaymentMailJob, opts: MailOptions): Promise<MailOutcome>;
  requestLapsed(job: LapseMailJob, opts: MailOptions): Promise<MailOutcome>;
  ownerWithdrawn(job: RequestMailJob, opts: MailOptions): Promise<MailOutcome>;
};

/** The notifier's mail kinds, the names mailKey takes. */
export type MailKind = Exclude<keyof BookingNotifier, "ready">;

const notReady = async (): Promise<MailOutcome> => ({ ok: false, error: "not_ready" });

/** The default until 04-05: not ready, every method answers `{ ok: false, error: "not_ready" }`, nothing is sent. */
export const NOT_READY_NOTIFIER: BookingNotifier = Object.freeze({
  ready: false,
  requestReceived: notReady,
  ownerRequest: notReady,
  paymentReceipt: notReady,
  ownerPayment: notReady,
  requestLapsed: notReady,
  ownerWithdrawn: notReady,
});

/** The notifier of this Worker. 04-05 changes only this body (its Resend notifier; that flip opens production, P-13). */
export function getNotifier(): BookingNotifier {
  // TODO(04-05 flip, once the six renderers land after the owner's signature): return the live notifier of
  // lib/email/booking-notifier.ts when it is not null (RESEND_API_KEY set), else NOT_READY_NOTIFIER, with its one import.
  return NOT_READY_NOTIFIER;
}

const KEY_PREFIX: Record<MailKind, string> = {
  requestReceived: "request",
  ownerRequest: "request-owner",
  paymentReceipt: "receipt",
  ownerPayment: "payment-owner",
  requestLapsed: "lapse",
  ownerWithdrawn: "withdrawn-owner",
};

/**
 * The Resend idempotency key of a mail (kept 24 hours by Resend): `request/<bookingId>`, `request-owner/<bookingId>`,
 * `receipt/<paymentId>`, `payment-owner/<paymentId>`, `lapse/<bookingId>`, `withdrawn-owner/<bookingId>`. A resend from
 * the dashboard (04-09) uses its own key, `resend/<bookingId>/<requestId>`, with the same template.
 */
export function mailKey(kind: MailKind, id: string): string {
  return `${KEY_PREFIX[kind]}/${id}`;
}

const ERROR_NAME = /^[a-z0-9_]+$/;

/** A short error name of at most 60 characters of [a-z0-9_]; anything else (a message, an address) is `unknown`. */
function errorName(error: unknown): string {
  return typeof error === "string" && ERROR_NAME.test(error) ? error.slice(0, 60) : "unknown";
}

/** One event through log_booking_event. A failing log is swallowed: a mail's bookkeeping never fails an answer. */
async function logEvent(db: BookingDb, bookingId: string, action: string, detail: Record<string, string>): Promise<void> {
  try {
    await db.rpc("log_booking_event", { p_booking: bookingId, p_actor: "system", p_action: action, p_detail: detail });
  } catch {
    // Swallowed on purpose: the delivery's answer stands without its event.
  }
}

export type MailRequest = {
  bookingId: string;
  template: MailTemplate;
  idempotencyKey: string;
  ready: boolean;
  send: () => Promise<MailOutcome>;
};

/**
 * Sends one mail and writes what happened, with `key` = the idempotency key on every event (04-09 finds a mail's
 * state by `detail.key`): not ready -> `email_pending` { template, key } and "pending", send is never called; sent ->
 * `email_sent` { template, key } and "sent"; refused -> `email_failed` { template, key, error } and "failed"; a send
 * that throws -> `email_failed` with error `threw` and "failed". Never throws.
 */
export async function deliverMail(db: BookingDb, mail: MailRequest): Promise<MailDelivery> {
  const { bookingId, template, idempotencyKey: key } = mail;
  if (!mail.ready) {
    await logEvent(db, bookingId, "email_pending", { template, key });
    return "pending";
  }
  let outcome: unknown;
  try {
    outcome = await mail.send();
  } catch {
    await logEvent(db, bookingId, "email_failed", { template, key, error: "threw" });
    return "failed";
  }
  const answer = typeof outcome === "object" && outcome !== null ? (outcome as { ok?: unknown; error?: unknown }) : null;
  if (answer?.ok === true) {
    await logEvent(db, bookingId, "email_sent", { template, key });
    return "sent";
  }
  await logEvent(db, bookingId, "email_failed", { template, key, error: errorName(answer?.error) });
  return "failed";
}
