// Integer fils (1 AED = 100 fils), the one rounding rule and percent text to basis points (B-06, PAY-02).
// Pure: no imports outside lib/money, no environment, no network.

/** Stripe's minimum charge on an AED account: 2.00 AED. */
export const MIN_CHARGE_FILS = 200;

/**
 * The largest subtotal the engine prices: 450,359,962,736 fils. A technical bound, not a business one: VAT is at most
 * 100 %, so the grand total is at most twice the subtotal, and pct() on that grand total (x 10000 + 5000) must stay a
 * safe integer. Above it the booking engine answers `too_large` instead of rounding wrong or throwing.
 */
export const MAX_AMOUNT_FILS = Math.floor((Number.MAX_SAFE_INTEGER - 5000) / 20000);

/** Throws unless `n` is a non-negative safe integer. `label` names the amount in the message. */
export function assertFils(n: unknown, label: string): asserts n is number {
  if (typeof n !== "number" || !Number.isSafeInteger(n) || n < 0) {
    throw new RangeError(`${label} must be a non-negative safe integer of fils, got ${String(n)}`);
  }
}

/**
 * The one rounding rule: `bp` basis points of `amount` fils, half-up.
 * pct(a, bp) = floor((a * bp + 5000) / 10000). Every percentage in the money engine goes through here.
 * The product is checked to be a safe integer; below 2^53 the quotient is under 2^40, where a correctly rounded
 * division cannot cross a whole number, so the floor is exact.
 */
export function pct(amount: number, bp: number): number {
  assertFils(amount, "amount");
  if (typeof bp !== "number" || !Number.isInteger(bp) || bp < 0 || bp > 10000) {
    throw new RangeError(`basis points must be an integer in 0..10000, got ${String(bp)}`);
  }
  const scaled = amount * bp + 5000;
  if (!Number.isSafeInteger(scaled)) {
    throw new RangeError(`amount * basis points is not a safe integer (${amount} * ${bp})`);
  }
  return Math.floor(scaled / 10000);
}

const PERCENT_TEXT = /^(0|[1-9][0-9]{0,2})(?:\.([0-9]{1,2}))?$/;

/**
 * A percentage written as decimal text ("5", "5.00", "5.5") to basis points (500, 500, 550), 0..100 % only, at most
 * two decimals. The text is split and read as whole numbers; no float is ever multiplied. A JSON number (PostgREST may
 * send `numeric` as one) is accepted when its String() form passes the same rule.
 */
export function percentTextToBp(value: string | number): number {
  let text: string;
  if (typeof value === "string") text = value;
  else if (typeof value === "number" && Number.isFinite(value)) text = String(value);
  else throw new TypeError(`percent must be decimal text or a finite number, got ${String(value)}`);

  const match = PERCENT_TEXT.exec(text);
  if (!match) throw new RangeError(`percent must look like "5", "5.5" or "5.00" (0..100), got ${JSON.stringify(text)}`);
  const whole = Number.parseInt(match[1], 10);
  const hundredths = Number.parseInt((match[2] ?? "").padEnd(2, "0"), 10);
  const bp = whole * 100 + hundredths;
  if (bp > 10000) throw new RangeError(`percent must be at most 100, got ${JSON.stringify(text)}`);
  return bp;
}
