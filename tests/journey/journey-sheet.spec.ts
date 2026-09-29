import { test, expect, type Page } from "@playwright/test";

const url = (s: string, l = "en") => `/__harness?c=journey-sheet&s=${s}&l=${l}`;
const entry = (p: Page) => p.getByTestId("harness-sheet").locator("button").first();
const dialog = (p: Page) => p.getByRole("dialog");
const heading = (p: Page) => dialog(p).getByRole("heading", { level: 2 });
const alertOf = (p: Page) => p.locator("p[role=alert]");
const next = (p: Page, name = "Next") => dialog(p).getByRole("button", { name, exact: true });
const day = (p: Page, dmy: string) => dialog(p).locator(`button[aria-label^="${dmy}"]`);
const calls = (p: Page) => p.getByTestId("search-calls");

test.use({ viewport: { width: 390, height: 844 } });

test.describe("JourneyEntry", () => {
  test("empty entry: title and hint, one button named by its text", async ({ page }) => {
    await page.goto(url("entry-empty"));
    await expect(entry(page)).toHaveText("Plan your journeyWhere · When · Who");
    await expect(page.getByRole("button", { name: "Plan your journey Where · When · Who" })).toHaveCount(1);
    expect(await entry(page).evaluate((e) => getComputedStyle(e).height)).toBe("64px");
    expect(await entry(page).evaluate((e) => getComputedStyle(e).borderTopWidth)).toBe("2px");
    expect(await entry(page).evaluate((e) => getComputedStyle(e).borderTopColor)).toBe("rgb(212, 186, 138)");
    await expect(entry(page).locator("span[aria-hidden=true] svg")).toHaveCount(1);
  });

  test("filled entry: destination, dates and guest summary", async ({ page }) => {
    await page.goto(url("entry-filled"));
    await expect(entry(page)).toContainText("Cartagena · 12/10/2026 – 17/10/2026");
    await expect(entry(page)).toContainText("2 adults");
  });

  test("docked row is 56px with no shadow", async ({ page }) => {
    await page.goto(url("docked-filled"));
    expect(await entry(page).evaluate((e) => getComputedStyle(e).height)).toBe("56px");
    expect(await entry(page).evaluate((e) => getComputedStyle(e).boxShadow)).toBe("none");
  });

  test("docked row opens at the first missing step, or at Where when complete", async ({ page }) => {
    await page.goto(url("docked-partial"));
    await entry(page).click();
    await expect(heading(page)).toHaveText("When?");
    await page.goto(url("docked-filled"));
    await entry(page).click();
    await expect(heading(page)).toHaveText("Where to?");
  });
});

test.describe("JourneySheet", () => {
  test("step 1: named dialog, H2 focused, 1 of 3, Next, three bars", async ({ page }) => {
    await page.goto(url("step-1"));
    await expect(dialog(page)).toHaveAccessibleName("Plan your journey");
    await expect(heading(page)).toHaveText("Where to?");
    await expect(heading(page)).toBeFocused();
    await expect(dialog(page)).toContainText("1 of 3");
    await expect(next(page)).toBeEnabled();
    const bars = dialog(page).locator("[data-bar]");
    await expect(bars).toHaveCount(3);
    expect(await bars.nth(0).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(31, 59, 64)");
    expect(await bars.nth(1).evaluate((e) => getComputedStyle(e).backgroundColor)).not.toBe("rgb(31, 59, 64)");
    expect(await bars.nth(0).evaluate((e) => getComputedStyle(e).height)).toBe("3px");
    expect(await dialog(page).evaluate((e) => getComputedStyle(e).zIndex)).toBe("70");
  });

  test("Back and Close have accessible names of 44px", async ({ page }) => {
    await page.goto(url("step-1"));
    for (const name of ["Back", "Close"]) {
      const b = dialog(page).getByRole("button", { name, exact: true });
      await expect(b).toHaveCSS("width", "44px");
      await expect(b).toHaveCSS("height", "44px");
    }
  });

  test("tapping a destination advances to When by itself", async ({ page }) => {
    await page.goto(url("step-1"));
    await dialog(page).getByRole("option", { name: /Cartagena/ }).click();
    await expect(heading(page)).toHaveText("When?");
    await expect(heading(page)).toBeFocused();
    await expect(dialog(page)).toContainText("2 of 3");
    await expect(dialog(page).getByRole("grid")).toHaveCount(1);
  });

  test("Next on Where with no destination warns and stays", async ({ page }) => {
    await page.goto(url("step-1"));
    await next(page).click();
    await expect(alertOf(page)).toHaveCount(1);
    await expect(alertOf(page)).toHaveText("Choose a destination.");
    await expect(heading(page)).toHaveText("Where to?");
    expect(await alertOf(page).evaluate((e) => getComputedStyle(e).color)).toBe("rgb(143, 45, 45)");
    expect(await alertOf(page).evaluate((e) => getComputedStyle(e).fontWeight)).toBe("700");
  });

  test("When: Next without both dates warns, with both dates moves to Who", async ({ page }) => {
    await page.goto(url("step-2"));
    await next(page).click();
    await expect(alertOf(page)).toHaveText("Choose arrival and departure.");
    await expect(heading(page)).toHaveText("When?");
    await dialog(page).getByRole("button", { name: "Next month" }).click();
    await day(page, "12/10/2026").click();
    await expect(alertOf(page)).toHaveCount(0);
    await next(page).click();
    await expect(alertOf(page)).toHaveText("Choose arrival and departure.");
    await day(page, "17/10/2026").click();
    await expect(dialog(page)).toContainText("12/10/2026");
    await next(page).click();
    await expect(heading(page)).toHaveText("Who's coming?");
    await expect(next(page, "Search")).toBeVisible();
  });

  test("Who: guest rows, no panel footer, Search calls onSearch once", async ({ page }) => {
    await page.goto(url("step-3"));
    await expect(dialog(page).getByRole("group", { name: "Guests" })).toBeVisible();
    await expect(dialog(page).getByRole("button", { name: "Done" })).toHaveCount(0);
    await dialog(page).getByRole("button", { name: "Add child" }).click();
    await next(page, "Search").click();
    await expect(calls(page)).toHaveText("1 cartagena");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("Who with something missing returns to the first missing step with the warning", async ({ page }) => {
    await page.goto(url("step-3-incomplete"));
    await next(page, "Search").click();
    await expect(heading(page)).toHaveText("Where to?");
    await expect(alertOf(page)).toHaveText("Choose a destination.");
    await expect(calls(page)).toHaveText("0");
  });

  test("dock summary and one button; never disabled", async ({ page }) => {
    await page.goto(url("step-3-complete"));
    await expect(dialog(page)).toContainText("2 adults, 1 child, and 1 infant");
    await expect(dialog(page).locator("button[disabled]")).toHaveCount(0);
    expect(await next(page, "Search").evaluate((e) => e.closest("div")!.getBoundingClientRect().height)).toBe(88);
  });

  test("Back steps back, Back on Where closes and focus returns to the entry", async ({ page }) => {
    await page.goto(url("entry-empty"));
    await entry(page).click();
    await dialog(page).getByRole("option", { name: /Cartagena/ }).click();
    await expect(heading(page)).toHaveText("When?");
    await dialog(page).getByRole("button", { name: "Back", exact: true }).click();
    await expect(heading(page)).toHaveText("Where to?");
    await dialog(page).getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(entry(page)).toBeFocused();
    await expect(entry(page)).toContainText("Cartagena");
  });

  test("Close keeps the values and returns focus to the docked row", async ({ page }) => {
    await page.goto(url("docked-empty"));
    await entry(page).click();
    await dialog(page).getByRole("option", { name: /Medellín/ }).click();
    await dialog(page).getByRole("button", { name: "Close", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
    await expect(entry(page)).toBeFocused();
    await expect(entry(page)).toContainText("Medellín");
  });

  test("Escape closes", async ({ page }) => {
    await page.goto(url("step-1"));
    await page.keyboard.press("Escape");
    await expect(dialog(page)).toHaveCount(0);
  });

  test("reduced motion swaps the slide for a fade", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url("step-1"));
    expect(await dialog(page).evaluate((e) => getComputedStyle(e).animationName)).toBe("fade-in");
  });

  test("motion: the sheet slides in", async ({ page }) => {
    await page.goto(url("step-1"));
    expect(await dialog(page).evaluate((e) => getComputedStyle(e).animationName)).toBe("sheet-in");
  });
});

test.describe("Private stay (D-62, D-63)", () => {
  test("lockDestination: sheet starts at When and Back on When closes it", async ({ page }) => {
    await page.goto(url("stay-locked"));
    await expect(heading(page)).toHaveText("When?");
    await expect(dialog(page)).toContainText("2 of 3");
    await dialog(page).getByRole("button", { name: "Back", exact: true }).click();
    await expect(dialog(page)).toHaveCount(0);
  });

  test("blockedDates: blocked days are unavailable, unpickable, and a crossing range restarts", async ({ page }) => {
    await page.goto(url("blocked-when"));
    await expect(heading(page)).toHaveText("When?");
    await dialog(page).getByRole("button", { name: "Next month" }).click();
    const blocked = day(page, "20/10/2026");
    await expect(blocked).toHaveAttribute("aria-disabled", "true");
    await expect(blocked).toHaveAttribute("aria-label", /unavailable/);
    await day(page, "18/10/2026").click();
    await blocked.click({ force: true });
    await expect(day(page, "20/10/2026")).not.toHaveAttribute("aria-label", /arrival|departure|leave/i);
    await day(page, "22/10/2026").click();
    await expect(day(page, "22/10/2026")).toHaveAttribute("aria-label", /arrival/);
  });

  test("locked stay in Arabic: starts at When, RTL", async ({ page }) => {
    await page.goto(url("stay-locked", "ar"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(dialog(page).getByRole("heading", { level: 2 })).not.toHaveText("إلى أين؟");
  });
});

test.describe("Arabic", () => {
  test("entry mirrors and reads in Arabic", async ({ page }) => {
    await page.goto(url("entry-empty", "ar"));
    await expect(entry(page)).toContainText("خطّط لرحلتك");
    expect(await entry(page).evaluate((e) => getComputedStyle(e).direction)).toBe("rtl");
    const btn = (await entry(page).boundingBox())!;
    const arrow = (await entry(page).locator("span[aria-hidden=true]").boundingBox())!;
    expect(arrow.x).toBeLessThan(btn.x + 20);
    const glyph = entry(page).locator("span[aria-hidden=true] svg");
    expect(await glyph.evaluate((e) => getComputedStyle(e).scale)).toBe("-1 1");
  });

  test("sheet: Back chevron points right (start), bars fill from the inline-start, warning in Arabic", async ({ page }) => {
    await page.goto(url("step-1", "ar"));
    await expect(dialog(page)).toHaveAccessibleName("خطّط لرحلتك");
    await expect(heading(page)).toHaveText("إلى أين؟");
    await expect(heading(page)).toBeFocused();
    await expect(dialog(page)).toContainText("1 من 3");
    const back = dialog(page).getByRole("button", { name: "رجوع", exact: true });
    const close = dialog(page).getByRole("button", { name: "إغلاق", exact: true });
    expect((await back.boundingBox())!.x).toBeGreaterThan((await close.boundingBox())!.x);
    expect(await back.locator("svg").evaluate((e) => getComputedStyle(e).scale)).toBe("1");
    const bars = dialog(page).locator("[data-bar]");
    expect((await bars.nth(0).boundingBox())!.x).toBeGreaterThan((await bars.nth(1).boundingBox())!.x);
    expect(await bars.nth(0).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe("rgb(31, 59, 64)");
    await next(page, "التالي").click();
    await expect(alertOf(page)).toHaveText("اختر وجهة.");
  });

  test("Arabic Who step: Search returns and steps work", async ({ page }) => {
    await page.goto(url("step-3", "ar"));
    await expect(heading(page)).toHaveText("من سيأتي؟");
    await next(page, "بحث").click();
    await expect(calls(page)).toHaveText("1 cartagena");
  });
});
