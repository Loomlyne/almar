// Plan 04-03, Tasks 3 and 4: the state of /booking/trip. Pure except loadTripState / writeTripState, two thin wrappers
// around window.sessionStorage (storage can be off: the page works without it).
//
// No amount is computed here: every price on the page is a field of the server's quote or hold answer (D-52). The
// inputs and the hold record live in sessionStorage key "almar-trip" for this tab only (Q-07): no amount and no terms
// box are stored, and the link token never goes into a URL (cross-plan decision 8). A stored value is untrusted (a tab
// can edit it): readTripState accepts only the exact shape and returns null for anything else, never repaired.
//
// Q-01 = B (owner, 2026-10-25): deposit or full, the UAE airport and the terms box end the Travellers step; Continue
// (go to 4) checks them with the traveller fields, and every entry into Request without a hold bumps `holdAttempt`,
// the one-shot signal the screen answers with exactly one POST /api/booking/hold (a re-render never sends a second).
// A refused or failed hold is retried with `retryHold` (the Hold button), never by itself.
//
// 04-06 dispatches `{ type: "closed" }` on a 503 requests_closed from /api/booking/request and `{ type: "refused",
// at: "request", reasons }` for its refusals (too_many_open); it never edits this file (cross-plan decision 7).
import { isEmail } from "../auth/rules";
import type { Locale } from "../locale-path";
import { isBookingRef } from "./ref";
import { holdMsLeft } from "./trip-format";
import type { TripQuery } from "./trip-link";
import type { Airport, BookingReason, HoldRequest, HoldResponse, PublicPriceSnapshot, QuoteRequest, QuoteResponse, TravellerInput } from "./types";
import { needsPickupAddress } from "./validate";

export const TRIP_STATE_KEY = "almar-trip";

export type TripStep = 1 | 2 | 3 | 4;
export type TripPlan = "deposit" | "full";

export type TripContact = {
  name: string;
  email: string;
  phone: string;
  nationality: string;
  specialRequests: string;
  emergencyName: string;
  emergencyPhone: string;
};

/** One traveller line as typed: the age is the text of its field ("" for an adult). */
export type TripTraveller = { kind: TravellerInput["kind"]; fullName: string; age: string };

/** What the page keeps of a hold. The token stays here and in the request bodies, never in a URL. */
export type TripHold = { ref: string; linkToken: string; holdExpiresAt: string; transferWindowMinutes: number };

export type TripRefusal = { at: "hold" | "request"; reasons: BookingReason[] };

export type TripState = {
  query: TripQuery;
  step: TripStep;
  /** The last quote answer (never stored). */
  quote: QuoteResponse | null;
  /** Add-on id -> quantity, only quantities above 0. */
  addons: Record<string, number>;
  addonsTouched: boolean;
  contact: TripContact;
  /** False once the guest ticks "I am not staying": then no line is the booker (Q-05). */
  bookerStays: boolean;
  travellers: TripTraveller[];
  pickup: string;
  plan: TripPlan | null;
  airport: Airport | null;
  /** The terms box: never stored, never restored (T-04-03-06). */
  terms: boolean;
  hold: TripHold | null;
  /** The hold answer's price, shown instead of the quote's while held (never stored). */
  holdBreakdown: PublicPriceSnapshot | null;
  ended: boolean;
  closed: boolean;
  /** Set by a Continue on Travellers that found errors; the errors show from then on. */
  showErrors: boolean;
  /** The refusal of the last hold or request, shown on the Request step. */
  refusal: TripRefusal | null;
  /**
   * Q-01 = B: bumped on every entry into Request without a hold and on every retry; the screen posts one hold per value
   * (never stored, so a reload sends nothing by itself).
   */
  holdAttempt: number;
};

/** The moves the guest makes that a hold locks: the screen asks first, releases, then applies the move. */
export type TripMove =
  | { type: "go"; step: TripStep }
  | { type: "setAddon"; id: string; qty: number }
  | { type: "plan"; plan: TripPlan }
  | { type: "airport"; airport: Airport }
  | { type: "terms"; accepted: boolean };

export type TripAction =
  | TripMove
  | { type: "quoted"; quote: QuoteResponse }
  | { type: "closed" }
  | { type: "contact"; patch: Partial<TripContact> }
  | { type: "bookerStays"; stays: boolean }
  | { type: "traveller"; index: number; patch: Partial<Pick<TripTraveller, "fullName" | "age">> }
  | { type: "pickup"; address: string }
  | { type: "held"; hold: Extract<HoldResponse, { ok: true }> }
  | { type: "released"; next?: TripMove }
  | { type: "ended" }
  | { type: "retryHold" }
  | { type: "refused"; at: TripRefusal["at"]; reasons: BookingReason[] };

// ---------------------------------------------------------------- shapes (the rules of lib/booking/validate.ts)

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// LINK_TOKEN of lib/booking/validate.ts.
const LINK_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;
// An instant with a time and an offset (the server's timestamptz as JSON).
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const MIN_PHONE_DIGITS = 7;
const AGE = /^[0-9]{1,2}$/;
const MAX_QTY = 99;
const AIRPORTS: readonly Airport[] = ["DXB", "AUH", "SHJ"];

export function isLinkToken(value: unknown): value is string {
  return typeof value === "string" && LINK_TOKEN.test(value);
}

export function isInstant(value: unknown): value is string {
  return typeof value === "string" && INSTANT.test(value) && Number.isFinite(Date.parse(value));
}

function isPhone(value: string): boolean {
  const t = value.trim();
  return t.length >= 7 && t.length <= 20 && PHONE.test(t) && t.replace(/[^0-9]/g, "").length >= MIN_PHONE_DIGITS;
}

const EMPTY_CONTACT: TripContact = {
  name: "",
  email: "",
  phone: "",
  nationality: "",
  specialRequests: "",
  emergencyName: "",
  emergencyPhone: "",
};
const CONTACT_KEYS = Object.keys(EMPTY_CONTACT) as (keyof TripContact)[];

function lineKinds(q: TripQuery): TripTraveller["kind"][] {
  return [
    ...Array<TripTraveller["kind"]>(q.adults).fill("adult"),
    ...Array<TripTraveller["kind"]>(q.children).fill("child"),
    ...Array<TripTraveller["kind"]>(q.infants).fill("infant"),
  ];
}

/** Step 1, nothing chosen: one empty line per guest (adults, then children, then infants), the booker staying. */
export function initialTripState(query: TripQuery): TripState {
  return {
    query,
    step: 1,
    quote: null,
    addons: {},
    addonsTouched: false,
    contact: { ...EMPTY_CONTACT },
    bookerStays: true,
    travellers: lineKinds(query).map((kind) => ({ kind, fullName: "", age: "" })),
    pickup: "",
    plan: null,
    airport: null,
    terms: false,
    hold: null,
    holdBreakdown: null,
    ended: false,
    closed: false,
    showErrors: false,
    refusal: null,
    holdAttempt: 0,
  };
}

// ---------------------------------------------------------------- derived values

/** The price the page shows: the hold's while held, else the last quote's. */
export function displayBreakdown(state: Pick<TripState, "quote" | "holdBreakdown">): PublicPriceSnapshot | null {
  return state.holdBreakdown ?? state.quote?.breakdown ?? null;
}

/** B-11: the pickup address is needed exactly when a home-pickup add-on (the offer's flag) has a quantity. */
export function tripNeedsPickup(state: Pick<TripState, "quote" | "addons">): boolean {
  const offers = state.quote?.offers ?? [];
  return needsPickupAddress(offers.map((o) => ({ isHomePickup: o.isHomePickup, quantity: state.addons[o.id] ?? 0 })));
}

/** The traveller lines as the hold body sends them (Q-05: no line ever has notStaying true). */
export function travellerInputs(state: Pick<TripState, "travellers" | "bookerStays">): TravellerInput[] {
  return state.travellers.map((line, i) => {
    const traveller: TravellerInput = {
      kind: line.kind,
      fullName: line.fullName.trim(),
      isBooker: state.bookerStays && i === 0 && line.kind === "adult",
      notStaying: false,
    };
    // A child's or an infant's age; text that is not a whole number goes as NaN, which the server refuses.
    if (line.kind !== "adult") traveller.age = AGE.test(line.age.trim()) ? Number(line.age.trim()) : Number.NaN;
    return traveller;
  });
}

export type TravellerErrorCode = "required" | "email" | "phone" | "tooLong" | "age";

/**
 * Every failing field of the Travellers step at once, keyed by the dotted paths parseHoldRequest uses
 * (`contact.name`, `travellers.2.age`, `pickupAddress`, ...), with the limits of lib/booking/validate.ts.
 */
export function travellersErrors(state: Pick<TripState, "contact" | "travellers" | "bookerStays" | "pickup" | "quote" | "addons">): Record<string, TravellerErrorCode> {
  const errors: Record<string, TravellerErrorCode> = {};
  const c = state.contact;
  const need = (key: string, value: string, max: number) => {
    const t = value.trim();
    if (t === "") errors[key] = "required";
    else if (t.length > max) errors[key] = "tooLong";
  };
  const optional = (key: string, value: string, max: number) => {
    if (value.trim().length > max) errors[key] = "tooLong";
  };

  need("contact.name", c.name, 120);
  const email = c.email.trim();
  if (email === "") errors["contact.email"] = "required";
  else if (!isEmail(email.toLowerCase())) errors["contact.email"] = "email";
  if (c.phone.trim() === "") errors["contact.phone"] = "required";
  else if (!isPhone(c.phone)) errors["contact.phone"] = "phone";
  optional("contact.nationality", c.nationality, 60);
  optional("contact.specialRequests", c.specialRequests, 1000);
  optional("contact.emergencyName", c.emergencyName, 120);
  if (c.emergencyPhone.trim() !== "" && !isPhone(c.emergencyPhone)) errors["contact.emergencyPhone"] = "phone";

  state.travellers.forEach((line, i) => {
    need(`travellers.${i}.fullName`, line.fullName, 120);
    if (line.kind === "adult") return;
    const age = line.age.trim();
    const [min, max] = line.kind === "child" ? [3, 12] : [0, 2];
    if (age === "") errors[`travellers.${i}.age`] = "required";
    else if (!AGE.test(age) || Number(age) < min || Number(age) > max) errors[`travellers.${i}.age`] = "age";
  });

  if (tripNeedsPickup(state)) need("pickupAddress", state.pickup, 300);
  return errors;
}

export type RequestChoiceErrors = { plan?: true; airport?: true; terms?: true };

/**
 * The Request step's three choices. Given the whole state, a "deposit" plan while the price has no deposit counts as
 * no plan; given only `{ plan, airport, terms }`, the plan is checked for presence alone.
 */
export function requestChoiceErrors(
  choices: Pick<TripState, "plan" | "airport" | "terms"> & Partial<Pick<TripState, "quote" | "holdBreakdown">>,
): RequestChoiceErrors {
  const errors: RequestChoiceErrors = {};
  const priced = "quote" in choices || "holdBreakdown" in choices;
  const deposit = priced ? displayBreakdown({ quote: choices.quote ?? null, holdBreakdown: choices.holdBreakdown ?? null })?.deposit ?? null : undefined;
  if (choices.plan === null || (choices.plan === "deposit" && deposit === null)) errors.plan = true;
  if (choices.airport === null) errors.airport = true;
  if (!choices.terms) errors.terms = true;
  return errors;
}

const isEmpty = (o: object) => Object.keys(o).length === 0;

// ---------------------------------------------------------------- request bodies

/** The quote body: the URL's six fields, add-ons above 0 sorted by id, the plan (or "full"), the locale, the hold. */
export function quoteBody(state: TripState, locale: Locale): QuoteRequest {
  const { stay, from, to, adults, children, infants } = state.query;
  const body: QuoteRequest = {
    stay,
    from,
    to,
    adults,
    children,
    infants,
    addons: Object.keys(state.addons)
      .filter((id) => (state.addons[id] ?? 0) > 0)
      .sort()
      .map((id) => ({ id, qty: state.addons[id] })),
    plan: state.plan ?? "full",
    locale,
  };
  if (state.hold) body.hold = { ref: state.hold.ref, t: state.hold.linkToken };
  return body;
}

/**
 * The hold body as the state stands, without the validity gate (holdBody is this behind travellersErrors and
 * requestChoiceErrors; the node tests use it for parity with parseHoldRequest). Contact trimmed, blank optional fields
 * left out, the pickup address only when needed, never an amount and never `hold`.
 */
export function holdBodyDraft(state: TripState, locale: Locale, plan: TripPlan, airport: Airport): HoldRequest {
  const quote = quoteBody({ ...state, hold: null }, locale);
  const c = state.contact;
  const contact: HoldRequest["contact"] = { name: c.name.trim(), email: c.email.trim(), phone: c.phone.trim() };
  for (const key of ["nationality", "specialRequests", "emergencyName", "emergencyPhone"] as const) {
    const value = c[key].trim();
    if (value !== "") contact[key] = value;
  }
  const body: HoldRequest = {
    ...quote,
    plan,
    contact,
    travellers: travellerInputs(state),
    airport,
    termsAccepted: true,
  };
  const pickup = state.pickup.trim();
  if (tripNeedsPickup(state) && pickup !== "") body.pickupAddress = pickup;
  return body;
}

/** The hold body, or null while held, while a traveller field fails, or until the plan, the airport and the terms are set. */
export function holdBody(state: TripState, locale: Locale): HoldRequest | null {
  if (state.hold) return null;
  if (!isEmpty(travellersErrors(state)) || !isEmpty(requestChoiceErrors(state))) return null;
  if (state.plan === null || state.airport === null || !state.terms) return null;
  return holdBodyDraft(state, locale, state.plan, state.airport);
}

// ---------------------------------------------------------------- Send request

export type CanRequest = { ok: true } | { ok: false; reason: "no_hold" | "hold_ended" | "requests_closed" };

/** Send request is enabled exactly while a live hold is stored and requests are open. */
export function canRequest(state: Pick<TripState, "hold" | "ended" | "closed">, nowMs: number): CanRequest {
  if (state.ended) return { ok: false, reason: "hold_ended" };
  if (!state.hold) return { ok: false, reason: "no_hold" };
  if (holdMsLeft(state.hold.holdExpiresAt, nowMs) === 0) return { ok: false, reason: "hold_ended" };
  if (state.closed) return { ok: false, reason: "requests_closed" };
  return { ok: true };
}

// ---------------------------------------------------------------- the reducer

function sameAddons(a: Record<string, number>, b: Record<string, number>): boolean {
  const ka = Object.keys(a);
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k]);
}

/**
 * May the guest stand on `step` now? Forward needs an ok quote and open requests; Request (Q-01 = B) needs clean
 * Travellers fields and the three choices, which sit at the end of the Travellers step.
 */
function stepOpen(state: TripState, step: TripStep): boolean {
  if (step <= state.step) return true;
  if (state.closed || !state.quote?.ok) return false;
  if (step === 4) return isEmpty(travellersErrors(state)) && isEmpty(requestChoiceErrors(state));
  return true;
}

// The hold body's fields the guest fills on the Travellers step (Q-01 = B: the choices too).
const TRAVELLER_FIELD = /^(?:contact\.|travellers(?:\.|$)|pickupAddress$|plan$|airport$|termsAccepted$)/;

function applyMove(state: TripState, move: TripMove): TripState {
  switch (move.type) {
    case "go": {
      if (move.step === state.step) return state;
      if (!stepOpen(state, move.step)) {
        // Continue on Travellers with errors: the step stays and the errors show.
        return move.step === 4 && state.step === 3 && !state.closed && state.quote?.ok ? { ...state, showErrors: true } : state;
      }
      const entering = move.step === 4 && !state.hold;
      return {
        ...state,
        step: move.step,
        refusal: null,
        ended: move.step < state.step ? false : state.ended,
        holdAttempt: entering ? state.holdAttempt + 1 : state.holdAttempt,
      };
    }
    case "setAddon": {
      if (!UUID.test(move.id) || !Number.isInteger(move.qty) || move.qty < 0 || move.qty > MAX_QTY) return state;
      const addons = { ...state.addons };
      if (move.qty === 0) delete addons[move.id];
      else addons[move.id] = move.qty;
      return { ...state, addons, addonsTouched: true };
    }
    case "plan": {
      if (move.plan === "deposit") {
        const price = displayBreakdown(state);
        if (price && price.deposit === null) return state;
      }
      return { ...state, plan: move.plan };
    }
    case "airport":
      return AIRPORTS.includes(move.airport) ? { ...state, airport: move.airport } : state;
    case "terms":
      return { ...state, terms: move.accepted };
  }
}

export function tripReducer(state: TripState, action: TripAction): TripState {
  switch (action.type) {
    case "go":
    case "setAddon":
    case "plan":
    case "airport":
    case "terms":
      // A hold locks the choices, the add-ons and every step before Request (Q-08): release first.
      if (state.hold && !(action.type === "go" && action.step === 4)) return state;
      return applyMove(state, action);

    case "quoted": {
      const quote = action.quote;
      let next: TripState = { ...state, quote };
      if (quote.reasons.some((r) => r.code === "requests_closed")) next.closed = true;
      if (!state.hold) {
        // D-48: the first ok quote, before the guest touches an add-on, adds the home pickup and nothing else.
        if (quote.ok && !state.addonsTouched) {
          const defaults: Record<string, number> = {};
          for (const offer of quote.offers) if (offer.isHomePickup) defaults[offer.id] = 1;
          if (!sameAddons(defaults, state.addons)) next = { ...next, addons: defaults };
        }
        if (quote.breakdown && quote.breakdown.deposit === null && state.plan === "deposit") next.plan = null;
      }
      return next;
    }

    case "closed":
      return state.closed ? state : { ...state, closed: true };

    case "contact": {
      if (state.hold) return state;
      const patch: Partial<TripContact> = {};
      for (const key of CONTACT_KEYS) {
        const value = action.patch[key];
        if (typeof value === "string") patch[key] = value;
      }
      const contact = { ...state.contact, ...patch };
      let travellers = state.travellers;
      // Line 1 is the booker's own line while they stay: it follows the contact name until the guest edits it.
      const first = travellers[0];
      if (patch.name !== undefined && state.bookerStays && first && (first.fullName === "" || first.fullName === state.contact.name)) {
        travellers = [{ ...first, fullName: patch.name }, ...travellers.slice(1)];
      }
      return { ...state, contact, travellers };
    }

    case "bookerStays": {
      if (state.hold || action.stays === state.bookerStays) return state;
      const first = state.travellers[0];
      let travellers = state.travellers;
      if (first) {
        // Not staying frees line 1 (its copied name goes); staying again fills an empty line 1 with the contact name.
        if (!action.stays && first.fullName === state.contact.name) travellers = [{ ...first, fullName: "" }, ...travellers.slice(1)];
        if (action.stays && first.fullName === "") travellers = [{ ...first, fullName: state.contact.name }, ...travellers.slice(1)];
      }
      return { ...state, bookerStays: action.stays, travellers };
    }

    case "traveller": {
      const line = state.travellers[action.index];
      if (state.hold || !line) return state;
      const patch: Partial<TripTraveller> = {};
      if (typeof action.patch.fullName === "string") patch.fullName = action.patch.fullName;
      if (typeof action.patch.age === "string" && line.kind !== "adult") patch.age = action.patch.age;
      const travellers = state.travellers.map((l, i) => (i === action.index ? { ...l, ...patch } : l));
      return { ...state, travellers };
    }

    case "pickup":
      return state.hold ? state : { ...state, pickup: action.address };

    case "held": {
      const h = action.hold;
      return {
        ...state,
        step: 4,
        hold: { ref: h.ref, linkToken: h.linkToken, holdExpiresAt: h.holdExpiresAt, transferWindowMinutes: h.transferWindowMinutes },
        holdBreakdown: h.breakdown,
        ended: false,
        refusal: null,
        showErrors: false,
      };
    }

    case "released": {
      if (!state.hold) return action.next ? applyMove(state, action.next) : state;
      // The terms are ticked again for the next hold (T-04-03-06: accepted in this hold, never carried over).
      const free: TripState = { ...state, hold: null, holdBreakdown: null, terms: false, refusal: null };
      return action.next ? applyMove(free, action.next) : free;
    }

    case "ended":
      return { ...state, hold: null, holdBreakdown: null, ended: true };

    case "retryHold":
      // The Hold button after a refused or failed hold: on Request, not held, requests open, the body still valid.
      if (state.step !== 4 || state.hold || state.closed || state.ended || holdBody(state, "en") === null) return state;
      return { ...state, refusal: null, holdAttempt: state.holdAttempt + 1 };

    case "refused": {
      if (action.reasons.length === 0) return state.refusal ? { ...state, refusal: null } : state;
      let next: TripState = { ...state, refusal: { at: action.at, reasons: action.reasons } };
      if (action.reasons.some((r) => r.code === "requests_closed")) next.closed = true;
      // A hold refused on a traveller field: back to Travellers with the errors shown.
      if (action.at === "hold" && !state.hold && action.reasons.some((r) => r.code === "invalid" && r.field !== undefined && TRAVELLER_FIELD.test(r.field))) {
        next = { ...next, step: 3, showErrors: true };
      }
      return next;
    }
  }
}

// ---------------------------------------------------------------- storage

const STORED_KEYS = ["v", "query", "step", "addons", "addonsTouched", "contact", "bookerStays", "travellers", "pickup", "plan", "airport", "hold"] as const;
const QUERY_KEYS = ["stay", "from", "to", "adults", "children", "infants"] as const;
const LINE_KEYS = ["kind", "fullName", "age"] as const;
const HOLD_KEYS = ["ref", "linkToken", "holdExpiresAt", "transferWindowMinutes"] as const;
const MAX_TEXT = 4000;

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function exactKeys(obj: Rec, keys: readonly string[]): boolean {
  const own = Object.keys(obj);
  return own.length === keys.length && keys.every((k) => Object.prototype.hasOwnProperty.call(obj, k));
}

const isShortText = (v: unknown): v is string => typeof v === "string" && v.length <= MAX_TEXT;

/** The stored form: the inputs and the hold record; no amount, no quote, no terms box. */
export function serializeTripState(state: TripState): string {
  return JSON.stringify({
    v: 1,
    query: state.query,
    step: state.step,
    addons: state.addons,
    addonsTouched: state.addonsTouched,
    contact: state.contact,
    bookerStays: state.bookerStays,
    travellers: state.travellers,
    pickup: state.pickup,
    plan: state.plan,
    airport: state.airport,
    hold: state.hold,
  });
}

/**
 * A stored trip for this URL's query, or null: not JSON, a missing or extra key, another query, an add-on id that is
 * not a uuid or a quantity outside 0..99, traveller lines that do not match the query, a hold whose reference, token,
 * end or window is not of its shape. Never repaired.
 */
export function readTripState(text: string | null, query: TripQuery): TripState | null {
  if (typeof text !== "string" || text === "") return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRec(raw) || !exactKeys(raw, STORED_KEYS) || raw.v !== 1) return null;

  const q = raw.query;
  if (!isRec(q) || !exactKeys(q, QUERY_KEYS) || !QUERY_KEYS.every((k) => q[k] === query[k])) return null;

  const step = raw.step;
  if (step !== 1 && step !== 2 && step !== 3 && step !== 4) return null;

  const addonsRaw = raw.addons;
  if (!isRec(addonsRaw)) return null;
  const addons: Record<string, number> = {};
  for (const [id, qty] of Object.entries(addonsRaw)) {
    if (!UUID.test(id) || typeof qty !== "number" || !Number.isInteger(qty) || qty < 0 || qty > MAX_QTY) return null;
    if (qty > 0) addons[id] = qty;
  }

  if (typeof raw.addonsTouched !== "boolean" || typeof raw.bookerStays !== "boolean") return null;

  const c = raw.contact;
  if (!isRec(c) || !exactKeys(c, CONTACT_KEYS) || !CONTACT_KEYS.every((k) => isShortText(c[k]))) return null;
  const contact = Object.fromEntries(CONTACT_KEYS.map((k) => [k, c[k] as string])) as TripContact;

  const kinds = lineKinds(query);
  const lines = raw.travellers;
  if (!Array.isArray(lines) || lines.length !== kinds.length) return null;
  const travellers: TripTraveller[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line: unknown = lines[i];
    if (!isRec(line) || !exactKeys(line, LINE_KEYS) || line.kind !== kinds[i]) return null;
    if (!isShortText(line.fullName) || typeof line.age !== "string" || line.age.length > 8) return null;
    travellers.push({ kind: kinds[i], fullName: line.fullName, age: line.age });
  }

  if (!isShortText(raw.pickup)) return null;
  const plan = raw.plan;
  if (plan !== null && plan !== "deposit" && plan !== "full") return null;
  const airport = raw.airport;
  if (airport !== null && !(typeof airport === "string" && (AIRPORTS as readonly string[]).includes(airport))) return null;

  let hold: TripHold | null = null;
  const h = raw.hold;
  if (h !== null) {
    if (!isRec(h) || !exactKeys(h, HOLD_KEYS)) return null;
    if (!isBookingRef(h.ref) || !isLinkToken(h.linkToken) || !isInstant(h.holdExpiresAt)) return null;
    const minutes = h.transferWindowMinutes;
    if (typeof minutes !== "number" || !Number.isInteger(minutes) || minutes < 1) return null;
    hold = { ref: h.ref, linkToken: h.linkToken, holdExpiresAt: h.holdExpiresAt, transferWindowMinutes: minutes };
  }

  return {
    ...initialTripState(query),
    // Q-01 = B: Request without a hold comes back on Travellers, where the terms box (never stored) is ticked again.
    step: step === 4 && hold === null ? 3 : step,
    addons,
    addonsTouched: raw.addonsTouched,
    contact,
    bookerStays: raw.bookerStays,
    travellers,
    pickup: raw.pickup,
    plan,
    airport: airport as Airport | null,
    hold,
  };
}

/**
 * The trip of this tab for `query` (sessionStorage), else a fresh one. A stored hold already past its end at `nowMs`
 * comes back ended (the inputs kept, the hold cleared); 04-06 adds the server check through /api/booking/view.
 */
export function loadTripState(query: TripQuery, nowMs: number = Date.now()): TripState {
  let text: string | null = null;
  try {
    text = typeof window === "undefined" ? null : window.sessionStorage.getItem(TRIP_STATE_KEY);
  } catch {
    text = null;
  }
  const state = readTripState(text, query) ?? initialTripState(query);
  return state.hold && holdMsLeft(state.hold.holdExpiresAt, nowMs) === 0 ? tripReducer(state, { type: "ended" }) : state;
}

/** Store the trip for this tab; a storage that is off or full is ignored. */
export function writeTripState(state: TripState): void {
  try {
    if (typeof window !== "undefined") window.sessionStorage.setItem(TRIP_STATE_KEY, serializeTripState(state));
  } catch {
    // Storage off or full: the page keeps working from memory.
  }
}
