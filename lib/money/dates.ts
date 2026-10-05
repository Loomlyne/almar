// Calendar-day helpers for the money engine: ISO `YYYY-MM-DD` strings, UTC arithmetic, the Dubai "today".
// Pure: no imports outside lib/money, no environment, no network.

const DAY_MS = 86_400_000;
const ISO_DAY = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

function utcMs(day: string): number {
  return Date.parse(`${day}T00:00:00Z`);
}

function assertIsoDate(day: unknown, label: string): asserts day is string {
  if (!isIsoDate(day)) throw new RangeError(`${label} must be a real YYYY-MM-DD day, got ${String(day)}`);
}

/** True only for a real calendar day written `YYYY-MM-DD` ("2026-02-30" and "2026-2-28" are false). */
export function isIsoDate(day: unknown): day is string {
  if (typeof day !== "string" || !ISO_DAY.test(day)) return false;
  const ms = utcMs(day);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === day;
}

/** `day` moved by `days` whole days (negative goes back). */
export function addDays(day: string, days: number): string {
  assertIsoDate(day, "day");
  if (!Number.isSafeInteger(days)) throw new RangeError(`days must be an integer, got ${String(days)}`);
  const next = new Date(utcMs(day) + days * DAY_MS).toISOString().slice(0, 10);
  assertIsoDate(next, "result");
  return next;
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  assertIsoDate(from, "from");
  assertIsoDate(to, "to");
  // Both are UTC midnights, so the difference is an exact multiple of a day.
  return (utcMs(to) - utcMs(from)) / DAY_MS;
}

/** The nights of a stay: every day in [from, to). Throws when `to` is not after `from`. */
export function eachNight(from: string, to: string): string[] {
  const count = daysBetween(from, to);
  if (count <= 0) throw new RangeError(`to (${to}) must be after from (${from})`);
  const nights: string[] = [];
  for (let i = 0; i < count; i += 1) nights.push(addDays(from, i));
  return nights;
}

const DUBAI_DAY = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Dubai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The calendar day in Dubai (UTC+4, no daylight saving) at `now`. The caller passes the clock. */
export function dubaiToday(now: Date): string {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new RangeError(`now must be a valid Date, got ${String(now)}`);
  }
  const parts = DUBAI_DAY.formatToParts(now);
  const part = (type: "year" | "month" | "day") => parts.find((p) => p.type === type)?.value ?? "";
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  assertIsoDate(day, "Dubai day");
  return day;
}
