import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { BOOKING_PAGE_COPY } from "../lib/copy/booking-page";
import { JOURNEY_COPY } from "../lib/copy/journey";
import { uaeDateTime } from "../lib/booking/trip-format";
import { fill } from "../lib/journey-format";
import type { BookingView } from "../lib/booking/types";
import { FAKE_LINK_TOKEN, FIXTURE_IBAN, FIXTURE_REF, viewFixture } from "./helpers/booking-view-fixtures";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// Plan 04-05, the guest booking page /<locale>/bookings/trip (signed 2026-10-26).
//  - copy (Task 2): every BOOKING_PAGE_COPY string is a clean non-empty string with the same keys in en, ar and es.
//  - pictures (Task 2): tests/journey/scenes/booking-page.tsx at 390/834/1440 x en/ar/es (print states at 834 in print
//    media, the two dialog states as viewport shots), env-gated by BOOKING_PAGE_PICTURES, written outside tests/, with
//    the DOM checks of the plan before each shot.
//  - behaviour (Task 5): the real static pages on next dev with POST /api/booking/view answered by page.route from the
//    Task 1 fixtures; the request body and its Origin (F-02 in the browser), the states, the language switch keeping the
//    booking (bite P5), the token never off the origin, the IBAN copy, print and no horizontal scroll.
//  - withdraw flow (Task 6): the Withdraw control live on POST /api/booking/withdraw (page.route), every answer.

type Locale = "en" | "ar" | "es";
const LOCALES: Locale[] = ["en", "ar", "es"];
const GOLD = "rgb(212, 186, 138)";
const WA = "https://wa.me/971563883302";
const INQUIRIES = "inquiries@almarprivatejourney.com";

// ---- copy ---------------------------------------------------------------------------------------------------------

function leaves(node: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (node !== null && typeof node === "object" && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = node;
  }
  return out;
}

test("copy: BOOKING_PAGE_COPY is clean non-empty strings with the same keys in en, ar and es", () => {
  const stem = (key: string) => key.replace(/\.(?:zero|one|two|few|many|other)$/, "");
  const enStems = [...new Set(Object.keys(leaves(BOOKING_PAGE_COPY.en)).map(stem))].sort();
  for (const locale of LOCALES) {
    const all = leaves(BOOKING_PAGE_COPY[locale]);
    expect([...new Set(Object.keys(all).map(stem))].sort(), `${locale}: same keys`).toEqual(enStems);
    for (const [key, value] of Object.entries(all)) {
      expect(typeof value, `${locale}.${key}`).toBe("string");
      expect((value as string).trim(), `${locale}.${key} empty`).not.toBe("");
      expect(value as string, `${locale}.${key}`).not.toMatch(/\[object|undefined|NaN/);
    }
    expect(BOOKING_PAGE_COPY[locale].withdrawKeep).not.toBe("Stay signed in");
  }
});

// ---- shared checks ------------------------------------------------------------------------------------------------

async function assertArabicFont(page: Page) {
  const font = await page.evaluate(async () => {
    await document.fonts.load('16px "Noto Sans Arabic"', "عربي");
    return {
      check: document.fonts.check('16px "Noto Sans Arabic"', "عربي"),
      faces: [...document.fonts].filter((face) => face.family.replace(/["']/g, "") === "Noto Sans Arabic").length,
    };
  });
  expect(font.faces, "a FontFace named Noto Sans Arabic").toBeGreaterThan(0);
  expect(font.check, "Noto Sans Arabic loaded for Arabic text").toBe(true);
}

/** No `src` and no link to another origin carries the link token (or any `t=`). */
async function assertTokenStaysHome(page: Page, token = "t=") {
  const leaks = await page.evaluate((needle) => {
    const out: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("[src]")) {
      const src = el.getAttribute("src") ?? "";
      if (src.includes(needle)) out.push(`src ${src}`);
    }
    for (const a of document.querySelectorAll<HTMLAnchorElement>("a[href]")) {
      const href = a.getAttribute("href") ?? "";
      let off = false;
      try {
        off = new URL(href, location.href).origin !== location.origin;
      } catch {
        off = true;
      }
      if (off && href.includes(needle)) out.push(`href ${href}`);
    }
    return out;
  }, token);
  expect(leaks, "the token never leaves the origin").toEqual([]);
}

async function assertKitLooks(page: Page) {
  const found = await page.evaluate((gold) => {
    const radius: string[] = [];
    for (const b of document.querySelectorAll("button")) {
      const r = getComputedStyle(b).borderRadius;
      if (r !== "0px") radius.push(`${b.textContent?.trim()}: ${r}`);
    }
    const goldFill: string[] = [];
    for (const el of document.querySelectorAll<HTMLElement>("body *")) {
      const s = getComputedStyle(el);
      if (s.backgroundColor === gold || s.color === gold) goldFill.push(el.tagName + "." + el.className);
    }
    return { radius, goldFill: goldFill.slice(0, 5) };
  }, GOLD);
  expect(found.radius, "every button is square").toEqual([]);
  expect(found.goldFill, "gold is a line only, never a fill or text").toEqual([]);
  const body = (await page.locator("body").innerText()) ?? "";
  expect(body).not.toMatch(/\[object|undefined|NaN/);
}

async function noHorizontalScroll(page: Page) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(wide, "no horizontal scroll").toBe(false);
}

// ---- pictures (Task 2) --------------------------------------------------------------------------------------------
// BOOKING_PAGE_PICTURES=<absolute folder> (or 1 for .tmp/pictures/04-05) writes <state>-<width>-<locale>.png; never
// under tests/ (memory: snapshot writes outside tests/).

const PICTURES_TO = process.env.BOOKING_PAGE_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : join(__dirname, "..", ".tmp", "pictures", "04-05");

const PRINT_STATES = new Set(["print-awaiting", "print-confirmed"]);
const DIALOG_STATES = new Set(["withdraw-confirm", "withdraw-failed"]);
const TRANSFER_STATES = new Set([
  "awaiting",
  "part-received",
  "part-paid-late",
  "deposit-balance",
  "print-awaiting",
  "withdraw-confirm",
  "withdraw-failed",
  "withdraw-refused-part-paid",
]);
const ACCESS_STATES = new Set(["confirmed", "completed", "print-confirmed"]);
const WITHDRAW_STATES = new Set(["awaiting", "print-awaiting", "withdraw-confirm", "withdraw-failed"]);
const NOTICE_KIND: Record<string, string> = {
  "withdraw-done": "done",
  "withdraw-refused-part-paid": "part_paid",
  "withdraw-refused-not-withdrawable": "not_withdrawable",
};
// The plan's list plus the second check's owner-made request (E-21: the contact line instead of Withdraw).
const CONTACT_STATES = new Set([
  "part-received",
  "part-paid-late",
  "awaiting-owner-made",
  "withdraw-refused-part-paid",
  "withdraw-refused-not-withdrawable",
]);

function pictureWidths(state: string): Viewport[] {
  return PRINT_STATES.has(state) ? ["tablet"] : ["phone", "tablet", "desktop"];
}

async function sceneChecks(page: Page, state: string, locale: Locale) {
  const copy = BOOKING_PAGE_COPY[locale];
  await expect(page.locator("[data-testid=transfer]"), "transfer block").toHaveCount(TRANSFER_STATES.has(state) ? 1 : 0);
  await expect(page.locator("[data-testid=access]"), "stay details").toHaveCount(ACCESS_STATES.has(state) ? 1 : 0);
  const withdraw = page.locator("[data-testid=withdraw]");
  await expect(withdraw, "the Withdraw control").toHaveCount(WITHDRAW_STATES.has(state) ? 1 : 0);
  if (WITHDRAW_STATES.has(state)) {
    expect(await withdraw.evaluate((el) => getComputedStyle(el).backgroundColor), "secondary, never the Teal fill").toBe("rgba(0, 0, 0, 0)");
  }
  const dialog = page.getByRole("dialog");
  if (DIALOG_STATES.has(state)) {
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: copy.withdrawKeep, exact: true })).toBeVisible();
    await expect(dialog).not.toContainText("Stay signed in");
    if (state === "withdraw-failed") {
      await expect(dialog.locator("[data-testid=withdraw-failed]")).toBeVisible();
      await expect(dialog.getByRole("button", { name: copy.withdrawRetry, exact: true })).toBeVisible();
    } else {
      await expect(dialog.getByRole("button", { name: copy.withdrawConfirmAction, exact: true })).toBeVisible();
    }
  } else {
    await expect(dialog).toHaveCount(0);
  }
  const notice = page.locator("[data-testid=withdraw-notice]");
  const kind = NOTICE_KIND[state];
  await expect(notice, "withdraw notice").toHaveCount(kind ? 1 : 0);
  if (kind) {
    await expect(notice).toHaveAttribute("data-kind", kind);
    if (kind === "done") await expect(notice.locator(`a[href="/${locale}/private-stays/test-stay"]`)).toHaveCount(1);
  }
  const contact = page.locator("[data-testid=contact-to-change]");
  await expect(contact, "contact line").toHaveCount(CONTACT_STATES.has(state) ? 1 : 0);
  if (CONTACT_STATES.has(state)) {
    await expect(contact.locator(`a[href="${WA}"]`)).toHaveCount(1);
    await expect(contact.locator(`a[href="mailto:${INQUIRIES}"]`)).toHaveCount(1);
  }
  const late = page.locator("[data-testid=deadline-passed]");
  await expect(late, "the late line").toHaveCount(state === "part-paid-late" ? 1 : 0);
  if (state === "part-paid-late") {
    const view = viewFixture("part-paid-late", locale);
    const sentence = fill(JOURNEY_COPY[locale].bookingStatus.payBy, uaeDateTime(view.transfer!.payBy!));
    await expect(page.locator("[data-testid=transfer]")).not.toContainText(sentence);
  }
  await assertTokenStaysHome(page);
  await assertKitLooks(page);
}

test.describe("pictures", () => {
  test.skip(!PICTURES_TO, "set BOOKING_PAGE_PICTURES=1 (or an absolute folder) to shoot the pictures");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(240_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("booking-page")) {
    for (const viewport of pictureWidths(state)) {
      for (const locale of LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await page.setViewportSize(VIEWPORTS[viewport]);
          if (PRINT_STATES.has(state)) await page.emulateMedia({ media: "print" });
          const url = `/__harness?c=booking-page&s=${state}&l=${locale}`;
          const first = await page.goto(url);
          if (!first || first.status() >= 500) await page.goto(url);
          await settle(page);
          await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
          await page.waitForFunction((l) => document.documentElement.lang === l, locale);
          if (locale === "ar") {
            await assertArabicFont(page);
            await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
          }
          await sceneChecks(page, state, locale);
          if (PRINT_STATES.has(state)) {
            await expect(page.locator("header").first()).toBeHidden();
            await expect(page.locator("footer").first()).toBeHidden();
            for (const button of await page.locator("button").all()) await expect(button).toBeHidden();
          }
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          await page.screenshot({ path: join(PICTURES, `${state}-${width}-${locale}.png`), fullPage: !DIALOG_STATES.has(state) });
        });
      }
    }
  }
});

// ---- the real pages: mocks ----------------------------------------------------------------------------------------

const REF = FIXTURE_REF;
const TOKEN = FAKE_LINK_TOKEN;

type Answer = { status: number; json?: unknown; abort?: true; delayMs?: number };

type Mocks = {
  views: { body: Record<string, unknown>; origin: string | undefined }[];
  withdraws: { body: Record<string, unknown>; origin: string | undefined }[];
};

/** The awaiting view with its deadline and pay-by one day after the real clock (the screen reads Date.now()). */
function liveAwaiting(locale: Locale): BookingView {
  const view = viewFixture("awaiting", locale);
  const ahead = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  view.deadline = ahead;
  view.transfer = { ...view.transfer!, payBy: ahead };
  return view;
}

const ok = (view: BookingView): Answer => ({ status: 200, json: { ok: true, booking: view } });

async function mockRoutes(
  page: Page,
  o: { view: (n: number, body: Record<string, unknown>) => Answer; withdraw?: (n: number) => Answer },
): Promise<Mocks> {
  const m: Mocks = { views: [], withdraws: [] };
  const answer = async (route: Route, a: Answer) => {
    if (a.delayMs) await new Promise((r) => setTimeout(r, a.delayMs));
    if (a.abort) return route.abort("failed");
    await route.fulfill({
      status: a.status,
      contentType: "application/json",
      headers: { "cache-control": "no-store" },
      body: JSON.stringify(a.json ?? { ok: false }),
    });
  };
  await page.route("**/api/booking/view", async (route) => {
    const req = route.request();
    const body = req.postDataJSON() as Record<string, unknown>;
    m.views.push({ body, origin: (await req.allHeaders())["origin"] });
    await answer(route, o.view(m.views.length, body));
  });
  await page.route("**/api/booking/withdraw", async (route) => {
    const req = route.request();
    m.withdraws.push({ body: req.postDataJSON() as Record<string, unknown>, origin: (await req.allHeaders())["origin"] });
    await answer(route, o.withdraw ? o.withdraw(m.withdraws.length) : { status: 503 });
  });
  return m;
}

function pageUrl(locale: Locale, t: string | null = TOKEN) {
  return `/${locale}/bookings/trip?ref=${REF}` + (t === null ? "" : `&t=${t}`);
}

async function openPage(page: Page, locale: Locale, t: string | null = TOKEN) {
  await page.goto(pageUrl(locale, t));
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

type ChipStatus = Exclude<keyof (typeof JOURNEY_COPY)["en"]["bookingStatus"], "payBy">;

/** The status chip (data-testid="booking-status") holding exactly that locale's 04-03 word. */
const statusChip = (page: Page, locale: Locale, status: ChipStatus) =>
  page.locator("[data-testid=booking-status]").filter({ hasText: new RegExp(`^${JOURNEY_COPY[locale].bookingStatus[status]}$`) });

// ---- behaviour (Task 5) -------------------------------------------------------------------------------------------

test.describe("behaviour", () => {
  test.setTimeout(120_000);

  test("one view call per page: body exactly { ref, t, locale }, the page's own Origin (F-02), in every locale", async ({ page, baseURL }) => {
    const m = await mockRoutes(page, { view: (_n, body) => ok(liveAwaiting(body.locale as Locale)) });
    for (const locale of LOCALES) {
      await openPage(page, locale);
      await expect(page.locator("[data-testid=transfer]")).toBeVisible();
    }
    expect(m.views.map((v) => v.body)).toEqual(LOCALES.map((locale) => ({ ref: REF, t: TOKEN, locale })));
    for (const v of m.views) expect(v.origin).toBe(new URL(baseURL!).origin);
    await openPage(page, "en", null);
    expect(m.views.at(-1)!.body, "without t the body has no t").toEqual({ ref: REF, locale: "en" });
  });

  test("a ref that is not a booking reference is not found with no call", async ({ page }) => {
    const m = await mockRoutes(page, { view: () => ok(liveAwaiting("en")) });
    await page.goto(`/en/bookings/trip?ref=nope&t=${TOKEN}`);
    await expect(page.getByText(BOOKING_PAGE_COPY.en.notFound)).toBeVisible();
    expect(m.views).toHaveLength(0);
  });

  test("awaiting shows the transfer block, the Pay-by sentence as fixed text, and the TEST banner on 127.0.0.1", async ({ page }) => {
    const view = liveAwaiting("en");
    await mockRoutes(page, { view: () => ok(view) });
    await openPage(page, "en");
    const transfer = page.locator("[data-testid=transfer]");
    await expect(transfer).toContainText(fill(JOURNEY_COPY.en.bookingStatus.payBy, uaeDateTime(view.transfer!.payBy!)));
    await expect(transfer).toContainText("AE07 0331 2345 6789 0123 456");
    await expect(transfer).toContainText("TESTAEAAXXX");
    await expect(page.getByText(BOOKING_PAGE_COPY.en.testBanner)).toBeVisible();
    await expect(statusChip(page, "en", "awaiting_payment")).toBeVisible();
    await expect(page.locator("[data-testid=access]")).toHaveCount(0);
  });

  test("confirmed shows the stay details; the back link only without t", async ({ page }) => {
    await mockRoutes(page, { view: (_n, body) => ok(viewFixture("confirmed", body.locale as Locale)) });
    await openPage(page, "en");
    await expect(page.locator("[data-testid=access]")).toBeVisible();
    await expect(page.locator("[data-testid=transfer]")).toHaveCount(0);
    await expect(page.locator('main a[href="/en/bookings"]')).toHaveCount(0);
    await openPage(page, "en", null);
    await expect(page.locator('main a[href="/en/bookings"]')).toHaveCount(1);
  });

  test("404 is not found: the sign-in line and Log in only without t", async ({ page }) => {
    await mockRoutes(page, { view: () => ({ status: 404, json: { ok: false } }) });
    const copy = BOOKING_PAGE_COPY.en;
    await openPage(page, "en");
    await expect(page.getByText(copy.notFound)).toBeVisible();
    await expect(page.getByText(copy.notFoundSignIn)).toHaveCount(0);
    await openPage(page, "en", null);
    await expect(page.getByText(copy.notFound)).toBeVisible();
    await expect(page.getByText(copy.notFoundSignIn)).toBeVisible();
    await expect(page.getByRole("link", { name: copy.logIn, exact: true })).toHaveAttribute("href", "/en/login?return=bookings");
  });

  test("503 is unavailable; Try again posts once more and shows the booking", async ({ page }) => {
    const m = await mockRoutes(page, { view: (n) => (n === 1 ? { status: 503, json: { ok: false } } : ok(liveAwaiting("en"))) });
    await openPage(page, "en");
    await expect(page.getByText(BOOKING_PAGE_COPY.en.unavailable)).toBeVisible();
    expect(m.views).toHaveLength(1);
    await page.getByRole("button", { name: BOOKING_PAGE_COPY.en.tryAgain, exact: true }).click();
    await expect(page.locator("[data-testid=transfer]")).toBeVisible();
    expect(m.views).toHaveLength(2);
  });

  test("a network error or an odd answer is unavailable, never a broken page", async ({ page }) => {
    await mockRoutes(page, { view: (n) => (n === 1 ? { status: 0, abort: true } : { status: 200, json: { ok: true, booking: { ref: REF } } }) });
    await openPage(page, "en");
    await expect(page.getByText(BOOKING_PAGE_COPY.en.unavailable)).toBeVisible();
    await page.getByRole("button", { name: BOOKING_PAGE_COPY.en.tryAgain, exact: true }).click();
    await expect(page.getByText(BOOKING_PAGE_COPY.en.unavailable)).toBeVisible();
    await expect(page.locator("body")).not.toContainText("NaN");
  });

  test("Arabic is right to left; choosing Español keeps the booking (bite P5) and posts with locale es", async ({ page }) => {
    const m = await mockRoutes(page, { view: (_n, body) => ok(liveAwaiting(body.locale as Locale)) });
    await openPage(page, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("[data-testid=transfer]")).toBeVisible();
    const es = page.locator(`a[href="/es/bookings/trip?ref=${REF}&t=${TOKEN}"]`).first();
    await expect(es).toHaveCount(1);
    await es.click();
    await expect(page).toHaveURL(new RegExp(`/es/bookings/trip\\?ref=${REF}&t=${TOKEN}$`));
    await page.waitForFunction(() => document.documentElement.lang === "es");
    await expect(page.locator("[data-testid=transfer]")).toBeVisible();
    expect(m.views.at(-1)!.body).toEqual({ ref: REF, t: TOKEN, locale: "es" });
  });

  test("the token never leaves the origin: no src and no off-origin link carries it", async ({ page }) => {
    await mockRoutes(page, { view: (_n, body) => ok(viewFixture("confirmed", body.locale as Locale)) });
    for (const locale of LOCALES) {
      await openPage(page, locale);
      await expect(page.locator("[data-testid=access]")).toBeVisible();
      await assertTokenStaysHome(page, TOKEN);
      await assertKitLooks(page);
    }
  });

  test("the IBAN copy button writes the IBAN without spaces and says it is copied", async ({ page, context, baseURL }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: new URL(baseURL!).origin });
    await mockRoutes(page, { view: () => ok(liveAwaiting("en")) });
    await openPage(page, "en");
    await page.getByRole("button", { name: BOOKING_PAGE_COPY.en.copyValue.copyIban, exact: true }).click();
    await expect(page.getByText(BOOKING_PAGE_COPY.en.copyValue.copied).first()).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(FIXTURE_IBAN);
    await page.getByRole("button", { name: BOOKING_PAGE_COPY.en.copyValue.copyReference, exact: true }).click();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(REF);
  });

  test("print hides the nav, the footer and every button; the transfer block and the amounts stay (bite P6)", async ({ page }) => {
    await mockRoutes(page, { view: () => ok(liveAwaiting("en")) });
    await openPage(page, "en");
    await expect(page.locator("[data-testid=transfer]")).toBeVisible();
    // The dev server's own overlay (not the page) has buttons of its own.
    await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
    await page.emulateMedia({ media: "print" });
    await expect(page.locator("header").first()).toBeHidden();
    await expect(page.locator("footer").first()).toBeHidden();
    for (const button of await page.locator("button").all()) await expect(button).toBeHidden();
    await expect(page.locator("[data-testid=transfer]")).toBeVisible();
    await page.emulateMedia({ media: "screen" });
  });

  test("390, 834 and 1440 have no horizontal scroll", async ({ page }) => {
    await mockRoutes(page, { view: (_n, body) => ok(liveAwaiting(body.locale as Locale)) });
    for (const viewport of ["phone", "tablet", "desktop"] as const) {
      await page.setViewportSize(VIEWPORTS[viewport]);
      for (const locale of LOCALES) {
        await openPage(page, locale);
        await expect(page.locator("[data-testid=transfer]")).toBeVisible();
        await noHorizontalScroll(page);
      }
    }
  });
});

// ---- withdraw flow (Task 6) ---------------------------------------------------------------------------------------

const DONE = { status: 200, json: { ok: true, ref: REF, status: "cancelled", firstTime: true } };

async function openConfirm(page: Page, locale: Locale) {
  await page.locator("[data-testid=withdraw]").click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("dialog")).toContainText(BOOKING_PAGE_COPY[locale].withdrawConfirmTitle);
}

function confirmButton(page: Page, label: string) {
  return page.getByRole("dialog").getByRole("button", { name: label, exact: true });
}

test.describe("withdraw flow", () => {
  test.setTimeout(120_000);

  test("(1) Keep my request: nothing is sent, the dialog closes, the control stays", async ({ page }) => {
    const m = await mockRoutes(page, { view: () => ok(liveAwaiting("en")), withdraw: () => DONE });
    await openPage(page, "en");
    await openConfirm(page, "en");
    await confirmButton(page, BOOKING_PAGE_COPY.en.withdrawKeep).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("[data-testid=withdraw]")).toBeVisible();
    expect(m.withdraws).toHaveLength(0);
  });

  for (const locale of LOCALES) {
    test(`(2) confirm, 200: the done notice, Cancelled, no control; 2 view reads, 1 withdraw { ref, t } from the page origin (bite P12), ${locale}`, async ({ page, baseURL }) => {
      const m = await mockRoutes(page, {
        view: (n) => ok(n === 1 ? liveAwaiting(locale) : viewFixture("withdrawn", locale)),
        withdraw: () => DONE,
      });
      await openPage(page, locale);
      await openConfirm(page, locale);
      await confirmButton(page, BOOKING_PAGE_COPY[locale].withdrawConfirmAction).click();
      const notice = page.locator("[data-testid=withdraw-notice]");
      await expect(notice).toHaveAttribute("data-kind", "done");
      await expect(notice).toContainText(BOOKING_PAGE_COPY[locale].withdrawDone);
      await expect(notice.getByRole("link", { name: BOOKING_PAGE_COPY[locale].withdrawStartAgain })).toHaveAttribute("href", `/${locale}/private-stays/test-stay`);
      await expect(statusChip(page, locale, "cancelled")).toBeVisible();
      await expect(page.locator("[data-testid=withdraw]")).toHaveCount(0);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(notice).toBeFocused();
      expect(m.views).toHaveLength(2);
      expect(m.withdraws).toHaveLength(1);
      expect(m.withdraws[0].body).toEqual({ ref: REF, t: TOKEN });
      expect(m.withdraws[0].origin).toBe(new URL(baseURL!).origin);
    });
  }

  test("(3) a double click on the confirm while the answer is held posts once (bite P9)", async ({ page }) => {
    const m = await mockRoutes(page, {
      view: (n) => ok(n === 1 ? liveAwaiting("en") : viewFixture("withdrawn", "en")),
      withdraw: () => ({ ...DONE, delayMs: 500 }),
    });
    await openPage(page, "en");
    await openConfirm(page, "en");
    await confirmButton(page, BOOKING_PAGE_COPY.en.withdrawConfirmAction).dblclick();
    await expect(page.locator("[data-testid=withdraw-notice]")).toHaveAttribute("data-kind", "done");
    expect(m.withdraws).toHaveLength(1);
  });

  test("(4) 409 part_paid: the refusal with WhatsApp and inquiries@, no control, one contact line (bite P10)", async ({ page }) => {
    const m = await mockRoutes(page, {
      view: (n) => ok(n === 1 ? liveAwaiting("en") : viewFixture("part-received", "en")),
      withdraw: () => ({ status: 409, json: { ok: false, reason: "part_paid" } }),
    });
    await openPage(page, "en");
    await openConfirm(page, "en");
    await confirmButton(page, BOOKING_PAGE_COPY.en.withdrawConfirmAction).click();
    const notice = page.locator("[data-testid=withdraw-notice]");
    await expect(notice).toHaveAttribute("data-kind", "part_paid");
    await expect(notice).toContainText(BOOKING_PAGE_COPY.en.withdrawRefusedPartPaid);
    await expect(notice.locator(`a[href="${WA}"]`)).toHaveCount(1);
    await expect(notice.locator(`a[href="mailto:${INQUIRIES}"]`)).toHaveCount(1);
    await expect(page.locator("[data-testid=withdraw]")).toHaveCount(0);
    await expect(page.locator("[data-testid=contact-to-change]")).toHaveCount(1);
    expect(m.views).toHaveLength(2);
  });

  test("(5) 409 not_withdrawable: the refusal and the view read again", async ({ page }) => {
    const m = await mockRoutes(page, {
      view: (n) => ok(n === 1 ? liveAwaiting("en") : viewFixture("expired", "en")),
      withdraw: () => ({ status: 409, json: { ok: false, reason: "not_withdrawable" } }),
    });
    await openPage(page, "en");
    await openConfirm(page, "en");
    await confirmButton(page, BOOKING_PAGE_COPY.en.withdrawConfirmAction).click();
    const notice = page.locator("[data-testid=withdraw-notice]");
    await expect(notice).toHaveAttribute("data-kind", "not_withdrawable");
    await expect(notice).toContainText(BOOKING_PAGE_COPY.en.withdrawRefusedNotWithdrawable);
    await expect(statusChip(page, "en", "expired")).toBeVisible();
    expect(m.views).toHaveLength(2);
  });

  for (const locale of ["en", "ar"] as const) {
    test(`(6) a network failure keeps the dialog open with Try again; the second confirm withdraws; 2 withdraw requests, ${locale}`, async ({ page }) => {
      const m = await mockRoutes(page, {
        view: (n) => ok(n === 1 ? liveAwaiting(locale) : viewFixture("withdrawn", locale)),
        withdraw: (n) => (n === 1 ? { status: 0, abort: true } : DONE),
      });
      await openPage(page, locale);
      if (locale === "ar") await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
      const copy = BOOKING_PAGE_COPY[locale];
      await openConfirm(page, locale);
      await confirmButton(page, copy.withdrawConfirmAction).click();
      const dialog = page.getByRole("dialog");
      await expect(dialog.locator("[data-testid=withdraw-failed]")).toBeVisible();
      await expect(dialog.locator("[data-testid=withdraw-failed]")).toContainText(copy.withdrawFailed);
      await expect(confirmButton(page, copy.withdrawRetry)).toBeVisible();
      await confirmButton(page, copy.withdrawRetry).click();
      await expect(page.locator("[data-testid=withdraw-notice]")).toHaveAttribute("data-kind", "done");
      expect(m.withdraws).toHaveLength(2);
    });
  }

  test("(7) 404 on the withdraw and on the re-read: not found", async ({ page }) => {
    const m = await mockRoutes(page, {
      view: (n) => (n === 1 ? ok(liveAwaiting("en")) : { status: 404, json: { ok: false } }),
      withdraw: () => ({ status: 404, json: { ok: false } }),
    });
    await openPage(page, "en");
    await openConfirm(page, "en");
    await confirmButton(page, BOOKING_PAGE_COPY.en.withdrawConfirmAction).click();
    await expect(page.getByText(BOOKING_PAGE_COPY.en.notFound)).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(m.views).toHaveLength(2);
    expect(m.withdraws).toHaveLength(1);
  });

  test("an owner-made or part-paid request never shows the control", async ({ page }) => {
    const m = await mockRoutes(page, {
      view: (n) => {
        const view = n === 1 ? viewFixture("awaiting-owner-made", "en") : viewFixture("part-received", "en");
        const ahead = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
        view.deadline = ahead;
        view.transfer = { ...view.transfer!, payBy: ahead };
        return ok(view);
      },
    });
    await openPage(page, "en");
    await expect(page.locator("[data-testid=contact-to-change]")).toHaveCount(1);
    await expect(page.locator("[data-testid=withdraw]")).toHaveCount(0);
    await openPage(page, "en");
    await expect(page.locator("[data-testid=contact-to-change]")).toHaveCount(1);
    await expect(page.locator("[data-testid=withdraw]")).toHaveCount(0);
    expect(m.withdraws).toHaveLength(0);
  });
});
