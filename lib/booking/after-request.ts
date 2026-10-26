// Plan 04-06, Task 3: what the trip page does after Send request and after a refresh with a stored hold. Pure: no
// React, no fetch, no storage, no browser globals. The screen posts (request-client.ts) and hands the status and body here.
//
// Nothing here passes a server string on except the reference (checked with isBookingRef) and a deadline or a hold end
// in the exact shape 04-03's uaeDateTime reads (a date, a time, then Z or +HH:MM / -HH:MM); every reason is rebuilt
// from its code alone. Amounts pass through as the server's fils, never computed. The summary of a sent request copies
// five keys of the view and nothing else: the view's bank block never reaches the trip page (T-04-06-05).
import { isBookingRef } from "./ref";
import type { BookingReason, BookingStatus, BookingView } from "./types";

// ---------------------------------------------------------------- types

/** What the sent state shows: exactly these five keys. `plan` and `dueNowFils` are null when only the request answered. */
export type SentSummary = {
  ref: string;
  plan: "deposit" | "full" | null;
  dueNowFils: number | null;
  deadline: string | null;
  /** True or false from the request's own answer; null after a refresh (the page then says the details are on the booking page). */
  emailSent: boolean | null;
};

/** The request route's answer, read for the screen. */
export type RequestUiOutcome =
  | { kind: "sent"; ref: string; deadline: string | null; firstTime: boolean; emailSent: boolean }
  | { kind: "ended" }
  | { kind: "taken"; reasons: BookingReason[] }
  | { kind: "refused"; reasons: BookingReason[] }
  | { kind: "closed"; reasons: BookingReason[] }
  | { kind: "retry" };

export type RequestSentOutcome = Extract<RequestUiOutcome, { kind: "sent" }>;

/** The view route's answer after a refresh (or right after a sent request), read against the device clock `nowMs`. */
export type ResumeOutcome =
  | { kind: "held"; holdExpiresAt: string }
  | { kind: "sent"; summary: SentSummary }
  | { kind: "ended" }
  | { kind: "elsewhere"; ref: string }
  | { kind: "retry" };

export type RequestPhase =
  | { kind: "idle" }
  | { kind: "checking"; failed: boolean }
  | { kind: "sending" }
  | { kind: "refused"; reasons: BookingReason[] }
  | { kind: "closed"; reasons: BookingReason[] }
  | { kind: "retry" }
  | { kind: "taken"; reasons: BookingReason[] }
  | { kind: "sent"; summary: SentSummary }
  | { kind: "ended" }
  | { kind: "elsewhere"; ref: string };

/**
 * The final result of one send, dispatched once with `answer`: the request's outcome, except that a sent request is
 * carried as its summary (from the view when it answered, else from the request) or as `elsewhere`.
 */
export type RequestAnswer =
  | { kind: "sent"; summary: SentSummary }
  | { kind: "elsewhere"; ref: string }
  | { kind: "ended" }
  | { kind: "taken"; reasons: BookingReason[] }
  | { kind: "refused"; reasons: BookingReason[] }
  | { kind: "closed"; reasons: BookingReason[] }
  | { kind: "retry" };

export type RequestPhaseAction =
  | { type: "send" }
  | { type: "answer"; result: RequestAnswer }
  | { type: "resume" }
  | { type: "resumed"; outcome: ResumeOutcome };

export const INITIAL_REQUEST_PHASE: RequestPhase = { kind: "idle" };

// ---------------------------------------------------------------- shape checks

type Rec = Record<string, unknown>;

const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null && !Array.isArray(v);
const isFils = (v: unknown): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
const isPlan = (v: unknown): v is "deposit" | "full" => v === "deposit" || v === "full";

const STATUSES: Record<BookingStatus, true> = {
  held: true,
  awaiting_payment: true,
  deposit_paid: true,
  paid_in_full: true,
  confirmed: true,
  completed: true,
  cancelled: true,
  expired: true,
};

const isStatus = (v: unknown): v is BookingStatus => typeof v === "string" && Object.prototype.hasOwnProperty.call(STATUSES, v);

// The shape uaeDateTime of trip-format.ts reads, and its parse (fraction cut to milliseconds): kept equal on purpose,
// so a value accepted here never makes uaeDateTime throw.
const INSTANT_SHAPE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(:\d{2})?(?:\.(\d+))?(Z|[+-]\d{2}:\d{2})$/;

/** The instant's time in ms when `value` is in the shape uaeDateTime reads, else null. */
function instantMs(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const m = INSTANT_SHAPE.exec(value);
  if (!m) return null;
  const fraction = m[4] === undefined ? "" : `.${m[4].slice(0, 3)}`;
  const ms = Date.parse(`${m[1]}T${m[2]}${m[3] ?? ""}${fraction}${m[5]}`);
  return Number.isNaN(ms) ? null : ms;
}

/** The deadline as sent when uaeDateTime can read it, else null. */
function readDeadline(value: unknown): string | null {
  return typeof value === "string" && instantMs(value) !== null ? value : null;
}

/**
 * The first reason of a refused body whose code is one of `expected`, rebuilt from the code alone; null for a body that
 * is not `{ ok: false, reasons: [...] }` or carries none of them.
 */
function expectedCode<C extends BookingReason["code"]>(json: unknown, expected: readonly C[]): C | null {
  if (!isRec(json) || json.ok !== false || !Array.isArray(json.reasons)) return null;
  for (const r of json.reasons) {
    if (isRec(r) && typeof r.code === "string" && (expected as readonly string[]).includes(r.code)) return r.code as C;
  }
  return null;
}

// ---------------------------------------------------------------- the request's answer

/**
 * POST /api/booking/request, read: 200 sent (a checked reference), 404 and 409 hold_ended ended, 409 sold_out or
 * blocked taken, 429 too_many_open refused, 503 requests_closed closed; everything else (503 unavailable, 400, 403, 413,
 * any other status, status 0, a body of another shape, a code not expected for its status) is retry. Never throws.
 */
export function requestOutcome(status: number, json: unknown): RequestUiOutcome {
  switch (status) {
    case 200: {
      if (
        !isRec(json) ||
        json.ok !== true ||
        !isBookingRef(json.ref) ||
        !isStatus(json.status) ||
        !(json.deadline === null || typeof json.deadline === "string") ||
        typeof json.firstTime !== "boolean" ||
        typeof json.emailSent !== "boolean"
      ) {
        return { kind: "retry" };
      }
      return { kind: "sent", ref: json.ref, deadline: readDeadline(json.deadline), firstTime: json.firstTime, emailSent: json.emailSent };
    }
    case 404:
      return { kind: "ended" };
    case 409: {
      const code = expectedCode(json, ["hold_ended", "sold_out", "blocked"] as const);
      if (code === "hold_ended") return { kind: "ended" };
      if (code === "sold_out" || code === "blocked") return { kind: "taken", reasons: [{ code }] };
      return { kind: "retry" };
    }
    case 429:
      return expectedCode(json, ["too_many_open"] as const) ? { kind: "refused", reasons: [{ code: "too_many_open" }] } : { kind: "retry" };
    case 503:
      return expectedCode(json, ["requests_closed"] as const) ? { kind: "closed", reasons: [{ code: "requests_closed" }] } : { kind: "retry" };
    default:
      return { kind: "retry" };
  }
}

// ---------------------------------------------------------------- the view's answer

/** The fields of a view the sent summary reads (a whole BookingView fits). */
export type SummaryView = Pick<BookingView, "ref" | "plan" | "deadline"> & { money: Pick<BookingView["money"], "dueNowFils"> };

/** The sent summary from a view: five keys, the bank block never copied; a deadline uaeDateTime cannot read is null. */
export function sentFromView(booking: SummaryView, emailSent: boolean | null): SentSummary {
  return {
    ref: booking.ref,
    plan: booking.plan,
    dueNowFils: booking.money.dueNowFils,
    deadline: readDeadline(booking.deadline),
    emailSent,
  };
}

/** The sent summary from the request's own answer, when the view could not be read: no plan, no amount. */
export function sentFromRequest(answer: RequestSentOutcome): SentSummary {
  return {
    ref: answer.ref,
    plan: null,
    dueNowFils: null,
    deadline: readDeadline(answer.deadline),
    emailSent: answer.emailSent,
  };
}

const LATER: Record<BookingStatus, boolean> = {
  held: false,
  awaiting_payment: false,
  expired: false,
  deposit_paid: true,
  paid_in_full: true,
  confirmed: true,
  completed: true,
  cancelled: true,
};

/**
 * POST /api/booking/view, read against the device clock `nowMs`: held with an end later than nowMs -> held (the
 * server's end); held with it past or missing, expired and 404 -> ended; awaiting_payment -> sent; a later status ->
 * elsewhere; anything else (another status, status 0, a booking without its reference, status, plan or amount due) ->
 * retry. The stored hold's own end never decides: only the server's answer does. Never throws.
 */
export function resumeOutcome(status: number, json: unknown, nowMs: number): ResumeOutcome {
  if (status === 404) return { kind: "ended" };
  if (status !== 200 || !isRec(json) || json.ok !== true) return { kind: "retry" };
  const b = json.booking;
  if (!isRec(b) || !isBookingRef(b.ref) || !isStatus(b.status) || !isPlan(b.plan)) return { kind: "retry" };
  if (!isRec(b.money) || !isFils(b.money.dueNowFils)) return { kind: "retry" };
  if (!(b.deadline === null || b.deadline === undefined || typeof b.deadline === "string")) return { kind: "retry" };

  if (b.status === "held") {
    const endIso = b.holdExpiresAt;
    if (endIso === null || endIso === undefined) return { kind: "ended" };
    const end = instantMs(endIso);
    if (typeof endIso !== "string" || end === null) return { kind: "retry" };
    return end > nowMs ? { kind: "held", holdExpiresAt: endIso } : { kind: "ended" };
  }
  if (b.status === "awaiting_payment") {
    const deadline = typeof b.deadline === "string" ? b.deadline : null;
    return { kind: "sent", summary: sentFromView({ ref: b.ref, plan: b.plan, money: { dueNowFils: b.money.dueNowFils }, deadline }, null) };
  }
  if (b.status === "expired") return { kind: "ended" };
  return LATER[b.status] ? { kind: "elsewhere", ref: b.ref } : { kind: "retry" };
}

// ---------------------------------------------------------------- the phase

const isFinal = (phase: RequestPhase) =>
  phase.kind === "closed" || phase.kind === "taken" || phase.kind === "sent" || phase.kind === "ended" || phase.kind === "elsewhere";

function phaseOfAnswer(result: RequestAnswer): RequestPhase {
  switch (result.kind) {
    case "sent":
      return { kind: "sent", summary: result.summary };
    case "elsewhere":
      return { kind: "elsewhere", ref: result.ref };
    case "ended":
      return { kind: "ended" };
    case "taken":
      return { kind: "taken", reasons: result.reasons };
    case "refused":
      return { kind: "refused", reasons: result.reasons };
    case "closed":
      return { kind: "closed", reasons: result.reasons };
    case "retry":
      return { kind: "retry" };
  }
}

function phaseOfResume(outcome: ResumeOutcome): RequestPhase {
  switch (outcome.kind) {
    case "held":
      return { kind: "idle" };
    case "retry":
      return { kind: "checking", failed: true };
    case "sent":
      return { kind: "sent", summary: outcome.summary };
    case "ended":
      return { kind: "ended" };
    case "elsewhere":
      return { kind: "elsewhere", ref: outcome.ref };
  }
}

/**
 * The request phase of the trip page. `send` from idle, refused or retry starts sending; `answer` applies only while
 * sending; `resume` from idle or a failed check starts checking; `resumed` applies only while checking. Closed, taken,
 * sent, ended and elsewhere are final. An action that does not apply returns the same state object.
 */
export function requestPhaseReducer(state: RequestPhase, action: RequestPhaseAction): RequestPhase {
  if (isFinal(state)) return state;
  switch (action.type) {
    case "send":
      return state.kind === "idle" || state.kind === "refused" || state.kind === "retry" ? { kind: "sending" } : state;
    case "answer":
      return state.kind === "sending" ? phaseOfAnswer(action.result) : state;
    case "resume":
      return state.kind === "idle" || (state.kind === "checking" && state.failed) ? { kind: "checking", failed: false } : state;
    case "resumed":
      return state.kind === "checking" ? phaseOfResume(action.outcome) : state;
    default:
      return state;
  }
}

/** False while a request is in flight (the hold timer's end waits for the server's answer), true in every other phase. */
export function holdEndNow(phase: RequestPhase): boolean {
  return phase.kind !== "sending";
}
