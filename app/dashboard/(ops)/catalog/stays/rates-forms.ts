// Plan 03.2-15: the pure rules behind the stay panel's Rates, Availability and Access tabs. No React, no request: the
// tabs call these before anything is sent, and the server (lib/ops/validate-catalog.ts, the stay_rates exclusion
// constraint) stays the authority. Money follows contract §1.2 (AED as a 2-decimal string, never a float); dates are
// "YYYY-MM-DD" calendar days; a range's last night is inclusive, like the API.
//
// Rate rule (C-11): one base nightly rate per stay plus any number of date ranges; the shortest range covering a night
// sets its price; two ranges of the same length can never share a night (the database refuses with 409 rate_overlap).
// A stay with no base rate is not bookable (C-12). This module never computes a total.

import type { Block, IsoDay } from "../../../../../components/ops/api-types";
import { addDays, daysBetween, isIsoDate } from "../../../../../lib/money/dates";

/** The API's money shape: up to 10 whole digits, at most 2 decimals (numeric(12, 2) in the database). */
const MONEY = /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/;

/** At most 730 nights in one range (the database's limit); at most 366 nights in one price check (contract §5.3). */
export const MAX_RANGE_NIGHTS = 730;
export const MAX_CHECK_NIGHTS = 366;
/** Each stay access field holds at most 2,000 characters (contract §5.5). */
export const MAX_ACCESS_CHARS = 2000;

export type MoneyResult = { ok: true; value: string | null } | { ok: false };

/**
 * The owner's typed amount as the API's money string. Arabic-Indic digits and the Arabic decimal mark are read as
 * Latin; a comma is refused (it is a thousands mark in English and a decimal mark in Spanish, so it is never guessed).
 * Empty is `null` only where clearing is allowed (the base rate); a range always needs an amount. Zero is refused.
 */
export function moneyString(raw: string, { allowEmpty = false }: { allowEmpty?: boolean } = {}): MoneyResult {
  const typed = raw
    .trim()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/٫/g, ".");
  if (typed === "") return allowEmpty ? { ok: true, value: null } : { ok: false };
  if (!MONEY.test(typed)) return { ok: false };
  const [whole, cents = ""] = typed.split(".");
  const value = `${whole}.${cents.padEnd(2, "0")}`;
  if (value === "0.00") return { ok: false };
  return { ok: true, value };
}

/** Nights from the first to the last night, both counted: one night on the same day. 0 if the order is wrong. */
export function nightsInRange(first: IsoDay, last: IsoDay): number {
  if (!isIsoDate(first) || !isIsoDate(last)) return 0;
  const days = daysBetween(first, last);
  return days < 0 ? 0 : days + 1;
}

/** The day after the last night: the `to` of a price check (nights are [from, to)). */
export function lastToExclusive(last: IsoDay): IsoDay {
  return addDays(last, 1);
}

export type RangeField = "first_night" | "last_night" | "nightly_rate_aed";
export type RangeRefusal = "required" | "order" | "too_long" | "money";
export type RangePayload = { id?: string; first_night: IsoDay; last_night: IsoDay; nightly_rate_aed: string };

/** The `range` of a `save_range` request, or the first field that is wrong and why. */
export function rangePayload(input: {
  id?: string;
  first: IsoDay | null;
  last: IsoDay | null;
  rate: string;
}): { ok: true; value: RangePayload } | { ok: false; field: RangeField; reason: RangeRefusal } {
  if (!input.first || !isIsoDate(input.first)) return { ok: false, field: "first_night", reason: "required" };
  if (!input.last || !isIsoDate(input.last)) return { ok: false, field: "last_night", reason: "required" };
  const nights = nightsInRange(input.first, input.last);
  if (nights === 0) return { ok: false, field: "last_night", reason: "order" };
  if (nights > MAX_RANGE_NIGHTS) return { ok: false, field: "last_night", reason: "too_long" };
  const money = moneyString(input.rate);
  if (!money.ok || money.value === null) return { ok: false, field: "nightly_rate_aed", reason: "money" };
  const value: RangePayload = { first_night: input.first, last_night: input.last, nightly_rate_aed: money.value };
  return { ok: true, value: input.id ? { id: input.id, ...value } : value };
}

/** The query of a price check for the nights first..last (inclusive), or why it cannot be asked. */
export function checkSpan(
  first: IsoDay | null,
  last: IsoDay | null,
): { ok: true; from: IsoDay; to: IsoDay } | { ok: false; reason: "required" | "order" | "too_long" } {
  if (!first || !last || !isIsoDate(first) || !isIsoDate(last)) return { ok: false, reason: "required" };
  const nights = nightsInRange(first, last);
  if (nights === 0) return { ok: false, reason: "order" };
  if (nights > MAX_CHECK_NIGHTS) return { ok: false, reason: "too_long" };
  return { ok: true, from: first, to: lastToExclusive(last) };
}

/** The first and last day of a month (1-12), both inclusive, as the blocks request wants them. */
export function monthWindow(year: number, month: number): { from: IsoDay; to: IsoDay } {
  const from = `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`;
  const next = month === 12 ? `${String(year + 1).padStart(4, "0")}-01-01` : `${String(year).padStart(4, "0")}-${String(month + 1).padStart(2, "0")}-01`;
  return { from, to: addDays(next, -1) };
}

/** Every day of the month a block covers (block ends are inclusive), with the blocks that cover it, in block order. */
export function blockedDays(blocks: readonly Block[], year: number, month: number): Map<IsoDay, Block[]> {
  const { from, to } = monthWindow(year, month);
  const out = new Map<IsoDay, Block[]>();
  for (const block of blocks) {
    if (!isIsoDate(block.starts_on) || !isIsoDate(block.ends_on)) continue;
    // ISO days sort as text, so the overlap with the month is a pair of string comparisons.
    const last = block.ends_on < to ? block.ends_on : to;
    for (let day = block.starts_on > from ? block.starts_on : from; day <= last; day = addDays(day, 1)) {
      const list = out.get(day);
      if (list) list.push(block);
      else out.set(day, [block]);
    }
  }
  return out;
}

/** "Block dates for this stay": the Calendar's block form for this stay, under /dashboard or on the ops host. */
export function calendarBlockHref(pathname: string, stayId: string): string {
  const base = pathname === "/dashboard" || pathname.startsWith("/dashboard/") ? "/dashboard/calendar" : "/calendar";
  return `${base}?block=stay&stay_id=${encodeURIComponent(stayId)}`;
}

export type AccessInput = {
  address: string;
  wifi_name: string;
  wifi_password: string;
  door_code: string;
  notes: string;
};
export type AccessPayload = { [K in keyof AccessInput]: string | null };

/**
 * The `access` of a stay-access `save`: a field that is only blanks is null, anything else is sent as typed (the server
 * trims address, Wi-Fi name and notes and keeps the password and door code exactly). A field over 2,000 characters
 * (counted like Postgres char_length) is refused before any request.
 */
export function accessPayload(
  input: AccessInput,
): { ok: true; value: AccessPayload } | { ok: false; field: keyof AccessInput } {
  const value = {} as AccessPayload;
  for (const key of ["address", "wifi_name", "wifi_password", "door_code", "notes"] as const) {
    const typed = input[key];
    if ([...typed].length > MAX_ACCESS_CHARS) return { ok: false, field: key };
    value[key] = typed.trim() === "" ? null : typed;
  }
  return { ok: true, value };
}
