import type { Page, Route } from "@playwright/test";
import type { BookingStatus } from "../../lib/booking/types";
import type { OwnerDetail, OwnerItem, OwnerPayment, OwnerRefund } from "../../lib/ops/booking-rules";

// The owner API behind Bookings (plan 04-09), answered from fixtures shaped exactly like 04-08 section B (snake_case,
// symbolic fils, bracket names). A small store keeps what the writes changed, so the detail read after a write is the new
// one. Every call is recorded (method, path, query, body). No network, no database. Documentation data only.

export const REF = "ALMAR-AB2CDE";
export const BOOKING_ID = "00000000-0000-4000-8000-0000000000b1";
export const PAYMENT_ID = "00000000-0000-4000-8000-0000000000c1";
export const DESTINATION_ID = "00000000-0000-4000-8000-0000000000d1";
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const isUuid = (value: unknown): boolean => typeof value === "string" && UUID_V4.test(value);

export type Call = { method: string; path: string; query: Record<string, string>; body: unknown };
export type Answer = { status: number; body: unknown };
/** A test overrides one reply: return undefined to let the default answer stand. */
export type Override = (call: Call) => Answer | undefined | Promise<Answer | undefined>;

type Money = OwnerDetail["money"];

export type FixtureInput = {
  id?: string;
  ref?: string;
  status?: BookingStatus;
  grand_fils?: number;
  deposit_fils?: number;
  paid_fils?: number;
  written_off_fils?: number;
  /** Plan 05-03: what the refunds already recorded add up to; defaults to the succeeded rows of `refunds`. */
  refunded_fils?: number;
  refunds?: OwnerRefund[];
  deadline_passed?: boolean;
  attention_reason?: OwnerDetail["flags"]["attention_reason"];
  is_test?: boolean;
  payments?: OwnerPayment[];
  events?: OwnerDetail["events"];
};

/** Symbolic amounts: nothing here is a price. */
export const GRAND = 1_200_000;
export const DEPOSIT = 300_000;

/**
 * One booking. Every flag is derived from the money and the status (revision-1 decision 4), never set by hand:
 * part_received = awaiting_payment and paid > 0; overpaid = paid > grand; written_off = written off > 0; settled = paid +
 * written off.
 */
export function makeBooking(input: FixtureInput = {}): OwnerDetail {
  const status = input.status ?? "awaiting_payment";
  const grand = input.grand_fils ?? GRAND;
  const deposit = input.deposit_fils ?? DEPOSIT;
  const paid = input.paid_fils ?? 0;
  const off = input.written_off_fils ?? 0;
  const refunds = input.refunds ?? [];
  const refunded = input.refunded_fils ?? refunds.filter((r) => r.status === "succeeded").reduce((sum, r) => sum + r.amount_fils, 0);
  const settled = paid + off;
  // P5-06: overpaid reads paid minus refunded above the total.
  const reason = input.attention_reason ?? (paid - refunded > grand ? "overpaid" : null);
  const money: Money = {
    nights_fils: grand,
    addons_fils: 0,
    subtotal_fils: grand,
    vat_bp: 0,
    vat_fils: 0,
    grand_fils: grand,
    deposit_bp: 2500,
    deposit_fils: deposit,
    balance_fils: grand - deposit,
    paid_fils: paid,
    refunded_fils: refunded,
    written_off_fils: off,
    balance_due_days: 30,
    balance_due_date: "2026-11-20",
  };
  return {
    id: input.id ?? BOOKING_ID,
    ref: input.ref ?? REF,
    status,
    source: "web",
    is_test: input.is_test ?? true,
    link_version: 1,
    created_at: "2026-10-01T08:00:00.000Z",
    updated_at: "2026-10-01T08:00:00.000Z",
    requested_at: status === "held" ? null : "2026-10-01T08:30:00.000Z",
    hold_expires_at: null,
    deadline: status === "awaiting_payment" ? "2026-10-27T08:30:00.000Z" : null,
    guest: { name: "[Guest name]", email: "guest@example.test", phone: null, nationality: null, special_requests: null, emergency_name: null, emergency_phone: null, locale: "en" },
    stay: { id: "00000000-0000-4000-8000-0000000000e1", slug: "stay-one", title: "[Stay one]" },
    destination: { id: DESTINATION_ID, name: "[Destination one]" },
    arrive: "2026-12-01",
    leave: "2026-12-05",
    nights: 4,
    adults: 2,
    children: 0,
    infants: 0,
    airport: null,
    pickup_address: null,
    terms_version: null,
    terms_accepted_at: null,
    plan: "deposit",
    money,
    flags: {
      needs_attention: reason !== null,
      attention_reason: reason,
      part_received: status === "awaiting_payment" && paid > 0,
      overpaid: paid - refunded > grand,
      written_off: off > 0,
      settled_fils: settled,
      due_now_fils: status === "awaiting_payment" ? Math.max(deposit - settled, 0) : 0,
      still_due_fils: Math.max(grand - settled, 0),
      balance_overdue: false,
      deadline_passed: input.deadline_passed ?? false,
    },
    travellers: [{ kind: "adult", full_name: "[Guest name]", age: null, is_booker: true, not_staying: false }],
    lines: [],
    payments: input.payments ?? [],
    refunds,
    notes: [],
    events: input.events ?? [],
    lapse_email: { sent_at: null, attempts: 0, claimed_at: null },
  };
}

export function toItem(b: OwnerDetail): OwnerItem {
  return {
    id: b.id,
    ref: b.ref,
    status: b.status,
    source: b.source,
    is_test: b.is_test,
    guest_name: b.guest.name,
    email: b.guest.email,
    stay_slug: b.stay.slug,
    stay_title: b.stay.title,
    destination_id: b.destination.id,
    destination_name: b.destination.name,
    arrive: b.arrive,
    leave: b.leave,
    guests: b.adults + b.children + b.infants,
    plan: b.plan,
    grand_fils: b.money.grand_fils,
    paid_fils: b.money.paid_fils,
    written_off_fils: b.money.written_off_fils,
    due_now_fils: b.flags.due_now_fils,
    deadline: b.deadline,
    balance_due_date: b.money.balance_due_date,
    created_at: b.created_at,
    requested_at: b.requested_at,
    flags: b.flags,
  };
}

export function succeededPayment(over: Partial<OwnerPayment> = {}): OwnerPayment {
  return {
    id: PAYMENT_ID,
    kind: "deposit",
    method: "bank_transfer",
    status: "succeeded",
    amount_fils: DEPOSIT,
    received_on: "2026-10-10",
    bank_reference: "[Bank ref]",
    recorded_by: "00000000-0000-4000-8000-0000000000f1",
    recorded_by_email: "owner@example.test",
    created_at: "2026-10-10T08:00:00.000Z",
    write_off_fils: 0,
    write_off_reason: null,
    void_reason: null,
    voided_at: null,
    voided_by: null,
    voided_by_email: null,
    card_brand: null,
    card_last4: null,
    ...over,
  };
}

/** Plan 05-03: one bank refund row as ops_get_booking returns it. */
export function succeededRefund(over: Partial<OwnerRefund> = {}): OwnerRefund {
  return {
    id: 1,
    method: "bank_transfer",
    status: "succeeded",
    amount_fils: 100_000,
    refunded_on: "2026-10-12",
    bank_reference: "[Refund bank ref]",
    reason: null,
    recorded_by: "00000000-0000-4000-8000-0000000000f1",
    recorded_by_email: "owner@example.test",
    created_at: "2026-10-12T08:00:00.000Z",
    void_reason: null,
    voided_at: null,
    voided_by: null,
    voided_by_email: null,
    ...over,
  };
}

export const SITE_STATUS = {
  state: "up_to_date",
  requested_seq: 5,
  live_seq: 5,
  requested_at: "2026-10-13T10:02:00.000Z",
  built_at: "2026-10-13T10:05:00.000Z",
  last_hook_at: "2026-10-13T10:02:00.000Z",
  last_hook_result: "ok",
};

const json = (route: Route, answer: Answer) => route.fulfill({ status: answer.status, contentType: "application/json", body: JSON.stringify(answer.body) });
const ok = (extra: Record<string, unknown>): Answer => ({ status: 200, body: { ok: true, ...extra } });
export const refusal = (status: number, code: string, field: string | null = null, detail: unknown = null): Answer => ({
  status,
  body: { ok: false, error: { code, field, locale: null, detail } },
});

export type BookingsApi = {
  /** Every request in order. */
  calls: Call[];
  /** The calls to one path (and method). */
  to: (path: string, method?: string) => Call[];
  /** The live booking store, by reference. */
  store: Map<string, OwnerDetail>;
};

/**
 * Answers every /api/ops/* the Bookings pages call: the list (by q, status, destination, from, to, after), the detail
 * (?ref=), the six writes, the destinations and the site status. `bookings` are the rows the store starts with.
 */
export async function mockBookingsApi(page: Page, bookings: OwnerDetail[] = [makeBooking()], override?: Override): Promise<BookingsApi> {
  const store = new Map(bookings.map((b) => [b.ref, structuredClone(b)]));
  const calls: Call[] = [];

  async function handle(route: Route, run: (call: Call) => Answer): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    let body: unknown = null;
    if (method !== "GET") {
      try {
        body = request.postDataJSON();
      } catch {
        body = request.postData();
      }
    }
    const call: Call = { method, path: url.pathname, query: Object.fromEntries(url.searchParams), body };
    calls.push(call);
    const overridden = override ? await override(call) : undefined;
    await json(route, overridden ?? run(call));
  }

  const byId = (id: unknown) => [...store.values()].find((b) => b.id === id);
  const reread = (b: OwnerDetail) => {
    b.flags = makeBooking({
      status: b.status,
      grand_fils: b.money.grand_fils,
      deposit_fils: b.money.deposit_fils,
      paid_fils: b.money.paid_fils,
      written_off_fils: b.money.written_off_fils,
      refunded_fils: b.money.refunded_fils,
      deadline_passed: b.flags.deadline_passed,
      attention_reason: b.flags.attention_reason,
    }).flags;
  };

  await page.route("**/api/ops/site-status", (route) => handle(route, () => ok({ site: SITE_STATUS })));
  await page.route(/\/api\/ops\/destinations(\?.*)?$/, (route) =>
    handle(route, () =>
      ok({ items: [{ id: DESTINATION_ID, slug: "destination-one", name_en: "[Destination one]", name_ar: "[Destination one AR]", name_es: "[Destination one ES]", is_published: true, position: 1 }], next: null }),
    ),
  );
  await page.route(/\/api\/ops\/bookings(\?.*)?$/, (route) =>
    handle(route, (call) => {
      const q = (call.query.q ?? "").toLowerCase();
      const items = [...store.values()]
        .filter((b) => q === "" || b.ref.toLowerCase().includes(q) || b.guest.name.toLowerCase().includes(q))
        .filter((b) => !call.query.status || call.query.status === "all" || b.status === call.query.status || (call.query.status === "attention" && b.flags.needs_attention))
        .filter((b) => !call.query.destination || b.destination.id === call.query.destination)
        .map(toItem);
      return ok({ items, next: null });
    }),
  );
  await page.route(/\/api\/ops\/booking(\?.*)?$/, (route) =>
    handle(route, (call) => {
      const found = store.get(call.query.ref ?? "");
      return found ? ok({ booking: found }) : refusal(404, "not_found");
    }),
  );
  await page.route(/\/api\/ops\/booking\/payment$/, (route) =>
    handle(route, (call) => {
      const body = call.body as { booking_id: string; amount: string; received_on: string; bank_reference: string; accept_short?: boolean };
      const b = byId(body.booking_id);
      if (!b) return refusal(404, "not_found");
      const fils = Math.round(Number(String(body.amount).replace(/,/g, "")) * 100);
      const payment = succeededPayment({ amount_fils: fils, received_on: body.received_on, bank_reference: body.bank_reference });
      b.payments.push(payment);
      b.money.paid_fils += fils;
      b.status = b.money.paid_fils >= b.money.grand_fils ? "paid_in_full" : b.money.paid_fils >= b.money.deposit_fils ? "deposit_paid" : b.status;
      b.events.unshift({ id: b.events.length + 1, at: "2026-10-25T09:00:00.000Z", actor: "system", action: "email_sent", from_status: null, to_status: null, detail: { template: "payment_receipt", key: `receipt/${payment.id}` } });
      reread(b);
      return ok({ payment, mail: { receipt: "sent", owner: "sent" } });
    }),
  );
  await page.route(/\/api\/ops\/booking\/void$/, (route) =>
    handle(route, (call) => {
      const body = call.body as { payment_id: string; reason: string };
      const b = [...store.values()].find((one) => one.payments.some((p) => p.id === body.payment_id));
      const payment = b?.payments.find((p) => p.id === body.payment_id);
      if (!b || !payment) return refusal(404, "not_found");
      // The SQL's rule: payments cannot drop below what was refunded.
      if (b.money.paid_fils - payment.amount_fils < b.money.refunded_fils) return refusal(409, "refund_first");
      payment.status = "voided";
      payment.void_reason = body.reason;
      b.money.paid_fils -= payment.amount_fils;
      reread(b);
      return ok({ voided: { payment_id: payment.id } });
    }),
  );
  // Plan 05-03: record a refund and void a refund record, answered as the SQL does (above_paid, a replay on request_id).
  const refundRequests = new Map<string, OwnerRefund>();
  let nextRefundId = 100;
  await page.route(/\/api\/ops\/booking\/refund$/, (route) =>
    handle(route, (call) => {
      const body = call.body as { booking_id: string; request_id: string; amount: string; refunded_on: string; bank_reference: string; reason: string | null };
      const b = byId(body.booking_id);
      if (!b) return refusal(404, "not_found");
      const seen = refundRequests.get(body.request_id);
      if (seen) return ok({ refund: { first_time: false, refund_id: seen.id, amount_fils: seen.amount_fils }, mail: "skipped" });
      const fils = Math.round(Number(String(body.amount).replace(/,/g, "")) * 100);
      const left = Math.max(0, b.money.paid_fils - b.money.refunded_fils);
      if (left <= 0) return refusal(409, "nothing_to_refund");
      if (fils > left) return refusal(409, "above_paid");
      nextRefundId += 1;
      const refund = succeededRefund({ id: nextRefundId, amount_fils: fils, refunded_on: body.refunded_on, bank_reference: body.bank_reference, reason: body.reason });
      b.refunds.push(refund);
      b.money.refunded_fils += fils;
      refundRequests.set(body.request_id, refund);
      b.events.unshift({ id: b.events.length + 1, at: "2026-10-25T09:00:00.000Z", actor: "system", action: "email_sent", from_status: null, to_status: null, detail: { template: "refund_receipt", key: `refund-receipt/${refund.id}` } });
      b.events.unshift({ id: b.events.length + 1, at: "2026-10-25T09:00:00.000Z", actor: `owner:${refund.recorded_by}`, action: "refund_recorded", from_status: null, to_status: null, detail: { refund_id: refund.id, amount_fils: fils } });
      reread(b);
      if (b.flags.attention_reason === "overpaid" && b.money.paid_fils - b.money.refunded_fils <= b.money.grand_fils) {
        b.flags.needs_attention = false;
        b.flags.attention_reason = null;
      }
      return ok({ refund: { first_time: true, refund_id: refund.id, amount_fils: fils, refunded_fils: b.money.refunded_fils }, mail: "sent" });
    }),
  );
  await page.route(/\/api\/ops\/booking\/refund-void$/, (route) =>
    handle(route, (call) => {
      const body = call.body as { refund_id: number; reason: string };
      const b = [...store.values()].find((one) => one.refunds.some((r) => r.id === body.refund_id));
      const refund = b?.refunds.find((r) => r.id === body.refund_id);
      if (!b || !refund) return refusal(404, "not_found");
      if (refund.status !== "succeeded") return refusal(409, "not_voidable");
      refund.status = "voided";
      refund.void_reason = body.reason;
      refund.voided_at = "2026-10-25T09:30:00.000Z";
      refund.voided_by_email = "owner@example.test";
      b.money.refunded_fils -= refund.amount_fils;
      b.events.unshift({ id: b.events.length + 1, at: "2026-10-25T09:30:00.000Z", actor: `owner:${refund.recorded_by}`, action: "refund_voided", from_status: null, to_status: null, detail: { refund_id: refund.id, amount_fils: refund.amount_fils } });
      reread(b);
      return ok({ void: { first_time: true, refund_id: refund.id, refunded_fils: b.money.refunded_fils } });
    }),
  );
  await page.route(/\/api\/ops\/booking\/status$/, (route) =>
    handle(route, (call) => {
      const body = call.body as { booking_id: string; action: "confirm" | "complete" | "cancel" };
      const b = byId(body.booking_id);
      if (!b) return refusal(404, "not_found");
      const from = b.status;
      b.status = body.action === "confirm" ? "confirmed" : body.action === "complete" ? "completed" : "cancelled";
      reread(b);
      return ok({ status: { from, to: b.status } });
    }),
  );
  const noteRequests = new Map<string, { id: string; at: string }>();
  await page.route(/\/api\/ops\/booking\/note$/, (route) =>
    handle(route, (call) => {
      const body = call.body as { booking_id: string; body: string; request_id: string };
      const b = byId(body.booking_id);
      if (!b) return refusal(404, "not_found");
      // The server's replay rule: the same request_id answers the stored note, first_time false.
      const seen = noteRequests.get(body.request_id);
      if (seen) return ok({ first_time: false, note: seen });
      const note = { id: `00000000-0000-4000-8000-00000000${String(b.notes.length + 10).padStart(4, "0")}`, at: "2026-10-25T09:00:00.000Z", actor: "owner", actor_email: "owner@example.test", body: body.body };
      b.notes.unshift(note);
      noteRequests.set(body.request_id, { id: note.id, at: note.at });
      return ok({ first_time: true, note: { id: note.id, at: note.at } });
    }),
  );
  await page.route(/\/api\/ops\/booking\/attention$/, (route) =>
    handle(route, (call) => {
      const body = call.body as { booking_id: string };
      const b = byId(body.booking_id);
      if (!b) return refusal(404, "not_found");
      b.flags.needs_attention = false;
      b.flags.attention_reason = null;
      return ok({ resolved: { first_time: true, note_id: "00000000-0000-4000-8000-0000000000aa" } });
    }),
  );
  await page.route(/\/api\/ops\/booking\/resend$/, (route) => handle(route, () => ok({ mail: "sent" })));

  return { calls, to: (path, method) => calls.filter((c) => c.path === path && (method === undefined || c.method === method)), store };
}
