import { test, expect, type Page } from "@playwright/test";

const url = (c: string, s: string, l = "en") => `/__harness?c=${c}&s=${s}&l=${l}`;
const bar = (p: Page) => p.getByRole("search");
const seg = (p: Page, i: 0 | 1 | 2) => bar(p).locator("button").nth(i);
const searchBtn = (p: Page) => bar(p).locator("button").nth(3);
const day = (p: Page, dmy: string) => p.locator(`button[aria-label^="${dmy}"]`);
const alertOf = (p: Page) => p.locator("p[role=alert]");
const calls = (p: Page) => p.getByTestId("search-calls");
const px = (p: Page, sel: string, prop: string) =>
  p.locator(sel).first().evaluate((e, k) => getComputedStyle(e).getPropertyValue(k), prop);

test.describe("JourneyBar hero", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("hero: 72px, 2px gold top rule, teal enabled Search with a glyph", async ({ page }) => {
    await page.goto(url("journey-bar", "empty"));
    const form = bar(page);
    await expect(form).toHaveAttribute("aria-label", "Plan a journey");
    expect(await form.evaluate((e) => getComputedStyle(e).height)).toBe("72px");
    expect(await form.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("2px");
    expect(await form.evaluate((e) => getComputedStyle(e).borderTopColor)).toBe("rgb(212, 186, 138)");
    const s = searchBtn(page);
    await expect(s).toBeEnabled();
    await expect(s).toHaveText("Search");
    expect(await s.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(31, 59, 64)");
    await expect(s.locator("svg")).toHaveCount(1);
  });

  test("segments grow 2:3:2 and are separated by 1px dividers", async ({ page }) => {
    await page.goto(url("journey-bar", "empty"));
    const w = async (i: 0 | 1 | 2) => (await seg(page, i).boundingBox())!.width;
    const [a, b, c] = [await w(0), await w(1), await w(2)];
    expect(Math.abs(a - c)).toBeLessThan(2);
    expect(b / a).toBeGreaterThan(1.4);
    expect(b / a).toBeLessThan(1.6);
    expect(await bar(page).locator("span.w-px").count()).toBe(2);
  });

  test("hover puts the segment on the surface colour", async ({ page }) => {
    await page.goto(url("journey-bar", "hover"));
    await seg(page, 0).hover();
    await expect(seg(page, 0)).toHaveCSS("background-color", "rgb(255, 255, 255)");
  });

  test("Search with nothing set: both Missing, one alert, focus on Destination, no panel, no call", async ({ page }) => {
    await page.goto(url("journey-bar", "empty"));
    await searchBtn(page).click();
    await expect(alertOf(page)).toHaveCount(1);
    await expect(alertOf(page)).toHaveText("Choose a destination and dates to search.");
    await expect(seg(page, 0)).toHaveAttribute("aria-invalid", "true");
    await expect(seg(page, 1)).toHaveAttribute("aria-invalid", "true");
    const id = await alertOf(page).getAttribute("id");
    await expect(seg(page, 0)).toHaveAttribute("aria-describedby", id!);
    await expect(seg(page, 0)).toBeFocused();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByRole("group", { name: "Choose dates" })).toHaveCount(0);
    await expect(calls(page)).toHaveText("0");
    expect(await seg(page, 0).evaluate((e) => getComputedStyle(e).boxShadow)).not.toBe("none");
  });

  test("Destination only: dates message, Dates Missing and focused", async ({ page }) => {
    await page.goto(url("journey-bar", "destination"));
    await searchBtn(page).click();
    await expect(alertOf(page)).toHaveText("Choose arrival and departure to search.");
    await expect(seg(page, 0)).not.toHaveAttribute("aria-invalid", "true");
    await expect(seg(page, 1)).toHaveAttribute("aria-invalid", "true");
    await expect(seg(page, 1)).toBeFocused();
    await expect(calls(page)).toHaveText("0");
  });

  test("all set: Search calls onSearch once, no alert", async ({ page }) => {
    await page.goto(url("journey-bar", "filled"));
    await expect(seg(page, 1)).toContainText("12/10/2026 – 17/10/2026");
    await expect(seg(page, 2)).toContainText("2 adults");
    await searchBtn(page).click();
    await expect(calls(page)).toHaveText("1 cartagena");
    await expect(alertOf(page)).toHaveCount(0);
  });

  test("arrival only reads 'Add date' for the departure", async ({ page }) => {
    await page.goto(url("journey-bar", "arrival"));
    await expect(seg(page, 1)).toContainText("12/10/2026 – Add date");
  });

  test("flow: pick destination, Dates opens, Done, Guests opens, Done closes; alert clears when fixed", async ({ page }) => {
    await page.goto(url("journey-bar", "empty"));
    await searchBtn(page).click();
    await expect(alertOf(page)).toBeVisible();
    await seg(page, 0).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.getByRole("option", { name: /Cartagena/ }).click();
    await expect(page.getByRole("group", { name: "Choose dates" })).toBeVisible();
    await expect(alertOf(page)).toHaveText("Choose arrival and departure to search.");
    await day(page, "12/10/2026").click();
    await day(page, "17/10/2026").click();
    await expect(alertOf(page)).toHaveCount(0);
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("group", { name: "Guests" })).toBeVisible();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(page.getByRole("group", { name: "Guests" })).toHaveCount(0);
    await expect(seg(page, 0)).toContainText("Cartagena");
    await expect(seg(page, 1)).toContainText("12/10/2026 – 17/10/2026");
    await searchBtn(page).click();
    await expect(calls(page)).toHaveText("1 cartagena");
  });

  test("Escape closes the panel and returns focus to its segment", async ({ page }) => {
    await page.goto(url("journey-bar", "empty"));
    await seg(page, 2).click();
    await expect(page.getByRole("group", { name: /Guests/ }).last()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Done" })).toHaveCount(0);
    await expect(seg(page, 2)).toBeFocused();
  });

  test("outside click closes the panel; clicking the open segment toggles it", async ({ page }) => {
    await page.goto(url("journey-bar", "open-where"));
    await expect(page.getByRole("listbox")).toBeVisible();
    // Radix arms its outside-click listener a tick after mount; retry until armed.
    await expect(async () => {
      await page.mouse.click(20, 850);
      await expect(page.getByRole("listbox")).toHaveCount(0, { timeout: 500 });
    }).toPass({ timeout: 5000 });
    await seg(page, 0).click();
    await expect(page.getByRole("listbox")).toBeVisible();
    await seg(page, 0).click();
    await expect(page.getByRole("listbox")).toHaveCount(0);
  });

  test("desktop: destination menu is w-menu under its segment; calendar has two months centred on Dates", async ({ page }) => {
    await page.goto(url("journey-bar", "open-when"));
    await expect(page.getByRole("grid")).toHaveCount(2);
    const panel = page.getByRole("group", { name: "Choose dates" });
    const p = (await panel.boundingBox())!;
    const t = (await seg(page, 1).boundingBox())!;
    expect(Math.abs(p.x + p.width / 2 - (t.x + t.width / 2))).toBeLessThan(3);
    expect(p.y).toBeGreaterThanOrEqual(t.y + t.height);
    await page.goto(url("journey-bar", "open-where"));
    const m = (await page.getByRole("listbox").locator("xpath=..").boundingBox())!;
    const d = (await seg(page, 0).boundingBox())!;
    expect(Math.round(m.width)).toBe(440);
    expect(Math.abs(m.x - d.x)).toBeLessThan(3);
  });

  test("desktop: guest picker is w-menu centred on Guests", async ({ page }) => {
    await page.goto(url("journey-bar", "open-guests"));
    const g = (await page.getByRole("group", { name: /Guests/ }).last().boundingBox())!;
    const t = (await seg(page, 2).boundingBox())!;
    expect(Math.round(g.width)).toBe(440);
    expect(Math.abs(g.x + g.width / 2 - (t.x + t.width / 2))).toBeLessThan(3);
  });

  test("tablet: one month, panel takes the bar's full width", async ({ page }) => {
    await page.setViewportSize({ width: 834, height: 900 });
    await page.goto(url("journey-bar", "tablet-open-when"));
    await expect(page.getByRole("grid")).toHaveCount(1);
    const p = (await page.getByRole("group", { name: "Choose dates" }).boundingBox())!;
    const f = (await bar(page).boundingBox())!;
    expect(Math.abs(p.width - f.width)).toBeLessThan(3);
    expect(Math.abs(p.x - f.x)).toBeLessThan(3);
  });

  test("docked: h-bar-docked without a shadow", async ({ page }) => {
    await page.goto(url("journey-bar", "docked-static"));
    const form = bar(page);
    expect(await form.evaluate((e) => getComputedStyle(e).height)).toBe("56px");
    expect(await form.evaluate((e) => getComputedStyle(e).boxShadow)).toBe("none");
    expect(await form.evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("2px");
    await seg(page, 1).click();
    await expect(page.getByRole("group", { name: "Choose dates" })).toBeVisible();
  });

  test("docked appears once the hero scrolls out of view", async ({ page }) => {
    await page.goto(url("journey-bar", "docked"));
    await expect(page.getByRole("search")).toHaveCount(1);
    await page.evaluate(() => window.scrollTo(0, 900));
    await expect(page.getByRole("search")).toHaveCount(2);
    const docked = page.getByRole("search").first();
    expect(await docked.evaluate((e) => getComputedStyle(e).height)).toBe("56px");
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByRole("search")).toHaveCount(1);
  });

  test("summary: read-only values, nights, Edit search at the end", async ({ page }) => {
    await page.goto(url("journey-bar", "summary"));
    const g = page.getByRole("group", { name: "Plan a journey" });
    expect(await g.evaluate((e) => getComputedStyle(e).height)).toBe("64px");
    await expect(g).toContainText("Cartagena");
    await expect(g).toContainText("12/10/2026 – 17/10/2026 · 5 nights");
    await expect(g).toContainText("2 adults");
    await expect(g.getByRole("button")).toHaveCount(1);
    await expect(g.getByRole("button", { name: "Edit search" })).toBeVisible();
  });

  test("stay bar: destination locked, blocked days unavailable and unpickable", async ({ page }) => {
    await page.goto(url("journey-bar", "stay"));
    await expect(seg(page, 0)).toHaveAttribute("aria-disabled", "true");
    await expect(seg(page, 0)).toContainText("Cartagena");
    await seg(page, 0).click({ force: true });
    await expect(page.getByRole("listbox")).toHaveCount(0);
    const blocked = day(page, "20/10/2026");
    await expect(blocked).toHaveAttribute("aria-disabled", "true");
    await expect(blocked).toHaveAttribute("aria-label", /unavailable/);
    await day(page, "18/10/2026").click();
    await blocked.click({ force: true });
    await expect(page.locator("[aria-live=polite]")).not.toContainText("Leave");
    await day(page, "22/10/2026").click();
    await expect(day(page, "22/10/2026")).toHaveAttribute("aria-label", /arrival/);
  });
});

test.describe("JourneyBar Arabic", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("Destination sits at the inline-start (right) and the Search glyph mirrors", async ({ page }) => {
    await page.goto(url("journey-bar", "filled", "ar"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const d = (await seg(page, 0).boundingBox())!;
    const w = (await seg(page, 1).boundingBox())!;
    const g = (await seg(page, 2).boundingBox())!;
    expect(d.x).toBeGreaterThan(w.x);
    expect(w.x).toBeGreaterThan(g.x);
    const glyph = await searchBtn(page).locator("svg").evaluate((e) => getComputedStyle(e).scale);
    expect(glyph).toBe("-1 1");
  });

  test("Arabic Search with nothing set shows the Arabic alert and focuses Destination", async ({ page }) => {
    await page.goto(url("journey-bar", "empty", "ar"));
    await searchBtn(page).click();
    await expect(alertOf(page)).toHaveCount(1);
    await expect(seg(page, 0)).toHaveAttribute("aria-invalid", "true");
    await expect(seg(page, 0)).toBeFocused();
    await expect(calls(page)).toHaveText("0");
  });
});
