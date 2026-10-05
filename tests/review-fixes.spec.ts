import { expect, test, type Page } from "@playwright/test";

// Phase 3.1 code review (03.1-REVIEW.md) W1 to W5: keyboard focus and URL typing.

async function mountHeroBooker(page: Page) {
  const js = await (await page.request.get("/embed/hero-booker")).text();
  await page.setContent('<div id="host"></div>');
  await page.evaluate((code) => {
    // eslint-disable-next-line no-eval
    (0, eval)(code);
  }, js);
  await page.evaluate(() => {
    const host = document.getElementById("host") as HTMLElement;
    (window as unknown as { AlmarMountHeroBooker: (h: HTMLElement) => void }).AlmarMountHeroBooker(host);
  });
  await expect(page.getByRole("search", { name: "Find a stay" })).toBeVisible();
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
  await mountHeroBooker(page);
  await page.locator('[data-slot="guests"] > button').click();
  const add = page.getByRole("button", { name: /add adult/i });
  const remove = page.getByRole("button", { name: /remove adult/i });
  await add.click();
  await remove.focus();
  // Press until the minimum: the button stays focused and is announced as disabled.
  for (let i = 0; i < 4; i += 1) await page.keyboard.press("Enter");
  await expect(remove).toBeFocused();
  await expect(remove).toHaveAttribute("aria-disabled", "true");
});

test("W4 calendar keeps one Tab stop after Next month, and Previous stops at this month", async ({ page }) => {
  await mountHeroBooker(page);
  await page.locator('[data-slot="when"] > button').click();
  const previous = page.getByRole("button", { name: "Previous month" });
  await expect(previous).toHaveAttribute("aria-disabled", "true");

  const next = page.getByRole("button", { name: "Next month" });
  await next.click();
  const grid = page.getByRole("grid");
  await expect(grid.locator('button[tabindex="0"]')).toHaveCount(1);
  await expect(grid.locator('button[tabindex="0"]')).toHaveAttribute("data-date", /-1$/);

  await page.keyboard.press("Tab");
  await expect(grid.locator('button[tabindex="0"]')).toBeFocused();
});

for (const [route, open, field] of [
  ["/dashboard/catalog/stays", "New stay", "Media URL"],
  ["/dashboard/content/team", "New member", "Photo"],
] as const) {
  test(`W5 ${field} keeps every typed key on ${route}`, async ({ page }) => {
    await page.goto(route);
    await page.getByRole("button", { name: open, exact: true }).click();
    const input = page.getByLabel(field, { exact: true });
    await input.pressSequentially("https://cdn.example.com/a.jpg");
    await expect(input).toHaveValue("https://cdn.example.com/a.jpg");
    await expect(page.getByText("Enter a URL that starts with https://.")).toHaveCount(0);

    await input.fill("");
    await input.pressSequentially("http:");
    await expect(page.getByText("Enter a URL that starts with https://.")).toBeVisible();
  });
}
