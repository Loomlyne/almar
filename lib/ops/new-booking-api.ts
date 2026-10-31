// Phase 5 plan 05-02 Task 1: the owner's New booking endpoints (OPS-06): availability, quote and create. No Next import and no
// Supabase import at runtime, so node tests call the handlers with a fake `rpc`; the three route files under
// app/api/ops/booking/ bind them through lib/ops/new-booking.ts, after lib/ops/route.ts has run requireOwner(), the Origin
// check, the 64 KiB JSON read and the parse.
//
// Money is never taken from the browser (T-05-02-02): the bodies carry no fils. The server prices the stay through
// priceOwnerQuote (the stay's rates, or the owner's agreed price read by parseAedAmount), with VAT and the deposit from
// Settings, and stores that snapshot (snapshotRow) in ONE ops_create_booking call, which checks every sum again. A hand-made
// booking sends no traveller and no terms key (P5-13). The guest gets the request_received mail with its own heading and
// first line (P5-05); the owner gets no notice of a booking she made herself. Nothing here logs and no reply sets
// affects_site. The contract of the bodies and answers is lib/ops/new-booking-contract.ts (05-01), never edited here.
import { isPlainEmail } from "../email-address";
import { deliverMail, mailKey, type MailOutcome } from "../booking/notify";
import { isBookingRef } from "../booking/ref";
import { priceOwnerQuote, snapshotRow, stayAvailability } from "../booking/server";
import type { Airport, BookingLocale } from "../booking/types";
import { needsPickupAddress } from "../booking/validate";
import { requestMail, parseAedAmount, type OwnerDetail } from "./booking-rules";
import { mapBookingRefusal, type BookingsDeps, type BookingsOwner, type OpsDb } from "./bookings-api";
import type {
  NewBookingAvailabilityAnswer,
  NewBookingAvailabilityBody,
  NewBookingCreateAnswer,
  NewBookingCreateBody,
  NewBookingQuoteAnswer,
  NewBookingQuoteBody,
  OwnerBreakdown,
} from "./new-booking-contract";
import { errorBody, OpsInvalid, type OpsOutcome, type OpsResult } from "./route-core";
import { bool, has, int, isoDay, onlyKeys, record, requiredText, slug, uuid } from "./validate";

/** The two request gates as the owner's screen needs them: open or not, for a real booking and for a TEST one. */
export type NewBookingDeps = BookingsDeps & { gates: (db: OpsDb) => Promise<{ real: { open: boolean }; test: { open: boolean } }> };

type Row = Record<string, unknown>;

function ok(body: Record<string, unknown>): OpsResult {
  return { body: { ok: true, ...body } };
}

function refused(status: number, code: string, field: string | null = null, detail: unknown = null): OpsResult {
  return { status, body: errorBody(code, field, null, detail) };
}

function isRow(value: unknown): value is Row {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const UNREADABLE: { dbError: { code: string } } = { dbError: { code: "unreadable" } };
const UNAVAILABLE: { dbError: { code: string } } = { dbError: { code: "unavailable" } };

// ------------------------------------------------------------------------------------------------------------
// Parsers
// ------------------------------------------------------------------------------------------------------------

const MAX_NIGHTS = 366;
const LOCALES: readonly string[] = ["en", "ar", "es"];
const AIRPORTS: readonly string[] = ["DXB", "AUH", "SHJ"];
/** The phone pattern of booking_write (SQL), and its hold_until pattern. */
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const HOLD = /^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}(:[0-9]{2}(\.[0-9]{1,6})?)?(Z|[+-][0-9]{2}:[0-9]{2})$/;

function chars(text: string): number {
  return [...text].length;
}

function sized(value: unknown, field: string, min: number, max: number): string {
  const out = requiredText(value, field, { max });
  if (chars(out) < min) throw new OpsInvalid(field);
  return out;
}

function nightsBetween(from: string, to: string): number {
  return (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
}

function range(b: Row): { from: string; to: string } {
  const from = isoDay(b.from, "from");
  const to = isoDay(b.to, "to");
  const nights = nightsBetween(from, to);
  if (nights < 1) throw new OpsInvalid("to");
  if (nights > MAX_NIGHTS) throw new OpsInvalid("to");
  return { from, to };
}

const QUOTE_KEYS = ["stay", "from", "to", "adults", "children", "infants", "addons", "plan", "locale", "agreed_amount"] as const;

/** POST /api/ops/booking/availability: a stay slug and a range of 1..366 nights. */
export function parseAvailability(body: unknown): NewBookingAvailabilityBody {
  const b = record(body, "body");
  onlyKeys(b, ["stay", "from", "to"]);
  return { stay: slug(b.stay, "stay"), ...range(b) };
}

function quoteFields(b: Row): NewBookingQuoteBody {
  const addonsRaw = b.addons;
  if (!Array.isArray(addonsRaw) || addonsRaw.length > 50) throw new OpsInvalid("addons");
  const addons = addonsRaw.map((item) => {
    const a = record(item, "addons");
    onlyKeys(a, ["id", "qty"], "addons.");
    return { id: uuid(a.id, "addons.id"), qty: int(a.qty, "addons.qty", { min: 1, max: 99 }) };
  });
  if (new Set(addons.map((a) => a.id)).size !== addons.length) throw new OpsInvalid("addons");
  if (b.plan !== "deposit" && b.plan !== "full") throw new OpsInvalid("plan");
  if (typeof b.locale !== "string" || !LOCALES.includes(b.locale)) throw new OpsInvalid("locale");
  let agreed: string | null = null;
  if (has(b, "agreed_amount") && b.agreed_amount !== null) {
    if (typeof b.agreed_amount !== "string" || parseAedAmount(b.agreed_amount) === null) throw new OpsInvalid("agreed_amount");
    agreed = b.agreed_amount.trim();
  }
  return {
    stay: slug(b.stay, "stay"),
    ...range(b),
    adults: int(b.adults, "adults", { min: 1, max: 99 }),
    children: int(b.children, "children", { min: 0, max: 99 }),
    infants: int(b.infants, "infants", { min: 0, max: 99 }),
    addons,
    plan: b.plan,
    locale: b.locale as BookingLocale,
    agreed_amount: agreed,
  };
}

/** POST /api/ops/booking/quote. */
export function parseQuote(body: unknown): NewBookingQuoteBody {
  const b = record(body, "body");
  onlyKeys(b, QUOTE_KEYS);
  return quoteFields(b);
}

/**
 * POST /api/ops/booking/create. The email is trimmed and lowercased (the SQL wants lowercase), the phone matches the SQL
 * pattern, hold_until carries an offset (the screen sends +04:00), agreed_reason is 3..300 characters exactly when an
 * agreed amount is sent. No traveller and no terms key exists (P5-13): an unknown key is refused.
 */
export function parseCreate(body: unknown): NewBookingCreateBody {
  const b = record(body, "body");
  onlyKeys(b, [...QUOTE_KEYS, "request_id", "guest", "airport", "pickup_address", "hold_until", "is_test", "agreed_reason"]);
  const quote = quoteFields(b);
  const request_id = uuid(b.request_id, "request_id");
  const g = record(b.guest, "guest");
  onlyKeys(g, ["name", "email", "phone"], "guest.");
  const name = sized(g.name, "guest.name", 1, 120);
  const email = typeof g.email === "string" ? g.email.trim().toLowerCase() : "";
  if (!isPlainEmail(email)) throw new OpsInvalid("guest.email");
  const phone = typeof g.phone === "string" ? g.phone.trim() : "";
  if (!PHONE.test(phone)) throw new OpsInvalid("guest.phone");
  let airport: Airport | null = null;
  if (has(b, "airport") && b.airport !== null) {
    if (typeof b.airport !== "string" || !AIRPORTS.includes(b.airport)) throw new OpsInvalid("airport");
    airport = b.airport as Airport;
  }
  let pickup_address: string | null = null;
  if (has(b, "pickup_address") && b.pickup_address !== null) pickup_address = sized(b.pickup_address, "pickup_address", 1, 300);
  const hold = typeof b.hold_until === "string" ? b.hold_until.trim() : "";
  if (!HOLD.test(hold) || !Number.isFinite(Date.parse(hold))) throw new OpsInvalid("hold_until");
  const is_test = bool(b.is_test, "is_test");
  let agreed_reason: string | null = null;
  if (quote.agreed_amount !== null) agreed_reason = sized(b.agreed_reason, "agreed_reason", 3, 300);
  else if (b.agreed_reason !== undefined && b.agreed_reason !== null) throw new OpsInvalid("agreed_reason");
  return { ...quote, request_id, guest: { name, email, phone }, airport, pickup_address, hold_until: hold, is_test, agreed_reason };
}

// ------------------------------------------------------------------------------------------------------------
// Reads
// ------------------------------------------------------------------------------------------------------------

/** POST /api/ops/booking/availability: the stay's blocked and taken nights in the range, and whether it has a rate for them. */
export async function postAvailability({ owner, body }: { owner: BookingsOwner; body: NewBookingAvailabilityBody }): Promise<OpsOutcome> {
  try {
    const a = await stayAvailability(owner.admin, body);
    const answer: NewBookingAvailabilityAnswer = { ok: true, stay: a.stay, blocked: a.blocked, taken: a.taken, has_rate: a.hasRate };
    return ok({ ...answer });
  } catch {
    return UNAVAILABLE;
  }
}

function agreedFils(text: string | null): number | null {
  return text === null ? null : parseAedAmount(text);
}

/** The server's price as the browser may see it: each night without its rate-range id. */
function ownerBreakdown(breakdown: NonNullable<Awaited<ReturnType<typeof priceOwnerQuote>>["breakdown"]>): OwnerBreakdown {
  return { ...breakdown, nights: breakdown.nights.map((n) => ({ night: n.night, rateFils: n.rateFils, source: n.source })) };
}

/**
 * POST /api/ops/booking/quote: every reason and the server's own price. No rate and no agreed amount: needs_agreed true and no
 * breakdown. The answer carries the two gates as booleans only (never a reason, never a bank value). Any throw is 503.
 */
export async function postQuote({ owner, body }: { owner: BookingsOwner; body: NewBookingQuoteBody }, deps: NewBookingDeps): Promise<OpsOutcome> {
  const agreed = agreedFils(body.agreed_amount);
  if (body.agreed_amount !== null && agreed === null) return refused(400, "invalid", "agreed_amount");
  try {
    const { agreed_amount: _text, ...request } = body;
    void _text;
    const quote = await priceOwnerQuote(owner.admin, request, agreed);
    const gates = await deps.gates(owner.admin);
    const answer: NewBookingQuoteAnswer = {
      ok: true,
      reasons: quote.reasons,
      stay: quote.stay,
      offers: quote.offers,
      breakdown: quote.breakdown ? ownerBreakdown(quote.breakdown) : null,
      needs_agreed: agreed === null && quote.reasons.some((r) => r.code === "no_rate"),
      real_open: gates.real.open,
      test_open: gates.test.open,
    };
    return ok({ ...answer });
  } catch {
    return UNAVAILABLE;
  }
}

// ------------------------------------------------------------------------------------------------------------
// Create
// ------------------------------------------------------------------------------------------------------------

/** Codes of the SQL that the screen knows; every one is 409 (invalid and the rest go through mapBookingRefusal). */
const SQL_CONFLICTS = new Set(["settings_missing", "settings_changed", "hold_too_soon", "stay_unavailable", "below_minimum_charge", "blocked", "sold_out"]);

function sqlConflict(error: { code?: string; message?: string } | null): OpsResult | null {
  if (error?.code !== "P0001" || typeof error.message !== "string" || !error.message.startsWith("almar:")) return null;
  const name = error.message.slice("almar:".length);
  return SQL_CONFLICTS.has(name) ? refused(409, name) : null;
}

const TEMPLATE = "request_received";

/** One email_failed event with the mail's key, so the detail page shows it and offers the resend. Best effort. */
async function logMailFailure(db: OpsDb, bookingId: string, key: string, error: string): Promise<void> {
  try {
    await db.rpc("log_booking_event", { p_booking: bookingId, p_actor: "system", p_action: "email_failed", p_detail: { template: TEMPLATE, key, error } });
  } catch {
    // The answer stands without its event.
  }
}

/**
 * The guest's mail after a create. A replay (the booking already holds a mail of its request key) sends nothing. Else the
 * hand-made request_received mail, key request/<id>, no owner notice. A missing view, a null link or a throw is "failed",
 * logged so the detail page offers the resend. Never throws.
 */
async function guestMail(
  owner: BookingsOwner,
  deps: NewBookingDeps,
  booking: { id: string; ref: string; linkVersion: number },
  body: NewBookingCreateBody,
): Promise<NewBookingCreateAnswer["mail"]> {
  const key = mailKey("requestReceived", booking.id);
  try {
    const read = await owner.admin.rpc("ops_get_booking", { p_ref: booking.ref });
    if (!read.error && isRow(read.data) && Array.isArray(read.data.events)) {
      const detail = { id: booking.id, events: read.data.events as OwnerDetail["events"] };
      if (requestMail(detail) !== "none") return "skipped";
    }
    const view = await deps.view(owner.admin, booking.id, { isTest: body.is_test });
    if (!view) {
      await logMailFailure(owner.admin, booking.id, key, "no_view");
      return "failed";
    }
    const bookingUrl = await deps.bookingUrl({ id: booking.id, ref: booking.ref, locale: view.locale, isTest: body.is_test, linkVersion: booking.linkVersion });
    if (bookingUrl === null) {
      await logMailFailure(owner.admin, booking.id, key, "no_link");
      return "failed";
    }
    const notifier = deps.notifier();
    const job = { bookingId: booking.id, view, isTest: body.is_test, bookingUrl, handMade: true };
    return await deliverMail(owner.admin, {
      bookingId: booking.id,
      template: TEMPLATE,
      idempotencyKey: key,
      ready: notifier.ready,
      send: async (): Promise<MailOutcome> => {
        try {
          return await notifier.requestReceived(job, { idempotencyKey: key });
        } catch {
          return { ok: false, error: "threw" };
        }
      },
    });
  } catch {
    await logMailFailure(owner.admin, booking.id, key, "threw");
    return "failed";
  }
}

/**
 * POST /api/ops/booking/create, in this order: the gate for this is_test (B-13); the server's own price in English (the
 * booking's add-on lines store English; body.locale is the booking's language and goes only in the payload); any reason but
 * blocked and sold_out refuses with no rpc (those two go on because a replay of this same request holds those nights
 * itself, and place_hold still refuses a real clash under lock); a home-pickup line needs an address; then ONE
 * ops_create_booking with the snapshot of that price; then the guest's mail. The same request_id answers the first booking.
 */
export async function postCreate({ owner, body }: { owner: BookingsOwner; body: NewBookingCreateBody }, deps: NewBookingDeps): Promise<OpsOutcome> {
  let gates: Awaited<ReturnType<NewBookingDeps["gates"]>>;
  try {
    gates = await deps.gates(owner.admin);
  } catch {
    return UNAVAILABLE;
  }
  if (!(body.is_test ? gates.test.open : gates.real.open)) return refused(409, "requests_closed");

  const agreed = agreedFils(body.agreed_amount);
  if (body.agreed_amount !== null && agreed === null) return refused(400, "invalid", "agreed_amount");
  if ((agreed === null) !== (body.agreed_reason === null)) return refused(400, "invalid", "agreed_reason");

  let quote: Awaited<ReturnType<typeof priceOwnerQuote>>;
  try {
    quote = await priceOwnerQuote(
      owner.admin,
      { stay: body.stay, from: body.from, to: body.to, adults: body.adults, children: body.children, infants: body.infants, addons: body.addons, plan: body.plan, locale: "en" },
      agreed,
    );
  } catch {
    return UNAVAILABLE;
  }
  const breakdown = quote.breakdown;
  const blocking = quote.reasons.filter((r) => r.code !== "blocked" && r.code !== "sold_out");
  if (!breakdown || blocking.length > 0) {
    const reasons = quote.reasons.length > 0 ? quote.reasons : [{ code: "unavailable" as const }];
    return refused(409, (blocking[0] ?? reasons[0]).code, null, { reasons });
  }

  const homePickup = new Map(quote.offers.map((o) => [o.id, o.isHomePickup]));
  const pickup = needsPickupAddress(breakdown.lines.map((l) => ({ isHomePickup: homePickup.get(l.id) === true, quantity: l.quantity })));
  if (pickup && body.pickup_address === null) return refused(400, "invalid", "pickup_address");

  const p: Record<string, unknown> = {
    ...snapshotRow(breakdown, quote.offers),
    stay_slug: body.stay,
    arrive: body.from,
    leave: body.to,
    adults: body.adults,
    children: body.children,
    infants: body.infants,
    guest_name: body.guest.name,
    email: body.guest.email,
    phone: body.guest.phone,
    locale: body.locale,
    is_test: body.is_test,
    ops_request_id: body.request_id,
    hold_until: body.hold_until,
  };
  if (body.airport !== null) p.airport = body.airport;
  if (body.pickup_address !== null) p.pickup_address = body.pickup_address;
  if (agreed !== null) p.agreed_reason = body.agreed_reason;

  let created: { data: unknown; error: { code?: string; message?: string; details?: string | null; hint?: string } | null };
  try {
    created = await owner.admin.rpc("ops_create_booking", { p, p_actor: owner.profile.id });
  } catch {
    return UNAVAILABLE;
  }
  if (created.error) return sqlConflict(created.error) ?? mapBookingRefusal(created.error);
  const data = created.data;
  if (
    !isRow(data) ||
    typeof data.booking_id !== "string" ||
    !isBookingRef(data.ref) ||
    typeof data.hold_expires_at !== "string" ||
    typeof data.link_version !== "number" ||
    !Number.isSafeInteger(data.link_version)
  ) {
    return UNREADABLE;
  }
  const mail = await guestMail(owner, deps, { id: data.booking_id, ref: data.ref, linkVersion: data.link_version }, body);
  const answer: NewBookingCreateAnswer = { ok: true, booking_id: data.booking_id, ref: data.ref, hold_expires_at: data.hold_expires_at, link_version: data.link_version, mail };
  return ok({ ...answer });
}
