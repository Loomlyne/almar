import { test, expect, type Page } from "@playwright/test";

const url = (c: string, s: string, l = "en") => `/__harness?c=${c}&s=${s}&l=${l}`;
const day = (page: Page, dmy: string) => page.locator(`button[aria-label^="${dmy}"]`);

test.describe("DateRangePanel", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("first click sets arrival, second sets departure and the line shows nights", async ({ page }) => {
    await page.goto(url("date-range-panel", "empty"));
    await day(page, "12/10/2026").click();
    await expect(day(page, "12/10/2026")).toHaveAttribute("aria-label", /arrival/);
    await expect(page.locator("[aria-live=polite]")).toContainText("12/10/2026");
    await day(page, "17/10/2026").click();
    await expect(day(page, "17/10/2026")).toHaveAttribute("aria-label", /departure/);
    await expect(day(page, "14/10/2026")).toHaveAttribute("aria-label", /in your stay/);
    await expect(page.locator("[aria-live=polite]")).toContainText("5 nights");
  });

  test("clicking before arrival resets arrival; never a zero-night stay", async ({ page }) => {
    await page.goto(url("date-range-panel", "arrival-only"));
    await day(page, "10/10/2026").click();
    await expect(day(page, "10/10/2026")).toHaveAttribute("aria-label", /arrival/);
    await expect(day(page, "12/10/2026")).not.toHaveAttribute("aria-label", /arrival/);
    await day(page, "10/10/2026").click();
    await expect(day(page, "10/10/2026")).toHaveAttribute("aria-label", /arrival/);
    await expect(page.locator("[aria-live=polite]")).not.toContainText("night");
  });

  test("past day is aria-disabled and cannot be picked", async ({ page }) => {
    await page.goto(url("date-range-panel", "past-days"));
    const past = day(page, "28/09/2026");
    await expect(past).toHaveAttribute("aria-disabled", "true");
    await expect(past).toHaveAttribute("aria-label", /unavailable/);
    await past.click({ force: true });
    await expect(page.locator("[aria-live=polite]")).toHaveText(/arrival date/);
    await expect(day(page, "29/09/2026")).toHaveAttribute("aria-label", /today/);
  });

  test("Previous month is disabled on the current month", async ({ page }) => {
    await page.goto(url("date-range-panel", "empty"));
    const prev = page.getByRole("button", { name: "Previous month" });
    await expect(prev).toBeDisabled();
    await page.getByRole("button", { name: "Next month" }).click();
    await expect(prev).toBeEnabled();
  });

  test("weeks start Monday", async ({ page }) => {
    await page.goto(url("date-range-panel", "one-month"));
    const heads = page.getByRole("columnheader");
    await expect(heads.first()).toHaveText(/^Mon/);
    await expect(heads.nth(6)).toHaveText(/^Sun/);
  });

  test("two months on desktop, one in the one-month scene", async ({ page }) => {
    await page.goto(url("date-range-panel", "two-months"));
    await expect(page.getByRole("grid")).toHaveCount(2);
    await page.goto(url("date-range-panel", "one-month"));
    await expect(page.getByRole("grid")).toHaveCount(1);
  });

  test("keyboard: arrows, Home, End, PageDown move focus; Enter picks", async ({ page }) => {
    await page.goto(url("date-range-panel", "empty"));
    await day(page, "30/09/2026").focus();
    await page.keyboard.press("ArrowRight");
    await expect(day(page, "01/10/2026")).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(day(page, "08/10/2026")).toBeFocused();
    await page.keyboard.press("Home");
    await expect(day(page, "05/10/2026")).toBeFocused();
    await page.keyboard.press("End");
    await expect(day(page, "11/10/2026")).toBeFocused();
    await page.keyboard.press("PageDown");
    await expect(day(page, "11/11/2026")).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(day(page, "11/11/2026")).toHaveAttribute("aria-label", /arrival/);
  });

  test("ar: rtl, Western numerals, mirrored previous chevron", async ({ page }) => {
    await page.goto(url("date-range-panel", "range", "ar"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(day(page, "12/10/2026")).toBeVisible();
    await expect(page.locator("[aria-live=polite]")).toContainText("12/10/2026");
    const scale = await page.locator("button:has(svg)").first().locator("svg").evaluate((el) => getComputedStyle(el).scale);
    // In LTR the previous chevron is mirrored (-100%); in RTL it must not be.
    expect(scale).not.toMatch(/^-/);
  });

  test("en: previous chevron is mirrored", async ({ page }) => {
    await page.goto(url("date-range-panel", "empty"));
    const scale = await page
      .getByRole("button", { name: "Previous month" })
      .locator("svg")
      .evaluate((el) => getComputedStyle(el).scale);
    expect(scale).toMatch(/^-/);
  });
});

test.describe("GuestPanel", () => {
  test("adults minus disabled at 1, plus increments, summary follows", async ({ page }) => {
    await page.goto(url("guest-panel", "default"));
    const summary = page.getByTestId("guest-summary");
    await expect(page.getByRole("button", { name: "Remove adult" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Remove child" })).toBeDisabled();
    await expect(summary).toHaveText("1 adult");
    await page.getByRole("button", { name: "Add adult" }).click();
    await expect(summary).toHaveText("2 adults");
    await page.getByRole("button", { name: "Add child" }).click();
    await page.getByRole("button", { name: "Add infant" }).click();
    await expect(summary).toContainText("2 adults");
    await expect(summary).toContainText("1 child");
    await expect(summary).toContainText("1 infant");
    await page.getByRole("button", { name: "Remove adult" }).click();
    await expect(page.getByRole("button", { name: "Remove adult" })).toBeDisabled();
  });

  test("no maximum", async ({ page }) => {
    await page.goto(url("guest-panel", "filled"));
    for (let i = 0; i < 12; i += 1) await page.getByRole("button", { name: "Add child" }).click();
    await expect(page.getByRole("button", { name: "Add child" })).toBeEnabled();
    await expect(page.getByText("At least 1 adult")).toBeVisible();
  });

  test("ar: summary uses Western digits", async ({ page }) => {
    await page.goto(url("guest-panel", "filled", "ar"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await page.getByRole("button").filter({ has: page.locator("span", { hasText: "+" }) }).first().click();
    const text = (await page.getByTestId("guest-summary").textContent()) ?? "";
    expect(text).toMatch(/3/);
    expect(text).not.toMatch(/[٠-٩]/);
  });
});

test.describe("DestinationMenu", () => {
  test("Down and Up move the active option; Home and End jump", async ({ page }) => {
    await page.goto(url("destination-menu", "default"));
    const options = page.getByRole("option");
    await expect(options).toHaveCount(5);
    await options.first().focus();
    await page.keyboard.press("ArrowDown");
    await expect(options.nth(1)).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(options.nth(0)).toBeFocused();
    await page.keyboard.press("End");
    await expect(options.nth(4)).toBeFocused();
    await page.keyboard.press("Home");
    await expect(options.nth(0)).toBeFocused();
  });

  test("typeahead lands on Bogotá; Enter selects", async ({ page }) => {
    await page.goto(url("destination-menu", "default"));
    await page.getByRole("option").first().focus();
    await page.keyboard.press("b");
    await expect(page.getByRole("option", { name: /Bogotá/ })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("option", { name: /Bogotá/ })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("option", { selected: true })).toHaveCount(1);
  });

  test("selected row has the check; no Packages line", async ({ page }) => {
    await page.goto(url("destination-menu", "selected"));
    const sel = page.getByRole("option", { selected: true });
    await expect(sel).toContainText("Cartagena");
    await expect(sel.locator("svg")).toHaveCount(1);
    await expect(page.getByText(/Packages/)).toHaveCount(0);
    await expect(page.getByText("[Short line]").first()).toBeVisible();
  });

  test("empty and loading states", async ({ page }) => {
    await page.goto(url("destination-menu", "empty"));
    await expect(page.getByText("No destinations to show.")).toBeVisible();
    await page.goto(url("destination-menu", "loading"));
    await expect(page.getByTestId("menu-loading").locator("> div")).toHaveCount(3);
  });

  test("ar: rtl and check mirrored", async ({ page }) => {
    await page.goto(url("destination-menu", "selected", "ar"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const scale = await page.getByRole("option", { selected: true }).locator("svg").evaluate((el) => getComputedStyle(el).scale);
    expect(scale).toMatch(/^-/);
  });
});

test("every icon-only button in the panels has an accessible name", async ({ page }) => {
  for (const [c, s] of [
    ["date-range-panel", "two-months"],
    ["guest-panel", "filled"],
    ["destination-menu", "selected"],
  ]) {
    await page.goto(url(c, s));
    await expect(page.getByTestId("harness-panel")).toBeVisible();
    const unnamed = await page.locator("#harness-root button").evaluateAll((els) =>
      els.filter((e) => !(e.getAttribute("aria-label") || (e.textContent ?? "").replace(/[−+]/g, "").trim())).length,
    );
    expect(unnamed, `${c}/${s}`).toBe(0);
  }
});
