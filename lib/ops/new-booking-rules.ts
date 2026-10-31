// Phase 5 plan 05-02 Task 3: the pure rules of the owner's New booking screen (lib/ops/new-booking-rules.ts). No React, no
// fetch and no clock of its own (the caller passes `nowMs` and `today`), so node tests call them directly. Browser-only: the
// screen files import this; nothing under app/api or the server routes does (Worker size). No amount is worked out here.
import type { SiteRequestSummary } from "../../components/ops/api-types";
import { isPlainEmail } from "../email-address";

export type NewBookingStep = 1 | 2 | 3 | 4 | 5;

/** The floor of a hold: it must end more than this many minutes from now (the SQL says `hold_too_soon` at or under it, O-03). */
export const HOLD_FLOOR_MINUTES = 35;

/** The phone pattern of booking_write (SQL): an optional plus, then 7 to 20 of digits, space, brackets and hyphen. */
const PHONE = /^\+?[0-9 ()-]{7,20}$/;
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

function isRealDay(day: string): boolean {
  const m = DAY.exec(day);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(Date.UTC(y, mo - 1, d));
  return y >= 1900 && date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

/** "YYYY-MM-DDTHH:MM:00+04:00" from a day and a UAE time, or null when either part is not real. */
export function holdIso(date: string, time: string): string | null {
  if (!isRealDay(date) || !TIME.test(time)) return null;
  return `${date}T${time}:00+04:00`;
}

/** True when `iso` is more than 35 minutes after `nowMs`. Exactly 35 minutes is false. */
export function holdFloorOk(iso: string, nowMs: number): boolean {
  const at = Date.parse(iso);
  return Number.isFinite(at) && Number.isFinite(nowMs) && at - nowMs > HOLD_FLOOR_MINUTES * 60_000;
}

/** Trimmed and lowercased, as the SQL wants an email. */
export function cleanEmail(text: string): string {
  return text.trim().toLowerCase();
}

/** Which guest fields are wrong: an empty (or over-long) name, an address that is not plain, a phone the SQL would refuse. */
export function guestProblems(g: { name: string; email: string; phone: string }): { name?: true; email?: true; phone?: true } {
  const out: { name?: true; email?: true; phone?: true } = {};
  const name = g.name.trim();
  if (name.length === 0 || [...name].length > 120) out.name = true;
  if (!isPlainEmail(cleanEmail(g.email))) out.email = true;
  if (!PHONE.test(g.phone.trim())) out.phone = true;
  return out;
}

/** The step a refused field belongs to (the server names fields like `guest.email` or `hold_until`). */
export function stepOfField(field: string | null): NewBookingStep {
  if (field === null) return 5;
  const name = field.split(".")[0] ?? field;
  if (name === "guest" || name === "guest_name" || name === "name" || name === "email" || name === "phone") return 1;
  if (["stay", "stay_slug", "from", "to", "arrive", "leave", "adults", "children", "infants"].includes(name)) return 2;
  if (["addons", "airport", "pickup_address"].includes(name)) return 3;
  if (["hold_until", "plan", "agreed_amount", "agreed_reason"].includes(name)) return 4;
  return 5;
}

/** B-13: a real booking needs the real gate open; a TEST one needs only the TEST gate. */
export function createAllowed(input: { isTest: boolean; realOpen: boolean; testOpen: boolean }): boolean {
  return input.isTest ? input.testOpen : input.realOpen;
}

export type Prefill = {
  name: string;
  email: string;
  phone: string;
  locale: "en" | "ar" | "es";
  from: string | null;
  to: string | null;
  adults: number | null;
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * P5-11: what a Plan, Package or Consultation request fills in. A List request gives nothing (null). The dates are taken only
 * when both are real days, `to` is after `from` and `from` is today or later; guests become the adults when they are a whole
 * number of 1 to 99, and any other number makes the request unusable (null). The phone is copied as the guest typed it.
 */
export function prefillFrom(row: Pick<SiteRequestSummary, "kind" | "name" | "email" | "locale" | "payload">, today: string): Prefill | null {
  if (row.kind === "list") return null;
  const payload = row.payload ?? {};
  let adults: number | null = null;
  const guests = payload.guests;
  if (guests !== undefined && guests !== null) {
    if (typeof guests !== "number" || !Number.isInteger(guests) || guests < 1 || guests > 99) return null;
    adults = guests;
  }
  let from: string | null = null;
  let to: string | null = null;
  if (row.kind !== "consultation") {
    const f = text(payload.from);
    const t = text(payload.to);
    if (isRealDay(f) && isRealDay(t) && t > f && f >= today) {
      from = f;
      to = t;
    }
  }
  return { name: row.name.trim(), email: cleanEmail(row.email), phone: text(payload.phone), locale: row.locale, from, to, adults };
}
