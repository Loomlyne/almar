// Plan 04-09 Task 5: the owner's booking endpoints (list, detail, record payment, void, status, note, attention, resend).
// No Next import and no Supabase import at runtime, so node tests call the handlers with a fake `rpc`; the route files
// under app/api/ops/booking* bind them through lib/ops/bookings.ts, after lib/ops/route.ts has run requireOwner(), the
// Origin check, the 64 KiB JSON read and the parse.
//
// Every write is ONE service-role RPC of 04-08's migration (20261019160000_booking_requests.sql) or 04-02's
// (ops_set_booking_status): never a table write from here. The RPCs check the owner again in SQL (p_actor). Their
// refusals (P0001 `almar:<code>`) are mapped here, in this file (F-08: route-core's mapDbError does not know them);
// anything else goes back as `{ dbError }` and route-core answers 503 unavailable with nothing from the database in it.
// Nothing here logs, and no reply ever sets affects_site (a booking never changes the public site).
//
// Mail goes through 04-08's seam only (deliverMail, mailKey): the guest receipt and the owner notice after a first
// recording, and a resend from the detail. A mail that is not ready, refused or throws is an event, never an error.
// The dashboard never sends the owner's withdraw notice (04-08 sends it from the guest's withdraw route).
import { deliverMail, mailKey, type BookingNotifier, type MailDelivery, type MailOutcome, type PaymentMailJob, type RequestMailJob } from "../booking/notify";
import { isBookingRef } from "../booking/ref";
import type { BookingStatus, BookingView } from "../booking/types";
import {
  BOOKING_STATUSES,
  canResendReceipt,
  canResendRequest,
  dubaiDayOf,
  listRpcArgs,
  parseAedAmount,
  parseListQuery,
  targetStatus,
  type OwnerDetail,
  type OwnerPayment,
  type StatusAction,
} from "./booking-rules";
import { errorBody, OpsInvalid, type DbError, type OpsOutcome, type OpsResult } from "./route-core";
import { bool, has, isoDay, onlyKeys, record, requiredText, uuid } from "./validate";

// ------------------------------------------------------------------------------------------------------------
// Types and dependencies
// ------------------------------------------------------------------------------------------------------------

/** A Supabase error as `rpc()` returns it (PostgrestError fits). */
export type OpsDbError = { code?: string; message?: string; details?: string | null; hint?: string };

/** What the handlers need of the service-role client: `rpc` only. */
export type OpsDb = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: OpsDbError | null }>;
};

/** What a handler needs of requireOwner()'s owner: the profile id (p_actor), the email (receipts) and the admin client. */
export type BookingsOwner = { profile: { id: string; email: string }; admin: OpsDb };

type Locale = "en" | "ar" | "es";

/** Injected so node tests run without the link secret, the mail sender or a database view. */
export type BookingsDeps = {
  notifier: () => BookingNotifier;
  view: (db: OpsDb, bookingId: string, opts: { isTest: boolean }) => Promise<BookingView | null>;
  /** The guest's signed booking page link, or null when the link cannot be signed. */
  bookingUrl: (b: { id: string; ref: string; locale: Locale; isTest: boolean; linkVersion: number }) => Promise<string | null>;
  linkReady: () => boolean;
};

type GetCtx = { owner: BookingsOwner; url: URL };
type PostCtx<B> = { owner: BookingsOwner; body: B };
type Row = Record<string, unknown>;

/** What a mail did: deliverMail's answer, or skipped when no mail was tried (a replay, no view). */
export type MailResult = MailDelivery | "skipped";

// ------------------------------------------------------------------------------------------------------------
// Replies and refusals
// ------------------------------------------------------------------------------------------------------------

function ok(body: Record<string, unknown>): OpsResult {
  return { body: { ok: true, ...body } };
}

function refused(status: number, code: string, field: string | null = null, detail: unknown = null): OpsResult {
  return { status, body: errorBody(code, field, null, detail) };
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** An answer the handler cannot read: 503 unavailable through route-core, with no database text. */
const UNREADABLE: { dbError: DbError } = { dbError: { code: "unreadable" } };

const PLAIN_FIELD = /^[a-z_]+(\.[a-z_]+)*$/;
const STATUSES: readonly string[] = BOOKING_STATUSES;

/** 409 refusals of 04-08's owner functions (and 04-02's ops_set_booking_status), passed on by their code. */
const CONFLICTS = new Set([
  "changed",
  "not_allowed",
  "not_requested",
  "not_applicable",
  "nothing_to_write_off",
  "not_voidable",
  "cancel_first",
  "window_missing",
  "nights_lost",
]);

function detailObject(details: string | null | undefined): Row | null {
  if (!details) return null;
  try {
    const value: unknown = JSON.parse(details);
    return isRow(value) ? value : null;
  } catch {
    return null;
  }
}

/**
 * A booking RPC's refusal in words the screens know (F-08): not_owner 403, not_found 404, invalid 400 with its field
 * (only a plain dotted name is copied), the conflicts 409 with their code (changed carries the status it found when
 * that is one of the eight). Anything else is `{ dbError }`: 503 unavailable through route-core. No database message
 * is ever copied.
 */
export function mapBookingRefusal(error: OpsDbError | null | undefined): OpsResult | { dbError: DbError } {
  const code = error?.code ?? "";
  const message = error?.message ?? "";
  if (code === "P0001" && message.startsWith("almar:")) {
    const name = message.slice("almar:".length);
    const detail = detailObject(error?.details);
    if (name === "not_owner") return refused(403, "not_owner");
    if (name === "not_found") return refused(404, "not_found");
    if (name === "invalid") {
      const field = typeof detail?.field === "string" && PLAIN_FIELD.test(detail.field) ? detail.field : null;
      return refused(400, "invalid", field);
    }
    if (name === "changed") {
      const status = typeof detail?.status === "string" && STATUSES.includes(detail.status) ? detail.status : null;
      return refused(409, "changed", null, status === null ? null : { status });
    }
    if (CONFLICTS.has(name)) return refused(409, name);
  }
  return { dbError: error ?? { code: "unknown" } };
}

// ------------------------------------------------------------------------------------------------------------
// Parsers (POST bodies; each throws OpsInvalid on the first bad field)
// ------------------------------------------------------------------------------------------------------------

function status(value: unknown, field: string): BookingStatus {
  if (typeof value !== "string" || !STATUSES.includes(value)) throw new OpsInvalid(field);
  return value as BookingStatus;
}

function chars(text: string): number {
  return [...text].length;
}

/** Trimmed text of `min`..`max` characters. */
function sized(value: unknown, field: string, min: number, max: number): string {
  const out = requiredText(value, field, { max });
  if (chars(out) < min) throw new OpsInvalid(field);
  return out;
}

function bookingRef(value: unknown, field = "ref"): string {
  const ref = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (!isBookingRef(ref)) throw new OpsInvalid(field);
  return ref;
}

export type PaymentBody = {
  booking_id: string;
  request_id: string;
  expected_status: BookingStatus;
  amount_fils: number;
  received_on: string;
  bank_reference: string;
  accept_short: boolean;
  accept_reason: string | null;
};

const PAYMENT_KEYS = ["booking_id", "request_id", "expected_status", "amount", "received_on", "bank_reference", "accept_short", "accept_reason"] as const;

/**
 * Record payment: the amount is the AED text the owner typed, read by parseAedAmount (the dialog's own parser, no
 * float); received_on a real day (the SQL refuses a day in the future or before the booking); the bank reference 1..100
 * characters; Accept as paid needs a reason of 3..300 characters, and a reason without it is refused.
 */
export function parsePayment(body: unknown): PaymentBody {
  const b = record(body, "body");
  onlyKeys(b, PAYMENT_KEYS);
  const booking_id = uuid(b.booking_id, "booking_id");
  const request_id = uuid(b.request_id, "request_id");
  const expected_status = status(b.expected_status, "expected_status");
  const amount_fils = typeof b.amount === "string" ? parseAedAmount(b.amount) : null;
  if (amount_fils === null) throw new OpsInvalid("amount");
  const received_on = isoDay(b.received_on, "received_on");
  const bank_reference = requiredText(b.bank_reference, "bank_reference", { max: 100 });
  const accept_short = has(b, "accept_short") && b.accept_short !== null ? bool(b.accept_short, "accept_short") : false;
  let accept_reason: string | null = null;
  if (accept_short) {
    accept_reason = sized(b.accept_reason, "accept_reason", 3, 300);
  } else if (b.accept_reason !== undefined && b.accept_reason !== null) {
    throw new OpsInvalid("accept_reason");
  }
  return { booking_id, request_id, expected_status, amount_fils, received_on, bank_reference, accept_short, accept_reason };
}

export type VoidBody = { payment_id: string; reason: string };

/** Void: the payment row and a reason of 3..300 characters. */
export function parseVoid(body: unknown): VoidBody {
  const b = record(body, "body");
  onlyKeys(b, ["payment_id", "reason"]);
  return { payment_id: uuid(b.payment_id, "payment_id"), reason: sized(b.reason, "reason", 3, 300) };
}

export type StatusBody = { booking_id: string; action: StatusAction; expected_status: BookingStatus };

const ACTIONS: readonly string[] = ["confirm", "complete", "cancel"];

/** Confirm, Mark completed or Cancel, with the status the screen showed (p_expected_from). */
export function parseStatus(body: unknown): StatusBody {
  const b = record(body, "body");
  onlyKeys(b, ["booking_id", "action", "expected_status"]);
  const booking_id = uuid(b.booking_id, "booking_id");
  if (typeof b.action !== "string" || !ACTIONS.includes(b.action)) throw new OpsInvalid("action");
  return { booking_id, action: b.action as StatusAction, expected_status: status(b.expected_status, "expected_status") };
}

export type NoteBody = { booking_id: string; body: string };

/** One internal note, trimmed, 1..2000 characters. */
export function parseNote(body: unknown): NoteBody {
  const b = record(body, "body");
  onlyKeys(b, ["booking_id", "body"]);
  return { booking_id: uuid(b.booking_id, "booking_id"), body: requiredText(b.body, "body", { max: 2000 }) };
}

export type AttentionBody = { booking_id: string; note: string };

/** Resolve attention: the owner's note, 3..500 characters. */
export function parseAttention(body: unknown): AttentionBody {
  const b = record(body, "body");
  onlyKeys(b, ["booking_id", "note"]);
  return { booking_id: uuid(b.booking_id, "booking_id"), note: sized(b.note, "note", 3, 500) };
}

export type ResendBody =
  | { ref: string; kind: "receipt"; payment_id: string; request_id: string }
  | { ref: string; kind: "request"; payment_id: null; request_id: string };

/**
 * Resend receipt (a payment row of the booking) or Resend request email (the bank details again). request_id is the
 * uuid the screen makes on the click: the mail's key is resend/<booking_id>/<request_id>.
 */
export function parseResend(body: unknown): ResendBody {
  const b = record(body, "body");
  onlyKeys(b, ["ref", "kind", "payment_id", "request_id"]);
  const ref = bookingRef(b.ref);
  if (b.kind !== "receipt" && b.kind !== "request") throw new OpsInvalid("kind");
  const request_id = uuid(b.request_id, "request_id");
  if (b.kind === "receipt") return { ref, kind: "receipt", payment_id: uuid(b.payment_id, "payment_id"), request_id };
  if (b.payment_id !== undefined && b.payment_id !== null) throw new OpsInvalid("payment_id");
  return { ref, kind: "request", payment_id: null, request_id };
}

// ------------------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------------------

/**
 * GET /api/ops/bookings: the query checked (parseListQuery), then ops_lapse_holds (an unpaid request past its deadline
 * lapses, a part-paid one is flagged), then one page of ops_list_bookings as the SQL orders it (Q-17).
 */
export async function listBookings({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const parsed = parseListQuery(url.searchParams);
  if (!parsed.ok) return refused(400, "invalid", parsed.field);
  const lapse = await owner.admin.rpc("ops_lapse_holds");
  if (lapse.error) return mapBookingRefusal(lapse.error);
  const { data, error } = await owner.admin.rpc("ops_list_bookings", listRpcArgs(parsed.query));
  if (error) return mapBookingRefusal(error);
  if (!isRow(data) || !Array.isArray(data.items)) return UNREADABLE;
  return ok({ items: data.items, next: typeof data.next === "string" ? data.next : null });
}

/** GET /api/ops/booking?ref=ALMAR-XXXXXX: ops_lapse_holds first, then ops_get_booking; unknown -> 404. */
export async function getBooking({ owner, url }: GetCtx): Promise<OpsOutcome> {
  const ref = (url.searchParams.get("ref") ?? "").trim().toUpperCase();
  if (!isBookingRef(ref)) return refused(400, "invalid", "ref");
  const lapse = await owner.admin.rpc("ops_lapse_holds");
  if (lapse.error) return mapBookingRefusal(lapse.error);
  const { data, error } = await owner.admin.rpc("ops_get_booking", { p_ref: ref });
  if (error) return mapBookingRefusal(error);
  if (data === null || data === undefined) return refused(404, "not_found");
  if (!isRow(data)) return UNREADABLE;
  return ok({ booking: data });
}

// ------------------------------------------------------------------------------------------------------------
// Mail helpers
// ------------------------------------------------------------------------------------------------------------

/** A notifier call whose throw becomes `{ ok: false, error: "threw" }` before deliverMail sees it. */
function guarded(send: () => Promise<MailOutcome>): () => Promise<MailOutcome> {
  return async () => {
    try {
      return await send();
    } catch {
      return { ok: false, error: "threw" };
    }
  };
}

function isLocale(value: unknown): value is Locale {
  return value === "en" || value === "ar" || value === "es";
}

async function urlOrNull(deps: BookingsDeps, b: Parameters<BookingsDeps["bookingUrl"]>[0]): Promise<string | null> {
  try {
    return await deps.bookingUrl(b);
  } catch {
    return null;
  }
}

const SKIPPED = { receipt: "skipped", owner: "skipped" } as const satisfies Record<string, MailResult>;

/**
 * After a first recording: the guest receipt (receipt/<payment_id>) and the owner notice (payment-owner/<payment_id>),
 * each through deliverMail. No view (null or a throw), an unreadable answer or a throwing notifier -> both skipped. Never
 * throws: the payment is recorded whatever happens to its mail.
 */
async function paymentMails(owner: BookingsOwner, deps: BookingsDeps, answer: Row, body: PaymentBody): Promise<{ receipt: MailResult; owner: MailResult }> {
  const bookingId = answer.booking_id;
  const paymentId = answer.payment_id;
  const ref = answer.ref;
  const isTest = answer.is_test;
  const before = answer.status_before;
  const after = answer.status_after;
  const amount = answer.amount_fils;
  if (
    typeof bookingId !== "string" ||
    typeof paymentId !== "string" ||
    typeof ref !== "string" ||
    typeof isTest !== "boolean" ||
    typeof before !== "string" ||
    !STATUSES.includes(before) ||
    typeof after !== "string" ||
    !STATUSES.includes(after) ||
    typeof amount !== "number"
  ) {
    return { ...SKIPPED };
  }
  try {
    const view = await deps.view(owner.admin, bookingId, { isTest });
    if (!view) return { ...SKIPPED };
    const notifier = deps.notifier();
    const flags = isRow(answer.flags) ? answer.flags : {};
    const linkVersion = typeof answer.link_version === "number" ? answer.link_version : 1;
    const locale = isLocale(answer.locale) ? answer.locale : view.locale;
    const job: PaymentMailJob = {
      bookingId,
      paymentId,
      view,
      isTest,
      bookingUrl: await urlOrNull(deps, { id: bookingId, ref, locale, isTest, linkVersion }),
      amountFils: amount,
      receivedOn: body.received_on,
      statusBefore: before as BookingStatus,
      statusAfter: after as BookingStatus,
      attentionReason: typeof flags.attention_reason === "string" ? flags.attention_reason : null,
      recordedByEmail: owner.profile.email || null,
    };
    const receiptKey = mailKey("paymentReceipt", paymentId);
    const receipt = await deliverMail(owner.admin, {
      bookingId,
      template: "payment_receipt",
      idempotencyKey: receiptKey,
      ready: notifier.ready,
      send: guarded(() => notifier.paymentReceipt(job, { idempotencyKey: receiptKey })),
    });
    const ownerKey = mailKey("ownerPayment", paymentId);
    const ownerMail = await deliverMail(owner.admin, {
      bookingId,
      template: "payment_owner",
      idempotencyKey: ownerKey,
      ready: notifier.ready,
      send: guarded(() => notifier.ownerPayment(job, { idempotencyKey: ownerKey })),
    });
    return { receipt, owner: ownerMail };
  } catch {
    return { ...SKIPPED };
  }
}

// ------------------------------------------------------------------------------------------------------------
// Writes
// ------------------------------------------------------------------------------------------------------------

/**
 * POST /api/ops/booking/payment: one ops_record_payment (idempotent on request_id). The first time, the receipt and
 * the owner notice go out (Q-15); a replay (first_time false) sends nothing. The reply carries the RPC's answer
 * without link_version and what each mail did.
 */
export async function recordPayment({ owner, body }: PostCtx<PaymentBody>, deps: BookingsDeps): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_record_payment", {
    p: {
      booking_id: body.booking_id,
      request_id: body.request_id,
      expected_status: body.expected_status,
      amount_fils: body.amount_fils,
      received_on: body.received_on,
      bank_reference: body.bank_reference,
      accept_short: body.accept_short,
      accept_reason: body.accept_reason,
    },
    p_actor: owner.profile.id,
  });
  if (error) {
    const mapped = mapBookingRefusal(error);
    // The wire's field is `amount` (AED text); the SQL names it amount_fils.
    if (!("dbError" in mapped) && mapped.body.ok === false && isRow(mapped.body.error) && mapped.body.error.field === "amount_fils") {
      return refused(400, "invalid", "amount");
    }
    return mapped;
  }
  if (!isRow(data)) return UNREADABLE;
  const { link_version: _linkVersion, ...payment } = data;
  void _linkVersion;
  const mail = data.first_time === true ? await paymentMails(owner, deps, data, body) : { ...SKIPPED };
  return ok({ payment, mail });
}

/** POST /api/ops/booking/void: one ops_void_payment; the row is kept, struck through with its reason. No mail (P-11). */
export async function voidPayment({ owner, body }: PostCtx<VoidBody>): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_void_payment", {
    p_payment: body.payment_id,
    p_reason: body.reason,
    p_actor: owner.profile.id,
  });
  if (error) return mapBookingRefusal(error);
  if (!isRow(data)) return UNREADABLE;
  return ok({ voided: data });
}

/**
 * POST /api/ops/booking/status: ops_lapse_holds first (Q-10: an unpaid request past its deadline lapses and answers
 * changed instead of being cancelled), then ops_set_booking_status with the shown status as expected_from.
 */
export async function setStatus({ owner, body }: PostCtx<StatusBody>): Promise<OpsOutcome> {
  const lapse = await owner.admin.rpc("ops_lapse_holds");
  if (lapse.error) return mapBookingRefusal(lapse.error);
  const { data, error } = await owner.admin.rpc("ops_set_booking_status", {
    p_booking: body.booking_id,
    p_to: targetStatus(body.action),
    p_expected_from: body.expected_status,
    p_actor: owner.profile.id,
  });
  if (error) return mapBookingRefusal(error);
  if (!isRow(data) || typeof data.from !== "string" || typeof data.to !== "string") return UNREADABLE;
  return ok({ status: { from: data.from, to: data.to } });
}

/** POST /api/ops/booking/note: one ops_add_booking_note. */
export async function addNote({ owner, body }: PostCtx<NoteBody>): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_add_booking_note", {
    p_booking: body.booking_id,
    p_body: body.body,
    p_actor: owner.profile.id,
  });
  if (error) return mapBookingRefusal(error);
  if (!isRow(data)) return UNREADABLE;
  return ok({ note: { id: data.id, at: data.at } });
}

/** POST /api/ops/booking/attention: one ops_resolve_attention (the note is kept, the flag cleared). */
export async function resolveAttention({ owner, body }: PostCtx<AttentionBody>): Promise<OpsOutcome> {
  const { data, error } = await owner.admin.rpc("ops_resolve_attention", {
    p_booking: body.booking_id,
    p_note: body.note,
    p_actor: owner.profile.id,
  });
  if (error) return mapBookingRefusal(error);
  if (!isRow(data)) return UNREADABLE;
  return ok({ resolved: { first_time: data.first_time === true, note_id: data.note_id ?? null } });
}

function readBooking(data: Row): OwnerDetail | null {
  if (typeof data.id !== "string" || typeof data.status !== "string" || !STATUSES.includes(data.status)) return null;
  if (typeof data.is_test !== "boolean" || !isRow(data.flags) || !Array.isArray(data.payments)) return null;
  return data as unknown as OwnerDetail;
}

/**
 * POST /api/ops/booking/resend: ops_lapse_holds first, then ops_get_booking. A receipt needs a succeeded row of this
 * booking; a request email needs canResendRequest (Awaiting payment, and past the pay-by date only when part paid:
 * owner, Q-18 = yes) and the link secret. Both need the guest's view; a request email also needs the view to read
 * awaiting_payment with a deadline (an unpaid request past its deadline reads expired with no deadline there; a
 * part-paid one keeps both, P-09). Every refusal writes nothing and sends nothing. Then one resend_requested event and
 * the mail with key resend/<booking_id>/<request_id>, through deliverMail.
 */
export async function resendMail({ owner, body }: PostCtx<ResendBody>, deps: BookingsDeps): Promise<OpsOutcome> {
  const lapse = await owner.admin.rpc("ops_lapse_holds");
  if (lapse.error) return mapBookingRefusal(lapse.error);
  const { data, error } = await owner.admin.rpc("ops_get_booking", { p_ref: body.ref });
  if (error) return mapBookingRefusal(error);
  if (data === null || data === undefined) return refused(404, "not_found");
  if (!isRow(data)) return UNREADABLE;
  const booking = readBooking(data);
  if (!booking) return UNREADABLE;

  let payment: OwnerPayment | null = null;
  if (body.kind === "receipt") {
    payment = booking.payments.find((p) => isRow(p) && p.id === body.payment_id) ?? null;
    if (!payment || !canResendReceipt(payment)) return refused(409, "not_applicable");
  } else {
    if (!canResendRequest(booking.status, booking.flags)) return refused(409, "not_applicable");
    if (!deps.linkReady()) return refused(503, "unavailable");
  }

  let view: BookingView | null;
  try {
    view = await deps.view(owner.admin, booking.id, { isTest: booking.is_test });
  } catch {
    return { dbError: { code: "view_failed" } };
  }
  if (!view) return refused(409, "not_applicable");
  if (body.kind === "request" && (view.status !== "awaiting_payment" || view.deadline === null)) {
    return refused(409, "not_applicable");
  }

  let notifier: BookingNotifier;
  try {
    notifier = deps.notifier();
  } catch {
    return refused(503, "unavailable");
  }
  const link = { id: booking.id, ref: booking.ref, locale: view.locale, isTest: booking.is_test, linkVersion: booking.link_version };
  const bookingUrl = await urlOrNull(deps, link);
  const key = `resend/${booking.id}/${body.request_id}`;

  // The job is built before anything is written, so a refusal here leaves no event behind.
  let send: () => Promise<MailOutcome>;
  if (payment) {
    const row = payment;
    const job: PaymentMailJob = {
      bookingId: booking.id,
      paymentId: row.id,
      view,
      isTest: booking.is_test,
      bookingUrl,
      amountFils: row.amount_fils,
      receivedOn: row.received_on ?? dubaiDayOf(row.created_at),
      statusBefore: booking.status,
      statusAfter: booking.status,
      attentionReason: null,
      recordedByEmail: row.recorded_by_email,
    };
    send = guarded(() => notifier.paymentReceipt(job, { idempotencyKey: key }));
  } else {
    if (bookingUrl === null) return refused(503, "unavailable");
    const job: RequestMailJob = { bookingId: booking.id, view, isTest: booking.is_test, bookingUrl };
    send = guarded(() => notifier.requestReceived(job, { idempotencyKey: key }));
  }

  const template = body.kind === "receipt" ? "payment_receipt" : "request_received";
  const logged = await owner.admin.rpc("log_booking_event", {
    p_booking: booking.id,
    p_actor: `owner:${owner.profile.id}`,
    p_action: "resend_requested",
    p_detail: { template, payment_id: body.payment_id, request_id: body.request_id },
  });
  if (logged.error) return mapBookingRefusal(logged.error);

  const mail = await deliverMail(owner.admin, { bookingId: booking.id, template, idempotencyKey: key, ready: notifier.ready, send });
  return ok({ mail });
}
