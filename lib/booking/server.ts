// Server side of the booking endpoints (plan 04-02): the live quote with every reason, the hold, the release, and the
// snake_case payload both SQL create functions read. `db` is anything with `.rpc(name, args)`, so the routes pass the
// service-role client and the tests pass a fake. No environment, no Next, no Supabase import: the routes own those.
//
// Money is never taken from the browser: the quote reads the stay, its night rates, the add-on prices and the owner's
// settings from `booking_context` and prices them with lib/money (the one engine); the hold re-quotes and stores that
// snapshot. A value the owner has not set (VAT, deposit, balance days) arrives as null and is a reason, never a default.
import { mediaUrl } from "../data/media";
import { priceBooking, type NightRate, type PriceReason, type PriceSnapshot } from "../money/booking-price";
import { daysBetween, dubaiToday, isIsoDate } from "../money/dates";
import { authorizeBookingAccess } from "./access";
import { bookingLinkConfigured, signBookingLink, verifyBookingLink } from "./link";
import { isBookingRef } from "./ref";
import { BOOKING_TERMS_IS_PLACEHOLDER, BOOKING_TERMS_VERSION } from "./terms";
import type { AddOnOffering, BookingReason, HoldRequest, HoldResponse, QuoteRequest, QuoteResponse, StayCard } from "./types";
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

/**
 * Every reason a stay and these dates cannot be booked as asked, with the server's own price (B-02: nothing is hidden
 * silently). One `booking_context` call; a second `booking_by_ref` only when the request carries the page's own hold.
 * Never throws for a guest's choice; a database failure throws and the route answers 503.
 */
export async function quoteBooking(db: BookingDb, input: QuoteRequest, opts: { now?: Date } = {}): Promise<QuoteResponse> {
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
  const respond = (reasons: BookingReason[], breakdown: PriceSnapshot | null): QuoteResponse => ({
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
    nights_snapshot: breakdown.nights.map((n) => ({ night: n.night, rate_fils: n.rateFils, source: n.source, rate_id: n.rateId })),
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
  now?: Date;
};

/** `bookingId` is for 04-04's Checkout Session and is never part of `response`. */
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
 * The guest's 30-minute hold. Order: the limiter (five holds an hour per email, twenty per IP), a fresh quote on the
 * server (the page's numbers and its old hold are ignored), any reason refuses, then one `create_web_booking`
 * transaction that re-checks the owner's settings, stores the booking with its price snapshot and places the nights.
 * Needs the link secret before it writes anything: a hold the guest cannot be given a link for is never created.
 */
export async function createWebHold(db: BookingDb, input: HoldRequest, ctx: HoldContext): Promise<HoldOutcome> {
  if (!bookingLinkConfigured()) throw new Error("booking link secret missing");

  const slot = await call(db, "claim_hold_slot", { p_email_hash: ctx.emailHash(input.contact.email), p_ip_hash: ctx.ipHash });
  if (typeof slot !== "boolean") throw new Error("rpc claim_hold_slot failed");
  if (!slot) return refuse([{ code: "hold_limit" }]);

  const quote = await quoteBooking(
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
    response: { ok: true, ref, holdExpiresAt: expires, linkToken: await signBookingLink(id, version), breakdown },
    bookingId: id,
  };
}

/** 200 for a hold, 429 for the limiter, 400 for a refused field, 503 for "not available", else 409 (the nights or the price changed). */
export function holdStatus(response: HoldResponse): 200 | 400 | 409 | 429 | 503 {
  if (response.ok) return 200;
  const codes = response.reasons.map((r) => r.code);
  if (codes.includes("hold_limit")) return 429;
  if (codes.includes("unavailable")) return 503;
  if (codes.includes("invalid")) return 400;
  return 409;
}

/**
 * TEST unless the Stripe secret key says live (`sk_live_`); a live key stays closed while the booking terms are the
 * placeholder (B-13: the owner's text does not exist yet). 04-04 moves this into lib/stripe/server.ts.
 */
export function liveGate(stripeSecret: string | undefined, termsArePlaceholder: boolean = BOOKING_TERMS_IS_PLACEHOLDER): { isTest: boolean; open: boolean } {
  const isTest = !(stripeSecret ?? "").trim().startsWith("sk_live_");
  return { isTest, open: isTest || !termsArePlaceholder };
}

// ---------------------------------------------------------------- the release

export type ReleaseDeps = { readSession?: () => Promise<{ email: string } | null> };
export type ReleaseResult = { ok: true; dropped: boolean; sessionIds: string[] } | { ok: false };

/**
 * The guest drops their own hold (B-16): the signed link, or, without a token, the signed-in guest whose email is the
 * booking's. Only a `held` booking is touched (the SQL decides): its nights are free at once and its open Checkout
 * Sessions come back for 04-04 to expire at Stripe. Any other status is `ok` with nothing dropped. Refused is `{ ok: false }`.
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
