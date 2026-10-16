// The Block dates form as plain data (plan 03.2-13, contract 5.4): form values to the `add` payload, the entry link of
// 03.2-15 (`?block=stay&stay_id=`), which days a block covers, and every Dubai-day rule of the Calendar (OPS-09).
// Pure: no React, no fetch, no clock (a caller passes `now`). Days are `YYYY-MM-DD` text; both ends of a block are
// inclusive; the Dubai day comes from the Asia/Dubai zone (UTC+4, no daylight saving).

export type BlockScope = "all" | "destination" | "stay";
export type IsoDay = string;

export type BlockFormValues = {
  scope: BlockScope;
  destinationId: string | null;
  stayId: string | null;
  first: IsoDay | null;
  last: IsoDay | null;
  reason: string;
};

/** What `POST /api/ops/blocks { action: "add", block }` takes (contract 5.4). */
export type BlockPayload = {
  scope: BlockScope;
  destination_id?: string;
  stay_id?: string;
  starts_on: IsoDay;
  ends_on: IsoDay;
  reason: string | null;
};

/** The field the form refuses on: the screen says it in words. */
export type BlockRefusal = "destination" | "stay" | "dates" | "reason";

export const REASON_MAX = 300;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a real calendar day written `YYYY-MM-DD` (2026-02-30 is not one). */
export function isIsoDay(value: unknown): value is IsoDay {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/**
 * The form to the `add` payload, or the field it refuses on. `all` carries no id; `destination` needs its id and sends no
 * stay; `stay` needs its id and sends no destination. The last day may be the first day (one day) but never earlier.
 * An empty reason is null; a reason over 300 characters is refused.
 */
export function blockPayload(values: BlockFormValues): { ok: true; payload: BlockPayload } | { ok: false; field: BlockRefusal } {
  if (values.scope === "destination" && !values.destinationId) return { ok: false, field: "destination" };
  if (values.scope === "stay" && !values.stayId) return { ok: false, field: "stay" };
  if (!isIsoDay(values.first) || !isIsoDay(values.last) || values.last < values.first) return { ok: false, field: "dates" };
  const reason = values.reason.trim();
  if (reason.length > REASON_MAX) return { ok: false, field: "reason" };

  const payload: BlockPayload = {
    scope: values.scope,
    starts_on: values.first,
    ends_on: values.last,
    reason: reason === "" ? null : reason,
  };
  if (values.scope === "destination") payload.destination_id = values.destinationId as string;
  if (values.scope === "stay") payload.stay_id = values.stayId as string;
  return { ok: true, payload };
}

/**
 * The entry link of 03.2-15: `?block=stay&stay_id=<uuid>` or `?block=destination&destination_id=<uuid>`. Only `block`
 * and the one matching id are read; anything else, a non-uuid id included, gives null and nothing from the URL is used.
 */
export function prefillFromQuery(search: string): { scope: "stay"; stayId: string } | { scope: "destination"; destinationId: string } | null {
  const params = new URLSearchParams(search);
  const kind = params.get("block");
  if (kind === "stay") {
    const id = params.get("stay_id");
    return id !== null && UUID.test(id) ? { scope: "stay", stayId: id.toLowerCase() } : null;
  }
  if (kind === "destination") {
    const id = params.get("destination_id");
    return id !== null && UUID.test(id) ? { scope: "destination", destinationId: id.toLowerCase() } : null;
  }
  return null;
}

/** True when `starts_on <= day <= ends_on`: the last day is a blocked day too. */
export function blockCoversDay(block: { starts_on: IsoDay; ends_on: IsoDay }, day: IsoDay): boolean {
  return block.starts_on <= day && day <= block.ends_on;
}

const DUBAI_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" });

/** The day it is in the UAE at `now`, whatever time zone the device is in. 19:59:59 UTC is still today; 20:00:00 UTC is tomorrow. */
export function dubaiDay(now: Date): IsoDay {
  return DUBAI_DAY.format(now);
}

const pad = (value: number) => String(value).padStart(2, "0");

/** The first and last day of a month (both inclusive), for `GET /api/ops/blocks?from=&to=`. `month` is 1 to 12. */
export function monthWindow(year: number, month: number): { from: IsoDay; to: IsoDay } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(last)}` };
}

/** The month `delta` months from (year, month), across a year end. */
export function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const at = year * 12 + (month - 1) + delta;
  return { year: Math.floor(at / 12), month: (at % 12) + 1 };
}
