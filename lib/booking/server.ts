// Server side of the booking endpoints (plans 04-02 and 04-08): the live quote with every reason, the hold, the release,
// the snake_case payload both SQL create functions read, the request gate, and the guest's request, view and withdraw
// with their emails. `db` is anything with `.rpc(name, args)`, so the routes pass the service-role client and the tests
// pass a fake. No environment, no Next, no Supabase import: the routes own those.
//
// Money is never taken from the browser: the quote reads the stay, its night rates, the add-on prices and the owner's
// settings from `booking_context` and prices them with lib/money (the one engine); the hold re-quotes and stores that
// snapshot. A value the owner has not set (VAT, deposit, balance days) arrives as null and is a reason, never a default.
import { mediaUrl } from "../data/media";
import { priceBooking, type AddOnUnit, type NightRate, type PriceReason, type PriceSnapshot } from "../money/booking-price";
import { daysBetween, dubaiToday, isIsoDate } from "../money/dates";
import { authorizeBookingAccess, type BookingAccessDeps } from "./access";
import { bookingLinkConfigured, signBookingLink, verifyBookingLink } from "./link";
import { deliverMail, mailKey, type BookingNotifier, type RequestMailJob } from "./notify";
import { bookingPagePath, originForBooking } from "./origin";
import { isBookingRef } from "./ref";
import { BOOKING_TERMS_VERSION } from "./terms";
import type {
  AddOnOffering,
  Airport,
  BookingLocale,
  BookingReason,
  BookingStatus,
  BookingView,
  GuestBookingSummary,
  HoldRequest,
  HoldResponse,
  PaymentMethod,
  PublicPriceSnapshot,
  QuoteRequest,
  QuoteResponse,
  ReasonCode,
  RequestRequest,
  RequestResponse,
  StayCard,
  TravellerInput,
  ViewRequest,
  ViewResponse,
  WithdrawRequest,
  WithdrawResponse,
} from "./types";
import { needsPickupAddress } from "./validate";

export type RpcError = { message?: string; details?: string | null } | null;
export type BookingDb = {
  rpc(name: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: RpcError }>;
};

type Raw = Record<string, unknown>;

const MAX_NIGHTS = 366;
const isUnit = (v: unknown): v is AddOnOffering["unit"] => v === "person" || v === "night" || v === "trip";
const isKind = (v: unknown): v is AddOnOffering["kind"] => v === "experience" || v === "service";
const SQL_REFUSALS = ["sold_out", "blocked", "stay_unavailable", "settings_missing", "settings_changed", "below_minimum_charge"] as const;

function isObj(value: unknown): value is Raw {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** One rpc whose failure is thrown. The message names the function only: never an argument, a detail or an address. */
async function call(db: BookingDb, name: string, args: Record<string, unknown>): Promise<unknown> {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error(`rpc ${name} failed`);
  return data;
}

// ---------------------------------------------------------------- reading booking_context

type Stay = {
  slug: string;
  maxGuests: number | null;
  minNights: number;
  infantsCount: boolean;
  baseRateFils: number | null;
  title: string;
  destinationName: string;
  imageKey: string | null;
  imageAlt: string | null;
};

type Context = {
  stay: Stay | null;
  nightRates: NightRate[];
  blocked: string[];
  taken: string[];
  offers: (AddOnOffering & { priceFils: number })[];
  inclusions: { id: string; label: string }[];
  vatBp: number | null;
  depositBp: number | null;
  balanceDueDays: number | null;
  today: string;
};

function unreadable(what: string): never {
  throw new Error(`booking_context: unreadable ${what}`);
}

const str = (v: unknown, what: string): string => (typeof v === "string" ? v : unreadable(what));
const strOrNull = (v: unknown, what: string): string | null => (v === null || v === undefined ? null : typeof v === "string" ? v : unreadable(what));
const intOrNull = (v: unknown, what: string): number | null =>
  v === null || v === undefined ? null : typeof v === "number" && Number.isSafeInteger(v) ? v : unreadable(what);
const int = (v: unknown, what: string): number => (typeof v === "number" && Number.isSafeInteger(v) ? v : unreadable(what));
const bool = (v: unknown, what: string): boolean => (typeof v === "boolean" ? v : unreadable(what));
const list = (v: unknown, what: string): unknown[] => (Array.isArray(v) ? v : unreadable(what));
const days = (v: unknown, what: string): string[] => list(v, what).map((d) => (isIsoDate(d) ? d : unreadable(what)));

function image(key: string | null, alt: string | null): { src: string; alt: string } | null {
  if (!key) return null;
  try {
    return { src: mediaUrl(key), alt: alt ?? "" };
  } catch {
    return null;
  }
}

function readContext(data: unknown): Context {
  if (!isObj(data)) return unreadable("answer");
  const rawStay = data.stay;
  let stay: Stay | null = null;
  if (isObj(rawStay) && rawStay.is_published === true) {
    stay = {
      slug: str(rawStay.slug, "stay.slug"),
      maxGuests: intOrNull(rawStay.max_guests, "stay.max_guests"),
      minNights: int(rawStay.min_nights, "stay.min_nights"),
      // null = the owner has not said (C-13): infants do not count toward the maximum until he says they do (plan 04-02).
      infantsCount: rawStay.infants_count === true,
      baseRateFils: intOrNull(rawStay.base_rate_fils, "stay.base_rate_fils"),
      title: str(rawStay.title, "stay.title"),
      destinationName: str(rawStay.destination_name, "stay.destination_name"),
      imageKey: strOrNull(rawStay.image_key, "stay.image_key"),
      imageAlt: strOrNull(rawStay.image_alt, "stay.image_alt"),
    };
  }

  const nightRates: NightRate[] = list(data.night_rates, "night_rates").map((row) => {
    if (!isObj(row)) return unreadable("night_rates");
    const source = row.source;
    if (source !== null && source !== "range" && source !== "base") return unreadable("night_rates.source");
    return { night: str(row.night, "night_rates.night"), rateFils: intOrNull(row.rate_fils, "night_rates.rate_fils"), source, rateId: strOrNull(row.rate_id, "night_rates.rate_id") };
  });

  const offers = list(data.offers, "offers").map((row) => {
    if (!isObj(row)) return unreadable("offers");
    const unit = row.unit;
    if (!isUnit(unit)) return unreadable("offers.unit");
    const kind = row.kind;
    if (!isKind(kind)) return unreadable("offers.kind");
    return {
      id: str(row.id, "offers.id"),
      slug: str(row.slug, "offers.slug"),
      kind,
      unit,
      isUae: bool(row.is_uae, "offers.is_uae"),
      isHomePickup: bool(row.is_home_pickup, "offers.is_home_pickup"),
      name: str(row.name, "offers.name"),
      image: image(strOrNull(row.image_key, "offers.image_key"), strOrNull(row.image_alt, "offers.image_alt")),
      priceFils: int(row.price_fils, "offers.price_fils"),
    };
  });

  const inclusions = list(data.inclusions, "inclusions").map((row) => {
    if (!isObj(row)) return unreadable("inclusions");
    return { id: str(row.id, "inclusions.id"), label: str(row.label, "inclusions.label") };
  });

  const settings = isObj(data.settings) ? data.settings : unreadable("settings");
  const today = data.today;
  if (!isIsoDate(today)) return unreadable("today");

  return {
    stay,
    nightRates,
    blocked: days(data.blocked, "blocked"),
    taken: days(data.taken, "taken"),
    offers,
    inclusions,
    vatBp: intOrNull(settings.vat_bp, "settings.vat_bp"),
    depositBp: intOrNull(settings.deposit_bp, "settings.deposit_bp"),
    balanceDueDays: intOrNull(settings.balance_due_days, "settings.balance_due_days"),
    today,
  };
}

// ---------------------------------------------------------------- the booking row behind a reference

type BookingRow = { id: string; email: string; linkVersion: number };

async function bookingByRef(db: BookingDb, ref: string): Promise<BookingRow | null> {
  const data = await call(db, "booking_by_ref", { p_ref: ref });
  if (data === null || data === undefined) return null;
  if (!isObj(data) || typeof data.id !== "string" || typeof data.email !== "string" || typeof data.link_version !== "number" || !Number.isSafeInteger(data.link_version)) {
    throw new Error("rpc booking_by_ref: unreadable answer");
  }
  return { id: data.id, email: data.email, linkVersion: data.link_version };
}

/** The id of the guest's own booking, only when the signed link for exactly that booking and version checks out. */
async function ownBookingId(db: BookingDb, hold: QuoteRequest["hold"]): Promise<string | null> {
  if (!hold || !bookingLinkConfigured()) return null;
  const row = await bookingByRef(db, hold.ref);
  if (!row) return null;
  return (await verifyBookingLink(row.id, row.linkVersion, hold.t)) ? row.id : null;
}

// ---------------------------------------------------------------- the quote

function mapPriceReason(reason: PriceReason): BookingReason {
  switch (reason.code) {
    case "addon_unavailable":
      return { code: "addon_unavailable", id: reason.id };
    case "addon_quantity":
      return { code: "addon_quantity", id: reason.id, max: reason.max };
    case "deposit_unavailable":
      return { code: "deposit_unavailable", cause: reason.cause };
    case "too_large":
      return { code: "invalid", field: reason.field, max: reason.max };
    default:
      return { code: reason.code };
  }
}

/** A quote with the engine's whole snapshot (each night's rate-range id included). For the server only: never sent to a browser. */
export type PricedQuote = Omit<QuoteResponse, "breakdown"> & { breakdown: PriceSnapshot | null };

/** The snapshot without each night's rate-range id: what the browser may see of a price. */
export function publicBreakdown(snapshot: PriceSnapshot): PublicPriceSnapshot {
  return { ...snapshot, nights: snapshot.nights.map((n) => ({ night: n.night, rateFils: n.rateFils, source: n.source })) };
}

/**
 * Every reason a stay and these dates cannot be booked as asked, with the server's own price (B-02: nothing is hidden
 * silently). One `booking_context` call; a second `booking_by_ref` only when the request carries the page's own hold.
 * Never throws for a guest's choice; a database failure throws and the route answers 503. The answer is the browser's:
 * its nights carry no rate-range id.
 */
export async function quoteBooking(db: BookingDb, input: QuoteRequest, opts: { now?: Date } = {}): Promise<QuoteResponse> {
  const quote = await priceQuote(db, input, opts);
  return { ...quote, breakdown: quote.breakdown ? publicBreakdown(quote.breakdown) : null };
}

/** `quoteBooking` with the whole snapshot, for the code that stores it (`snapshotRow`). Its answer never goes to a browser as it is. */
export async function priceQuote(db: BookingDb, input: QuoteRequest, opts: { now?: Date } = {}): Promise<PricedQuote> {
  const own = await ownBookingId(db, input.hold);
  const ctx = readContext(
    await call(db, "booking_context", { p_stay_slug: input.stay, p_from: input.from, p_to: input.to, p_locale: input.locale, p_own_booking: own }),
  );

  const stay = ctx.stay;
  if (!stay) {
    return { ok: false, reasons: [{ code: "stay_unavailable" }], stay: null, offers: [], inclusions: [], breakdown: null };
  }

  const card: StayCard = {
    slug: stay.slug,
    title: stay.title,
    destinationName: stay.destinationName,
    image: image(stay.imageKey, stay.imageAlt),
    maxGuests: stay.maxGuests,
    minNights: stay.minNights,
    infantsCount: stay.infantsCount,
  };
  const offers: AddOnOffering[] = ctx.offers;
  const respond = (reasons: BookingReason[], breakdown: PriceSnapshot | null): PricedQuote => ({
    ok: reasons.length === 0,
    reasons,
    stay: card,
    offers,
    inclusions: ctx.inclusions,
    breakdown,
  });

  // More than a year of nights is refused here: the context answers no night rows past 366 and the engine would throw.
  const nights = isIsoDate(input.from) && isIsoDate(input.to) ? daysBetween(input.from, input.to) : 0;
  if (nights < 1 || nights > MAX_NIGHTS) return respond([{ code: "dates_invalid" }], null);

  const priced = priceBooking({
    from: input.from,
    to: input.to,
    today: opts.now ? dubaiToday(opts.now) : ctx.today,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    baseRateFils: stay.baseRateFils,
    nightRates: ctx.nightRates,
    offers: ctx.offers.map((o) => ({ id: o.id, unit: o.unit, priceFils: o.priceFils })),
    picks: input.addons.map((a) => ({ id: a.id, quantity: a.qty })),
    vatBp: ctx.vatBp,
    depositBp: ctx.depositBp,
    balanceDueDays: ctx.balanceDueDays,
    plan: input.plan,
  });
  if (priced.reasons.some((r) => r.code === "dates_invalid")) return respond([{ code: "dates_invalid" }], null);

  const reasons: BookingReason[] = [];
  if (ctx.blocked.length > 0) reasons.push({ code: "blocked", nights: ctx.blocked });
  if (ctx.taken.length > 0) reasons.push({ code: "sold_out", nights: ctx.taken });
  if (nights < stay.minNights) reasons.push({ code: "below_min_nights", min: stay.minNights });
  const guests = input.adults + input.children + (stay.infantsCount ? input.infants : 0);
  if (stay.maxGuests !== null && guests > stay.maxGuests) reasons.push({ code: "over_max_guests", max: stay.maxGuests });
  for (const reason of priced.reasons) reasons.push(mapPriceReason(reason));
  return respond(reasons, priced.snapshot);
}

// ---------------------------------------------------------------- the snapshot both SQL functions read

/**
 * The money of a priced booking in the snake_case the SQL functions read (`create_web_booking`, `ops_create_booking`,
 * and 05-02's payload). `offers` names each add-on line (its name in the guest's language, the home-pickup flag); a line
 * whose offer is missing is a caller error. For plan full the deposit and the balance are 0 and the due date is null.
 */
export function snapshotRow(breakdown: PriceSnapshot, offers: readonly Pick<AddOnOffering, "id" | "name" | "isUae" | "isHomePickup">[]): Record<string, unknown> {
  const byId = new Map(offers.map((o) => [o.id, o]));
  const deposit = breakdown.plan === "deposit";
  return {
    nights_fils: breakdown.nightsFils,
    addons_fils: breakdown.addonsFils,
    subtotal_fils: breakdown.subtotalFils,
    vat_bp: breakdown.vatBp,
    vat_fils: breakdown.vatFils,
    grand_fils: breakdown.grandFils,
    deposit_bp: breakdown.depositBp,
    deposit_fils: deposit ? breakdown.dueNowFils : 0,
    balance_fils: deposit ? breakdown.balanceFils : 0,
    due_now_fils: breakdown.dueNowFils,
    plan: breakdown.plan,
    nights_snapshot: breakdown.nights.map((n) => {
      // The browser's price (quoteBooking) has no rate ids: storing it would silently lose them. Use priceQuote.
      if (n.rateId === undefined) throw new Error(`snapshotRow: night ${n.night} has no rateId (price it with priceQuote, not quoteBooking)`);
      return { night: n.night, rate_fils: n.rateFils, source: n.source, rate_id: n.rateId };
    }),
    balance_due_date: deposit ? breakdown.balanceDueDate : null,
    lines: breakdown.lines.map((line) => {
      const offer = byId.get(line.id);
      if (!offer) throw new Error(`snapshotRow: no offer for add-on line ${line.id}`);
      return {
        catalog_item_id: line.id,
        name: offer.name.slice(0, 200),
        unit: line.unit,
        is_uae: offer.isUae,
        is_home_pickup: offer.isHomePickup,
        unit_price_fils: line.unitPriceFils,
        quantity: line.quantity,
        line_fils: line.lineFils,
      };
    }),
  };
}

// ---------------------------------------------------------------- the hold

export type HoldContext = {
  /** The visitor's IP as a keyed hash (job 02's limiterHash): the raw address never reaches the database. */
  ipHash: string;
  /** The same keyed hash for the guest's email. */
  emailHash: (email: string) => string;
  isTest: boolean;
  /** The transfer window the request will get (the open gate's window), sent back in the ok answer. */
  transferWindowMinutes: number;
  now?: Date;
};

/** `bookingId` stays on the server and is never part of `response`. */
export type HoldOutcome = { response: HoldResponse; bookingId: string | null };

const refuse = (reasons: BookingReason[]): HoldOutcome => ({ response: { ok: false, reasons }, bookingId: null });

function sqlRefusal(reason: unknown): BookingReason {
  return (SQL_REFUSALS as readonly unknown[]).includes(reason) ? ({ code: reason } as BookingReason) : { code: "unavailable" };
}

function invalidFrom(error: NonNullable<RpcError>): BookingReason {
  try {
    const parsed: unknown = JSON.parse(error.details ?? "");
    if (isObj(parsed) && typeof parsed.field === "string") return { code: "invalid", field: parsed.field };
  } catch {
    // Details that are not JSON name no field.
  }
  return { code: "invalid" };
}

/**
 * The guest's 30-minute hold. Order: a fresh quote on the server (the page's numbers and its old hold are ignored),
 * any reason refuses, then the limiter (five holds an hour per email, twenty per IP; only a request that is about to
 * write claims a slot), then one `create_web_booking` transaction that re-checks the owner's settings, stores the
 * booking with its price snapshot (rate ids included) and places the nights.
 * Needs the link secret before it writes anything: a hold the guest cannot be given a link for is never created.
 */
export async function createWebHold(db: BookingDb, input: HoldRequest, ctx: HoldContext): Promise<HoldOutcome> {
  if (!bookingLinkConfigured()) throw new Error("booking link secret missing");

  const quote = await priceQuote(
    db,
    // English texts: the booking's add-on lines store the English name (the plan's "EN snapshot"); the guest's own
    // language is the booking's `locale`, which the emails use. The amounts do not depend on the language.
    { stay: input.stay, from: input.from, to: input.to, adults: input.adults, children: input.children, infants: input.infants, addons: input.addons, plan: input.plan, locale: "en" },
    { now: ctx.now },
  );
  if (!quote.ok) return refuse(quote.reasons);
  const breakdown = quote.breakdown;
  if (!breakdown) throw new Error("quote answered ok without a price");

  const flags = new Map(quote.offers.map((o) => [o.id, o.isHomePickup]));
  const pickup = needsPickupAddress(breakdown.lines.map((l) => ({ isHomePickup: flags.get(l.id) === true, quantity: l.quantity })));
  if (pickup && !input.pickupAddress) return refuse([{ code: "invalid", field: "pickupAddress" }]);

  // The limiter is claimed only now, once nothing is left to refuse before the write: a quote that says sold out or
  // blocked, or a missing address, costs the guest no slot (review 2026-10-05: five refused answers had locked a real
  // guest out for an hour).
  const slot = await call(db, "claim_hold_slot", { p_email_hash: ctx.emailHash(input.contact.email), p_ip_hash: ctx.ipHash });
  if (typeof slot !== "boolean") throw new Error("rpc claim_hold_slot failed");
  if (!slot) return refuse([{ code: "hold_limit" }]);

  const { contact } = input;
  const travellers = [...input.travellers.filter((t) => t.isBooker), ...input.travellers.filter((t) => !t.isBooker)].map((t) => ({
    kind: t.kind,
    full_name: t.fullName,
    ...(t.kind === "adult" || t.age === undefined ? {} : { age: t.age }),
    is_booker: t.isBooker,
    not_staying: t.notStaying,
  }));
  const payload: Record<string, unknown> = {
    ...snapshotRow(breakdown, quote.offers),
    stay_slug: input.stay,
    arrive: input.from,
    leave: input.to,
    adults: input.adults,
    children: input.children,
    infants: input.infants,
    guest_name: contact.name,
    email: contact.email,
    phone: contact.phone,
    locale: input.locale,
    airport: input.airport,
    terms_version: BOOKING_TERMS_VERSION,
    is_test: ctx.isTest,
    travellers,
  };
  if (contact.nationality !== undefined) payload.nationality = contact.nationality;
  if (contact.specialRequests !== undefined) payload.special_requests = contact.specialRequests;
  if (contact.emergencyName !== undefined) payload.emergency_name = contact.emergencyName;
  if (contact.emergencyPhone !== undefined) payload.emergency_phone = contact.emergencyPhone;
  if (pickup && input.pickupAddress) payload.pickup_address = input.pickupAddress;

  const { data, error } = await db.rpc("create_web_booking", { p: payload });
  if (error) {
    if (error.message === "almar:invalid") return refuse([invalidFrom(error)]);
    throw new Error("rpc create_web_booking failed");
  }
  if (!isObj(data)) throw new Error("rpc create_web_booking: unreadable answer");
  if (data.ok === false) return refuse([sqlRefusal(data.reason)]);

  const id = data.booking_id;
  const ref = data.ref;
  const expires = data.hold_expires_at;
  const version = data.link_version;
  if (data.ok !== true || typeof id !== "string" || !isBookingRef(ref) || typeof expires !== "string" || typeof version !== "number" || !Number.isSafeInteger(version)) {
    throw new Error("rpc create_web_booking: unreadable answer");
  }
  return {
    response: {
      ok: true,
      ref,
      holdExpiresAt: expires,
      linkToken: await signBookingLink(id, version),
      breakdown: publicBreakdown(breakdown),
      transferWindowMinutes: ctx.transferWindowMinutes,
      // The server's clock as it answers: the page's countdown runs from it, not from the device's clock.
      serverNow: (ctx.now ?? new Date()).toISOString(),
    },
    bookingId: id,
  };
}

/**
 * 200 for a hold, 429 for the limiter or too many open requests, 400 for a refused field, 503 for "not available" or
 * requests closed (the page shows the closed state), else 409 (the nights or the price changed).
 */
export function holdStatus(response: HoldResponse): 200 | 400 | 409 | 429 | 503 {
  if (response.ok) return 200;
  const codes = response.reasons.map((r) => r.code);
  if (codes.includes("hold_limit") || codes.includes("too_many_open")) return 429;
  if (codes.includes("unavailable") || codes.includes("requests_closed")) return 503;
  if (codes.includes("invalid")) return 400;
  return 409;
}

// ---------------------------------------------------------------- the request gate (04-08)

/** The transfer window of a TEST booking (P-06): the 35-minute floor, whatever the owner's window. */
export const TEST_TRANSFER_WINDOW_MINUTES = 35;

/** The shortest transfer window the owner can set (P-07); the SQL checks the same bound. */
const MIN_TRANSFER_WINDOW_MINUTES = 35;

/**
 * Why requests are closed. Never sent to a browser: the guest sees one `requests_closed`. 04-09's readiness block may
 * list them from `booking_gate()` plus the terms constant.
 */
export type GateReason = "terms_not_final" | "link_secret_missing" | "mail_not_ready" | "settings_missing" | "window_not_set" | "bank_incomplete";

/** The gate's database half, as `readBookingGate` reads it from `booking_gate()` (never a bank value). */
export type BookingGateState = { windowMinutes: number | null; bankComplete: boolean; settingsPresent: boolean };

/** Every input of the gate. The route puts them together (lib/booking/gate-server.ts); this file reads none of them. */
export type RequestGateInput = BookingGateState & {
  isTest: boolean;
  termsArePlaceholder: boolean;
  linkConfigured: boolean;
  mailReady: boolean;
};

/** An open gate always has a window: the owner's for a real booking, TEST_TRANSFER_WINDOW_MINUTES for a TEST one. */
export type RequestGate =
  | { isTest: boolean; open: true; windowMinutes: number; reasons: GateReason[] }
  | { isTest: boolean; open: false; windowMinutes: number | null; reasons: GateReason[] };

/**
 * Whether a guest may hold and request now. A real booking (the production host) needs the owner's terms (not the
 * placeholder), the link secret, a ready email sender (P-13), the owner's VAT and deposit settings, a transfer window
 * of at least 35 minutes and complete bank details (P-08). A TEST booking needs the link secret, the settings and the
 * bank details; placeholder terms, a sender that is not ready and an unset window are allowed, and its window is
 * TEST_TRANSFER_WINDOW_MINUTES. Each missing input adds its reason, in a fixed order.
 */
export function requestGate(input: RequestGateInput): RequestGate {
  const real = !input.isTest;
  const windowSet = input.windowMinutes !== null && Number.isSafeInteger(input.windowMinutes) && input.windowMinutes >= MIN_TRANSFER_WINDOW_MINUTES;
  const reasons: GateReason[] = [];
  if (real && input.termsArePlaceholder) reasons.push("terms_not_final");
  if (!input.linkConfigured) reasons.push("link_secret_missing");
  if (real && !input.mailReady) reasons.push("mail_not_ready");
  if (!input.settingsPresent) reasons.push("settings_missing");
  if (real && !windowSet) reasons.push("window_not_set");
  if (!input.bankComplete) reasons.push("bank_incomplete");
  const windowMinutes = input.isTest ? TEST_TRANSFER_WINDOW_MINUTES : input.windowMinutes;
  if (reasons.length === 0 && windowMinutes !== null) return { isTest: input.isTest, open: true, windowMinutes, reasons };
  return { isTest: input.isTest, open: false, windowMinutes, reasons };
}

/** One `booking_gate()` call. Any other shape is thrown (the route answers 503); so is a database error. */
export async function readBookingGate(db: BookingDb): Promise<BookingGateState> {
  const data = await call(db, "booking_gate", {});
  if (!isObj(data)) throw new Error("rpc booking_gate: unreadable answer");
  const rawWindow = data.window_minutes;
  const bankComplete = data.bank_complete;
  const settingsPresent = data.settings_present;
  const windowMinutes = rawWindow === null ? null : typeof rawWindow === "number" && Number.isSafeInteger(rawWindow) ? rawWindow : undefined;
  if (windowMinutes === undefined || typeof bankComplete !== "boolean" || typeof settingsPresent !== "boolean") {
    throw new Error("rpc booking_gate: unreadable answer");
  }
  return { windowMinutes, bankComplete, settingsPresent };
}

/**
 * The quote as the trip page sees it while requests are closed (P-17): the breakdown and every reason are kept, ok is
 * false and exactly one `requests_closed` is added. An open gate returns the quote itself, unchanged.
 */
export function withRequestGate(quote: QuoteResponse, gate: RequestGate): QuoteResponse {
  if (gate.open) return quote;
  return { ...quote, ok: false, reasons: [...quote.reasons, { code: "requests_closed" }] };
}

// ---------------------------------------------------------------- the release

export type ReleaseDeps = { readSession?: () => Promise<{ email: string } | null> };
/** `sessionIds` is what `booking_drop_hold` returns (04-02's card session ids); unused in Phase 4. */
export type ReleaseResult = { ok: true; dropped: boolean; sessionIds: string[] } | { ok: false };

/**
 * The guest drops their own hold (B-16): the signed link, or, without a token, the signed-in guest whose email is the
 * booking's. Only a `held` booking is touched (the SQL decides): its nights are free at once. Any other status is `ok`
 * with nothing dropped (a sent request is withdrawn through withdrawBooking, P-19). Refused is `{ ok: false }`.
 */
export async function releaseWebHold(db: BookingDb, input: { ref: unknown; t?: unknown }, deps: ReleaseDeps = {}): Promise<ReleaseResult> {
  const access = await authorizeBookingAccess(input, {
    findByRef: async (ref) => {
      const row = await bookingByRef(db, ref);
      return row ? { id: row.id, email: row.email, linkVersion: row.linkVersion } : null;
    },
    verify: (id, version, token) => verifyBookingLink(id, version, token),
    readSession: deps.readSession ?? (async () => null),
  });
  if (!access.ok) return { ok: false };

  const data = await call(db, "booking_drop_hold", { p_booking: access.bookingId, p_actor: "guest" });
  if (!isObj(data) || typeof data.dropped !== "boolean" || !Array.isArray(data.closed_sessions)) {
    throw new Error("rpc booking_drop_hold: unreadable answer");
  }
  return { ok: true, dropped: data.dropped, sessionIds: data.closed_sessions.filter((s): s is string => typeof s === "string") };
}

// ---------------------------------------------------------------- the guest's request, view and withdraw (04-08)

const BOOKING_STATUSES: readonly BookingStatus[] = ["held", "awaiting_payment", "deposit_paid", "paid_in_full", "confirmed", "completed", "cancelled", "expired"];
const BOOKING_LOCALES: readonly BookingLocale[] = ["en", "ar", "es"];
const AIRPORTS: readonly Airport[] = ["DXB", "AUH", "SHJ"];
const TRAVELLER_KINDS: readonly TravellerInput["kind"][] = ["adult", "child", "infant"];
const ADDON_UNITS: readonly AddOnUnit[] = ["person", "night", "trip"];
const PAYMENT_METHODS: readonly PaymentMethod[] = ["bank_transfer", "card"];
const PLANS: readonly ("deposit" | "full")[] = ["deposit", "full"];
const CURRENCIES: readonly "AED"[] = ["AED"];

type SessionReader = () => Promise<{ email: string } | null>;

/** Readers for one rpc's answer. A wrong shape throws `rpc <name>: unreadable <field>`: the field's name, never a value. */
type Reader = {
  obj(v: unknown, what: string): Raw;
  str(v: unknown, what: string): string;
  strOrNull(v: unknown, what: string): string | null;
  int(v: unknown, what: string): number;
  intOrNull(v: unknown, what: string): number | null;
  bool(v: unknown, what: string): boolean;
  list(v: unknown, what: string): unknown[];
  ref(v: unknown, what: string): string;
  pick<T extends string>(allowed: readonly T[], v: unknown, what: string): T;
};

function readerFor(rpc: string): Reader {
  const fail = (what: string): never => {
    throw new Error(`rpc ${rpc}: unreadable ${what}`);
  };
  const isInt = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v);
  return {
    obj: (v, what) => (isObj(v) ? v : fail(what)),
    str: (v, what) => (typeof v === "string" ? v : fail(what)),
    strOrNull: (v, what) => (v === null || v === undefined ? null : typeof v === "string" ? v : fail(what)),
    int: (v, what) => (isInt(v) ? v : fail(what)),
    intOrNull: (v, what) => (v === null || v === undefined ? null : isInt(v) ? v : fail(what)),
    bool: (v, what) => (typeof v === "boolean" ? v : fail(what)),
    list: (v, what) => (Array.isArray(v) ? v : fail(what)),
    ref: (v, what) => (isBookingRef(v) ? v : fail(what)),
    pick: <T extends string>(allowed: readonly T[], v: unknown, what: string): T =>
      typeof v === "string" && (allowed as readonly string[]).includes(v) ? (v as T) : fail(what),
  };
}

/** The access check of the three guest calls: the booking behind the reference, its signed link, else the session. */
function accessDeps(db: BookingDb, readSession: SessionReader): BookingAccessDeps {
  return {
    findByRef: async (ref) => {
      const row = await bookingByRef(db, ref);
      return row ? { id: row.id, email: row.email, linkVersion: row.linkVersion } : null;
    },
    verify: (id, version, token) => verifyBookingLink(id, version, token),
    readSession,
  };
}

const noSession: SessionReader = async () => null;

/** `booking_view` (section B) in camelCase, the image through mediaUrl like the quote's. */
function readView(data: unknown, r: Reader): BookingView {
  const v = r.obj(data, "answer");
  const stay = r.obj(v.stay, "stay");
  const money = r.obj(v.money, "money");
  const flags = r.obj(v.flags, "flags");
  const transfer = v.transfer === null || v.transfer === undefined ? null : r.obj(v.transfer, "transfer");
  const access = v.access === null || v.access === undefined ? null : r.obj(v.access, "access");
  return {
    ref: r.ref(v.ref, "ref"),
    status: r.pick(BOOKING_STATUSES, v.status, "status"),
    locale: r.pick(BOOKING_LOCALES, v.locale, "locale"),
    guest: { name: r.str(v.guest_name, "guest_name"), email: r.str(v.email, "email") },
    stay: {
      slug: r.str(stay.slug, "stay.slug"),
      title: r.str(stay.title, "stay.title"),
      destinationName: r.str(stay.destination_name, "stay.destination_name"),
      image: image(r.strOrNull(stay.image_key, "stay.image_key"), r.strOrNull(stay.image_alt, "stay.image_alt")),
    },
    arrive: r.str(v.arrive, "arrive"),
    leave: r.str(v.leave, "leave"),
    nights: r.int(v.nights, "nights"),
    adults: r.int(v.adults, "adults"),
    children: r.int(v.children, "children"),
    infants: r.int(v.infants, "infants"),
    travellers: r.list(v.travellers, "travellers").map((row) => {
      const t = r.obj(row, "travellers");
      return {
        kind: r.pick(TRAVELLER_KINDS, t.kind, "travellers.kind"),
        fullName: r.str(t.full_name, "travellers.full_name"),
        age: r.intOrNull(t.age, "travellers.age"),
        isBooker: r.bool(t.is_booker, "travellers.is_booker"),
        notStaying: r.bool(t.not_staying, "travellers.not_staying"),
      };
    }),
    lines: r.list(v.lines, "lines").map((row) => {
      const l = r.obj(row, "lines");
      return {
        name: r.str(l.name, "lines.name"),
        unit: r.pick(ADDON_UNITS, l.unit, "lines.unit"),
        quantity: r.int(l.quantity, "lines.quantity"),
        unitPriceFils: r.int(l.unit_price_fils, "lines.unit_price_fils"),
        lineFils: r.int(l.line_fils, "lines.line_fils"),
      };
    }),
    airport: v.airport === null || v.airport === undefined ? null : r.pick(AIRPORTS, v.airport, "airport"),
    pickupAddress: r.strOrNull(v.pickup_address, "pickup_address"),
    plan: r.pick(PLANS, v.plan, "plan"),
    money: {
      nightsFils: r.int(money.nights_fils, "money.nights_fils"),
      addonsFils: r.int(money.addons_fils, "money.addons_fils"),
      subtotalFils: r.int(money.subtotal_fils, "money.subtotal_fils"),
      vatBp: r.int(money.vat_bp, "money.vat_bp"),
      vatFils: r.int(money.vat_fils, "money.vat_fils"),
      grandFils: r.int(money.grand_fils, "money.grand_fils"),
      depositFils: r.int(money.deposit_fils, "money.deposit_fils"),
      balanceFils: r.int(money.balance_fils, "money.balance_fils"),
      paidFils: r.int(money.paid_fils, "money.paid_fils"),
      dueNowFils: r.int(money.due_now_fils, "money.due_now_fils"),
      stillDueFils: r.int(money.still_due_fils, "money.still_due_fils"),
    },
    holdExpiresAt: r.strOrNull(v.hold_expires_at, "hold_expires_at"),
    deadline: r.strOrNull(v.deadline, "deadline"),
    balanceDueDate: r.strOrNull(v.balance_due_date, "balance_due_date"),
    flags: {
      partReceived: r.bool(flags.part_received, "flags.part_received"),
      overpaid: r.bool(flags.overpaid, "flags.overpaid"),
      writtenOff: r.bool(flags.written_off, "flags.written_off"),
    },
    withdrawable: r.bool(v.withdrawable, "withdrawable"),
    payments: r.list(v.payments, "payments").map((row) => {
      const p = r.obj(row, "payments");
      return {
        receivedOn: r.strOrNull(p.received_on, "payments.received_on"),
        method: r.pick(PAYMENT_METHODS, p.method, "payments.method"),
        amountFils: r.int(p.amount_fils, "payments.amount_fils"),
      };
    }),
    transfer: transfer === null ? null : {
      accountName: r.str(transfer.account_name, "transfer.account_name"),
      bankName: r.str(transfer.bank_name, "transfer.bank_name"),
      iban: r.str(transfer.iban, "transfer.iban"),
      swift: r.str(transfer.swift, "transfer.swift"),
      bankAddress: r.str(transfer.bank_address, "transfer.bank_address"),
      note: r.str(transfer.note, "transfer.note"),
      currency: r.pick(CURRENCIES, transfer.currency, "transfer.currency"),
      amountFils: r.int(transfer.amount_fils, "transfer.amount_fils"),
      reference: r.str(transfer.reference, "transfer.reference"),
      payBy: r.strOrNull(transfer.pay_by, "transfer.pay_by"),
      dueBy: r.strOrNull(transfer.due_by, "transfer.due_by"),
    },
    access: access === null ? null : {
      address: r.strOrNull(access.address, "access.address"),
      wifiName: r.strOrNull(access.wifi_name, "access.wifi_name"),
      wifiPassword: r.strOrNull(access.wifi_password, "access.wifi_password"),
      doorCode: r.strOrNull(access.door_code, "access.door_code"),
      notes: r.strOrNull(access.notes, "access.notes"),
    },
  };
}

async function readBookingView(db: BookingDb, bookingId: string, locale: BookingLocale | null, isTest: boolean): Promise<BookingView | null> {
  const data = await call(db, "booking_view", { p_booking: bookingId, p_locale: locale, p_expect_test: isTest });
  if (data === null || data === undefined) return null;
  return readView(data, readerFor("booking_view"));
}

/**
 * The guest's booking page by id, for the emails (server only; 04-09 uses it for the payment mails). Null when
 * `booking_view` answers null (an unknown id, or a TEST flag that is not `isTest`); throws only on an unreadable answer
 * or a database error. Without a locale the booking's own language.
 */
export async function bookingViewById(db: BookingDb, bookingId: string, opts: { locale?: BookingLocale; isTest: boolean }): Promise<BookingView | null> {
  return readBookingView(db, bookingId, opts.locale ?? null, opts.isTest);
}

/** The view for a mail. A view that cannot be read sends no mail and never fails the answer it belongs to. */
async function viewForMail(db: BookingDb, bookingId: string, isTest: boolean): Promise<BookingView | null> {
  try {
    return await bookingViewById(db, bookingId, { isTest });
  } catch {
    return null;
  }
}

export type RequestContext = {
  /** From the Host header (the request gate's), never from the body. */
  isTest: boolean;
  notifier: BookingNotifier;
  /** The origin of the guest's link: originForBooking(isTest). */
  origin: string;
};

/** The request route's status and answer. The booking id is never in `response`. */
export type RequestOutcome = { status: 200 | 404 | 409 | 429 | 503; response: RequestResponse };

const NOT_FOUND_REQUEST: RequestOutcome = { status: 404, response: { ok: false } };

function requestRefused(status: 409 | 429 | 503, code: ReasonCode): RequestOutcome {
  return { status, response: { ok: false, reasons: [{ code }] } };
}

function requestRefusal(reason: unknown): RequestOutcome {
  switch (reason) {
    case "not_found":
      return NOT_FOUND_REQUEST;
    case "hold_ended":
      return requestRefused(409, "hold_ended");
    case "blocked":
      return requestRefused(409, "blocked");
    case "sold_out":
      return requestRefused(409, "sold_out");
    case "too_many_open":
      return requestRefused(429, "too_many_open");
    case "requests_closed":
      return requestRefused(503, "requests_closed");
    default:
      throw new Error("rpc request_web_booking: unreadable reason");
  }
}

/** The guest's request mail and the owner's notice, each through deliverMail. True when the guest's mail was sent. */
async function sendRequestMails(db: BookingDb, bookingId: string, ref: string, token: string, ctx: RequestContext): Promise<boolean> {
  const view = await viewForMail(db, bookingId, ctx.isTest);
  if (!view) return false;
  const job: RequestMailJob = { bookingId, view, isTest: ctx.isTest, bookingUrl: ctx.origin + bookingPagePath(view.locale, ref, token) };
  const { notifier } = ctx;
  const guestKey = mailKey("requestReceived", bookingId);
  const ownerKey = mailKey("ownerRequest", bookingId);
  // Side by side: the guest's answer waits for one send time, not two (deliverMail never throws).
  const [guest] = await Promise.all([
    deliverMail(db, {
      bookingId,
      template: "request_received",
      idempotencyKey: guestKey,
      ready: notifier.ready,
      send: () => notifier.requestReceived(job, { idempotencyKey: guestKey }),
    }),
    deliverMail(db, {
      bookingId,
      template: "request_owner",
      idempotencyKey: ownerKey,
      ready: notifier.ready,
      send: () => notifier.ownerRequest(job, { idempotencyKey: ownerKey }),
    }),
  ]);
  return guest === "sent";
}

/**
 * The guest sends the request (held -> awaiting_payment, B-23). Link only, like the release: the signed token for this
 * booking and its link version; the session is never read. One `request_web_booking` with the host's TEST flag (a
 * mismatch is the same 404 as a wrong token). The first time, the guest's mail and the owner's notice go out through
 * deliverMail (keys request/<id> and request-owner/<id>); a second request sends nothing. A mail never changes the
 * status: `emailSent` is true only when the guest's mail was sent. An unreadable answer is thrown (the route: 503).
 */
export async function requestBooking(db: BookingDb, input: RequestRequest, ctx: RequestContext): Promise<RequestOutcome> {
  const access = await authorizeBookingAccess(input, accessDeps(db, noSession));
  if (!access.ok) return NOT_FOUND_REQUEST;

  const data = await call(db, "request_web_booking", { p_booking: access.bookingId, p_expect_test: ctx.isTest });
  if (!isObj(data)) throw new Error("rpc request_web_booking: unreadable answer");
  if (data.ok === false) return requestRefusal(data.reason);
  if (data.ok !== true) throw new Error("rpc request_web_booking: unreadable answer");
  const r = readerFor("request_web_booking");
  const firstTime = r.bool(data.first_time, "first_time");
  const ref = r.ref(data.ref, "ref");
  const status = r.pick(BOOKING_STATUSES, data.status, "status");
  const deadline = r.strOrNull(data.deadline, "deadline");

  const emailSent = firstTime ? await sendRequestMails(db, access.bookingId, ref, input.t, ctx) : false;
  return { status: 200, response: { ok: true, ref, status, deadline, firstTime, emailSent } };
}

export type ViewDeps = {
  /** From the Host header, never from the body. */
  isTest: boolean;
  /** The signed-in guest; read only when the body has no token. Without it, no token means refused. */
  readSession?: SessionReader;
};

/**
 * The guest's booking page (BOOK-08). The token is the only door when the body has one, else the signed-in email must
 * be the booking's. One `booking_view` with the page's language (else the booking's) and the host's TEST flag. A
 * refused access, an unknown or malformed reference, a wrong token and a TEST mismatch are the identical `{ ok: false }`.
 */
export async function viewBooking(db: BookingDb, input: ViewRequest, deps: ViewDeps): Promise<ViewResponse> {
  const access = await authorizeBookingAccess(input, accessDeps(db, deps.readSession ?? noSession));
  if (!access.ok) return { ok: false };
  const booking = await readBookingView(db, access.bookingId, input.locale ?? null, deps.isTest);
  return booking ? { ok: true, booking } : { ok: false };
}

export type WithdrawDeps = ViewDeps & { notifier: BookingNotifier };

/** The withdraw route's status and answer (P-19); 503 is the shared unavailable answer, which 04-05 maps to a retry. */
export type WithdrawOutcome =
  | { status: 200 | 404 | 409; response: WithdrawResponse }
  | { status: 503; response: { ok: false; reasons: BookingReason[] } };

const NOT_FOUND_WITHDRAW: WithdrawOutcome = { status: 404, response: { ok: false } };

/**
 * The guest withdraws an unpaid request (P-19, changed by the owner 2026-10-20): the view's access rule, then one
 * `booking_withdraw_request` with the host's TEST flag. Withdrawn -> 200; a second withdraw answers firstTime false; a
 * request with a payment recorded -> 409 part_paid; past its deadline + 2 minutes, lapsed or cancelled -> 409
 * not_withdrawable; refused or unknown -> the same 404. The first time, the owner gets one notice (key
 * withdrawn-owner/<id>, a link without a token); the guest gets no mail. A mail never changes the answer. An unreadable
 * answer is thrown (the route: 503).
 */
export async function withdrawBooking(db: BookingDb, input: WithdrawRequest, deps: WithdrawDeps): Promise<WithdrawOutcome> {
  const access = await authorizeBookingAccess(input, accessDeps(db, deps.readSession ?? noSession));
  if (!access.ok) return NOT_FOUND_WITHDRAW;

  const data = await call(db, "booking_withdraw_request", { p_booking: access.bookingId, p_expect_test: deps.isTest });
  if (!isObj(data)) throw new Error("rpc booking_withdraw_request: unreadable answer");
  if (data.ok === false) {
    const reason = data.reason;
    if (reason === "not_found") return NOT_FOUND_WITHDRAW;
    if (reason === "part_paid") return { status: 409, response: { ok: false, reason: "part_paid" } };
    if (reason === "not_withdrawable") return { status: 409, response: { ok: false, reason: "not_withdrawable" } };
    throw new Error("rpc booking_withdraw_request: unreadable reason");
  }
  if (data.ok !== true || data.status !== "cancelled") throw new Error("rpc booking_withdraw_request: unreadable answer");
  const r = readerFor("booking_withdraw_request");
  const firstTime = r.bool(data.first_time, "first_time");
  const ref = r.ref(data.ref, "ref");

  if (firstTime) {
    const bookingId = access.bookingId;
    const view = await viewForMail(db, bookingId, deps.isTest);
    if (view) {
      const job: RequestMailJob = { bookingId, view, isTest: deps.isTest, bookingUrl: originForBooking(deps.isTest) + bookingPagePath(view.locale, ref) };
      const { notifier } = deps;
      const key = mailKey("ownerWithdrawn", bookingId);
      await deliverMail(db, {
        bookingId,
        template: "request_withdrawn_owner",
        idempotencyKey: key,
        ready: notifier.ready,
        send: () => notifier.ownerWithdrawn(job, { idempotencyKey: key }),
      });
    }
  }
  return { status: 200, response: { ok: true, ref, status: "cancelled", firstTime } };
}

/**
 * The signed-in guest's list (`guest_bookings`, AUTH-01) for /bookings (04-06): the session's email, the page's
 * language and the host's TEST flag. `paidFils` is the settled payments, voids excluded. Throws on an unreadable answer.
 */
export async function listGuestBookings(db: BookingDb, opts: { email: string; locale: BookingLocale; isTest: boolean }): Promise<GuestBookingSummary[]> {
  const r = readerFor("guest_bookings");
  const data = r.obj(await call(db, "guest_bookings", { p_email: opts.email, p_locale: opts.locale, p_is_test: opts.isTest }), "answer");
  return r.list(data.items, "items").map((row) => {
    const item = r.obj(row, "items");
    return {
      ref: r.ref(item.ref, "items.ref"),
      status: r.pick(BOOKING_STATUSES, item.status, "items.status"),
      stayTitle: r.str(item.stay_title, "items.stay_title"),
      destinationName: r.str(item.destination_name, "items.destination_name"),
      image: image(r.strOrNull(item.image_key, "items.image_key"), r.strOrNull(item.image_alt, "items.image_alt")),
      arrive: r.str(item.arrive, "items.arrive"),
      leave: r.str(item.leave, "items.leave"),
      plan: r.pick(PLANS, item.plan, "items.plan"),
      grandFils: r.int(item.grand_fils, "items.grand_fils"),
      paidFils: r.int(item.paid_fils, "items.paid_fils"),
      stillDueFils: r.int(item.still_due_fils, "items.still_due_fils"),
      deadline: r.strOrNull(item.deadline, "items.deadline"),
    };
  });
}
