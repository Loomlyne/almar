import { expect, test, type Page, type Route } from "@playwright/test";
import { OPS_NEW_BOOKING_COPY } from "../lib/copy/ops-new-booking";
import { SITE_STATUS } from "./helpers/ops-bookings-api";

// Plan 05-02 Task 3: /dashboard/bookings/new against contract-shaped mocks of /api/ops/*. WRITTEN, NOT RUN (owner's no-test
// rule); the 390, 834 and 1440 walk in EN and AR is the controller's or the UAT's. Symbolic values: every amount is a test
// number in fils, every name a bracket name. /api/ops/site-status is answered, or the ops-mode shell redirects to sign-in.

type Locale = "en" | "ar" | "es";
type Body = Record<string, unknown>;

const STAY_SLUG = "stay-one";
const DESTINATION_ID = "00000000-0000-4000-8000-0000000000d1";
const DESTINATION_TWO = "00000000-0000-4000-8000-0000000000d2";
const HOME_ITEM = "bbbbbbbb-1111-4222-8333-444455556666";

const json = (route: Route, status: number, body: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

function breakdown(grandFils = 315000) {
  // Test numbers only: 3 nights at 1000.00, VAT 5 %, deposit 30 %.
  return {
    nights: [
      { night: "2099-01-10", rateFils: 100000, source: "base" },
      { night: "2099-01-11", rateFils: 100000, source: "base" },
      { night: "2099-01-12", rateFils: 100000, source: "base" },
    ],
    nightCount: 3,
    nightsFils: 300000,
    lines: [],
    addonsFils: 0,
    subtotalFils: 300000,
    vatBp: 500,
    vatFils: 15000,
    grandFils,
    depositBp: 3000,
    deposit: { dueNowFils: 94500, balanceFils: 220500, balanceDueDate: "2098-12-11" },
    depositBlock: null,
    full: { dueNowFils: 315000 },
    plan: "deposit",
    dueNowFils: 94500,
    balanceFils: 220500,
    balanceDueDate: "2098-12-11",
  };
}

type Setup = {
  hasRate?: boolean;
  realOpen?: boolean;
  testOpen?: boolean;
  /** The part after /dashboard/bookings/new, like "?request=<uuid>". */
  search?: string;
  /** A request row for /api/ops/requests. */
  request?: Body;
  /** A taken night the calendar must show as unavailable. */
  taken?: string;
  /** The create call gets no answer at all. */
  dropCreate?: boolean;
};

/** The calendar's data-date key as date-range-panel writes it: year-month-day, not padded. */
const dateKey = (iso: string) => iso.split("-").map(Number).join("-");
const plus = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function openNew(page: Page, locale: Locale, setup: Setup = {}) {
  const { hasRate = true, realOpen = true, testOpen = true } = setup;
  const creates: Body[] = [];
  const quotes: Body[] = [];
  const ctl = { shift: false };
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: "http://127.0.0.1" }]);
  await page.route("**/api/ops/site-status", (route) => json(route, 200, { ok: true, site: SITE_STATUS }));
  await page.route(/\/api\/ops\/destinations(\?.*)?$/, (route) =>
    json(route, 200, { ok: true, items: [
        { id: DESTINATION_ID, slug: "destination-one", name_en: "[Destination one]", name_ar: "[Destination one AR]", name_es: "[Destination one ES]", is_published: true, position: 1 },
        { id: DESTINATION_TWO, slug: "destination-two", name_en: "[Destination two]", name_ar: "[Destination two AR]", name_es: "[Destination two ES]", is_published: true, position: 2 },
      ],
    }),
  );
  await page.route(/\/api\/ops\/stays(\?.*)?$/, (route) =>
    json(route, 200, {
      ok: true,
      items: [
        { id: "s1", slug: STAY_SLUG, title_en: "[Stay one]", destination_id: DESTINATION_ID, destination_name_en: "[Destination one]", is_published: true, position: 1 },
        { id: "s2", slug: "stay-two", title_en: "[Stay two]", destination_id: DESTINATION_TWO, destination_name_en: "[Destination two]", is_published: true, position: 2 },
      ],
    }),
  );
  await page.route(/\/api\/ops\/requests(\?.*)?$/, (route) => json(route, 200, { ok: true, items: setup.request ? [setup.request] : [] }));
  await page.route("**/api/ops/booking/availability", (route) => {
    const sent = route.request().postDataJSON() as Body;
    // The year-ahead call (the calendar) sees the taken night; a range call sees it only when the range holds it.
    const holds = setup.taken !== undefined && (sent.from as string) <= setup.taken && setup.taken < (sent.to as string);
    return json(route, 200, { ok: true, stay: null, blocked: [], taken: holds && setup.taken ? [setup.taken] : [], has_rate: hasRate });
  });
  await page.route("**/api/ops/booking/quote", (route) => {
    const sent = route.request().postDataJSON() as Body;
    quotes.push(sent);
    const agreed = sent.agreed_amount;
    const needsAgreed = !hasRate && agreed === null;
    return json(route, 200, {
      ok: true,
      reasons: needsAgreed ? [{ code: "no_rate" }] : [],
      stay: { slug: STAY_SLUG, title: "[Stay one]", destinationName: "[Destination one]", image: null, maxGuests: 6, minNights: 2, infantsCount: false },
      offers: [{ id: HOME_ITEM, slug: "home-pickup", kind: "service", unit: "trip", isUae: true, isHomePickup: false, name: "[Service one]", image: null, priceFils: 25000 }],
      breakdown: needsAgreed ? null : breakdown(ctl.shift ? 400000 : 315000),
      needs_agreed: needsAgreed,
      real_open: realOpen,
      test_open: testOpen,
    });
  });
  await page.route("**/api/ops/booking/create", (route) => {
    creates.push(route.request().postDataJSON() as Body);
    if (setup.dropCreate) return route.abort();
    return json(route, 200, { ok: true, booking_id: "b1", ref: "ALMAR-ABCDEF", hold_expires_at: "2099-01-01T10:00:00.000Z", link_version: 1, mail: "sent" });
  });
  await page.goto(`/dashboard/bookings/new${setup.search ?? ""}`);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.locator("[data-new-booking]")).toBeVisible({ timeout: 30_000 });
  return { creates, quotes, ctl };
}

async function fillGuest(page: Page, locale: Locale) {
  const c = OPS_NEW_BOOKING_COPY[locale];
  await page.getByLabel(c.guest.name, { exact: true }).fill("[Guest name]");
  await page.getByLabel(c.guest.email, { exact: true }).fill("Guest@Example.com");
  await page.getByLabel(c.guest.phone, { exact: true }).fill("+971 50 000 0000");
  await page.getByRole("button", { name: c.continue }).first().click();
}

async function pickDays(page: Page, first: string, last: string) {
  for (const day of [first, last]) {
    const cell = page.locator(`[data-date="${dateKey(day)}"]`);
    for (let i = 0; i < 4 && (await cell.count()) === 0; i += 1) {
      await page.getByRole("button", { name: /next|التالي|siguiente/i }).first().click();
    }
    await cell.first().click();
  }
}

async function chooseStayAndDates(page: Page, locale: Locale) {
  const c = OPS_NEW_BOOKING_COPY[locale];
  await page.locator("#nb-stay").click();
  await page.getByRole("option", { name: "[Stay one]" }).click();
  // The calendar opens on the current month; two days 40 and 43 days ahead are picked by their data-date, paging forward.
  await pickDays(page, plus(40), plus(43));
  await page.getByRole("button", { name: c.continue }).first().click();
}

async function toPayment(page: Page, locale: Locale) {
  const c = OPS_NEW_BOOKING_COPY[locale];
  await fillGuest(page, locale);
  await chooseStayAndDates(page, locale);
  await page.getByRole("button", { name: c.continue }).first().click();
}

test("the happy path reaches Create and posts the server's choices with a request id, the email lowercased, +04:00 and no money", async ({ page }) => {
  const c = OPS_NEW_BOOKING_COPY.en;
  const { creates } = await openNew(page, "en");
  await toPayment(page, "en");
  await page.locator("#nb-hold-date").fill("2099-01-01");
  await page.locator("#nb-hold-time").fill("14:30");
  await page.getByRole("button", { name: c.continue }).first().click();
  await page.getByRole("checkbox", { name: c.review.test }).check();
  const create = page.getByRole("button", { name: c.review.create }).first();
  await expect(create).toBeEnabled();
  await create.click();
  await expect.poll(() => creates.length).toBe(1);
  const body = creates[0];
  expect(typeof body.request_id).toBe("string");
  expect(body.hold_until).toBe("2099-01-01T14:30:00+04:00");
  expect(body.is_test).toBe(true);
  expect(body.plan).toBe("deposit");
  expect((body.guest as Body).email).toBe("guest@example.com");
  for (const key of Object.keys(body)) expect(key, key).not.toMatch(/fils|grand|vat|total|travellers|terms/);
  await expect(page).toHaveURL(/\/dashboard\/bookings\/detail\?ref=ALMAR-ABCDEF/);
});

test("a stay with no rate requires an agreed price and a reason, and the switch cannot be turned off", async ({ page }) => {
  const c = OPS_NEW_BOOKING_COPY.en;
  await openNew(page, "en", { hasRate: false });
  await toPayment(page, "en");
  await expect(page.getByText(c.payment.noRate).first()).toBeVisible();
  await expect(page.getByRole("checkbox", { name: c.payment.agreedToggle })).toHaveCount(0);
  await expect(page.locator("#nb-amount")).toBeVisible();
  await expect(page.locator("#nb-reason")).toBeVisible();
  await page.locator("#nb-hold-date").fill("2099-01-01");
  await page.locator("#nb-hold-time").fill("14:30");
  await page.getByRole("button", { name: c.continue }).first().click();
  await expect(page.getByText(c.payment.amountError)).toBeVisible();
  await expect(page.getByText(c.payment.reasonError)).toBeVisible();
});

test("a closed real gate disables Create and says why; the Test booking tick opens it", async ({ page }) => {
  const c = OPS_NEW_BOOKING_COPY.en;
  await openNew(page, "en", { realOpen: false, testOpen: true });
  await toPayment(page, "en");
  await page.locator("#nb-hold-date").fill("2099-01-01");
  await page.locator("#nb-hold-time").fill("14:30");
  await page.getByRole("button", { name: c.continue }).first().click();
  const create = page.getByRole("button", { name: c.review.create }).first();
  await expect(page.getByText(c.review.gateReal)).toBeVisible();
  await expect(create).toBeDisabled();
  await page.getByRole("checkbox", { name: c.review.test }).check();
  await expect(create).toBeEnabled();
});

test("at ar the page is right to left", async ({ page }) => {
  await openNew(page, "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("[data-new-booking]")).toHaveAttribute("dir", "rtl");
});

test("no radio control, no underlined text, and none of the out-of-scope words are on the screen", async ({ page }) => {
  await openNew(page, "en");
  await toPayment(page, "en");
  await expect(page.getByRole("radio")).toHaveCount(0);
  const underlined = await page.evaluate(() =>
    [...document.querySelectorAll("[data-new-booking] *")].filter((el) => getComputedStyle(el).textDecorationLine.includes("underline")).length,
  );
  expect(underlined).toBe(0);
  const text = (await page.locator("[data-new-booking]").innerText()).toLowerCase();
  for (const word of ["pay later", "draft", "payment link", "record a payment", "notify", "internal note", "booking source", "search customers", "create a customer"]) {
    expect(text, word).not.toContain(word);
  }
});

async function toReview(page: Page, locale: Locale) {
  const c = OPS_NEW_BOOKING_COPY[locale];
  await toPayment(page, locale);
  await page.locator("#nb-hold-date").fill("2099-01-01");
  await page.locator("#nb-hold-time").fill("14:30");
  await page.getByRole("button", { name: c.continue }).first().click();
}

const REQUEST_ID = "11111111-2222-4333-8444-555555555555";

test("a request's dates and guests survive choosing a stay (?request=)", async ({ page }) => {
  const c = OPS_NEW_BOOKING_COPY.en;
  const request = {
    id: REQUEST_ID,
    kind: "plan",
    locale: "en",
    name: "[Guest name]",
    email: "guest@example.com",
    payload: { phone: "+971 50 000 0000", from: plus(40), to: plus(43), guests: 2 },
    created_at: "2026-10-30T10:00:00.000Z",
    handled_at: null,
    handled_by: null,
  };
  const { quotes } = await openNew(page, "en", { search: `?request=${REQUEST_ID}`, request });
  await expect(page.getByLabel(c.guest.name, { exact: true })).toHaveValue("[Guest name]");
  await page.getByRole("button", { name: c.continue }).first().click();
  await page.locator("#nb-stay").click();
  await page.getByRole("option", { name: "[Stay one]" }).click();
  await expect.poll(() => quotes.at(-1)?.from).toBe(plus(40));
  expect(quotes.at(-1)?.to).toBe(plus(43));
  expect(quotes.at(-1)?.adults).toBe(2);
});

test("switching Destination resets a stay that is not in the new list", async ({ page }) => {
  const c = OPS_NEW_BOOKING_COPY.en;
  await openNew(page, "en");
  await fillGuest(page, "en");
  await page.locator("#nb-stay").click();
  await page.getByRole("option", { name: "[Stay one]" }).click();
  await expect(page.locator("#nb-stay")).toContainText("[Stay one]");
  await page.locator("#nb-destination").click();
  await page.getByRole("option", { name: "[Destination two]" }).click();
  await expect(page.locator("#nb-stay")).toContainText(c.stay.choose);
});

test("a taken night may be the checkout day", async ({ page }) => {
  const { quotes } = await openNew(page, "en", { taken: plus(43) });
  await fillGuest(page, "en");
  await page.locator("#nb-stay").click();
  await page.getByRole("option", { name: "[Stay one]" }).click();
  await pickDays(page, plus(40), plus(43));
  await expect.poll(() => quotes.at(-1)?.to).toBe(plus(43));
});

test("no answer to Create says the booking may exist and does not say it was not created", async ({ page }) => {
  const c = OPS_NEW_BOOKING_COPY.en;
  const { creates } = await openNew(page, "en", { dropCreate: true });
  await toReview(page, "en");
  await page.getByRole("checkbox", { name: c.review.test }).check();
  await page.getByRole("button", { name: c.review.create }).first().click();
  await expect(page.getByText(c.problems.noAnswer)).toBeVisible();
  await expect(page.getByText(c.problems.saveFailed)).toHaveCount(0);
  expect(creates.length).toBe(1);
});

test("a price that changed before Create is shown and stops; the next Create sends", async ({ page }) => {
  const c = OPS_NEW_BOOKING_COPY.en;
  const { creates, ctl } = await openNew(page, "en");
  await toReview(page, "en");
  await page.getByRole("checkbox", { name: c.review.test }).check();
  ctl.shift = true;
  await page.getByRole("button", { name: c.review.create }).first().click();
  await expect(page.getByText(/4,?000/).first()).toBeVisible();
  await expect(page.getByText(c.problems.priceChanged.split("{amount}")[0], { exact: false })).toBeVisible();
  expect(creates.length).toBe(0);
  await page.getByRole("button", { name: c.review.create }).first().click();
  await expect.poll(() => creates.length).toBe(1);
  for (const key of Object.keys(creates[0])) expect(key, key).not.toMatch(/fils|grand|vat|total/);
});
