// The booking price, in the order the owner signed (B-05): nights -> add-ons -> subtotal -> VAT on the subtotal, once
// -> grand -> deposit (% of grand) or full; balance and its due date (B-15); full payment only when arrival is sooner
// than the balance-due days (B-21). Integer fils and the one pct() rounding rule only (B-06). The page's numbers are
// display only: the server calls priceBooking again for every amount that is charged or stored.
// No coupon line and no damage-hold line (deferred: PAY-05, PAY-13). Each night's rate arrives already resolved by
// 3.2's stay_night_rates (C-11); this engine sums them and never chooses between ranges.
// Pure: no imports outside lib/money, no environment, no network.
import { addDays, daysBetween, eachNight, isIsoDate } from "./dates";
import { MAX_AMOUNT_FILS, MIN_CHARGE_FILS, assertFils, pct } from "./fils";

export type AddOnUnit = "person" | "night" | "trip";

export type NightRate = { night: string; rateFils: number | null; source: "range" | "base" | null; rateId: string | null };

export type AddOnOffer = { id: string; unit: AddOnUnit; priceFils: number };

export type PriceInput = {
  from: string;
  to: string;
  today: string;
  adults: number;
  children: number;
  infants: number;
  baseRateFils: number | null;
  nightRates: NightRate[];
  offers: AddOnOffer[];
  picks: { id: string; quantity: number }[];
  vatBp: number | null;
  depositBp: number | null;
  balanceDueDays: number | null;
  plan: "deposit" | "full";
};

export type DepositBlock = "too_close_to_arrival" | "no_due_days" | "zero_deposit" | "balance_below_minimum";

export type PriceReason =
  | { code: "no_rate" }
  | { code: "settings_missing" }
  | { code: "dates_invalid" }
  | { code: "addon_unavailable"; id: string }
  | { code: "addon_quantity"; id: string; max: number }
  | { code: "deposit_unavailable"; cause: DepositBlock }
  | { code: "below_minimum_charge" }
  | { code: "too_large"; field: "guests" | "amount"; max: number };

export type PriceSnapshot = {
  nights: { night: string; rateFils: number; source: "range" | "base"; rateId: string | null }[];
  nightCount: number;
  nightsFils: number;
  lines: { id: string; unit: AddOnUnit; unitPriceFils: number; quantity: number; lineFils: number }[];
  addonsFils: number;
  subtotalFils: number;
  vatBp: number;
  vatFils: number;
  grandFils: number;
  depositBp: number;
  deposit: { dueNowFils: number; balanceFils: number; balanceDueDate: string } | null;
  depositBlock: DepositBlock | null;
  full: { dueNowFils: number };
  plan: "deposit" | "full";
  dueNowFils: number;
  balanceFils: number;
  balanceDueDate: string | null;
};

/**
 * `snapshot` is null when the stay cannot be priced at all: dates_invalid, settings_missing, no_rate, or too_large
 * (a guest total or an amount past the exact-arithmetic bounds). With any other reason it is the price as far as it
 * goes, for display; it is stored only when `ok`.
 */
export type PriceResult =
  | { ok: true; snapshot: PriceSnapshot; reasons: [] }
  | { ok: false; reasons: PriceReason[]; snapshot: PriceSnapshot | null };

const UNITS: readonly AddOnUnit[] = ["person", "night", "trip"];

function assertCount(n: unknown, label: string): asserts n is number {
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`${label} must be a non-negative integer, got ${String(n)}`);
  }
}

function assertBp(n: unknown, label: string): void {
  if (n === null) return;
  if (typeof n !== "number" || !Number.isInteger(n) || n < 0 || n > 10000) {
    throw new RangeError(`${label} must be null or an integer in 0..10000, got ${String(n)}`);
  }
}

/**
 * `total + x` when it stays at or under `max`, else null. Both are non-negative safe integers and `total <= max`, so
 * `max - total` is exact and no unsafe sum is ever formed.
 */
function addWithin(total: number, x: number, max: number): number | null {
  return x > max - total ? null : total + x;
}

/**
 * Shape checks on what the server itself passes in (database rows, settings, its own guest counts). A failure is a
 * programming error and throws. The pick elements come from the browser and are checked in priceBooking instead.
 */
function assertCallerInput(input: PriceInput): void {
  if (!isIsoDate(input.today)) throw new RangeError(`today must be a YYYY-MM-DD day, got ${String(input.today)}`);
  assertCount(input.adults, "adults");
  assertCount(input.children, "children");
  assertCount(input.infants, "infants");
  if (input.baseRateFils !== null) assertFils(input.baseRateFils, "baseRateFils");
  assertBp(input.vatBp, "vatBp");
  assertBp(input.depositBp, "depositBp");
  if (input.balanceDueDays !== null) assertCount(input.balanceDueDays, "balanceDueDays");
  if (input.plan !== "deposit" && input.plan !== "full") throw new RangeError(`plan must be "deposit" or "full"`);
  if (!Array.isArray(input.nightRates)) throw new TypeError("nightRates must be an array of night rows");
  if (!Array.isArray(input.offers)) throw new TypeError("offers must be an array");
  if (!Array.isArray(input.picks)) throw new TypeError("picks must be an array");
  const offerIds = new Set<string>();
  for (const offer of input.offers) {
    if (typeof offer.id !== "string" || offer.id === "") throw new TypeError("every offer needs an id");
    if (offerIds.has(offer.id)) throw new RangeError(`offer ${offer.id} is listed twice`);
    offerIds.add(offer.id);
    if (!UNITS.includes(offer.unit)) throw new RangeError(`offer ${offer.id} has an unknown unit ${String(offer.unit)}`);
    assertFils(offer.priceFils, `offer ${offer.id} priceFils`);
  }
}

/**
 * The night rows must be exactly the stay's nights, in order; anything else is a caller error and throws.
 * Returns the priced nights, or null when a night has no rate (C-12).
 */
function priceNights(input: PriceInput): PriceSnapshot["nights"] | null {
  const count = daysBetween(input.from, input.to);
  if (input.nightRates.length !== count) {
    throw new RangeError(`nightRates has ${input.nightRates.length} night rows for a ${count}-night stay`);
  }
  const expected = eachNight(input.from, input.to);
  const nights: PriceSnapshot["nights"] = [];
  let missing = false;
  input.nightRates.forEach((row, i) => {
    if (row.night !== expected[i]) {
      throw new RangeError(`night row ${i} is ${String(row.night)}, expected ${expected[i]}`);
    }
    if (row.rateFils === null) {
      missing = true;
      return;
    }
    assertFils(row.rateFils, `rate for night ${row.night}`);
    if (row.source !== "range" && row.source !== "base") {
      throw new RangeError(`night ${row.night} has a rate but no source`);
    }
    if (row.rateId !== null && typeof row.rateId !== "string") {
      throw new TypeError(`night ${row.night} rateId must be a string or null`);
    }
    nights.push({ night: row.night, rateFils: row.rateFils, source: row.source, rateId: row.rateId });
  });
  return missing ? null : nights;
}

function maxQuantity(unit: AddOnUnit, guestTotal: number, nightCount: number): number {
  if (unit === "person") return guestTotal;
  if (unit === "night") return nightCount;
  return 1;
}

/** Prices one booking. Never throws for a guest's choice; throws only when the server passes a malformed input. */
export function priceBooking(input: PriceInput): PriceResult {
  assertCallerInput(input);

  // 1. Dates: real days, at least one night, arrival today or later.
  if (!isIsoDate(input.from) || !isIsoDate(input.to) || input.to <= input.from || input.from < input.today) {
    return { ok: false, reasons: [{ code: "dates_invalid" }], snapshot: null };
  }

  // 2. Settings, the guest total, then 3. nights (checked against the stay even when something above is missing, so a
  // caller error still shows). The guest total must stay exact: past MAX_SAFE_INTEGER it is too_large, never a throw.
  const blocking: PriceReason[] = [];
  if (input.vatBp === null || input.depositBp === null) blocking.push({ code: "settings_missing" });
  const someGuests = addWithin(input.adults, input.children, Number.MAX_SAFE_INTEGER);
  const guestTotal = someGuests === null ? null : addWithin(someGuests, input.infants, Number.MAX_SAFE_INTEGER);
  if (guestTotal === null) blocking.push({ code: "too_large", field: "guests", max: Number.MAX_SAFE_INTEGER });
  const nights = priceNights(input);
  if (input.baseRateFils === null || nights === null) blocking.push({ code: "no_rate" });
  if (blocking.length > 0 || nights === null || guestTotal === null || input.vatBp === null || input.depositBp === null) {
    return { ok: false, reasons: blocking, snapshot: null };
  }
  const vatBp = input.vatBp;
  const depositBp = input.depositBp;
  const nightCount = nights.length;
  // Every amount up to the subtotal stays at or under MAX_AMOUNT_FILS; past it the price is too_large (no snapshot).
  let tooLarge = false;
  let nightsFils = 0;
  for (const n of nights) {
    const next = addWithin(nightsFils, n.rateFils, MAX_AMOUNT_FILS);
    if (next === null) tooLarge = true;
    else nightsFils = next;
  }

  // 4. Add-on lines (D-46). Picks come from the browser: an element that is not an object with a string id is
  // addon_unavailable under String(id), never a throw. Zero picks are dropped; a repeated id is refused as a whole.
  const reasons: PriceReason[] = [];
  const refused = new Set<string>();
  const wellFormed: { id: string; quantity: unknown }[] = [];
  for (const raw of input.picks as unknown[]) {
    const isObject = raw !== null && typeof raw === "object";
    const id: unknown = isObject ? (raw as { id?: unknown }).id : raw;
    if (!isObject || typeof id !== "string") {
      const shown = String(id);
      if (!refused.has(shown)) {
        refused.add(shown);
        reasons.push({ code: "addon_unavailable", id: shown });
      }
      continue;
    }
    const quantity: unknown = (raw as { quantity?: unknown }).quantity;
    if (quantity === 0) continue;
    wellFormed.push({ id, quantity });
  }
  const seen = new Map<string, number>();
  for (const p of wellFormed) seen.set(p.id, (seen.get(p.id) ?? 0) + 1);
  const offers = new Map(input.offers.map((o) => [o.id, o]));
  const lines: PriceSnapshot["lines"] = [];
  let addonsFils = 0;
  for (const pick of wellFormed) {
    if (refused.has(pick.id)) continue;
    const offer = offers.get(pick.id);
    if (!offer || (seen.get(pick.id) ?? 0) > 1) {
      refused.add(pick.id);
      reasons.push({ code: "addon_unavailable", id: pick.id });
      continue;
    }
    const max = maxQuantity(offer.unit, guestTotal, nightCount);
    const q = pick.quantity;
    if (typeof q !== "number" || !Number.isSafeInteger(q) || q < 0 || q > max) {
      refused.add(pick.id);
      reasons.push({ code: "addon_quantity", id: pick.id, max });
      continue;
    }
    const lineFils = offer.priceFils * q;
    const nextAddons = Number.isSafeInteger(lineFils) ? addWithin(addonsFils, lineFils, MAX_AMOUNT_FILS) : null;
    if (nextAddons === null) {
      tooLarge = true;
      continue;
    }
    addonsFils = nextAddons;
    lines.push({ id: offer.id, unit: offer.unit, unitPriceFils: offer.priceFils, quantity: q, lineFils });
  }

  // 5. Subtotal, VAT on the subtotal (once), grand. With subtotal <= MAX_AMOUNT_FILS every pct() below is exact.
  const subtotal = tooLarge ? null : addWithin(nightsFils, addonsFils, MAX_AMOUNT_FILS);
  if (subtotal === null) {
    return { ok: false, reasons: [...reasons, { code: "too_large", field: "amount", max: MAX_AMOUNT_FILS }], snapshot: null };
  }
  const subtotalFils = subtotal;
  const vatFils = pct(subtotalFils, vatBp);
  const grandFils = subtotalFils + vatFils;

  // 6. The deposit option: deposit % of grand, balance by subtraction so the two always add up.
  const depositFils = pct(grandFils, depositBp);
  const restFils = grandFils - depositFils;
  let depositBlock: DepositBlock | null = null;
  if (input.balanceDueDays === null) depositBlock = "no_due_days";
  else if (depositBp === 0) depositBlock = "zero_deposit";
  else if (daysBetween(input.today, input.from) < input.balanceDueDays) depositBlock = "too_close_to_arrival";
  else if (depositFils < MIN_CHARGE_FILS || restFils < MIN_CHARGE_FILS) depositBlock = "balance_below_minimum";
  const deposit =
    depositBlock === null && input.balanceDueDays !== null
      ? { dueNowFils: depositFils, balanceFils: restFils, balanceDueDate: addDays(input.from, -input.balanceDueDays) }
      : null;

  // 7. The chosen plan. A refused deposit leaves the snapshot on full, the only payable plan, and says why.
  let plan: "deposit" | "full" = "full";
  let dueNowFils = grandFils;
  let balanceFils = 0;
  let balanceDueDate: string | null = null;
  if (input.plan === "deposit" && deposit) {
    plan = "deposit";
    dueNowFils = deposit.dueNowFils;
    balanceFils = deposit.balanceFils;
    balanceDueDate = deposit.balanceDueDate;
  } else if (input.plan === "deposit") {
    reasons.push({ code: "deposit_unavailable", cause: depositBlock ?? "no_due_days" });
  }

  // 8. Stripe's minimum charge on what is due now.
  if (dueNowFils < MIN_CHARGE_FILS) reasons.push({ code: "below_minimum_charge" });

  const snapshot: PriceSnapshot = {
    nights,
    nightCount,
    nightsFils,
    lines,
    addonsFils,
    subtotalFils,
    vatBp,
    vatFils,
    grandFils,
    depositBp,
    deposit,
    depositBlock,
    full: { dueNowFils: grandFils },
    plan,
    dueNowFils,
    balanceFils,
    balanceDueDate,
  };
  return reasons.length === 0 ? { ok: true, snapshot, reasons: [] } : { ok: false, reasons, snapshot };
}
