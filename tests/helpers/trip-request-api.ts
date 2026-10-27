// Plan 04-06, Task 3 (step 5): the booking routes of the trip page, answered by page.route for tests/trip-request.spec.ts
// (and the one view mock 04-03's tests/booking-trip.spec.ts gains). Never the real API. Every amount is a symbolic test
// value in fils and every name a bracketed placeholder; the bank block of `viewAwaiting` carries documentation values
// only (the IBAN is the public documentation example DOC_IBAN): the spec asserts none of them reaches the trip page.
//
//  - mockTripApi(page, answers): /api/booking/quote, /hold, /release, /request and /view. It counts the POSTs per path
//    and records each body and its `origin` header (F-02: the page never writes one; the browser's must equal the page
//    origin). An answer may wait (`delayMs`, real time on the Node side; `waitFor`, a promise the test settles, e.g.
//    after `page.clock.runFor`), abort (a lost answer: the page sees a network error) or return any status and body.
//  - viewHeld, viewAwaiting, viewExpired, viewDepositPaid: BookingView fixtures (`withdrawable` true only on
//    viewAwaiting, as 04-08 sets it; 04-06 never reads it).
//  - seedTripState(page, ...): a stored trip with a hold, built with 04-03's serializeTripState and written by
//    page.addInitScript into sessionStorage[TRIP_STATE_KEY] before the page's scripts run.
//  - reachRequestStep(page, locale): 04-03's steps to the Request step (quote and hold mocked): Book's query, Continue,
//    Continue to travellers, the traveller fields, Full payment, DXB, the terms box, Continue to request.
import { expect, type Page, type Route } from "@playwright/test";
import type { BookingStatus, BookingView } from "../../lib/booking/types";
import { initialTripState, serializeTripState, TRIP_STATE_KEY, type TripHold, type TripState } from "../../lib/booking/trip-state";
import type { TripQuery } from "../../lib/booking/trip-link";
import { JOURNEY_COPY } from "../../lib/copy/journey";

export type Locale = "en" | "ar" | "es";

// ---------------------------------------------------------------- shared values (04-03's spec uses the same)

export const REF = "ALMAR-7K3P9Q";
export const TOKEN = "tok_test_0123456789abcdef";
export const PICKUP = "00000000-0000-4000-8000-000000000001";
export const UAE_SERVICE = "00000000-0000-4000-8000-000000000002";
export const TOUR = "00000000-0000-4000-8000-000000000003";
export const STAY_SLUG = "getsemani-colonial-house";
export const NIGHT_FILS = 100_000;
export const LINE_FILS = 10_000;

/** The public documentation IBAN (never a real account): the spec asserts it never shows on the trip page. */
export const DOC_IBAN = "GB82 WEST 1234 5698 7654 32";
export const DOC_BIC = "TESTAEAAXXX";

export const HOLD_MS = 30 * 60 * 1000;
export const TRANSFER_WINDOW_MINUTES = 35;

export function isoDays(fromToday: number, now: number = Date.now()): string {
  const d = new Date(now);
  d.setUTCDate(d.getUTCDate() + fromToday);
  return d.toISOString().slice(0, 10);
}

export const FROM = isoDays(200);
export const TO = isoDays(203);

export function tripQuery(o: { adults?: number; children?: number; infants?: number } = {}): TripQuery {
  return { stay: STAY_SLUG, from: FROM, to: TO, adults: o.adults ?? 2, children: o.children ?? 0, infants: o.infants ?? 0 };
}

export function tripSearch(q: TripQuery = tripQuery()): string {
  return `stay=${q.stay}&from=${q.from}&to=${q.to}&adults=${q.adults}&children=${q.children}&infants=${q.infants}`;
}

export async function openTrip(page: Page, locale: Locale, q: TripQuery = tripQuery()) {
  await page.goto(`/${locale}/booking/trip?${tripSearch(q)}`);
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

// ---------------------------------------------------------------- quote and hold answers (copied from 04-03's spec)

type Addon = { id: string; qty: number };

function offers() {
  return [
    { id: PICKUP, slug: "home-pickup", kind: "service", unit: "trip", isUae: true, isHomePickup: true, name: "Home pickup", image: null, priceFils: LINE_FILS },
    { id: UAE_SERVICE, slug: "vip-meet", kind: "service", unit: "trip", isUae: true, isHomePickup: false, name: "VIP meet", image: null, priceFils: LINE_FILS },
    { id: TOUR, slug: "heritage-tour", kind: "experience", unit: "person", isUae: false, isHomePickup: false, name: "Heritage tour", image: null, priceFils: LINE_FILS },
  ];
}

export function breakdown(addons: Addon[], o: { deposit?: boolean; depositBlock?: string | null; plan?: "deposit" | "full" } = {}) {
  const lines = addons.map((a) => ({ id: a.id, unit: a.id === TOUR ? "person" : "trip", unitPriceFils: LINE_FILS, quantity: a.qty, lineFils: LINE_FILS * a.qty }));
  const nightsFils = NIGHT_FILS * 3;
  const addonsFils = lines.reduce((s, l) => s + l.lineFils, 0);
  const subtotalFils = nightsFils + addonsFils;
  const vatFils = subtotalFils / 20;
  const grandFils = subtotalFils + vatFils;
  const deposit = o.deposit === false ? null : { dueNowFils: grandFils / 2, balanceFils: grandFils / 2, balanceDueDate: isoDays(170) };
  const plan = o.plan ?? "full";
  return {
    nights: [0, 1, 2].map((n) => ({ night: isoDays(200 + n), rateFils: NIGHT_FILS, source: "base" })),
    nightCount: 3,
    nightsFils,
    lines,
    addonsFils,
    subtotalFils,
    vatBp: 500,
    vatFils,
    grandFils,
    depositBp: 5000,
    deposit,
    depositBlock: deposit ? null : (o.depositBlock ?? "too_close_to_arrival"),
    full: { dueNowFils: grandFils },
    plan,
    dueNowFils: plan === "deposit" && deposit ? deposit.dueNowFils : grandFils,
    balanceFils: plan === "deposit" && deposit ? deposit.balanceFils : 0,
    balanceDueDate: plan === "deposit" && deposit ? deposit.balanceDueDate : null,
  };
}

export function quoteAnswer(addons: Addon[], o: { reasons?: unknown[]; ok?: boolean; deposit?: boolean; depositBlock?: string } = {}) {
  const ok = o.ok ?? true;
  return {
    ok,
    reasons: o.reasons ?? [],
    stay: { slug: STAY_SLUG, title: "[Stay name]", destinationName: "[Destination]", image: null, maxGuests: 6, minNights: 2, infantsCount: false },
    offers: offers(),
    inclusions: [{ id: "i1", label: "[Inclusion]" }],
    breakdown: ok || o.reasons?.some((r) => (r as { code: string }).code === "requests_closed") ? breakdown(addons, o) : null,
  };
}

/** A 200 hold answer for `body`, its end and serverNow on the server clock `server`. */
export function holdAnswer(body: Record<string, unknown>, server: number = Date.now()) {
  return {
    ok: true,
    ref: REF,
    holdExpiresAt: new Date(server + HOLD_MS).toISOString(),
    linkToken: TOKEN,
    breakdown: breakdown((body.addons as Addon[] | undefined) ?? [], { plan: body.plan as "deposit" | "full" }),
    transferWindowMinutes: TRANSFER_WINDOW_MINUTES,
    serverNow: new Date(server).toISOString(),
  };
}

/** A 200 request answer: firstTime true on the first request only, as 04-08's idempotent request answers. */
export function requestAnswer(o: { deadline?: string | null; firstTime?: boolean; emailSent?: boolean; now?: number } = {}) {
  return {
    ok: true,
    ref: REF,
    status: "awaiting_payment" as BookingStatus,
    deadline: o.deadline === undefined ? new Date((o.now ?? Date.now()) + TRANSFER_WINDOW_MINUTES * 60_000).toISOString() : o.deadline,
    firstTime: o.firstTime ?? true,
    emailSent: o.emailSent ?? true,
  };
}

export const refusal = (...codes: string[]) => ({ ok: false, reasons: codes.map((code) => ({ code })) });

// ---------------------------------------------------------------- view fixtures (BookingView)

// Symbolic fils for the three nights and the home pickup that reachRequestStep adds (the trip's own breakdown).
const MONEY = {
  nightsFils: 300_000,
  addonsFils: 10_000,
  subtotalFils: 310_000,
  vatBp: 500,
  vatFils: 15_500,
  grandFils: 325_500,
  depositFils: 162_750,
  balanceFils: 162_750,
} as const;

type ViewOptions = { plan?: "deposit" | "full"; now?: number; ref?: string; locale?: Locale };

function baseView(status: BookingStatus, o: ViewOptions = {}): BookingView {
  const plan = o.plan ?? "full";
  return {
    ref: o.ref ?? REF,
    status,
    locale: o.locale ?? "en",
    guest: { name: "[Guest name]", email: "guest@example.com" },
    stay: { slug: STAY_SLUG, title: "[Stay name]", destinationName: "[Destination]", image: null },
    arrive: FROM,
    leave: TO,
    nights: 3,
    adults: 2,
    children: 0,
    infants: 0,
    travellers: [
      { kind: "adult", fullName: "[Guest name]", age: null, isBooker: true, notStaying: false },
      { kind: "adult", fullName: "[Second guest]", age: null, isBooker: false, notStaying: false },
    ],
    lines: [{ name: "Home pickup", unit: "trip", quantity: 1, unitPriceFils: LINE_FILS, lineFils: LINE_FILS }],
    airport: "DXB",
    pickupAddress: "[Pickup address]",
    plan,
    money: {
      ...MONEY,
      depositFils: plan === "deposit" ? MONEY.depositFils : 0,
      balanceFils: plan === "deposit" ? MONEY.balanceFils : 0,
      paidFils: 0,
      dueNowFils: plan === "deposit" ? MONEY.depositFils : MONEY.grandFils,
      stillDueFils: MONEY.grandFils,
    },
    holdExpiresAt: null,
    deadline: null,
    balanceDueDate: plan === "deposit" ? isoDays(170) : null,
    flags: { partReceived: false, overpaid: false, writtenOff: false },
    withdrawable: false,
    payments: [],
    transfer: null,
    access: null,
  };
}

/** A live hold: `holdExpiresAt` the server's end (default 30 minutes after `now`). */
export function viewHeld(o: ViewOptions & { holdExpiresAt?: string } = {}): BookingView {
  const view = baseView("held", o);
  view.holdExpiresAt = o.holdExpiresAt ?? new Date((o.now ?? Date.now()) + HOLD_MS).toISOString();
  return view;
}

/** The request sent and not paid: the deadline (default the 35-minute TEST window after `now`) and the bank block. */
export function viewAwaiting(o: ViewOptions & { deadline?: string } = {}): BookingView {
  const view = baseView("awaiting_payment", o);
  const deadline = o.deadline ?? new Date((o.now ?? Date.now()) + TRANSFER_WINDOW_MINUTES * 60_000).toISOString();
  view.deadline = deadline;
  view.withdrawable = true;
  view.transfer = {
    accountName: "[Account name]",
    bankName: "[Bank name]",
    iban: DOC_IBAN,
    swift: DOC_BIC,
    bankAddress: "[Bank address]",
    note: "[Note line]",
    currency: "AED",
    amountFils: view.money.dueNowFils,
    reference: view.ref,
    payBy: deadline,
    dueBy: null,
  };
  return view;
}

/** An unpaid request past its deadline (the display status). */
export function viewExpired(o: ViewOptions = {}): BookingView {
  return baseView("expired", o);
}

/** The deposit received: a later status, so the trip page points to the booking page. */
export function viewDepositPaid(o: ViewOptions = {}): BookingView {
  const view = baseView("deposit_paid", { ...o, plan: "deposit" });
  view.money.paidFils = MONEY.depositFils;
  view.money.dueNowFils = MONEY.balanceFils;
  view.money.stillDueFils = MONEY.balanceFils;
  view.payments = [{ receivedOn: isoDays(0), method: "bank_transfer", amountFils: MONEY.depositFils }];
  return view;
}

export const viewOk = (booking: BookingView) => ({ ok: true, booking });

// ---------------------------------------------------------------- mockTripApi

export type ApiName = "quote" | "hold" | "release" | "request" | "view";
export const API_NAMES: readonly ApiName[] = ["quote", "hold", "release", "request", "view"];

export type MockAnswer = {
  status?: number;
  json?: unknown;
  /** Wait this long (Node's real clock, not page.clock) before answering. */
  delayMs?: number;
  /** Wait for this promise before answering (the test settles it, e.g. after page.clock.runFor). */
  waitFor?: Promise<unknown>;
  /** Abort the request instead of answering: the page's fetch fails (a lost answer, status 0). */
  abort?: boolean;
};

/** One answer for every call, one per call (the last repeats), or a function of the body and the call's number (1-based). */
export type AnswerSource = MockAnswer | MockAnswer[] | ((body: Record<string, unknown>, n: number) => MockAnswer);

export type TripApiAnswers = Partial<Record<ApiName, AnswerSource>> & {
  /** The server's clock for the default hold answer (its holdExpiresAt and serverNow); the test runner's by default. */
  serverClock?: () => number;
};

export type TripApiCalls = {
  /** POSTs per path, counted when the request reaches the route (before any delay or abort). */
  posts: Record<ApiName, number>;
  bodies: Record<ApiName, Record<string, unknown>[]>;
  /** The `origin` header of each POST, null when the browser sent none. */
  origins: Record<ApiName, (string | null)[]>;
  /** Every URL the page requested (the token must never be in one). */
  urls: string[];
  /** Calls answered so far per path (aborted ones included). */
  settled: Record<ApiName, number>;
};

function perName<T>(make: () => T): Record<ApiName, T> {
  return { quote: make(), hold: make(), release: make(), request: make(), view: make() };
}

function pick(source: AnswerSource, body: Record<string, unknown>, n: number): MockAnswer {
  if (typeof source === "function") return source(body, n);
  if (Array.isArray(source)) return source[Math.min(n, source.length) - 1] ?? {};
  return source;
}

function defaultAnswer(name: ApiName, body: Record<string, unknown>, n: number, server: number): MockAnswer {
  switch (name) {
    case "quote":
      return { status: 200, json: quoteAnswer((body.addons as Addon[] | undefined) ?? []) };
    case "hold":
      return { status: 200, json: holdAnswer(body, server) };
    case "release":
      return { status: 200, json: { ok: true } };
    case "request":
      return { status: 200, json: requestAnswer({ firstTime: n === 1, now: server }) };
    case "view":
      return { status: 200, json: viewOk(viewAwaiting({ now: server })) };
  }
}

function readBody(route: Route): Record<string, unknown> {
  try {
    const json: unknown = route.request().postDataJSON();
    return json !== null && typeof json === "object" && !Array.isArray(json) ? (json as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

/** Answer the five booking routes; nothing reaches the real API. */
export async function mockTripApi(page: Page, answers: TripApiAnswers = {}): Promise<TripApiCalls> {
  const calls: TripApiCalls = {
    posts: perName(() => 0),
    bodies: perName(() => []),
    origins: perName(() => []),
    urls: [],
    settled: perName(() => 0),
  };
  page.on("request", (r) => calls.urls.push(r.url()));
  for (const name of API_NAMES) {
    await page.route(`**/api/booking/${name}`, async (route: Route) => {
      const request = route.request();
      if (request.method() !== "POST") {
        await route.fulfill({ status: 405, contentType: "application/json", body: JSON.stringify({ ok: false }) });
        return;
      }
      calls.posts[name] += 1;
      const n = calls.posts[name];
      const body = readBody(route);
      calls.bodies[name].push(body);
      calls.origins[name].push(await request.headerValue("origin"));
      const source = answers[name];
      const server = (answers.serverClock ?? Date.now)();
      const answer = source === undefined ? defaultAnswer(name, body, n, server) : pick(source, body, n);
      if (answer.waitFor) await answer.waitFor;
      if (answer.delayMs) await new Promise((resolve) => setTimeout(resolve, answer.delayMs));
      try {
        if (answer.abort) {
          await route.abort("failed");
        } else {
          const fallback = defaultAnswer(name, body, n, server);
          await route.fulfill({
            status: answer.status ?? fallback.status ?? 200,
            contentType: "application/json",
            body: JSON.stringify(answer.json === undefined ? fallback.json : answer.json),
          });
        }
      } catch {
        // The page went away while the answer waited: nothing to answer.
      } finally {
        calls.settled[name] += 1;
      }
    });
  }
  return calls;
}

/** A promise and its resolve, for `waitFor`. */
export function gate(): { promise: Promise<void>; open: () => void } {
  let open = () => {};
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

// ---------------------------------------------------------------- stored state

/** A stored hold for REF and TOKEN; `holdExpiresAt` defaults to 30 minutes after `now`. */
export function storedHold(o: Partial<TripHold> & { now?: number } = {}): TripHold {
  return {
    ref: o.ref ?? REF,
    linkToken: o.linkToken ?? TOKEN,
    holdExpiresAt: o.holdExpiresAt ?? new Date((o.now ?? Date.now()) + HOLD_MS).toISOString(),
    transferWindowMinutes: o.transferWindowMinutes ?? TRANSFER_WINDOW_MINUTES,
    clockOffsetMs: o.clockOffsetMs ?? 0,
  };
}

/** The trip reachRequestStep leaves: the traveller fields, Full payment, DXB, the home pickup, step 4 and `hold`. */
export function storedTrip(hold: TripHold | null, q: TripQuery = tripQuery()): TripState {
  const state = initialTripState(q);
  return {
    ...state,
    step: 4,
    addons: { [PICKUP]: 1 },
    addonsTouched: false,
    contact: { ...state.contact, name: "[Guest name]", email: "guest@example.com", phone: "+971 50 000 0000" },
    travellers: state.travellers.map((t, i) => (i === 1 ? { ...t, fullName: "[Second guest]" } : t)),
    pickup: "[Pickup address]",
    plan: "full",
    airport: "DXB",
    hold,
  };
}

/**
 * Write `state` into sessionStorage[TRIP_STATE_KEY] before the page's scripts run. By default only on the first load of
 * this tab (a reload then reads what the page itself stored); `everyLoad` writes it on every navigation.
 */
export async function seedTripState(page: Page, state: TripState, o: { everyLoad?: boolean } = {}) {
  await page.addInitScript(
    ({ key, text, everyLoad }) => {
      const marker = `${key}-seeded-by-test`;
      if (!everyLoad && window.sessionStorage.getItem(marker) === "1") return;
      window.sessionStorage.setItem(key, text);
      window.sessionStorage.setItem(marker, "1");
    },
    { key: TRIP_STATE_KEY, text: serializeTripState(state), everyLoad: o.everyLoad === true },
  );
}

// ---------------------------------------------------------------- reachRequestStep (04-03's steps)

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** 04-03's path to the Request step with the hold placed (quote and hold must be mocked: mockTripApi first). */
export async function reachRequestStep(page: Page, locale: Locale, q: TripQuery = tripQuery()) {
  const copy = JOURNEY_COPY[locale];
  await openTrip(page, locale, q);
  await expect(page.getByRole("button", { name: copy.summary.continue })).toBeEnabled();
  await page.getByRole("button", { name: copy.summary.continue }).click();
  await page.getByRole("button", { name: copy.addons.continue }).click();
  await expect(page.getByRole("heading", { name: copy.trip.stepTitle.travellers })).toBeVisible();
  await page.locator("#trip-contact-name").fill("[Guest name]");
  await page.locator("#trip-contact-email").fill("guest@example.com");
  await page.locator("#trip-contact-phone").fill("+971 50 000 0000");
  await page.locator("#trip-traveller-1-name").fill("[Second guest]");
  await page.locator("#trip-pickup").fill("[Pickup address]");
  await page.getByRole("button", { name: new RegExp(escape(copy.request.full)) }).click();
  await page.getByRole("button", { name: copy.request.airports.DXB }).click();
  await page.getByLabel(copy.request.terms).check();
  await page.getByRole("button", { name: copy.travellers.continue }).click();
  await expect(page.getByRole("timer")).toBeVisible();
  await expect(page.getByRole("button", { name: copy.request.send })).toBeEnabled();
}
