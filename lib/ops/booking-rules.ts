// Plan 04-09 Task 1: the pure booking rules the owner's dashboard shares with its handlers (lib/ops/bookings-api.ts):
// the owner's JSON shapes as 04-08's SQL returns them (snake_case, 20261019160000_booking_requests.sql), which actions a
// status offers, AED text to fils (the dialog's and the server's one parser), the Record and Void previews, the list
// query, UAE time text and the mail state of a receipt or a request email.
// Pure: no React, no fetch, no clock (callers pass what they read), no environment. The money rules mirror the SQL
// (booking_next_status, booking_deposit_floor, booking_flags, ops_record_payment, ops_void_payment); where they could
// differ the SQL wins, and tests/ops-record-payment.db.test.mjs (Task 6) compares a grid on a stack.
// Names avoid the text r-e-underscore (F-09, tests/phase-02-gates.test.mjs).
import { westernDigits } from "../format";
import { assertFils, pct } from "../money/fils";
import { dubaiToday } from "../money/dates";
import type { BookingStatus } from "../booking/types";

// ------------------------------------------------------------------------------------------------------------
// Statuses, filters and the owner's JSON shapes
// ------------------------------------------------------------------------------------------------------------

/** The eight statuses of 04-02, in the dashboard's order. */
export const BOOKING_STATUSES = [
  "held",
  "awaiting_payment",
  "deposit_paid",
  "paid_in_full",
  "confirmed",
  "completed",
  "cancelled",
  "expired",
] as const satisfies readonly BookingStatus[];

// Type-level check: every BookingStatus is listed above (a new status in lib/booking/types.ts breaks the build here).
type UnlistedStatus = Exclude<BookingStatus, (typeof BOOKING_STATUSES)[number]>;
const EVERY_STATUS_LISTED: [UnlistedStatus] extends [never] ? true : never = true;
void EVERY_STATUS_LISTED;

/** The list's status filter: all (the SQL hides abandoned holds), one status, or Needs attention. */
export const STATUS_FILTERS = ["all", ...BOOKING_STATUSES, "attention"] as const;
export type StatusFilter = (typeof STATUS_FILTERS)[number];

type BookingPlan = "deposit" | "full";
type AttentionReason = "paid_after_expiry" | "paid_after_cancel" | "overpaid" | "deadline_passed_part_paid";

/** booking_flags(b), 04-08 section B, exactly. settled = paid + written off. */
export type OwnerFlags = {
  needs_attention: boolean;
  attention_reason: AttentionReason | null;
  part_received: boolean;
  overpaid: boolean;
  written_off: boolean;
  settled_fils: number;
  due_now_fils: number;
  still_due_fils: number;
  balance_overdue: boolean;
  deadline_passed: boolean;
};

/** One row of ops_list_bookings. Days are YYYY-MM-DD, times ISO UTC. */
export type OwnerItem = {
  id: string;
  ref: string;
  status: BookingStatus;
  source: "web" | "ops";
  is_test: boolean;
  guest_name: string;
  email: string;
  stay_slug: string;
  stay_title: string;
  destination_id: string;
  destination_name: string;
  arrive: string;
  leave: string;
  guests: number;
  plan: BookingPlan;
  grand_fils: number;
  paid_fils: number;
  written_off_fils: number;
  due_now_fils: number;
  deadline: string | null;
  balance_due_date: string | null;
  created_at: string;
  requested_at: string | null;
  flags: OwnerFlags;
};

/** ops_list_bookings: one page and the `after` of the next one (null on the last page). */
export type OwnerList = { items: OwnerItem[]; next: string | null };

/** One booking_payments row as ops_get_booking returns it (voided rows included, with their reason). */
export type OwnerPayment = {
  id: string;
  kind: "deposit" | "full" | "balance" | "transfer";
  method: "card" | "bank_transfer";
  status: "open" | "succeeded" | "expired" | "failed" | "voided";
  amount_fils: number;
  received_on: string | null;
  bank_reference: string | null;
  recorded_by: string | null;
  recorded_by_email: string | null;
  created_at: string;
  write_off_fils: number;
  write_off_reason: string | null;
  void_reason: string | null;
  voided_at: string | null;
  voided_by: string | null;
  voided_by_email: string | null;
  card_brand: string | null;
  card_last4: string | null;
};

/** One internal note, newest first. */
export type OwnerNote = { id: string; at: string; actor: string; actor_email: string | null; body: string };

/** One booking_events row, newest first (at most 200). `detail` is the event's JSON as written. */
export type OwnerEvent = {
  id: number;
  at: string;
  actor: string;
  action: string;
  from_status: string | null;
  to_status: string | null;
  detail: Record<string, unknown> | null;
};

/** ops_get_booking(p_ref): the owner's whole booking. */
export type OwnerDetail = {
  id: string;
  ref: string;
  status: BookingStatus;
  source: "web" | "ops";
  is_test: boolean;
  link_version: number;
  created_at: string;
  updated_at: string;
  requested_at: string | null;
  hold_expires_at: string | null;
  deadline: string | null;
  guest: {
    name: string;
    email: string;
    phone: string | null;
    nationality: string | null;
    special_requests: string | null;
    emergency_name: string | null;
    emergency_phone: string | null;
    locale: "en" | "ar" | "es";
  };
  stay: { id: string; slug: string; title: string };
  destination: { id: string; name: string };
  arrive: string;
  leave: string;
  nights: number;
  adults: number;
  children: number;
  infants: number;
  airport: "DXB" | "AUH" | "SHJ" | null;
  pickup_address: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  plan: BookingPlan;
  money: {
    nights_fils: number;
    addons_fils: number;
    subtotal_fils: number;
    vat_bp: number;
    vat_fils: number;
    grand_fils: number;
    deposit_bp: number;
    deposit_fils: number;
    balance_fils: number;
    paid_fils: number;
    written_off_fils: number;
    balance_due_days: number | null;
    balance_due_date: string | null;
  };
  flags: OwnerFlags;
  travellers: { kind: "adult" | "child" | "infant"; full_name: string; age: number | null; is_booker: boolean; not_staying: boolean }[];
  lines: {
    catalog_item_id: string | null;
    name: string;
    unit: "person" | "night" | "trip";
    is_uae: boolean;
    unit_price_fils: number;
    quantity: number;
    line_fils: number;
  }[];
  payments: OwnerPayment[];
  notes: OwnerNote[];
  events: OwnerEvent[];
  lapse_email: { sent_at: string | null; attempts: number; claimed_at: string | null };
};

/** ops_get_money_settings(): values null when unset. updated_by is a uuid (U-01). */
export type MoneyView = {
  transfer_window_minutes: number | null;
  balance_due_days: number | null;
  bank: {
    account_name: string | null;
    bank_name: string | null;
    iban: string | null;
    swift: string | null;
    bank_address: string | null;
    note_en: string | null;
    note_ar: string | null;
    note_es: string | null;
  };
  bank_complete: boolean;
  updated_at: string | null;
  updated_by: string | null;
};

// ------------------------------------------------------------------------------------------------------------
// Actions per status (ops_set_booking_status of 04-02; Q-04: a Held booking shows no owner action)
// ------------------------------------------------------------------------------------------------------------

export type StatusAction = "confirm" | "complete" | "cancel";

const ACTIONS: Record<BookingStatus, readonly StatusAction[]> = {
  held: [],
  awaiting_payment: ["cancel"],
  deposit_paid: ["confirm", "cancel"],
  paid_in_full: ["confirm", "cancel"],
  confirmed: ["complete", "cancel"],
  completed: [],
  cancelled: [],
  expired: [],
};

/** The status buttons a booking shows, in order. */
export function statusActions(status: BookingStatus): StatusAction[] {
  return [...ACTIONS[status]];
}

/** The status an action moves to (p_to of ops_set_booking_status). */
export function targetStatus(action: StatusAction): "confirmed" | "completed" | "cancelled" {
  if (action === "confirm") return "confirmed";
  if (action === "complete") return "completed";
  return "cancelled";
}

/** Record payment is offered on every status but Held (ops_record_payment: not_requested). */
export function canRecordPayment(status: BookingStatus): boolean {
  return status !== "held";
}

/** Accept as paid (B-33) only where ops_record_payment allows it (otherwise not_applicable). */
export function canAcceptShort(status: BookingStatus): boolean {
  return status === "awaiting_payment" || status === "deposit_paid" || status === "confirmed" || status === "completed";
}

/** Void only a succeeded bank transfer row (ops_void_payment: otherwise not_voidable). */
export function canVoid(payment: Pick<OwnerPayment, "status" | "method">): boolean {
  return payment.status === "succeeded" && payment.method === "bank_transfer";
}

/** Resend receipt on a succeeded row. */
export function canResendReceipt(payment: Pick<OwnerPayment, "status" | "method">): boolean {
  return payment.status === "succeeded";
}

/**
 * Resend request email (the bank details again, Q-09) on Awaiting payment. Past the pay-by date only when part paid:
 * owner, 2026-10-21 (Q-18 = yes), a part-paid request keeps the button after its deadline (it never lapses, P-09 as
 * changed); an unpaid request past its deadline lapses at the next sweep and is never sent the bank details again (Q-10).
 * `part_received` is booking_flags' "awaiting_payment and paid_fils > 0".
 */
export function canResendRequest(status: BookingStatus, flags: Pick<OwnerFlags, "deadline_passed" | "part_received">): boolean {
  return status === "awaiting_payment" && (!flags.deadline_passed || flags.part_received);
}

// ------------------------------------------------------------------------------------------------------------
// AED text and fils (Q-11)
// ------------------------------------------------------------------------------------------------------------

/** 10,000,000,000.00 AED: the SQL's bound on amount_fils (booking_int 1..1e12). */
export const AED_MAX_FILS = 1_000_000_000_000;

const AED_PLAIN = /^(0|[1-9][0-9]*)(?:\.([0-9]{1,2}))?$/;
const AED_GROUPED = /^([1-9][0-9]{0,2}(?:,[0-9]{3})+)(?:\.([0-9]{1,2}))?$/;

/**
 * The amount the owner typed, as received in AED, to fils; null when it is not one. Plain ("1050", "1050.5") or comma
 * grouped ("1,050.00"), at most two decimals, 0.01 to 10,000,000,000.00. Arabic-Indic and Persian digits become
 * Western; the Arabic decimal separator U+066B becomes "." and the Arabic group separator U+066C becomes ",". No float:
 * the text is split and each part is read as an integer string of at most 13 digits.
 */
export function parseAedAmount(text: string): number | null {
  if (typeof text !== "string") return null;
  const value = westernDigits(text.trim()).replace(/٫/g, ".").replace(/٬/g, ",");
  const match = AED_PLAIN.exec(value) ?? AED_GROUPED.exec(value);
  if (!match) return null;
  const wholeDigits = match[1].replace(/,/g, "");
  if (wholeDigits.length > 13) return null;
  const whole = Number.parseInt(wholeDigits, 10);
  const fraction = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10);
  const fils = whole * 100 + fraction;
  if (!Number.isSafeInteger(fils) || fils < 1 || fils > AED_MAX_FILS) return null;
  return fils;
}

/** Fils as plain AED text for the amount field: 105050 -> "1050.50", 5 -> "0.05". Not for display (formatAed is). */
export function aedText(fils: number): string {
  assertFils(fils, "fils");
  const part = fils % 100;
  const whole = (fils - part) / 100;
  return `${whole}.${String(part).padStart(2, "0")}`;
}

// ------------------------------------------------------------------------------------------------------------
// Table C and the previews
// ------------------------------------------------------------------------------------------------------------

const PAYABLE = new Set<BookingStatus>(["awaiting_payment", "deposit_paid", "paid_in_full"]);
const LIVE = new Set<BookingStatus>(["awaiting_payment", "deposit_paid", "paid_in_full", "confirmed", "completed"]);

/**
 * booking_next_status (table C): awaiting_payment, deposit_paid, paid_in_full: settled >= grand -> paid_in_full; a
 * deposit plan with settled >= deposit -> deposit_paid; otherwise awaiting_payment. Every other status is unchanged.
 */
export function nextStatus(status: BookingStatus, plan: BookingPlan, grandFils: number, depositFils: number, settledFils: number): BookingStatus {
  if (!PAYABLE.has(status)) return status;
  if (settledFils >= grandFils) return "paid_in_full";
  if (plan === "deposit" && settledFils >= depositFils) return "deposit_paid";
  return "awaiting_payment";
}

/** booking_flags' still_due_fils: the rest of the total on a live booking, else 0. */
function stillDue(status: BookingStatus, grandFils: number, settledFils: number): number {
  return LIVE.has(status) ? Math.max(0, grandFils - settledFils) : 0;
}

type SettleInput = {
  status: BookingStatus;
  plan: BookingPlan;
  grandFils: number;
  depositFils: number;
  paidFils: number;
  writtenOffFils: number;
  attentionReason: AttentionReason | null;
  amountFils: number;
  acceptShort: boolean;
};

type SettleResult = {
  refusal: "not_requested" | "not_applicable" | "nothing_to_write_off" | null;
  statusAfter: BookingStatus;
  settledAfterFils: number;
  writeOffFils: number;
  gapFils: number;
  partReceived: boolean;
  overpaidFils: number;
  attention: "paid_after_expiry" | "paid_after_cancel" | "overpaid" | null;
  nightsKept: boolean;
  stillDueFils: number;
  attentionCleared: boolean;
};

/**
 * What recording `amountFils` would do, as ops_record_payment does it (the screen's review sentence; the SQL decides).
 * - Held: not_requested. Accept as paid outside canAcceptShort: not_applicable.
 * - The target is the deposit for an awaiting_payment deposit plan, else the total; gap = target - settled after the
 *   row. Accept as paid writes the gap off on the row; a gap <= 0 is nothing_to_write_off.
 * - The status follows table C on awaiting_payment and deposit_paid; every other status keeps its own.
 * - partReceived: still awaiting_payment with money paid. overpaidFils: paid (never write-offs) above the total.
 * - attention, the flag this record raises: paid_after_expiry on expired, paid_after_cancel on cancelled, else overpaid.
 * - nightsKept: the booking keeps its nights for good (the first record on a request makes them permanent, P-09 as
 *   changed 2026-10-20); false on expired and cancelled, whose nights are never taken back (B-34).
 * - attentionCleared: deadline_passed_part_paid ends once the record moves the booking out of awaiting_payment.
 * The inline lapse of an unpaid request past its deadline (P-10) needs the clock: the server answers `changed` then.
 */
export function settlePreview(input: SettleInput): SettleResult {
  const { status, plan, grandFils, depositFils, paidFils, writtenOffFils, attentionReason, amountFils, acceptShort } = input;
  const settledBefore = paidFils + writtenOffFils;
  const unchanged: SettleResult = {
    refusal: null,
    statusAfter: status,
    settledAfterFils: settledBefore,
    writeOffFils: 0,
    gapFils: 0,
    partReceived: status === "awaiting_payment" && paidFils > 0,
    overpaidFils: 0,
    attention: null,
    nightsKept: false,
    stillDueFils: stillDue(status, grandFils, settledBefore),
    attentionCleared: false,
  };
  if (status === "held") return { ...unchanged, refusal: "not_requested" };
  if (acceptShort && !canAcceptShort(status)) return { ...unchanged, refusal: "not_applicable" };

  const target = status === "awaiting_payment" && plan === "deposit" ? depositFils : grandFils;
  const gap = canAcceptShort(status) ? target - (settledBefore + amountFils) : 0;
  if (acceptShort && gap <= 0) return { ...unchanged, refusal: "nothing_to_write_off" };

  const writeOffFils = acceptShort ? gap : 0;
  const paidAfter = paidFils + amountFils;
  const settledAfterFils = settledBefore + amountFils + writeOffFils;
  const statusAfter =
    status === "awaiting_payment" || status === "deposit_paid"
      ? nextStatus(status, plan, grandFils, depositFils, settledAfterFils)
      : status;
  const overpaidFils = paidAfter > grandFils ? paidAfter - grandFils : 0;
  const attention =
    status === "expired" ? "paid_after_expiry" : status === "cancelled" ? "paid_after_cancel" : overpaidFils > 0 ? "overpaid" : null;
  return {
    refusal: null,
    statusAfter,
    settledAfterFils,
    writeOffFils,
    gapFils: Math.max(0, gap),
    partReceived: statusAfter === "awaiting_payment" && paidAfter > 0,
    overpaidFils,
    attention,
    nightsKept: statusAfter !== "expired" && statusAfter !== "cancelled",
    stillDueFils: stillDue(statusAfter, grandFils, settledAfterFils),
    attentionCleared: attentionReason === "deadline_passed_part_paid" && statusAfter !== "awaiting_payment",
  };
}

/**
 * The cancel_first floor, mirroring 04-08's booking_deposit_floor (P-21 as changed 2026-10-20: the deposit on every
 * plan): a deposit plan's stored deposit_fils; any other plan the deposit it would have had, pct(grand, deposit_bp),
 * half up (a 0 % deposit gives 0).
 */
export function depositFloor(plan: BookingPlan, grandFils: number, depositFils: number, depositBp: number): number {
  return plan === "deposit" ? depositFils : pct(grandFils, depositBp);
}

type VoidInput = {
  status: BookingStatus;
  plan: BookingPlan;
  grandFils: number;
  depositFils: number;
  depositBp: number;
  paidFils: number;
  writtenOffFils: number;
  attentionReason: AttentionReason | null;
  payment: { amountFils: number; writeOffFils: number };
};

type VoidResult = {
  refusal: "cancel_first" | null;
  statusAfter: BookingStatus;
  settledAfterFils: number;
  paidAfterFils: number;
  deadline: "unchanged" | "later_of" | "fresh" | null;
  nights: "kept" | "until_deadline" | "none";
  attentionCleared: boolean;
};

/**
 * What voiding one row would do, as ops_void_payment does it (the row's write-off goes with it).
 * - confirmed / completed left below depositFloor: cancel_first, nothing changes.
 * - deposit_paid / paid_in_full follow table C; back to awaiting_payment: a fresh pay-by date (the transfer window from
 *   now), nights kept while money is left, else held until then.
 * - awaiting_payment with money left: date and nights unchanged; voided to 0: an unpaid request again, its date the
 *   later of the current one and the window from now, its nights held until then.
 * - confirmed, completed, deposit_paid, paid_in_full otherwise: no date, nights kept. expired / cancelled: no date, no
 *   nights. held (no row can be recorded there) keeps its own date and timed nights.
 * - attentionCleared: overpaid with paid after <= total, or a money flag (deadline_passed_part_paid, paid_after_expiry,
 *   paid_after_cancel) with nothing paid after.
 * window_missing (no transfer window set) needs the settings: the server answers it.
 */
export function voidPreview(input: VoidInput): VoidResult {
  const { status, plan, grandFils, depositFils, depositBp, paidFils, writtenOffFils, attentionReason, payment } = input;
  const paidAfterFils = paidFils - payment.amountFils;
  const settledAfterFils = paidFils + writtenOffFils - payment.amountFils - payment.writeOffFils;

  if ((status === "confirmed" || status === "completed") && settledAfterFils < depositFloor(plan, grandFils, depositFils, depositBp)) {
    return { refusal: "cancel_first", statusAfter: status, settledAfterFils, paidAfterFils, deadline: null, nights: "kept", attentionCleared: false };
  }

  const statusAfter =
    status === "deposit_paid" || status === "paid_in_full" ? nextStatus(status, plan, grandFils, depositFils, settledAfterFils) : status;

  let deadline: VoidResult["deadline"];
  let nights: VoidResult["nights"];
  if ((status === "deposit_paid" || status === "paid_in_full") && statusAfter === "awaiting_payment") {
    deadline = "fresh";
    nights = paidAfterFils > 0 ? "kept" : "until_deadline";
  } else if (status === "awaiting_payment") {
    deadline = paidAfterFils > 0 ? "unchanged" : "later_of";
    nights = paidAfterFils > 0 ? "kept" : "until_deadline";
  } else if (status === "expired" || status === "cancelled") {
    deadline = null;
    nights = "none";
  } else if (status === "held") {
    deadline = "unchanged";
    nights = "until_deadline";
  } else {
    deadline = null;
    nights = "kept";
  }

  const attentionCleared =
    (attentionReason === "overpaid" && paidAfterFils <= grandFils) ||
    ((attentionReason === "deadline_passed_part_paid" || attentionReason === "paid_after_expiry" || attentionReason === "paid_after_cancel") &&
      paidAfterFils === 0);

  return { refusal: null, statusAfter, settledAfterFils, paidAfterFils, deadline, nights, attentionCleared };
}

// ------------------------------------------------------------------------------------------------------------
// The list query (GET /api/ops/bookings -> ops_list_bookings)
// ------------------------------------------------------------------------------------------------------------

/** The default page size (ops_list_bookings p_limit default). */
export const LIST_LIMIT = 30;

type ListQuery = {
  q: string;
  status: StatusFilter;
  destination: string | null;
  from: string | null;
  to: string | null;
  after: string | null;
  limit: number;
};

type ListField = "q" | "status" | "destination" | "arrive" | "after" | "limit";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

function isDay(value: string): boolean {
  const m = DAY.exec(value);
  if (!m) return false;
  const [y, mo, d] = [Number.parseInt(m[1], 10), Number.parseInt(m[2], 10), Number.parseInt(m[3], 10)];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

function param(params: URLSearchParams, key: string): string | null {
  const value = params.get(key);
  return value === null || value.trim() === "" ? null : value.trim();
}

/**
 * The list's search params, checked the way ops_list_bookings checks them, to a query or the field it refuses on.
 * q: trimmed, Arabic-Indic / Persian digits Western, at most 100 characters. status: all, one of the eight or
 * attention. destination: a uuid. from / to: real days, from not after to (field arrive). after: 1-6 digits.
 * limit: 1..60, default 30. An empty param is the default.
 */
export function parseListQuery(params: URLSearchParams): { ok: true; query: ListQuery } | { ok: false; field: ListField } {
  const q = westernDigits(params.get("q") ?? "").trim();
  if (Array.from(q).length > 100) return { ok: false, field: "q" };

  const statusText = param(params, "status") ?? "all";
  const status = (STATUS_FILTERS as readonly string[]).includes(statusText) ? (statusText as StatusFilter) : null;
  if (status === null) return { ok: false, field: "status" };

  const destination = param(params, "destination");
  if (destination !== null && !UUID.test(destination)) return { ok: false, field: "destination" };

  const from = param(params, "from");
  const to = param(params, "to");
  if ((from !== null && !isDay(from)) || (to !== null && !isDay(to)) || (from !== null && to !== null && from > to)) {
    return { ok: false, field: "arrive" };
  }

  const after = param(params, "after");
  if (after !== null && !/^[0-9]{1,6}$/.test(after)) return { ok: false, field: "after" };

  const limitText = param(params, "limit");
  let limit = LIST_LIMIT;
  if (limitText !== null) {
    if (!/^[0-9]{1,2}$/.test(limitText)) return { ok: false, field: "limit" };
    limit = Number.parseInt(limitText, 10);
    if (limit < 1 || limit > 60) return { ok: false, field: "limit" };
  }

  return { ok: true, query: { q, status, destination: destination === null ? null : destination.toLowerCase(), from, to, after, limit } };
}

/** The query as search params, defaults left out (parseListQuery(listSearch(q)) gives q back). */
export function listSearch(query: ListQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q !== "") params.set("q", query.q);
  if (query.status !== "all") params.set("status", query.status);
  if (query.destination !== null) params.set("destination", query.destination);
  if (query.from !== null) params.set("from", query.from);
  if (query.to !== null) params.set("to", query.to);
  if (query.after !== null) params.set("after", query.after);
  if (query.limit !== LIST_LIMIT) params.set("limit", String(query.limit));
  return params;
}

/** The seven arguments of ops_list_bookings; status "all" is p_status null (abandoned holds hidden, Q-17). */
export function listRpcArgs(query: ListQuery): {
  p_q: string | null;
  p_status: string | null;
  p_destination: string | null;
  p_arrive_from: string | null;
  p_arrive_to: string | null;
  p_after: string | null;
  p_limit: number;
} {
  return {
    p_q: query.q === "" ? null : query.q,
    p_status: query.status === "all" ? null : query.status,
    p_destination: query.destination,
    p_arrive_from: query.from,
    p_arrive_to: query.to,
    p_after: query.after,
    p_limit: query.limit,
  };
}

// ------------------------------------------------------------------------------------------------------------
// UAE time (Asia/Dubai, UTC+4, no daylight saving; U-03: not 04-03's uaeDateTime)
// ------------------------------------------------------------------------------------------------------------

const UAE_PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

function instant(iso: string): Date {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) throw new RangeError(`not a time: ${String(iso)}`);
  return date;
}

/** The Dubai calendar day of an ISO time: "2026-10-19T20:00:00Z" -> "2026-10-20". */
export function dubaiDayOf(iso: string): string {
  return dubaiToday(instant(iso));
}

/** An ISO time as "DD/MM/YYYY HH:MM" in UAE time (the screen adds " UAE time"). */
export function uaeDateTimeText(iso: string): string {
  const parts = UAE_PARTS.formatToParts(instant(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("day")}/${part("month")}/${part("year")} ${part("hour")}:${part("minute")}`;
}

/** A day "YYYY-MM-DD" as "DD/MM/YYYY". */
export function uaeDate(day: string): string {
  if (!isDay(day)) throw new RangeError(`not a day: ${String(day)}`);
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

// ------------------------------------------------------------------------------------------------------------
// Mail state (04-08 deliverMail writes { template, key, error? } on every email event)
// ------------------------------------------------------------------------------------------------------------

export type MailState = "sent" | "pending" | "failed" | "none";

const MAIL_EVENTS: Record<string, Exclude<MailState, "none">> = {
  email_sent: "sent",
  email_pending: "pending",
  email_failed: "failed",
};

function text(detail: Record<string, unknown> | null, key: string): string | null {
  const value = detail?.[key];
  return typeof value === "string" ? value : null;
}

/** The newest email event (highest id) whose detail.key is one of `keys`; reads only action and detail.key. */
function mailState(events: readonly OwnerEvent[], keys: ReadonlySet<string>): MailState {
  let newest: OwnerEvent | null = null;
  for (const event of events) {
    if (!(event.action in MAIL_EVENTS)) continue;
    const key = text(event.detail, "key");
    if (key === null || !keys.has(key)) continue;
    if (newest === null || event.id > newest.id) newest = event;
  }
  return newest === null ? "none" : MAIL_EVENTS[newest.action];
}

/**
 * The guest receipt of one payment: keys receipt/<payment_id> and resend/<booking_id>/<request_id> for each
 * resend_requested event that names this payment_id and a request_id.
 */
export function receiptMail(detail: Pick<OwnerDetail, "id" | "events">, paymentId: string): MailState {
  const keys = new Set([`receipt/${paymentId}`]);
  for (const event of detail.events) {
    if (event.action !== "resend_requested") continue;
    const requestId = text(event.detail, "request_id");
    if (requestId !== null && text(event.detail, "payment_id") === paymentId) keys.add(`resend/${detail.id}/${requestId}`);
  }
  return mailState(detail.events, keys);
}

/**
 * The request email (the bank details): keys request/<booking_id> and resend/<booking_id>/<request_id> for each
 * resend_requested event whose template is request_received. The owner withdrawal notice (withdrawn-owner/<booking_id>)
 * is another key and changes nothing here.
 */
export function requestMail(detail: Pick<OwnerDetail, "id" | "events">): MailState {
  const keys = new Set([`request/${detail.id}`]);
  for (const event of detail.events) {
    if (event.action !== "resend_requested") continue;
    const requestId = text(event.detail, "request_id");
    if (requestId !== null && text(event.detail, "template") === "request_received") keys.add(`resend/${detail.id}/${requestId}`);
  }
  return mailState(detail.events, keys);
}

const OWNER_ACTOR = /^owner:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Who did it, for History: owner:<uuid> is Owner, guest is Guest, anything else System. */
export function actorKind(actor: string): "owner" | "system" | "guest" {
  if (OWNER_ACTOR.test(actor)) return "owner";
  if (actor === "guest") return "guest";
  return "system";
}
