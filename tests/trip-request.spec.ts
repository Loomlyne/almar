import { expect, test, type Page } from "@playwright/test";
import { bookingPagePath } from "../lib/booking/origin";
import { uaeDateTime } from "../lib/booking/trip-format";
import { TRIP_STATE_KEY } from "../lib/booking/trip-state";
import { JOURNEY_COPY } from "../lib/copy/journey";
import { fill } from "../lib/journey-format";
import { formatAed } from "../lib/money/format";
import {
  DOC_IBAN,
  HOLD_MS,
  REF,
  STAY_SLUG,
  TOKEN,
  TRANSFER_WINDOW_MINUTES,
  gate,
  mockTripApi,
  openTrip,
  reachRequestStep,
  refusal,
  requestAnswer,
  seedTripState,
  storedHold,
  storedTrip,
  viewAwaiting,
  viewDepositPaid,
  viewExpired,
  viewHeld,
  viewOk,
  type Locale,
} from "./helpers/trip-request-api";
import { VIEWPORTS } from "./journey/matrix";

// Plan 04-06 (signed 2026-10-27): /booking/trip after Send request, and the resume after a refresh.
//  - copy: every key of the afterRequest group is a non-empty string with the same keys in en, ar and es.
//  - pictures: not here. The owner signed one HTML page (pictures/04-06/index.html) instead of a shoot ("No test.
//    Direct, no test."; 2026-10-27), so this file has no pictures block; the harness scene
//    tests/journey/scenes/trip-request.tsx draws the same states should a shoot ever be asked for.
//  - behaviour: the real page on next dev, every /api/booking/* call answered by page.route (tests/helpers/
//    trip-request-api.ts), never the real API. Fresh sends go through reachRequestStep; resumes seed the stored trip.
//    Written and not run (owner, 2026-10-27).

const LOCALES: Locale[] = ["en", "ar", "es"];
const STAY_PATH = (locale: Locale) => `/${locale}/private-stays/${STAY_SLUG}`;
// viewAwaiting's own money for the plan reachRequestStep chooses (Full payment): the booking's due-now, not the quote's.
const FULL_DUE_FILS = 325_500;

// ---- copy ---------------------------------------------------------------------------------------------------------

test("copy: afterRequest is a non-empty string per key, the same keys in en, ar and es", () => {
  const keys = Object.keys(JOURNEY_COPY.en.afterRequest).sort();
  expect(keys.length).toBeGreaterThan(0);
  for (const locale of LOCALES) {
    const group = JOURNEY_COPY[locale].afterRequest as Record<string, unknown>;
    expect(Object.keys(group).sort(), `${locale} keys`).toEqual(keys);
    for (const [key, value] of Object.entries(group)) {
      expect(typeof value, `${locale}.afterRequest.${key}`).toBe("string");
      expect((value as string).trim(), `${locale}.afterRequest.${key} empty`).not.toBe("");
      expect(value as string, `${locale}.afterRequest.${key}`).not.toMatch(/\[object|undefined|NaN/);
    }
  }
});

// ---- helpers ------------------------------------------------------------------------------------------------------

async function storedTripHold(page: Page): Promise<{ ref: string; linkToken: string; holdExpiresAt: string } | null | undefined> {
  const text = await page.evaluate((key) => window.sessionStorage.getItem(key), TRIP_STATE_KEY);
  return text ? (JSON.parse(text).hold as { ref: string; linkToken: string; holdExpiresAt: string } | null) : undefined;
}

function payByText(locale: Locale, iso: string): string {
  return fill(JOURNEY_COPY[locale].bookingStatus.payBy, uaeDateTime(iso));
}

async function noHorizontalScroll(page: Page) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(wide, "no horizontal scroll").toBe(false);
}

/** The sent state's safety lines: nothing to pay on the site, no bank detail, one href with the token, none in the URL. */
async function expectSafeSentState(page: Page) {
  await expect(page.getByRole("button", { name: /^Pay/ })).toHaveCount(0);
  await expect(page.locator("iframe")).toHaveCount(0);
  await expect(page.locator('[autocomplete="cc-number"]')).toHaveCount(0);
  expect(await page.locator("body").innerText()).not.toContain(DOC_IBAN);
  await expect(page.locator('[href*="&t="]')).toHaveCount(1);
  expect(new URL(page.url()).searchParams.has("t")).toBe(false);
}

const sendButton = (page: Page, locale: Locale) => page.getByRole("button", { name: JOURNEY_COPY[locale].request.send });

// ---- send ---------------------------------------------------------------------------------------------------------

test.describe("send request", () => {
  test.setTimeout(180_000);

  test("Send posts exactly { ref, t } once with the page's Origin, busy while it runs, then the sent state from the view", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const deadline = new Date(Date.now() + TRANSFER_WINDOW_MINUTES * 60_000).toISOString();
    const answer = gate();
    const calls = await mockTripApi(page, {
      request: { waitFor: answer.promise, status: 200, json: requestAnswer({ deadline, emailSent: true }) },
      view: { status: 200, json: viewOk(viewAwaiting({ deadline })) },
    });
    await reachRequestStep(page, "en");
    const before = await storedTripHold(page);
    expect(before?.ref).toBe(REF);

    await sendButton(page, "en").dblclick();
    const busy = page.getByRole("button", { name: JOURNEY_COPY.en.request.sending });
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await expect.poll(() => calls.posts.request).toBe(1);
    expect(calls.bodies.request[0]).toEqual({ ref: before?.ref, t: before?.linkToken });
    expect(calls.origins.request[0]).toBe(new URL(page.url()).origin);
    expect(calls.posts.view).toBe(0);

    answer.open();
    const a = JOURNEY_COPY.en.afterRequest;
    const heading = page.getByRole("heading", { name: a.heading });
    await expect(heading).toBeVisible();
    await expect(heading).toBeFocused();
    expect(calls.posts.request).toBe(1);
    expect(calls.posts.view).toBe(1);
    expect(calls.bodies.view[0]).toEqual({ ref: REF, t: TOKEN, locale: "en" });
    await expect(page.getByText(REF).first()).toBeVisible();
    await expect(page.getByText(`${a.planFull} · ${a.dueNow} ${formatAed(FULL_DUE_FILS)}`)).toBeVisible();
    await expect(page.getByText(payByText("en", deadline))).toBeVisible();
    await expect(page.getByText(a.emailSent)).toBeVisible();
    await expect(page.getByText(a.lapse)).toBeVisible();
    await expect(page.getByRole("link", { name: a.open })).toHaveAttribute("href", bookingPagePath("en", REF, TOKEN));
    await expect(page.getByRole("link", { name: JOURNEY_COPY.en.reasons.actions.whatsapp }).last()).toHaveAttribute("target", "_blank");
    // The steps gave way: no Send request, no Change.
    await expect(sendButton(page, "en")).toHaveCount(0);
    await expect(page.getByRole("button", { name: JOURNEY_COPY.en.request.change, exact: true })).toHaveCount(0);
    await expectSafeSentState(page);
    expect(calls.urls.some((u) => u.includes(TOKEN))).toBe(false);
    expect(calls.posts.hold).toBe(1);
  });

  test("AR: the sent state is right to left, the reference and the amount left to right", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await mockTripApi(page);
    await reachRequestStep(page, "ar");
    await sendButton(page, "ar").click();
    const a = JOURNEY_COPY.ar.afterRequest;
    await expect(page.getByRole("heading", { name: a.heading })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator('bdi[dir="ltr"]', { hasText: REF }).first()).toBeVisible();
    await expect(page.locator('bdi[dir="ltr"]', { hasText: formatAed(FULL_DUE_FILS) }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: a.open })).toHaveAttribute("href", bookingPagePath("ar", REF, TOKEN));
    await expectSafeSentState(page);
  });

  test("the view fails after a 200: the amount is on the booking page, the request's own deadline shows", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const deadline = new Date(Date.now() + TRANSFER_WINDOW_MINUTES * 60_000).toISOString();
    const calls = await mockTripApi(page, {
      request: { status: 200, json: requestAnswer({ deadline, emailSent: false }) },
      view: { status: 503, json: refusal("unavailable") },
    });
    await reachRequestStep(page, "en");
    await sendButton(page, "en").click();
    const a = JOURNEY_COPY.en.afterRequest;
    await expect(page.getByRole("heading", { name: a.heading })).toBeVisible();
    await expect(page.getByText(a.amountOnPage)).toBeVisible();
    await expect(page.getByText(payByText("en", deadline))).toBeVisible();
    await expect(page.getByText(a.emailPage)).toBeVisible();
    expect(calls.posts.view).toBe(1);
    await expectSafeSentState(page);
  });

  test("a lost answer is the retry state; Send again is answered firstTime false and lands on the same sent state", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const calls = await mockTripApi(page, {
      request: [{ abort: true }, { status: 200, json: requestAnswer({ firstTime: false }) }],
    });
    await reachRequestStep(page, "en");
    await sendButton(page, "en").click();
    await expect(page.locator('[data-reason="unavailable"]')).toBeVisible();
    await expect(page.getByText(JOURNEY_COPY.en.afterRequest.retryNote)).toBeVisible();
    await expect(sendButton(page, "en")).toBeEnabled();
    expect((await storedTripHold(page))?.ref).toBe(REF);

    await sendButton(page, "en").click();
    await expect(page.getByRole("heading", { name: JOURNEY_COPY.en.afterRequest.heading })).toBeVisible();
    expect(calls.posts.request).toBe(2);
    expect(calls.bodies.request[1]).toEqual({ ref: REF, t: TOKEN });
    expect(calls.posts.hold).toBe(1);
  });

  test("503 unavailable: the reason, the retry note, Send enabled", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await mockTripApi(page, { request: { status: 503, json: refusal("unavailable") } });
    await reachRequestStep(page, "en");
    await sendButton(page, "en").click();
    await expect(page.getByText(JOURNEY_COPY.en.reasons.unavailable)).toBeVisible();
    await expect(page.getByText(JOURNEY_COPY.en.afterRequest.retryNote)).toBeVisible();
    await expect(sendButton(page, "en")).toBeEnabled();
  });
});

// ---- refusals -----------------------------------------------------------------------------------------------------

test.describe("refusals after Send request", () => {
  test.setTimeout(180_000);

  for (const [name, answer] of [
    ["404", { status: 404, json: { ok: false } }],
    ["409 hold_ended", { status: 409, json: refusal("hold_ended") }],
  ] as const) {
    test(`${name}: the ended view, Start again to the stay, the stored hold cleared, nothing more posted`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      const calls = await mockTripApi(page, { request: answer });
      await reachRequestStep(page, "en");
      await sendButton(page, "en").click();
      await expect(page.getByText(JOURNEY_COPY.en.request.ended).first()).toBeVisible();
      await expect(page.getByRole("link", { name: JOURNEY_COPY.en.request.startAgain }).first()).toHaveAttribute("href", STAY_PATH("en"));
      await expect(sendButton(page, "en")).toHaveCount(0);
      await expect.poll(() => storedTripHold(page)).toBeNull();
      expect(calls.posts.request).toBe(1);
      expect(calls.posts.view).toBe(0);
      expect(calls.posts.release).toBe(0);
    });
  }

  for (const code of ["sold_out", "blocked"] as const) {
    test(`409 ${code}: one release with { ref, t }, the taken line and the way back to the stay`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      const calls = await mockTripApi(page, { request: { status: 409, json: refusal(code) } });
      await reachRequestStep(page, "en");
      await sendButton(page, "en").click();
      await expect(page.getByText(JOURNEY_COPY.en.reasons.taken)).toBeVisible();
      await expect(page.getByRole("link", { name: JOURNEY_COPY.en.reasons.actions.startAgain }).first()).toHaveAttribute("href", STAY_PATH("en"));
      await expect.poll(() => calls.posts.release).toBe(1);
      expect(calls.bodies.release[0]).toEqual({ ref: REF, t: TOKEN });
      await expect.poll(() => storedTripHold(page)).toBeNull();
      await expect(page.getByRole("button", { name: JOURNEY_COPY.en.request.hold })).toBeDisabled();
      expect(calls.posts.request).toBe(1);
      expect(calls.posts.hold).toBe(1);
    });
  }

  test("429 too_many_open: the reason under Send request, the hold kept, Send enabled", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const calls = await mockTripApi(page, { request: { status: 429, json: refusal("too_many_open") } });
    await reachRequestStep(page, "en");
    await sendButton(page, "en").click();
    await expect(page.getByText(JOURNEY_COPY.en.reasons.too_many_open)).toBeVisible();
    await expect(sendButton(page, "en")).toBeEnabled();
    expect((await storedTripHold(page))?.ref).toBe(REF);
    await expect(page.getByText(JOURNEY_COPY.en.afterRequest.retryNote)).toHaveCount(0);
    expect(calls.posts.request).toBe(1);
  });

  test("503 requests_closed: the closed line, Send disabled, the hold kept, nothing more posted", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const calls = await mockTripApi(page, { request: { status: 503, json: refusal("requests_closed") } });
    await reachRequestStep(page, "en");
    await sendButton(page, "en").click();
    await expect(page.getByText(JOURNEY_COPY.en.reasons.requests_closed)).toBeVisible();
    await expect(sendButton(page, "en")).toBeDisabled();
    expect((await storedTripHold(page))?.ref).toBe(REF);
    expect(calls.posts.request).toBe(1);
    expect(calls.posts.view).toBe(0);
  });
});

// ---- race: the hold ends while the request is out -----------------------------------------------------------------
// The browser clock is paused 10 s before the hold's end, the request answer waits on a gate, and page.clock runs 12 s:
// the hold timer reaches 00:00 while the POST is pending (postJson's 20 s timeout has not fired).

async function sendAcrossTheEnd(page: Page, answer: { status?: number; json?: unknown; abort?: boolean }) {
  await page.clock.install();
  const g = gate();
  const calls = await mockTripApi(page, { request: { ...answer, waitFor: g.promise } });
  await reachRequestStep(page, "en");
  const before = await storedTripHold(page);
  expect(before?.ref).toBe(REF);
  await page.clock.pauseAt(Date.parse(before?.holdExpiresAt ?? "") - 10_000);
  await sendButton(page, "en").click();
  await expect.poll(() => calls.posts.request).toBe(1);
  await page.clock.runFor(12_000);
  // While the POST is pending: no ended view, the stored hold kept.
  await expect(page.getByText(JOURNEY_COPY.en.request.ended)).toHaveCount(0);
  expect((await storedTripHold(page))?.ref).toBe(REF);
  g.open();
  return { calls, before };
}

test.describe("race: the hold ends while sending", () => {
  test.setTimeout(180_000);

  test("answer 200: the sent state, never the ended view", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const { calls, before } = await sendAcrossTheEnd(page, { status: 200, json: requestAnswer() });
    await expect(page.getByRole("heading", { name: JOURNEY_COPY.en.afterRequest.heading })).toBeVisible();
    await expect(page.getByText(JOURNEY_COPY.en.request.ended)).toHaveCount(0);
    expect(calls.posts.request).toBe(1);
    expect(calls.bodies.request[0]).toEqual({ ref: before?.ref, t: before?.linkToken });
  });

  test("answer 409 hold_ended: the ended view", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const { calls, before } = await sendAcrossTheEnd(page, { status: 409, json: refusal("hold_ended") });
    await expect(page.getByText(JOURNEY_COPY.en.request.ended).first()).toBeVisible();
    await expect(sendButton(page, "en")).toHaveCount(0);
    expect(calls.posts.request).toBe(1);
    expect(calls.bodies.request[0]).toEqual({ ref: before?.ref, t: before?.linkToken });
  });

  test("a lost answer: the held-back end is applied right after it, Send gone", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const { calls, before } = await sendAcrossTheEnd(page, { abort: true });
    await expect(page.getByText(JOURNEY_COPY.en.request.ended).first()).toBeVisible();
    await expect(sendButton(page, "en")).toHaveCount(0);
    await expect.poll(() => storedTripHold(page)).toBeNull();
    expect(calls.posts.request).toBe(1);
    expect(calls.bodies.request[0]).toEqual({ ref: before?.ref, t: before?.linkToken });
  });
});

// ---- resume after a refresh ---------------------------------------------------------------------------------------

test.describe("resume with a stored hold", () => {
  test.setTimeout(180_000);

  test("checking first: nothing quoted, held or requested before the view answers; held continues with the server's end", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await seedTripState(page, storedTrip(storedHold()));
    const g = gate();
    // The server says 10 minutes are left, the stored hold says 30: the server's end is the one shown.
    const calls = await mockTripApi(page, {
      view: () => ({ waitFor: g.promise, status: 200, json: viewOk(viewHeld({ holdExpiresAt: new Date(Date.now() + 10 * 60_000).toISOString() })) }),
    });
    await openTrip(page, "en");
    await expect(page.getByText(JOURNEY_COPY.en.afterRequest.checking)).toBeVisible();
    await expect.poll(() => calls.posts.view).toBe(1);
    expect(calls.posts.quote).toBe(0);
    expect(calls.posts.hold).toBe(0);
    expect(calls.posts.request).toBe(0);
    expect(calls.bodies.view[0]).toEqual({ ref: REF, t: TOKEN, locale: "en" });
    g.open();
    await expect(page.getByRole("timer")).toContainText(/(10:00|09:[45]\d)/);
    await expect(sendButton(page, "en")).toBeEnabled();
    await expect.poll(() => calls.posts.quote).toBeGreaterThan(0);
    expect(calls.bodies.quote[0].hold).toEqual({ ref: REF, t: TOKEN });
    expect(calls.posts.hold).toBe(0);
    expect(calls.posts.request).toBe(0);
  });

  test("awaiting payment with the stored end already past: the sent state (the local clock never decides)", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const now = Date.now();
    const deadline = new Date(now + TRANSFER_WINDOW_MINUTES * 60_000).toISOString();
    await seedTripState(page, storedTrip(storedHold({ holdExpiresAt: new Date(now - HOLD_MS).toISOString() })));
    const calls = await mockTripApi(page, { view: { status: 200, json: viewOk(viewAwaiting({ deadline })) } });
    await openTrip(page, "en");
    const a = JOURNEY_COPY.en.afterRequest;
    await expect(page.getByRole("heading", { name: a.heading })).toBeVisible();
    await expect(page.getByText(`${a.planFull} · ${a.dueNow} ${formatAed(FULL_DUE_FILS)}`)).toBeVisible();
    await expect(page.getByText(payByText("en", deadline))).toBeVisible();
    await expect(page.getByText(a.emailPage)).toBeVisible();
    await expect(page.getByRole("link", { name: a.open })).toHaveAttribute("href", bookingPagePath("en", REF, TOKEN));
    await expectSafeSentState(page);
    expect(calls.posts.view).toBe(1);
    expect(calls.posts.hold).toBe(0);
    expect(calls.posts.request).toBe(0);
  });

  test("AR resume on an awaiting booking: right to left, Full payment, the reference left to right", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await seedTripState(page, storedTrip(storedHold()));
    const calls = await mockTripApi(page, { view: { status: 200, json: viewOk(viewAwaiting({ locale: "ar" })) } });
    await openTrip(page, "ar");
    const a = JOURNEY_COPY.ar.afterRequest;
    await expect(page.getByRole("heading", { name: a.heading })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByText(a.planFull, { exact: false }).first()).toBeVisible();
    await expect(page.locator('bdi[dir="ltr"]', { hasText: REF }).first()).toBeVisible();
    expect(calls.bodies.view[0]).toEqual({ ref: REF, t: TOKEN, locale: "ar" });
    expect(calls.posts.hold).toBe(0);
    expect(calls.posts.request).toBe(0);
  });

  for (const [name, answer] of [
    ["expired", { status: 200, json: viewOk(viewExpired()) }],
    ["404", { status: 404, json: { ok: false } }],
  ] as const) {
    test(`view ${name}: the ended view, the stored hold cleared`, async ({ page }) => {
      await page.setViewportSize(VIEWPORTS.desktop);
      await seedTripState(page, storedTrip(storedHold()));
      const calls = await mockTripApi(page, { view: answer });
      await openTrip(page, "en");
      await expect(page.getByText(JOURNEY_COPY.en.request.ended).first()).toBeVisible();
      await expect(page.getByRole("link", { name: JOURNEY_COPY.en.request.startAgain }).first()).toHaveAttribute("href", STAY_PATH("en"));
      await expect.poll(() => storedTripHold(page)).toBeNull();
      expect(calls.posts.hold).toBe(0);
      expect(calls.posts.request).toBe(0);
    });
  }

  test("a later status: the booking has moved on, a link to its booking page", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await seedTripState(page, storedTrip(storedHold()));
    const calls = await mockTripApi(page, { view: { status: 200, json: viewOk(viewDepositPaid()) } });
    await openTrip(page, "en");
    const a = JOURNEY_COPY.en.afterRequest;
    await expect(page.getByRole("heading", { name: a.elsewhereTitle })).toBeVisible();
    await expect(page.getByText(a.elsewhere)).toBeVisible();
    await expect(page.getByRole("link", { name: a.open })).toHaveAttribute("href", bookingPagePath("en", REF, TOKEN));
    await expect(sendButton(page, "en")).toHaveCount(0);
    expect(calls.posts.hold).toBe(0);
    expect(calls.posts.request).toBe(0);
  });

  test("the view fails: Check again asks the view again", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await seedTripState(page, storedTrip(storedHold()));
    const calls = await mockTripApi(page, { view: [{ status: 503, json: refusal("unavailable") }, { status: 200, json: viewOk(viewHeld()) }] });
    await openTrip(page, "en");
    const again = page.getByRole("button", { name: JOURNEY_COPY.en.afterRequest.checkAgain });
    await expect(again).toBeVisible();
    await expect(page.locator('[data-reason="unavailable"]')).toBeVisible();
    expect(calls.posts.quote).toBe(0);
    await again.click();
    await expect(page.getByRole("timer")).toBeVisible();
    expect(calls.posts.view).toBe(2);
    expect(calls.posts.hold).toBe(0);
    expect(calls.posts.request).toBe(0);
  });

  test("the sent state has no horizontal scroll at 390, 834 and 1440", async ({ page }) => {
    await seedTripState(page, storedTrip(storedHold()), { everyLoad: true });
    await mockTripApi(page);
    for (const viewport of ["phone", "tablet", "desktop"] as const) {
      await page.setViewportSize(VIEWPORTS[viewport]);
      await openTrip(page, "en");
      await expect(page.getByRole("heading", { name: JOURNEY_COPY.en.afterRequest.heading })).toBeVisible();
      await noHorizontalScroll(page);
    }
  });
});
