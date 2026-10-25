// Plan 04-03, Tasks 3 and 4: the trip page's calls to the booking routes. A plain module (no React, no directive), used
// by the client screen. Same-origin JSON POSTs only: the browser sets the Origin itself and the server checks it (F-02);
// nothing here reads or writes an Origin, a cookie or the environment. Nothing ever throws to the screen: a network
// error or a timeout is status 0, a body that is not the expected shape is the `unavailable` reason, and an answer is
// checked before the page formats a single amount from it (formatAed throws on a value that is not fils).
// The request and view routes are 04-06's to call; it calls them through postJson.
import type { DepositBlock } from "../money/booking-price";
import { isIsoDate } from "../money/dates";
import { isBookingRef } from "./ref";
import { isInstant, isLinkToken } from "./trip-state";
import type {
  AddOnOffering,
  BookingReason,
  HoldRequest,
  HoldResponse,
  PublicPriceSnapshot,
  QuoteRequest,
  QuoteResponse,
  ReasonCode,
  StayCard,
} from "./types";

export const QUOTE_PATH = "/api/booking/quote";
export const HOLD_PATH = "/api/booking/hold";
export const RELEASE_PATH = "/api/booking/release";

export type BookingApiPath = `/api/booking/${string}`;

export type PostResult = { status: number; json: unknown; aborted?: true };

export type PostOptions = { signal?: AbortSignal; timeoutMs?: number };

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * POST `body` as JSON to a booking route. Resolves `{ status, json }`: `json` is null when the answer is not JSON;
 * `status` is 0 on a network error or a timeout; a caller's abort resolves `{ status: 0, json: null, aborted: true }`.
 */
export async function postJson(path: BookingApiPath, body: unknown, options: PostOptions = {}): Promise<PostResult> {
  const { signal, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  if (signal?.aborted) return { status: 0, json: null, aborted: true };

  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const json: unknown = await res.json().catch(() => null);
    if (signal?.aborted) return { status: 0, json: null, aborted: true };
    return { status: res.status, json };
  } catch {
    return signal?.aborted ? { status: 0, json: null, aborted: true } : { status: 0, json: null };
  } finally {
    globalThis.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

// ---------------------------------------------------------------- shape checks of the server's answers

type Rec = Record<string, unknown>;

function isRec(value: unknown): value is Rec {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const isFils = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0;
const isCount = isFils;
const isBp = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 10_000;
const isText = (v: unknown): v is string => typeof v === "string";
const isUnit = (v: unknown) => v === "person" || v === "night" || v === "trip";

// Exhaustive on purpose: tsc fails here when 04-08 or a later plan adds a code, so the page never meets one it cannot word.
const REASON_CODES: Record<ReasonCode, true> = {
  stay_unavailable: true,
  dates_invalid: true,
  below_min_nights: true,
  over_max_guests: true,
  blocked: true,
  sold_out: true,
  no_rate: true,
  addon_unavailable: true,
  addon_quantity: true,
  settings_missing: true,
  settings_changed: true,
  deposit_unavailable: true,
  below_minimum_charge: true,
  hold_limit: true,
  hold_ending: true,
  hold_ended: true,
  not_payable: true,
  nothing_due: true,
  terms_required: true,
  unavailable: true,
  invalid: true,
  requests_closed: true,
  too_many_open: true,
};

const DEPOSIT_BLOCKS: Record<DepositBlock, true> = {
  too_close_to_arrival: true,
  no_due_days: true,
  zero_deposit: true,
  balance_below_minimum: true,
};

const isReasonCode = (v: unknown): v is ReasonCode => typeof v === "string" && Object.prototype.hasOwnProperty.call(REASON_CODES, v);
const isDepositBlock = (v: unknown): v is DepositBlock => typeof v === "string" && Object.prototype.hasOwnProperty.call(DEPOSIT_BLOCKS, v);

const UNAVAILABLE: BookingReason[] = [{ code: "unavailable" }];

/**
 * The reasons of an answer, rebuilt field by field: a reason with an unknown code is dropped, an optional field of the
 * wrong kind is left out. Null when `value` is not an array.
 */
export function readReasons(value: unknown): BookingReason[] | null {
  if (!Array.isArray(value)) return null;
  const out: BookingReason[] = [];
  for (const row of value) {
    if (!isRec(row) || !isReasonCode(row.code)) continue;
    const reason: BookingReason = { code: row.code };
    if (typeof row.min === "number" && Number.isInteger(row.min)) reason.min = row.min;
    if (typeof row.max === "number" && Number.isInteger(row.max)) reason.max = row.max;
    if (Array.isArray(row.nights) && row.nights.every((n) => isIsoDate(n))) reason.nights = [...(row.nights as string[])];
    if (isText(row.id)) reason.id = row.id;
    if (isDepositBlock(row.cause)) reason.cause = row.cause;
    if (isText(row.field)) reason.field = row.field;
    out.push(reason);
  }
  return out;
}

/** The answer's reasons, or `unavailable` when there are none it can word. */
function reasonsOf(json: unknown): BookingReason[] {
  const reasons = isRec(json) ? readReasons(json.reasons) : null;
  return reasons !== null && reasons.length > 0 ? reasons : UNAVAILABLE;
}

const isImage = (v: unknown) => v === null || (isRec(v) && isText(v.src) && isText(v.alt));

function isStayCard(v: unknown): v is StayCard {
  return (
    isRec(v) &&
    isText(v.slug) &&
    isText(v.title) &&
    isText(v.destinationName) &&
    isImage(v.image) &&
    (v.maxGuests === null || isCount(v.maxGuests)) &&
    isCount(v.minNights) &&
    typeof v.infantsCount === "boolean"
  );
}

function isOffer(v: unknown): v is AddOnOffering {
  return (
    isRec(v) &&
    isText(v.id) &&
    isText(v.slug) &&
    (v.kind === "experience" || v.kind === "service") &&
    isUnit(v.unit) &&
    typeof v.isUae === "boolean" &&
    typeof v.isHomePickup === "boolean" &&
    isText(v.name) &&
    isImage(v.image) &&
    isFils(v.priceFils)
  );
}

/** Every field the page shows or formats from a price, with the kind formatAed and formatBp need. */
export function isPriceSnapshot(v: unknown): v is PublicPriceSnapshot {
  if (!isRec(v)) return false;
  const nightsOk =
    Array.isArray(v.nights) &&
    v.nights.every((n) => isRec(n) && isIsoDate(n.night) && isFils(n.rateFils) && (n.source === "range" || n.source === "base"));
  const linesOk =
    Array.isArray(v.lines) &&
    v.lines.every(
      (l) => isRec(l) && isText(l.id) && isUnit(l.unit) && isFils(l.unitPriceFils) && isCount(l.quantity) && isFils(l.lineFils),
    );
  const deposit = v.deposit;
  const depositOk =
    deposit === null || (isRec(deposit) && isFils(deposit.dueNowFils) && isFils(deposit.balanceFils) && isIsoDate(deposit.balanceDueDate));
  return (
    nightsOk &&
    linesOk &&
    depositOk &&
    isCount(v.nightCount) &&
    isFils(v.nightsFils) &&
    isFils(v.addonsFils) &&
    isFils(v.subtotalFils) &&
    isBp(v.vatBp) &&
    isFils(v.vatFils) &&
    isFils(v.grandFils) &&
    isBp(v.depositBp) &&
    (v.depositBlock === null || isDepositBlock(v.depositBlock)) &&
    isRec(v.full) &&
    isFils(v.full.dueNowFils) &&
    (v.plan === "deposit" || v.plan === "full") &&
    isFils(v.dueNowFils) &&
    isFils(v.balanceFils) &&
    (v.balanceDueDate === null || isIsoDate(v.balanceDueDate))
  );
}

function readQuoteResponse(json: unknown): QuoteResponse | null {
  if (!isRec(json) || typeof json.ok !== "boolean") return null;
  const reasons = readReasons(json.reasons);
  if (reasons === null) return null;
  if (!(json.stay === null || isStayCard(json.stay))) return null;
  if (!Array.isArray(json.offers) || !json.offers.every(isOffer)) return null;
  if (!Array.isArray(json.inclusions) || !json.inclusions.every((i) => isRec(i) && isText(i.id) && isText(i.label))) return null;
  if (!(json.breakdown === null || isPriceSnapshot(json.breakdown))) return null;
  // An ok answer has a price; a refused one carries at least one reason the page can word.
  if (json.ok && json.breakdown === null) return null;
  if (!json.ok && reasons.length === 0) return null;
  return {
    ok: json.ok,
    reasons,
    stay: json.stay as StayCard | null,
    offers: json.offers as AddOnOffering[],
    inclusions: json.inclusions as { id: string; label: string }[],
    breakdown: json.breakdown as PublicPriceSnapshot | null,
  };
}

/** A refused quote with no stay and no price: what the page shows when the answer is not a quote. */
export function refusedQuote(reasons: BookingReason[]): QuoteResponse {
  return { ok: false, reasons, stay: null, offers: [], inclusions: [], breakdown: null };
}

/**
 * POST /api/booking/quote. A 200 of the right shape is the answer as sent; anything else is a refused quote with the
 * body's reasons (or `unavailable`). The caller's abort resolves `{ aborted: true }`, which the screen ignores.
 */
export async function postQuote(body: QuoteRequest, signal?: AbortSignal): Promise<QuoteResponse | { aborted: true }> {
  const res = await postJson(QUOTE_PATH, body, { signal });
  if (res.aborted) return { aborted: true };
  if (res.status === 200) {
    const quote = readQuoteResponse(res.json);
    if (quote) return quote;
    return refusedQuote(UNAVAILABLE);
  }
  return refusedQuote(reasonsOf(res.json));
}

export type HoldOk = Extract<HoldResponse, { ok: true }>;

export function isHoldOk(json: unknown): json is HoldOk {
  return (
    isRec(json) &&
    json.ok === true &&
    isBookingRef(json.ref) &&
    isInstant(json.holdExpiresAt) &&
    isLinkToken(json.linkToken) &&
    typeof json.transferWindowMinutes === "number" &&
    Number.isInteger(json.transferWindowMinutes) &&
    json.transferWindowMinutes >= 1 &&
    isPriceSnapshot(json.breakdown)
  );
}

/**
 * POST /api/booking/hold. Resolves the HTTP status (kept for the screen: 409 sold_out or blocked reads "taken", 429 the
 * attempts line, 503 requests_closed closes) and the answer: the hold for a 200 of the right shape, else `{ ok: false,
 * reasons }` from the body or `unavailable`.
 */
export async function postHold(body: HoldRequest): Promise<{ status: number; response: HoldResponse }> {
  const res = await postJson(HOLD_PATH, body);
  if (res.status === 200 && isHoldOk(res.json)) {
    const j = res.json;
    return {
      status: 200,
      response: {
        ok: true,
        ref: j.ref,
        holdExpiresAt: j.holdExpiresAt,
        linkToken: j.linkToken,
        breakdown: j.breakdown,
        transferWindowMinutes: j.transferWindowMinutes,
      },
    };
  }
  return { status: res.status, response: { ok: false, reasons: reasonsOf(res.json) } };
}

/**
 * POST /api/booking/release { ref, t }. `{ ok: true }` for 200 and for 404 alike (404: the stored hold is not this
 * guest's any more, so the page clears it); `{ ok: false }` otherwise (the page keeps the hold and shows `unavailable`).
 */
export async function postRelease(hold: { ref: string; t: string }): Promise<{ ok: boolean }> {
  const res = await postJson(RELEASE_PATH, { ref: hold.ref, t: hold.t });
  return { ok: res.status === 200 || res.status === 404 };
}
