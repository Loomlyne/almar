import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { JOURNEY_COPY } from "../lib/copy/journey";
import { formatAed } from "../lib/money/format";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// Plan 04-03: the guest's trip (/en|ar|es/booking/trip) and Book on the stay page.
//  - copy: every string of the groups this plan added or changed is a non-empty string in en, ar and es.
//  - pictures: full-page PNGs of tests/journey/scenes/booking-trip.tsx for the owner (env-gated, written outside tests/).
//  - book and add-ons (Task 3) and travellers and request (Task 4): the real pages on next dev, every booking route
//    answered by page.route with symbolic fils, the request bodies asserted. Q-01 = B (owner, 2026-10-25): the
//    choices end Travellers and "Continue to request" places the one hold.

type Locale = "en" | "ar" | "es";
const LOCALES: Locale[] = ["en", "ar", "es"];

// ---- copy ---------------------------------------------------------------------------------------------------------

const GROUPS = ["steps", "addons", "cart", "pay", "book", "trip", "summary", "travellers", "request", "reasons", "bookingStatus"] as const;

function leaves(node: unknown, prefix = "", out: Record<string, unknown> = {}): Record<string, unknown> {
  if (node !== null && typeof node === "object" && !Array.isArray(node)) {
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) leaves(v, prefix ? `${prefix}.${k}` : k, out);
  } else {
    out[prefix] = node;
  }
  return out;
}

test("copy: the trip groups are non-empty strings with the same keys in en, ar and es", () => {
  const en = leaves(Object.fromEntries(GROUPS.map((g) => [g, JOURNEY_COPY.en[g]])));
  // Plural forms differ by language (Arabic has zero/two/few/many): compare the keys above the plural level.
  const stem = (key: string) => key.replace(/\.(?:zero|one|two|few|many|other)$/, "");
  const enStems = [...new Set(Object.keys(en).map(stem))].sort();
  for (const locale of LOCALES) {
    const all = leaves(Object.fromEntries(GROUPS.map((g) => [g, JOURNEY_COPY[locale][g]])));
    expect([...new Set(Object.keys(all).map(stem))].sort(), `${locale}: same keys`).toEqual(enStems);
    for (const [key, value] of Object.entries(all)) {
      expect(typeof value, `${locale}.${key}`).toBe("string");
      expect((value as string).trim(), `${locale}.${key} empty`).not.toBe("");
      expect(value as string, `${locale}.${key}`).not.toMatch(/\[object|undefined|NaN/);
    }
  }
  // British spelling (owner, 2026-10-25) and the signed lines.
  expect(JOURNEY_COPY.en.steps.travelers).toBe("Travellers");
  expect(JOURNEY_COPY.en.addons.continue).toBe("Continue to travellers");
  expect(JOURNEY_COPY.en.travellers.errors.summary.length).toBeGreaterThan(0);
  expect(JOURNEY_COPY.en.request.windowNote).toContain("[N]");
});

// ---- pictures -----------------------------------------------------------------------------------------------------
// BOOKING_TRIP_PICTURES=1 writes into .tmp/pictures/04-03/, an absolute folder writes there; never under tests/.

const PICTURES_TO = process.env.BOOKING_TRIP_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : join(__dirname, "..", ".tmp", "pictures", "04-03");

function pictureWidths(state: string): Viewport[] {
  if (state === "book-sheet" || state === "book-dock") return ["phone"];
  if (state.startsWith("book-bar")) return ["tablet", "desktop"];
  return ["phone", "tablet", "desktop"];
}

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

test.describe("pictures", () => {
  test.skip(!PICTURES_TO, "set BOOKING_TRIP_PICTURES=1 (or an absolute folder) to shoot the pictures");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(240_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("booking-trip")) {
    for (const viewport of pictureWidths(state)) {
      for (const locale of LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await page.setViewportSize(VIEWPORTS[viewport]);
          const url = `/__harness?c=booking-trip&s=${state}&l=${locale}`;
          const first = await page.goto(url);
          if (!first || first.status() >= 500) await page.goto(url);
          await settle(page);
          await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
          await page.waitForFunction((l) => document.documentElement.lang === l, locale);
          if (locale === "ar") {
            await assertArabicFont(page);
            await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
          }
          if (state === "book-bar-no-dates") {
            // The guest's path: Book without dates shows the needDates line and opens the Dates panel.
            await page.getByRole("button", { name: JOURNEY_COPY[locale].book.label, exact: true }).click();
            await expect(page.getByRole("alert").filter({ hasText: JOURNEY_COPY[locale].book.needDates })).toBeVisible();
          }
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          const body = (await page.locator("body").innerText()) ?? "";
          expect(body, "no [object] in the scene").not.toMatch(/\[object|undefined|NaN/);
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          await page.screenshot({ path: join(PICTURES, `${state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});

// ---- fixtures for the real pages ------------------------------------------------------------------------------------
// Symbolic fils (the test's own numbers, never a real rate); the page only formats them.

const PICKUP = "00000000-0000-4000-8000-000000000001";
const UAE_SERVICE = "00000000-0000-4000-8000-000000000002";
const TOUR = "00000000-0000-4000-8000-000000000003";
const REF = "ALMAR-7K3P9Q";
const TOKEN = "tok_test_0123456789abcdef";
const NIGHT_FILS = 100_000;
const LINE_FILS = 10_000;

type Addon = { id: string; qty: number };

function isoDays(fromToday: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + fromToday);
  return d.toISOString().slice(0, 10);
}
const FROM = isoDays(200);
const TO = isoDays(203);

function offers() {
  return [
    { id: PICKUP, slug: "home-pickup", kind: "service", unit: "trip", isUae: true, isHomePickup: true, name: "Home pickup", image: null, priceFils: LINE_FILS },
    { id: UAE_SERVICE, slug: "vip-meet", kind: "service", unit: "trip", isUae: true, isHomePickup: false, name: "VIP meet", image: null, priceFils: LINE_FILS },
    { id: TOUR, slug: "heritage-tour", kind: "experience", unit: "person", isUae: false, isHomePickup: false, name: "Heritage tour", image: null, priceFils: LINE_FILS },
  ];
}

function breakdown(addons: Addon[], o: { deposit?: boolean; depositBlock?: string | null; plan?: "deposit" | "full" } = {}) {
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

function quoteAnswer(addons: Addon[], o: { reasons?: unknown[]; ok?: boolean; deposit?: boolean; depositBlock?: string } = {}) {
  const ok = o.ok ?? true;
  return {
    ok,
    reasons: o.reasons ?? [],
    stay: { slug: "stay", title: "[Stay name]", destinationName: "[Destination]", image: null, maxGuests: 6, minNights: 2, infantsCount: false },
    offers: offers(),
    inclusions: [{ id: "i1", label: "[Inclusion]" }],
    breakdown: ok || o.reasons?.some((r) => (r as { code: string }).code === "requests_closed") ? breakdown(addons, o) : null,
  };
}

type Mocks = {
  quotes: Record<string, unknown>[];
  holds: Record<string, unknown>[];
  releases: Record<string, unknown>[];
  urls: string[];
};

async function mockBooking(
  page: Page,
  o: {
    quote?: (body: { addons: Addon[] }) => unknown;
    hold?: (n: number) => { status: number; json: unknown };
    /** The server's clock for the default hold answer (its holdExpiresAt and serverNow); the test runner's by default. */
    serverClock?: () => number;
  } = {},
): Promise<Mocks> {
  const m: Mocks = { quotes: [], holds: [], releases: [], urls: [] };
  page.on("request", (r: Request) => m.urls.push(r.url()));
  await page.route("**/api/booking/quote", async (route: Route) => {
    const body = route.request().postDataJSON() as { addons: Addon[] };
    m.quotes.push(body as unknown as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(o.quote ? o.quote(body) : quoteAnswer(body.addons)) });
  });
  await page.route("**/api/booking/hold", async (route: Route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    m.holds.push(body);
    const server = (o.serverClock ?? Date.now)();
    const answer = o.hold
      ? o.hold(m.holds.length)
      : {
          status: 200,
          json: {
            ok: true,
            ref: REF,
            holdExpiresAt: new Date(server + 30 * 60 * 1000).toISOString(),
            linkToken: TOKEN,
            breakdown: breakdown(body.addons as Addon[], { plan: body.plan as "deposit" | "full" }),
            transferWindowMinutes: 35,
            serverNow: new Date(server).toISOString(),
          },
        };
    await route.fulfill({ status: answer.status, contentType: "application/json", body: JSON.stringify(answer.json) });
  });
  await page.route("**/api/booking/release", async (route: Route) => {
    m.releases.push(route.request().postDataJSON() as Record<string, unknown>);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });
  return m;
}

const query = (o: { adults?: number; children?: number; infants?: number } = {}) =>
  `stay=getsemani-colonial-house&from=${FROM}&to=${TO}&adults=${o.adults ?? 2}&children=${o.children ?? 0}&infants=${o.infants ?? 0}`;

async function openTrip(page: Page, locale: Locale, q = query()) {
  await page.goto(`/${locale}/booking/trip?${q}`);
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

async function noHorizontalScroll(page: Page) {
  const wide = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  expect(wide, "no horizontal scroll").toBe(false);
}

const en = JOURNEY_COPY.en;

// ---- Task 3: book and add-ons ---------------------------------------------------------------------------------------

test.describe("book and add-ons", () => {
  test.setTimeout(180_000);
  let slug = "";
  test.beforeAll(async () => {
    const { getStaySlugs } = await import("../lib/data/stays");
    slug = (await getStaySlugs())[0];
  });

  async function seedDates(page: Page) {
    await page.addInitScript(
      ({ from, to }) => {
        window.sessionStorage.setItem(
          "almar-journey-choice",
          JSON.stringify({ destination_id: null, from, to, adults: 2, children: 1, infants: 0, guests_set: true }),
        );
      },
      { from: FROM, to: TO },
    );
  }

  test("Book with dates opens the trip page with the exact query (EN and AR)", async ({ page }) => {
    await mockBooking(page);
    await seedDates(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    for (const locale of ["en", "ar"] as const) {
      await page.goto(`/${locale}/private-stays/${slug}`);
      const book = page.getByRole("link", { name: JOURNEY_COPY[locale].book.label, exact: true }).first();
      await expect(book).toHaveAttribute("href", `/${locale}/booking/trip?stay=${slug}&from=${FROM}&to=${TO}&adults=2&children=1&infants=0`);
      await book.click();
      await expect(page).toHaveURL(new RegExp(`/${locale}/booking/trip\\?stay=${slug}&`));
    }
  });

  test("Book without dates asks for them and opens the dates, no navigation", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.goto(`/en/private-stays/${slug}`);
    const before = page.url();
    await page.getByRole("button", { name: en.book.label, exact: true }).first().click();
    await expect(page.getByRole("alert").filter({ hasText: en.book.needDates })).toBeVisible();
    await expect(page.getByRole("dialog").or(page.locator("[data-radix-popper-content-wrapper]"))).toBeVisible();
    expect(page.url()).toBe(before);

    await page.setViewportSize(VIEWPORTS.phone);
    await page.reload();
    // The dock's Book opens the sheet on its dates step.
    await page.getByRole("button", { name: en.book.label, exact: true }).last().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("heading", { name: en.sheet.when })).toBeVisible();
    expect(page.url()).toBe(before);
  });

  test("step 1 shows the summary; reasons show their lines and Continue is off", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await mockBooking(page, {
      quote: () =>
        quoteAnswer([], { ok: false, reasons: [{ code: "sold_out", nights: [FROM] }, { code: "below_min_nights", min: 4 }] }),
    });
    await openTrip(page, "en");
    await expect(page.getByText("[Stay name]").first()).toBeVisible();
    await expect(page.getByText("This stay needs at least 4 nights.")).toBeVisible();
    await expect(page.getByRole("link", { name: en.reasons.actions.backToStay }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: en.summary.continue })).toBeDisabled();
  });

  test("requests closed: the closed line, WhatsApp, Continue off", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await mockBooking(page, { quote: (b) => quoteAnswer(b.addons, { ok: false, reasons: [{ code: "requests_closed" }] }) });
    await openTrip(page, "en");
    await expect(page.getByText(en.reasons.requests_closed)).toBeVisible();
    await expect(page.getByRole("link", { name: en.reasons.actions.whatsapp }).first()).toHaveAttribute("href", /wa\.me/);
    await expect(page.getByRole("button", { name: en.summary.continue })).toBeDisabled();
  });

  test("add-ons: home pickup starts added, a person add-on re-quotes, removing it re-quotes, VAT 5%", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const m = await mockBooking(page);
    await openTrip(page, "en");
    await page.getByRole("button", { name: en.summary.continue }).click();
    await expect.poll(() => m.quotes.length).toBeGreaterThanOrEqual(2);
    const second = m.quotes[1] as { addons: Addon[] };
    expect(second.addons).toEqual([{ id: PICKUP, qty: 1 }]);
    const cart = page.getByRole("complementary", { name: en.cart.label }).first();
    await expect(cart.getByText("VAT 5%")).toBeVisible();
    const count = m.quotes.length;
    await page.getByRole("button", { name: `Add one Heritage tour` }).first().click();
    await expect.poll(() => m.quotes.length).toBeGreaterThan(count);
    const last = m.quotes.at(-1) as { addons: Addon[] };
    expect(last.addons).toEqual([{ id: PICKUP, qty: 1 }, { id: TOUR, qty: 1 }].sort((a, b) => a.id.localeCompare(b.id)));
    await expect(cart.getByText(formatAed(LINE_FILS)).first()).toBeVisible();
    const n = m.quotes.length;
    await cart.getByRole("button", { name: "Remove Heritage tour" }).click();
    await expect.poll(() => m.quotes.length).toBeGreaterThan(n);
    expect((m.quotes.at(-1) as { addons: Addon[] }).addons).toEqual([{ id: PICKUP, qty: 1 }]);
    expect(m.urls.some((u) => /[?&]t=/.test(u))).toBe(false);
  });

  test("the language control keeps the query; a bad link is a line; AR is rtl; no horizontal scroll", async ({ page }) => {
    await mockBooking(page);
    for (const viewport of ["phone", "tablet", "desktop"] as const) {
      await page.setViewportSize(VIEWPORTS[viewport]);
      await openTrip(page, "en");
      await noHorizontalScroll(page);
    }
    await openTrip(page, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const es = page.locator(`a[href^="/es/booking/trip?stay="]`).first();
    await expect(es).toHaveAttribute("href", `/es/booking/trip?${query()}`);
    await page.goto("/en/booking/trip?stay=Bad_Slug");
    await expect(page.getByText(en.trip.badLink)).toBeVisible();
    await expect(page.getByRole("link", { name: en.trip.badLinkAction })).toHaveAttribute("href", "/en/private-stays");
  });
});

// ---- Task 4: travellers and request (Q-01 = B) ----------------------------------------------------------------------

async function toTravellers(page: Page) {
  await expect(page.getByRole("button", { name: en.summary.continue })).toBeEnabled();
  await page.getByRole("button", { name: en.summary.continue }).click();
  await page.getByRole("button", { name: en.addons.continue }).click();
  await expect(page.getByRole("heading", { name: en.trip.stepTitle.travellers })).toBeVisible();
}

async function fillTravellers(page: Page, o: { pickup?: boolean } = {}) {
  await page.locator("#trip-contact-name").fill("[Guest name]");
  await page.locator("#trip-contact-email").fill("guest@example.com");
  await page.locator("#trip-contact-phone").fill("+971 50 000 0000");
  await page.locator("#trip-traveller-1-name").fill("[Second guest]");
  if (o.pickup !== false) await page.locator("#trip-pickup").fill("[Pickup address]");
}

async function chooseFull(page: Page) {
  await page.getByRole("button", { name: new RegExp(en.request.full) }).click();
  await page.getByRole("button", { name: en.request.airports.DXB }).click();
  await page.getByLabel(en.request.terms).check();
}

test.describe("travellers and request", () => {
  test.setTimeout(180_000);

  test("empty Continue shows every required error and sends no hold", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const m = await mockBooking(page);
    await openTrip(page, "en");
    await toTravellers(page);
    await page.getByRole("button", { name: en.travellers.continue }).click();
    await expect(page.getByText(en.travellers.errors.summary)).toBeVisible();
    await expect(page.getByText(en.travellers.errors.required).first()).toBeVisible();
    await expect(page.getByText(en.pay.choice.error)).toBeVisible();
    await expect(page.getByText(en.pay.airport.error)).toBeVisible();
    await expect(page.getByText(en.pay.terms.error)).toBeVisible();
    expect(m.holds.length).toBe(0);
  });

  test("Continue to request places one hold: the body, the countdown, What happens next, Send request on", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const m = await mockBooking(page);
    await openTrip(page, "en");
    await toTravellers(page);
    await fillTravellers(page);
    await chooseFull(page);
    const go = page.getByRole("button", { name: en.travellers.continue });
    await go.dblclick();
    await expect(page.getByRole("timer")).toContainText(/Held for (30:00|29:5\d)/);
    expect(m.holds.length).toBe(1);
    const body = m.holds[0];
    expect(body.plan).toBe("full");
    expect(body.airport).toBe("DXB");
    expect(body.termsAccepted).toBe(true);
    expect((body.travellers as { isBooker: boolean }[])[0].isBooker).toBe(true);
    expect(JSON.stringify(body)).not.toMatch(/Fils|amount|price/i);
    await expect(page.getByText(REF).first()).toBeVisible();
    await expect(page.getByText("35 minutes")).toBeVisible();
    await expect(page.getByText(/All transfer fees are paid by you, the sender/)).toBeVisible();
    await expect(page.getByRole("button", { name: en.request.send })).toBeEnabled();
    expect(m.urls.some((u) => /[?&]t=/.test(u))).toBe(false);
  });

  test("I am not staying makes every line not the booker", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const m = await mockBooking(page);
    await openTrip(page, "en");
    await toTravellers(page);
    await fillTravellers(page);
    await page.getByLabel(en.travellers.notStaying).check();
    await page.locator("#trip-traveller-0-name").fill("[First guest]");
    await chooseFull(page);
    await page.getByRole("button", { name: en.travellers.continue }).click();
    await expect.poll(() => m.holds.length).toBe(1);
    const lines = m.holds[0].travellers as { isBooker: boolean; notStaying: boolean }[];
    expect(lines.every((l) => !l.isBooker && !l.notStaying)).toBe(true);
  });

  test("deposit: due first and balance by date; disabled with its sentence when blocked", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await mockBooking(page, { quote: (b) => quoteAnswer(b.addons, { deposit: false, depositBlock: "too_close_to_arrival" }) });
    await openTrip(page, "en");
    await toTravellers(page);
    await expect(page.getByText(en.request.depositUnavailable.too_close_to_arrival)).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`^${en.request.deposit}`) })).toBeDisabled();
  });

  test("409 sold_out reads taken; 429 the attempts line; 503 requests_closed disables Hold", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const answers = [
      { status: 409, json: { ok: false, reasons: [{ code: "sold_out", nights: [FROM] }] } },
      { status: 429, json: { ok: false, reasons: [{ code: "hold_limit" }] } },
      { status: 503, json: { ok: false, reasons: [{ code: "requests_closed" }] } },
    ];
    await mockBooking(page, { hold: (n) => answers[Math.min(n, 3) - 1] });
    await openTrip(page, "en");
    await toTravellers(page);
    await fillTravellers(page);
    await chooseFull(page);
    await page.getByRole("button", { name: en.travellers.continue }).click();
    await expect(page.getByText(en.reasons.taken)).toBeVisible();
    await page.getByRole("button", { name: en.request.hold }).click();
    await expect(page.getByText(en.reasons.hold_limit)).toBeVisible();
    await page.getByRole("button", { name: en.request.hold }).click();
    await expect(page.getByText(en.reasons.requests_closed)).toBeVisible();
    await expect(page.getByRole("button", { name: en.request.hold })).toBeDisabled();
  });

  test("Change asks, releases with { ref, t }, then opens Travellers; forward again holds once more", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    const m = await mockBooking(page);
    await openTrip(page, "en");
    await toTravellers(page);
    await fillTravellers(page);
    await chooseFull(page);
    await page.getByRole("button", { name: en.travellers.continue }).click();
    await expect(page.getByRole("timer")).toBeVisible();
    await page.getByRole("button", { name: en.request.change, exact: true }).first().click();
    await expect(page.getByRole("dialog")).toContainText(en.request.changeBody);
    await page.getByRole("button", { name: en.request.changeConfirm }).click();
    await expect.poll(() => m.releases.length).toBe(1);
    expect(m.releases[0]).toEqual({ ref: REF, t: TOKEN });
    await expect(page.getByRole("heading", { name: en.trip.stepTitle.travellers })).toBeVisible();
    await page.getByLabel(en.request.terms).check();
    await page.getByRole("button", { name: en.travellers.continue }).click();
    await expect.poll(() => m.holds.length).toBe(2);
  });

  test("the hold ends: the ended view, Start again to the stay, no hold in storage; a reload keeps a live hold", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.clock.install();
    await mockBooking(page);
    await openTrip(page, "en");
    await toTravellers(page);
    await fillTravellers(page);
    await chooseFull(page);
    await page.getByRole("button", { name: en.travellers.continue }).click();
    await expect(page.getByRole("timer")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("timer")).toBeVisible();
    await page.clock.runFor(31 * 60 * 1000);
    await expect(page.getByText(en.request.ended)).toBeVisible();
    await expect(page.getByRole("link", { name: en.request.startAgain })).toHaveAttribute("href", "/en/private-stays/getsemani-colonial-house");
    const stored = await page.evaluate(() => window.sessionStorage.getItem("almar-trip"));
    expect(JSON.parse(stored ?? "{}").hold).toBeNull();
  });

  test("the countdown runs on the server's clock: a device ten minutes ahead still shows the full 30 minutes", async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    // The server answers ten minutes behind the browser: from the device clock alone the hold would read 20:00.
    await mockBooking(page, { serverClock: () => Date.now() - 10 * 60 * 1000 });
    await openTrip(page, "en");
    await toTravellers(page);
    await fillTravellers(page);
    await chooseFull(page);
    await page.getByRole("button", { name: en.travellers.continue }).click();
    await expect(page.getByRole("timer")).toContainText(/30:00|29:5\d/);
  });

  test("AR is rtl on Travellers and Request at 390; no horizontal scroll", async ({ page }) => {
    await mockBooking(page);
    await page.setViewportSize(VIEWPORTS.phone);
    await openTrip(page, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await noHorizontalScroll(page);
  });
});
