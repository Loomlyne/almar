// Parsers for the three booking endpoints' bodies (plan 04-02). Pure: no Next, no Supabase, no environment. A parser
// never throws: it returns { ok: true, value } with trimmed text and a lower-cased email, or { ok: false, reasons } with
// ONE reason, { code: "invalid", field }, naming the first field that failed (a dotted path such as
// "travellers.1.age"). Unknown keys are refused, so a client cannot smuggle a price or a status into a body. What the
// parser does not judge (dates in the past, the order of two dates, a repeated add-on, a guest count the stay cannot
// take) is the quote's reason, not a parse error.
import { isEmail } from "../auth/rules";
import { isIsoDate } from "../money/dates";
import { isBookingRef } from "./ref";
import type { Airport, BookingReason, ContactInput, HoldRequest, QuoteRequest, TravellerInput } from "./types";

export type ParseResult<T> = { ok: true; value: T } | { ok: false; reasons: BookingReason[] };

type Rec = Record<string, unknown>;
type Step<T> = { v: T } | { bad: string };

const QUOTE_KEYS = ["stay", "from", "to", "adults", "children", "infants", "addons", "plan", "locale", "hold"] as const;
const HOLD_KEYS = [...QUOTE_KEYS, "contact", "travellers", "airport", "pickupAddress", "termsAccepted"] as const;
const ADDON_KEYS = ["id", "qty"] as const;
const HOLD_REF_KEYS = ["ref", "t"] as const;
const CONTACT_KEYS = ["name", "email", "phone", "nationality", "specialRequests", "emergencyName", "emergencyPhone"] as const;
const TRAVELLER_KEYS = ["kind", "fullName", "age", "isBooker", "notStaying"] as const;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LINK_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const MIN_PHONE_DIGITS = 7;
const AIRPORTS: readonly string[] = ["DXB", "AUH", "SHJ"];
const PLANS: readonly string[] = ["deposit", "full"];
const LOCALES: readonly string[] = ["en", "ar", "es"];
const KINDS: readonly string[] = ["adult", "child", "infant"];

const MAX_ADDONS = 100;

function isRec(value: unknown): value is Rec {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** The first own key that is not in `allowed`, or null. */
function unknownKey(obj: Rec, allowed: readonly string[]): string | null {
  for (const key of Object.keys(obj)) if (!allowed.includes(key)) return key;
  return null;
}

function count(value: unknown, min: number, max: number): number | null {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : null;
}

/** Trimmed text of length min..max (after trimming), or null. */
function text(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length >= min && trimmed.length <= max ? trimmed : null;
}

function phone(value: unknown): string | null {
  const trimmed = text(value, 7, 20);
  if (trimmed === null || !PHONE.test(trimmed)) return null;
  const digits = trimmed.replace(/[^0-9]/g, "").length;
  return digits >= MIN_PHONE_DIGITS ? trimmed : null;
}

function refuse(field: string): { ok: false; reasons: BookingReason[] } {
  return { ok: false, reasons: [{ code: "invalid", field }] };
}

function readHoldRef(value: unknown): Step<{ ref: string; t: string }> {
  if (!isRec(value)) return { bad: "hold" };
  const extra = unknownKey(value, HOLD_REF_KEYS);
  if (extra !== null) return { bad: `hold.${extra}` };
  const ref = value.ref;
  if (!isBookingRef(ref)) return { bad: "hold.ref" };
  const t = value.t;
  if (typeof t !== "string" || !LINK_TOKEN.test(t)) return { bad: "hold.t" };
  return { v: { ref, t } };
}

function readAddons(value: unknown): Step<{ id: string; qty: number }[]> {
  if (!Array.isArray(value) || value.length > MAX_ADDONS) return { bad: "addons" };
  const out: { id: string; qty: number }[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const row: unknown = value[i];
    if (!isRec(row)) return { bad: `addons.${i}` };
    const extra = unknownKey(row, ADDON_KEYS);
    if (extra !== null) return { bad: `addons.${i}.${extra}` };
    const id = row.id;
    if (typeof id !== "string" || !UUID.test(id)) return { bad: `addons.${i}.id` };
    const qty = row.qty;
    if (typeof qty !== "number" || !Number.isSafeInteger(qty) || qty < 0) return { bad: `addons.${i}.qty` };
    out.push({ id: id.toLowerCase(), qty });
  }
  return { v: out };
}

/** The nine quote fields plus the optional page hold. Unknown-key checks are the caller's. */
function readQuote(obj: Rec): Step<QuoteRequest> {
  const stay = obj.stay;
  if (typeof stay !== "string" || stay.length > 80 || !SLUG.test(stay)) return { bad: "stay" };
  const from = obj.from;
  if (!isIsoDate(from)) return { bad: "from" };
  const to = obj.to;
  if (!isIsoDate(to)) return { bad: "to" };
  const adults = count(obj.adults, 1, 99);
  if (adults === null) return { bad: "adults" };
  const children = count(obj.children, 0, 99);
  if (children === null) return { bad: "children" };
  const infants = count(obj.infants, 0, 99);
  if (infants === null) return { bad: "infants" };
  const addons = readAddons(obj.addons);
  if ("bad" in addons) return addons;
  const plan = obj.plan;
  if (typeof plan !== "string" || !PLANS.includes(plan)) return { bad: "plan" };
  const locale = obj.locale;
  if (typeof locale !== "string" || !LOCALES.includes(locale)) return { bad: "locale" };

  const value: QuoteRequest = {
    stay,
    from,
    to,
    adults,
    children,
    infants,
    addons: addons.v,
    plan: plan as QuoteRequest["plan"],
    locale: locale as QuoteRequest["locale"],
  };
  if (obj.hold !== undefined) {
    const held = readHoldRef(obj.hold);
    if ("bad" in held) return held;
    value.hold = held.v;
  }
  return { v: value };
}

function readContact(value: unknown): Step<ContactInput> {
  if (!isRec(value)) return { bad: "contact" };
  const extra = unknownKey(value, CONTACT_KEYS);
  if (extra !== null) return { bad: `contact.${extra}` };

  const name = text(value.name, 1, 120);
  if (name === null) return { bad: "contact.name" };
  const emailText = text(value.email, 1, 254);
  const email = emailText === null ? null : emailText.toLowerCase();
  if (email === null || !isEmail(email)) return { bad: "contact.email" };
  const phoneText = phone(value.phone);
  if (phoneText === null) return { bad: "contact.phone" };

  const out: ContactInput = { name, email, phone: phoneText };

  // Optional: absent or blank after trimming means "left out"; anything else must be the right kind and size.
  const optionals: { key: "nationality" | "specialRequests" | "emergencyName" | "emergencyPhone"; max: number; isPhone: boolean }[] = [
    { key: "nationality", max: 60, isPhone: false },
    { key: "specialRequests", max: 1000, isPhone: false },
    { key: "emergencyName", max: 120, isPhone: false },
    { key: "emergencyPhone", max: 20, isPhone: true },
  ];
  for (const { key, max, isPhone } of optionals) {
    const raw = value[key];
    if (raw === undefined) continue;
    if (typeof raw !== "string") return { bad: `contact.${key}` };
    if (raw.trim() === "") continue;
    const clean = isPhone ? phone(raw) : text(raw, 1, max);
    if (clean === null) return { bad: `contact.${key}` };
    out[key] = clean;
  }
  return { v: out };
}

function readTravellers(value: unknown, adults: number, children: number, infants: number): Step<TravellerInput[]> {
  if (!Array.isArray(value) || value.length !== adults + children + infants) return { bad: "travellers" };
  const out: TravellerInput[] = [];
  let bookers = 0;
  const kinds = { adult: 0, child: 0, infant: 0 };

  for (let i = 0; i < value.length; i += 1) {
    const row: unknown = value[i];
    const at = `travellers.${i}`;
    if (!isRec(row)) return { bad: at };
    const extra = unknownKey(row, TRAVELLER_KEYS);
    if (extra !== null) return { bad: `${at}.${extra}` };

    const kind = row.kind;
    if (typeof kind !== "string" || !KINDS.includes(kind)) return { bad: `${at}.kind` };
    const fullName = text(row.fullName, 1, 120);
    if (fullName === null) return { bad: `${at}.fullName` };

    const isBooker = row.isBooker === undefined ? false : row.isBooker;
    if (typeof isBooker !== "boolean") return { bad: `${at}.isBooker` };
    const notStaying = row.notStaying === undefined ? false : row.notStaying;
    if (typeof notStaying !== "boolean") return { bad: `${at}.notStaying` };
    if (isBooker) {
      bookers += 1;
      if (bookers > 1) return { bad: `${at}.isBooker` };
    }
    if (notStaying && !isBooker) return { bad: `${at}.notStaying` };

    const traveller: TravellerInput = { kind: kind as TravellerInput["kind"], fullName, isBooker, notStaying };
    if (kind === "adult") {
      if (row.age !== undefined && row.age !== null) return { bad: `${at}.age` };
    } else {
      const age = kind === "child" ? count(row.age, 3, 12) : count(row.age, 0, 2);
      if (age === null) return { bad: `${at}.age` };
      traveller.age = age;
    }
    kinds[kind as keyof typeof kinds] += 1;
    out.push(traveller);
  }

  if (kinds.adult !== adults || kinds.child !== children || kinds.infant !== infants) return { bad: "travellers" };
  return { v: out };
}

/** A quote request: the nine fields (all required) and, while the trip page holds one, `hold: { ref, t }`. */
export function parseQuoteRequest(body: unknown): ParseResult<QuoteRequest> {
  if (!isRec(body)) return refuse("body");
  const extra = unknownKey(body, QUOTE_KEYS);
  if (extra !== null) return refuse(extra);
  const quote = readQuote(body);
  return "bad" in quote ? refuse(quote.bad) : { ok: true, value: quote.v };
}

/** A hold request: every quote field, plus the contact, one traveller per guest, the airport and the terms. */
export function parseHoldRequest(body: unknown): ParseResult<HoldRequest> {
  if (!isRec(body)) return refuse("body");
  const extra = unknownKey(body, HOLD_KEYS);
  if (extra !== null) return refuse(extra);

  const quote = readQuote(body);
  if ("bad" in quote) return refuse(quote.bad);
  const contact = readContact(body.contact);
  if ("bad" in contact) return refuse(contact.bad);
  const travellers = readTravellers(body.travellers, quote.v.adults, quote.v.children, quote.v.infants);
  if ("bad" in travellers) return refuse(travellers.bad);

  const airport = body.airport;
  if (typeof airport !== "string" || !AIRPORTS.includes(airport)) return refuse("airport");

  let pickupAddress: string | undefined;
  const rawAddress = body.pickupAddress;
  if (rawAddress !== undefined) {
    if (typeof rawAddress !== "string") return refuse("pickupAddress");
    const clean = rawAddress.trim();
    if (clean.length > 300) return refuse("pickupAddress");
    if (clean !== "") pickupAddress = clean;
  }

  if (body.termsAccepted !== true) return refuse("termsAccepted");

  const value: HoldRequest = {
    ...quote.v,
    contact: contact.v,
    travellers: travellers.v,
    airport: airport as Airport,
    termsAccepted: true,
  };
  if (pickupAddress !== undefined) value.pickupAddress = pickupAddress;
  return { ok: true, value };
}

/** A release request: the booking reference and the signed link token, nothing else. */
export function parseReleaseRequest(body: unknown): ParseResult<{ ref: string; t: string }> {
  if (!isRec(body)) return refuse("body");
  const extra = unknownKey(body, HOLD_REF_KEYS);
  if (extra !== null) return refuse(extra);
  const ref = body.ref;
  if (!isBookingRef(ref)) return refuse("ref");
  const t = body.t;
  if (typeof t !== "string" || !LINK_TOKEN.test(t)) return refuse("t");
  return { ok: true, value: { ref, t } };
}

/** B-11: the guest's home address is required exactly when a home-pickup line has a quantity (the explicit flag). */
export function needsPickupAddress(lines: readonly { isHomePickup: boolean; quantity: number }[]): boolean {
  return lines.some((line) => line.isHomePickup && line.quantity > 0);
}
