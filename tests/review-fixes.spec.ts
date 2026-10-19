import { expect, test } from "@playwright/test";

// Phase 3.1 code review (03.1-REVIEW.md) W1 to W4: keyboard focus. W5 (the https URL fields on stays and team) is gone:
// plans 03.2-07 and 03.2-08 replace those fields with the media picker (03.2-09's MediaField), so their URL-typing cases are replaced there.

// W3 and W4 ran on the hero booker specimen until Phase 3.3 close removed it with the Framer bridge. The same Stepper
// now runs in the journey bar's guest panel, and the same CalendarPanel in the dashboard's date field (DateRangeField).

/** A Dubai day as the calendar keys it (not zero padded), `days` from today: DateRangeField counts from the Dubai day. */
function dubaiDay(days: number): { year: number; month: number; day: number } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  const at = new Date(Date.UTC(year, month - 1, day + days));
  return { year: at.getUTCFullYear(), month: at.getUTCMonth() + 1, day: at.getUTCDate() };
}

test.describe("W1 dashboard phone menu", () => {
  test.use({ viewport: { width: 1024, height: 800 } });

  test("Escape returns focus to the menu button, and Tab reaches Close", async ({ page }) => {
    await page.goto("/dashboard/home");
    const toggle = page.getByRole("button", { name: "Menu", exact: true });
    await toggle.click();
    const close = page.getByRole("button", { name: "Close menu", exact: true });
    await expect(close).toHaveAttribute("aria-expanded", "true");

    // Shift+Tab from the first nav link wraps to the Close button, which is in the loop.
    await page.keyboard.press("Shift+Tab");
    await expect(close).toBeFocused();

    await page.keyboard.press("Tab");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
  });

  test("the Close button returns focus to the menu button", async ({ page }) => {
    await page.goto("/dashboard/home");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Close menu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
  });
});

test.describe("W2 site nav phone menu", () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test("Close returns focus to Menu", async ({ page }) => {
    // /account needs a session since 02-02: the same hub through the harness, signed in as a fixture guest.
    await page.goto("/__harness?c=guest-account&s=hub&l=en");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await page.getByRole("button", { name: "Close menu", exact: true }).click();
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
  });

  test("Escape closes only the open list, then the menu, then focus is on Menu", async ({ page }) => {
    // /account needs a session since 02-02: the same hub through the harness, signed in as a fixture guest.
    await page.goto("/__harness?c=guest-account&s=hub&l=en");
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    const header = page.locator("header").first();
    const list = header.getByRole("combobox").first();
    await list.click();
    await expect(page.getByRole("listbox")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Close menu", exact: true })).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Menu", exact: true })).toBeFocused();
  });
});

test("W3 stepper keeps focus on the button that reached its bound", async ({ page }) => {
  await page.goto("/__harness?c=guest-panel&s=default&l=en");
  const add = page.getByRole("button", { name: "Add adult", exact: true });
  const remove = page.getByRole("button", { name: "Remove adult", exact: true });
  await add.click();
  await remove.focus();
  // Press until the minimum: the button stays focused and is announced as disabled.
  for (let i = 0; i < 4; i += 1) await page.keyboard.press("Enter");
  await expect(remove).toBeFocused();
  await expect(remove).toHaveAttribute("aria-disabled", "true");
});

test("W4 calendar keeps one Tab stop after Next month, and Previous stops at this month", async ({ page }) => {
  await page.goto("/__harness?c=ops-kit&s=date-range&l=en");
  // The one-day field's day is today + 3 (tests/journey/scenes/ops-kit.tsx); the calendar opens on that day's month.
  await page.locator("#kit-one-day").click();
  const grid = page.getByRole("grid");
  await expect(grid).toBeVisible();
  const previous = page.getByRole("button", { name: "Previous month" });
  // In the last days of a month the field's day is in next month: one step back reaches this month.
  if ((await previous.getAttribute("aria-disabled")) !== "true") await previous.click();
  await expect(previous).toHaveAttribute("aria-disabled", "true");
  const today = dubaiDay(0);
  await expect(grid.locator(`[data-date="${today.year}-${today.month}-${today.day}"]`)).toHaveCount(1);
  await previous.click();
  await expect(grid.locator(`[data-date="${today.year}-${today.month}-${today.day}"]`)).toHaveCount(1);

  await page.getByRole("button", { name: "Next month" }).click();
  await expect(grid.locator('button[tabindex="0"]')).toHaveCount(1);
  // The Tab stop is the field's day when it is in the month shown, otherwise the month's first day.
  const field = dubaiDay(3);
  const next = today.month === 12 ? { year: today.year + 1, month: 1 } : { year: today.year, month: today.month + 1 };
  const stop = field.year === next.year && field.month === next.month ? `${field.year}-${field.month}-${field.day}` : `${next.year}-${next.month}-1`;
  await expect(grid.locator('button[tabindex="0"]')).toHaveAttribute("data-date", stop);

  await page.keyboard.press("Tab");
  await expect(grid.locator('button[tabindex="0"]')).toBeFocused();
});
