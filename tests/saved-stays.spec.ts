import { expect, test, type BrowserContext, type Page, type Route } from "@playwright/test";
import { SAVED_STAYS_COPY } from "../lib/copy/saved-stays";
import { fill } from "../lib/journey-format";

// Plan 06-07 Task 4: the heart and Share on the real pages, with /api/saved-stays answered here. No database. Written, NOT run (owner
// rule 2026-10-21). The account card needs a session: tests/saved-stays-route.test.mjs checks its source.

const STAY = "getsemani-colonial-house";
const TITLE = "Getsemaní Colonial House";
const STAY_PATH = `/en/private-stays/${STAY}`;
const HINT = { name: "almar-signed-in", value: "1", url: "http://127.0.0.1" };
const en = SAVED_STAYS_COPY.en;
const WIDTHS = [390, 834, 1440];

const reply = (route: Route, status: number, json: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });

type Mock = { requests: Array<{ method: string; url: string; body: string | null }> };

/** Answers the endpoint: a GET with `stays`, a write with `write`. Every request is recorded. */
async function mockSaved(page: Page, { stays = [] as string[], write = 200 } = {}): Promise<Mock> {
  const mock: Mock = { requests: [] };
  await page.route("**/api/saved-stays**", (route) => {
    const request = route.request();
    mock.requests.push({ method: request.method(), url: request.url(), body: request.postData() });
    if (request.method() === "GET") return reply(route, 200, { ok: true, signedIn: true, stays });
    if (write !== 200) return reply(route, write, { ok: false, error: { code: "unavailable" } });
    return reply(route, 200, { ok: true, saved: request.method() === "POST" });
  });
  return mock;
}

const signedIn = (context: BrowserContext) => context.addCookies([HINT]);

const heroSave = (page: Page) => page.locator("#content").getByRole("button", { name: fill(en.saveStay, { stay: TITLE }), exact: true });
const heroRemove = (page: Page) => page.locator("#content").getByRole("button", { name: fill(en.removeStay, { stay: TITLE }), exact: true });
const heroSignIn = (page: Page) => page.locator("#content").getByRole("link", { name: fill(en.signInToSave, { stay: TITLE }), exact: true });

/** A stubbed share sheet (or none), set before the page's own scripts run. */
async function stubShare(page: Page, kind: "native" | "none") {
  await page.addInitScript((mode) => {
    const nav = window.navigator as Navigator & { __shared?: unknown[] };
    if (mode === "native") {
      nav.__shared = [];
      Object.defineProperty(nav, "share", { configurable: true, value: async (data: unknown) => void nav.__shared?.push(data) });
      Object.defineProperty(nav, "canShare", { configurable: true, value: () => true });
    } else {
      Object.defineProperty(nav, "share", { configurable: true, value: undefined });
    }
  }, kind);
}

test.describe("the heart", () => {
  for (const width of WIDTHS) {
    test(`signed out at ${width}: no request, and the heart is a link to sign-in`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const mock = await mockSaved(page);
      await page.goto(STAY_PATH);
      await expect(heroSignIn(page)).toHaveAttribute("href", `/en/login?return=stay&stay=${STAY}`);
      await page.waitForLoadState("networkidle");
      expect(mock.requests).toEqual([]);
    });
  }

  test("signed out on the list: each card's heart is a link beside the card's link, never inside it", async ({ page }) => {
    await mockSaved(page);
    await page.goto("/en/private-stays");
    const heart = page.getByRole("link", { name: fill(en.signInToSave, { stay: TITLE }), exact: true });
    await expect(heart).toHaveAttribute("href", `/en/login?return=stay&stay=${STAY}`);
    await expect(heart.locator("xpath=ancestor::a")).toHaveCount(0);
    await expect(page.getByRole("link", { name: TITLE, exact: true })).toHaveAttribute("href", STAY_PATH);
  });

  test("a tap while signed out stores the intent and opens sign-in", async ({ page }) => {
    await mockSaved(page);
    await page.goto(STAY_PATH);
    await heroSignIn(page).click();
    await page.waitForURL(`**/en/login?return=stay&stay=${STAY}`);
    const stored = await page.evaluate(() => window.localStorage.getItem("almar-save-intent"));
    expect(JSON.parse(stored ?? "{}").stay).toBe(STAY);
  });

  test("signed in and saved: filled on the stay page and on the same stay's card, with the word Saved on the stay page", async ({ page, context }) => {
    await signedIn(context);
    const mock = await mockSaved(page, { stays: [STAY] });
    await page.goto(STAY_PATH);
    await expect(heroRemove(page)).toBeVisible();
    await expect(heroRemove(page)).toContainText(en.saved);
    await expect(heroRemove(page).locator("svg")).toHaveAttribute("fill", "currentColor");
    expect(mock.requests.filter((r) => r.method === "GET")).toHaveLength(1);

    await page.goto("/en/private-stays");
    const card = page.getByRole("button", { name: fill(en.removeStay, { stay: TITLE }), exact: true });
    await expect(card).toBeVisible();
    await expect(card).not.toContainText(en.saved);
  });

  test("one GET per page, however many hearts it has", async ({ page, context }) => {
    await signedIn(context);
    const mock = await mockSaved(page);
    await page.goto("/en/private-stays");
    await expect(page.getByRole("button", { name: fill(en.saveStay, { stay: TITLE }), exact: true })).toBeVisible();
    expect(mock.requests.filter((r) => r.method === "GET")).toHaveLength(1);
  });

  test("not saved: the outline; a tap sends only the slug, and a second tap removes it", async ({ page, context }) => {
    await signedIn(context);
    const mock = await mockSaved(page);
    await page.goto(STAY_PATH);
    await expect(heroSave(page).locator("svg")).toHaveAttribute("fill", "none");
    await heroSave(page).click();
    await expect(heroRemove(page)).toBeVisible();
    const post = mock.requests.find((r) => r.method === "POST");
    expect(post?.body).toBe(JSON.stringify({ stay: STAY }));

    await heroRemove(page).click();
    await expect(heroSave(page)).toBeVisible();
    expect(mock.requests.find((r) => r.method === "DELETE")?.url).toContain(`/api/saved-stays?stay=${STAY}`);
  });

  test("a failed save: the heart goes back to the outline and the notice says so", async ({ page, context }) => {
    await signedIn(context);
    await mockSaved(page, { write: 500 });
    await page.goto(STAY_PATH);
    await heroSave(page).click();
    await expect(page.getByText(en.saveFailed)).toBeVisible();
    await expect(heroSave(page)).toBeVisible();
  });

  test("a 401 on a tap: the hearts offer sign-in again", async ({ page, context }) => {
    await signedIn(context);
    await mockSaved(page, { write: 401 });
    await page.goto(STAY_PATH);
    await heroSave(page).click();
    await expect(heroSignIn(page)).toBeVisible();
  });

  test("back from the sign-in link: one POST on load, the heart filled, and the notice; the intent is gone", async ({ page, context }) => {
    await signedIn(context);
    await page.addInitScript((stay) => {
      if (window.sessionStorage.getItem("seeded")) return;
      window.sessionStorage.setItem("seeded", "1");
      window.localStorage.setItem("almar-save-intent", JSON.stringify({ stay, at: Date.now() }));
    }, STAY);
    const mock = await mockSaved(page);
    await page.goto(STAY_PATH);
    await expect(page.getByText(en.savedNotice)).toBeVisible();
    await expect(heroRemove(page)).toBeVisible();
    expect(mock.requests.filter((r) => r.method === "POST")).toEqual([expect.objectContaining({ body: JSON.stringify({ stay: STAY }) })]);
    expect(await page.evaluate(() => window.localStorage.getItem("almar-save-intent"))).toBeNull();
  });

  test("an intent older than an hour saves nothing", async ({ page, context }) => {
    await signedIn(context);
    await page.addInitScript((stay) => {
      window.localStorage.setItem("almar-save-intent", JSON.stringify({ stay, at: Date.now() - 3_600_001 }));
    }, STAY);
    const mock = await mockSaved(page);
    await page.goto(STAY_PATH);
    await expect(heroSave(page)).toBeVisible();
    expect(mock.requests.filter((r) => r.method === "POST")).toHaveLength(0);
  });

  test("Arabic: right to left, the word beside the heart, the sign-in link in the page's language", async ({ page }) => {
    await mockSaved(page);
    await page.goto(`/ar/private-stays/${STAY}`);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const heart = page.locator(`#content a[href="/ar/login?return=stay&stay=${STAY}"]`).first();
    await expect(heart).toContainText(SAVED_STAYS_COPY.ar.save);
  });

  test("the new controls have square corners and no gold fill or text", async ({ page }) => {
    await stubShare(page, "none");
    await mockSaved(page);
    await page.goto(STAY_PATH);
    const controls = page.locator(`#content a[href*="return=stay"], #content button:has-text("${en.copy}"), #content a[href^="https://wa.me/?text="]`);
    await expect(controls.first()).toBeVisible();
    const looks = await controls.evaluateAll((nodes) => nodes.map((node) => {
      const style = getComputedStyle(node);
      return { radius: style.borderTopLeftRadius, background: style.backgroundColor, color: style.color };
    }));
    expect(looks.length).toBeGreaterThanOrEqual(3);
    for (const look of looks) {
      expect(look.radius).toBe("0px");
      expect(look.background).not.toBe("rgb(212, 186, 138)");
      expect(look.color).not.toBe("rgb(212, 186, 138)");
    }
  });
});

test.describe("Share", () => {
  for (const width of WIDTHS) {
    test(`with a share sheet at ${width}: one Share button, called with the canonical address`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await stubShare(page, "native");
      await mockSaved(page);
      await page.goto(`${STAY_PATH}?utm_source=leak#gallery`);
      await page.locator("#content").getByRole("button", { name: en.share, exact: true }).click();
      const shared = await page.evaluate(() => (window.navigator as Navigator & { __shared?: Array<{ url: string; title: string }> }).__shared);
      expect(shared).toHaveLength(1);
      expect(shared?.[0].title).toBe(TITLE);
      expect(shared?.[0].url).toMatch(new RegExp(`/en/private-stays/${STAY}$`));
      await expect(page.locator("#content").getByRole("button", { name: en.copy, exact: true })).toHaveCount(0);
    });

    test(`no share sheet at ${width}: Copy link and a wa.me link with the name and address, no number`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await stubShare(page, "none");
      await mockSaved(page);
      await page.goto(STAY_PATH);
      await expect(page.locator("#content").getByRole("button", { name: en.copy, exact: true })).toBeVisible();
      const whatsapp = page.locator("#content").getByRole("link", { name: en.shareOn, exact: true });
      const href = (await whatsapp.getAttribute("href")) ?? "";
      expect(href.startsWith("https://wa.me/?text=")).toBe(true);
      const text = decodeURIComponent(href.slice("https://wa.me/?text=".length));
      expect(text).toContain(TITLE);
      expect(text).toMatch(new RegExp(`/en/private-stays/${STAY}$`));
      await expect(page.locator("#content").getByRole("button", { name: en.share, exact: true })).toHaveCount(0);
    });
  }

  test("a share that fails for any reason but her closing the sheet falls back; closing it does not", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(window.navigator, "canShare", { configurable: true, value: () => true });
      Object.defineProperty(window.navigator, "share", {
        configurable: true,
        value: async () => {
          const calls = Number(window.sessionStorage.getItem("shareCalls") ?? "0") + 1;
          window.sessionStorage.setItem("shareCalls", String(calls));
          throw new DOMException("no", calls === 1 ? "AbortError" : "NotAllowedError");
        },
      });
    });
    await mockSaved(page);
    await page.goto(STAY_PATH);
    const share = page.locator("#content").getByRole("button", { name: en.share, exact: true });
    await share.click();
    await expect(share).toBeVisible();
    await share.click();
    await expect(page.locator("#content").getByRole("link", { name: en.shareOn, exact: true })).toBeVisible();
  });

  test("Spanish fallback reads as signed", async ({ page }) => {
    await stubShare(page, "none");
    await mockSaved(page);
    await page.goto(`/es/private-stays/${STAY}`);
    await expect(page.locator("#content").getByRole("button", { name: SAVED_STAYS_COPY.es.copy, exact: true })).toBeVisible();
    await expect(page.locator("#content").getByRole("link", { name: SAVED_STAYS_COPY.es.shareOn, exact: true })).toBeVisible();
  });
});
