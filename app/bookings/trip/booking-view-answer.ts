// Plan 04-05, Task 5: how the booking page reads one answer of 04-08's POST /api/booking/view. Pure: no fetch, no
// React, no storage. The screen (booking-trip-screen.tsx) posts; this file decides. An answer is shown only when every
// value the page formats is well formed (formatAed, formatIsoDate, uaeDateTime and formatBp throw on anything else),
// so a bad answer is the "unavailable" line, never a broken page. 404 and 400 are "not found" (unknown ref, wrong
// token, TEST/real mismatch and no session all answer the same 404); anything else is "unavailable".
import { isBookingRef } from "../../../lib/booking/ref";
import { formatBp, formatIsoDate, uaeDateTime } from "../../../lib/booking/trip-format";
import type { BookingLocale, BookingStatus, BookingView, ViewRequest } from "../../../lib/booking/types";

export type ViewAnswer = { kind: "ready"; view: BookingView } | { kind: "not_found" } | { kind: "unavailable" };

type Rec = Record<string, unknown>;

const STATUSES: ReadonlySet<BookingStatus> = new Set([
  "held",
  "awaiting_payment",
  "deposit_paid",
  "paid_in_full",
  "confirmed",
  "completed",
  "cancelled",
  "expired",
]);
const LOCALES: ReadonlySet<string> = new Set(["en", "ar", "es"]);
const AIRPORTS: ReadonlySet<string> = new Set(["DXB", "AUH", "SHJ"]);
const UNITS: ReadonlySet<string> = new Set(["person", "night", "trip"]);
const KINDS: ReadonlySet<string> = new Set(["adult", "child", "infant"]);
const METHODS: ReadonlySet<string> = new Set(["bank_transfer", "card"]);

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === "string";
const isTextOrNull = (v: unknown) => v === null || isText(v);
const isCount = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const isFils = isCount;
const isBool = (v: unknown): v is boolean => typeof v === "boolean";

function formats(fn: () => unknown): boolean {
  try {
    fn();
    return true;
  } catch {
    return false;
  }
}

const isDay = (v: unknown): v is string => isText(v) && formats(() => formatIsoDate(v));
const isDayOrNull = (v: unknown) => v === null || isDay(v);
const isInstantOrNull = (v: unknown) => v === null || (isText(v) && formats(() => uaeDateTime(v)));

const MONEY_KEYS = [
  "nightsFils",
  "addonsFils",
  "subtotalFils",
  "vatFils",
  "grandFils",
  "depositFils",
  "balanceFils",
  "paidFils",
  "dueNowFils",
  "stillDueFils",
] as const;

function isMoney(v: unknown): boolean {
  if (!isRec(v)) return false;
  if (!MONEY_KEYS.every((k) => isFils(v[k]))) return false;
  return isCount(v.vatBp) && formats(() => formatBp(v.vatBp as number));
}

function isTraveller(v: unknown): boolean {
  return (
    isRec(v) &&
    isText(v.kind) &&
    KINDS.has(v.kind) &&
    isText(v.fullName) &&
    (v.age === null || isCount(v.age)) &&
    isBool(v.isBooker) &&
    isBool(v.notStaying)
  );
}

function isLine(v: unknown): boolean {
  return (
    isRec(v) &&
    isText(v.name) &&
    isText(v.unit) &&
    UNITS.has(v.unit) &&
    isCount(v.quantity) &&
    isFils(v.unitPriceFils) &&
    isFils(v.lineFils)
  );
}

function isPayment(v: unknown): boolean {
  return isRec(v) && isDayOrNull(v.receivedOn) && isText(v.method) && METHODS.has(v.method) && isFils(v.amountFils);
}

function isTransfer(v: unknown): boolean {
  if (v === null) return true;
  return (
    isRec(v) &&
    ["accountName", "bankName", "iban", "swift", "bankAddress", "note", "reference"].every((k) => isText(v[k])) &&
    v.currency === "AED" &&
    isFils(v.amountFils) &&
    isInstantOrNull(v.payBy) &&
    isDayOrNull(v.dueBy)
  );
}

function isAccess(v: unknown): boolean {
  if (v === null) return true;
  return isRec(v) && ["address", "wifiName", "wifiPassword", "doorCode", "notes"].every((k) => isTextOrNull(v[k]));
}

function isStay(v: unknown): boolean {
  if (!isRec(v) || !isText(v.slug) || !isText(v.title) || !isText(v.destinationName)) return false;
  const image = v.image;
  return image === null || (isRec(image) && isText(image.src) && isText(image.alt));
}

/** True when `v` is a BookingView every part of the page can draw. */
export function isBookingView(v: unknown): v is BookingView {
  if (!isRec(v)) return false;
  return (
    isText(v.ref) &&
    isText(v.status) &&
    STATUSES.has(v.status as BookingStatus) &&
    isText(v.locale) &&
    LOCALES.has(v.locale) &&
    isRec(v.guest) &&
    isText(v.guest.name) &&
    isText(v.guest.email) &&
    isStay(v.stay) &&
    isDay(v.arrive) &&
    isDay(v.leave) &&
    isCount(v.nights) &&
    isCount(v.adults) &&
    isCount(v.children) &&
    isCount(v.infants) &&
    Array.isArray(v.travellers) &&
    v.travellers.every(isTraveller) &&
    Array.isArray(v.lines) &&
    v.lines.every(isLine) &&
    (v.airport === null || (isText(v.airport) && AIRPORTS.has(v.airport))) &&
    isTextOrNull(v.pickupAddress) &&
    (v.plan === "deposit" || v.plan === "full") &&
    isMoney(v.money) &&
    isInstantOrNull(v.holdExpiresAt) &&
    isInstantOrNull(v.deadline) &&
    isDayOrNull(v.balanceDueDate) &&
    isRec(v.flags) &&
    isBool(v.flags.partReceived) &&
    isBool(v.flags.overpaid) &&
    isBool(v.flags.writtenOff) &&
    isBool(v.withdrawable) &&
    Array.isArray(v.payments) &&
    v.payments.every(isPayment) &&
    isTransfer(v.transfer) &&
    isAccess(v.access)
  );
}

/** The page's reading of one view answer: its status, its parsed JSON (null when unreadable) and the asked ref. */
export function viewAnswer(status: number, body: unknown, ref: string): ViewAnswer {
  if (status === 404 || status === 400) return { kind: "not_found" };
  if (status !== 200 || !isRec(body) || body.ok !== true) return { kind: "unavailable" };
  const view = body.booking;
  if (!isBookingView(view) || view.ref !== ref || !isBookingRef(view.ref)) return { kind: "unavailable" };
  return { kind: "ready", view };
}

/** The view call's body: exactly { ref, t, locale }, `t` left out when the URL has none. */
export function viewRequestBody(ref: string, t: string | undefined, locale: BookingLocale): ViewRequest {
  return typeof t === "string" && t !== "" ? { ref, t, locale } : { ref, locale };
}
