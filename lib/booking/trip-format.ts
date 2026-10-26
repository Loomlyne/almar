// Plan 04-03, Task 1a: pure display helpers for the trip screens. No React, no clock, no locale.
// Nothing here touches money: formatBp is a rate (basis points), the rest are dates and durations.
import { formatDate } from "../format";

const HOLD_MS = 30 * 60 * 1000;

/** Basis points as a percentage: 500 -> "5", 525 -> "5.25", 550 -> "5.5". Integer maths only. */
export function formatBp(bp: number): string {
  if (!Number.isInteger(bp) || bp < 0) throw new Error("formatBp: basis points must be a non-negative integer");
  const whole = Math.floor(bp / 100);
  const rest = bp % 100;
  if (rest === 0) return String(whole);
  const frac = String(rest).padStart(2, "0").replace(/0$/, "");
  return `${whole}.${frac}`;
}

/** "2026-11-02" -> "02/11/2026". */
export function formatIsoDate(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error("formatIsoDate: not an ISO date");
  return formatDate(Number(m[3]), Number(m[2]), Number(m[1]));
}

/** Milliseconds left on a hold: never more than the 30 minutes, never below 0, 0 for an unparseable end. */
export function holdMsLeft(endsAtIso: string, nowMs: number): number {
  const end = Date.parse(endsAtIso);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.min(end - nowMs, HOLD_MS));
}

/**
 * The server's clock minus the device's, from a hold answer: `serverNowIso` is the answer's serverNow, `receivedAtMs`
 * the device clock (Date.now()) when the answer arrived. The server's time later is the device clock plus this offset,
 * that is serverNow plus the time the device has counted since the answer, so a device set minutes off shows the
 * server's countdown. 0 for an unparseable instant.
 */
export function clockOffsetMs(serverNowIso: string, receivedAtMs: number): number {
  const server = Date.parse(serverNowIso);
  if (Number.isNaN(server) || !Number.isFinite(receivedAtMs)) return 0;
  return Math.round(server - receivedAtMs);
}

/** mm:ss with seconds rounded up, so 00:00 shows only at the end. */
export function countdownParts(msLeft: number): { minutes: number; seconds: number; text: string } {
  const total = Math.max(0, Math.ceil(msLeft / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return { minutes, seconds, text: `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}` };
}

/** 10, 5 or 1 when that many whole minutes are left, 0 at the end, else null (the live region speaks four times). */
export function liveMinute(msLeft: number): 10 | 5 | 1 | 0 | null {
  const total = Math.ceil(msLeft / 1000);
  if (total <= 0) return 0;
  const minutes = Math.floor(total / 60);
  return minutes === 10 || minutes === 5 || minutes === 1 ? minutes : null;
}

/** The owner's transfer window in the largest whole unit: 1440 -> 1 day, 120 -> 2 hours, 90 -> 90 minutes. */
export function windowParts(minutes: number): { unit: "minute" | "hour" | "day"; count: number } {
  if (!Number.isInteger(minutes) || minutes < 1) throw new Error("windowParts: minutes must be a positive integer");
  if (minutes % 1440 === 0) return { unit: "day", count: minutes / 1440 };
  if (minutes % 60 === 0) return { unit: "hour", count: minutes / 60 };
  return { unit: "minute", count: minutes };
}

const SHAPE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

const DUBAI = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Dubai",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  numberingSystem: "latn",
});

/** An instant with an offset as UAE date "dd/mm/yyyy" and time "HH:MM" (Asia/Dubai, Western digits). */
export function uaeDateTime(iso: string): { date: string; time: string } {
  const m = SHAPE.exec(iso);
  if (!m) throw new Error("uaeDateTime: needs a date, a time and an offset");
  const fraction = m[4] === undefined ? "" : `.${m[4].slice(0, 3)}`;
  const ms = Date.parse(`${m[1]}T${m[2]}${m[3] ?? ""}${fraction}${m[5]}`);
  if (Number.isNaN(ms)) throw new Error("uaeDateTime: not a real instant");
  const parts: Record<string, string> = {};
  for (const p of DUBAI.formatToParts(new Date(ms))) parts[p.type] = p.value;
  return {
    date: formatDate(Number(parts.day), Number(parts.month), Number(parts.year)),
    time: `${parts.hour}:${parts.minute}`,
  };
}
