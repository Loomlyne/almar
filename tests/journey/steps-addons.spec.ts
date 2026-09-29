import { test, expect } from "@playwright/test";

const url = (c: string, s: string, l = "en") => `/__harness?c=${c}&s=${s}&l=${l}`;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
});

test.describe("AddOnRow", () => {
  test("per trip toggles aria-pressed and keeps the name 'Add {name}'", async ({ page }) => {
    await page.goto(url("add-on-row", "trip-off"));
    const btn = page.getByRole("button", { name: "Add VIP Airport Meet & Greet" });
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("harness-add-on").locator("article")).toHaveClass(/shadow-selected/);
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("harness-add-on").locator("article")).toHaveClass(/ring-line/);
  });

  test("per person stepper stops at every guest incl. infants and shows the reason", async ({ page }) => {
    await page.goto(url("add-on-row", "person"));
    const plus = page.getByRole("button", { name: "Add one Cartagena Heritage Tours" });
    for (let i = 0; i < 3; i++) await plus.click();
    await expect(page.getByText("4", { exact: true })).toBeVisible();
    await expect(plus).toBeDisabled();
    await expect(page.getByText("One per guest")).toBeVisible();
  });

  test("per person at max scene", async ({ page }) => {
    await page.goto(url("add-on-row", "person-max"));
    await expect(page.getByRole("button", { name: "Add one Cartagena Heritage Tours" })).toBeDisabled();
    await expect(page.getByText("One per guest")).toBeVisible();
  });

  test("per night stepper stops at the number of nights", async ({ page }) => {
    await page.goto(url("add-on-row", "night"));
    const plus = page.getByRole("button", { name: "Add one 24/7 Private Concierge" });
    for (let i = 0; i < 3; i++) await plus.click();
    await expect(plus).toBeDisabled();
    await expect(page.getByText("One per night")).toBeVisible();
  });

  test("per night at max scene", async ({ page }) => {
    await page.goto(url("add-on-row", "night-max"));
    await expect(page.getByText("One per night")).toBeVisible();
  });

  test("row shows its image, price and unit; never a checkbox", async ({ page }) => {
    await page.goto(url("add-on-row", "person"));
    const row = page.getByTestId("harness-add-on");
    await expect(row.locator("img")).toBeVisible();
    await expect(row).toContainText("AED [PRICE]");
    await expect(row).toContainText("per person");
    await expect(row.locator("input[type=checkbox], input[type=radio]")).toHaveCount(0);
  });

  test("home pickup starts added and can be removed", async ({ page }) => {
    await page.goto(url("add-on-row", "trip-on"));
    const btn = page.getByRole("button", { name: "Add Home pickup" });
    await expect(btn).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("Service · UAE")).toBeVisible();
    await btn.click();
    await expect(btn).toHaveAttribute("aria-pressed", "false");
  });

  test("phone row uses an icon toggle and a small image", async ({ page }) => {
    await page.goto(url("add-on-row", "phone-row"));
    const img = page.getByTestId("harness-add-on").locator("img");
    expect((await img.boundingBox())?.width).toBe(84);
    await expect(page.getByRole("button", { name: "Add one Cartagena Heritage Tours" })).toBeVisible();
  });
});

test.describe("AddOnList", () => {
  test("All shows 11, filters by kind, header count follows", async ({ page }) => {
    await page.goto(url("add-on-row", "list-all"));
    const list = page.getByRole("region", { name: "Experiences and services, scrolls" });
    await expect(list).toHaveAttribute("tabindex", "0");
    await expect(list.locator("article")).toHaveCount(11);
    await expect(page.getByText("11 options · 1 added")).toBeVisible();
    await page.getByRole("button", { name: "Experiences", exact: true }).click();
    await expect(list.locator("article")).toHaveCount(8);
    await page.getByRole("button", { name: "Services", exact: true }).click();
    await expect(list.locator("article")).toHaveCount(3);
    await page.getByRole("button", { name: "All", exact: true }).click();
    await expect(list.locator("article")).toHaveCount(11);
  });

  test("list-experiences scene starts filtered", async ({ page }) => {
    await page.goto(url("add-on-row", "list-experiences"));
    await expect(page.getByRole("button", { name: "Experiences", exact: true })).toHaveAttribute("aria-pressed", "true");
  });

  test("a filter with no items shows its empty line", async ({ page }) => {
    await page.goto(url("add-on-row", "list-empty"));
    await expect(page.getByText("No services here yet.")).toBeVisible();
    await page.getByRole("button", { name: "Experiences", exact: true }).click();
    await expect(page.getByText("No services here yet.")).toHaveCount(0);
  });

  test("loading shows three skeleton rows and no articles", async ({ page }) => {
    await page.goto(url("add-on-row", "list-loading"));
    const list = page.getByRole("region", { name: "Experiences and services, scrolls" });
    await expect(list).toHaveAttribute("aria-busy", "true");
    await expect(list.locator("article")).toHaveCount(0);
    await expect(list.locator("[aria-hidden=true]").filter({ has: page.locator(".animate-pulse") })).toHaveCount(3);
  });

  test("filter chips are at least 40px tall (legacy .ui-chip min-block-size 44px, see deferred-items)", async ({ page }) => {
    await page.goto(url("add-on-row", "list-all"));
    const h = await page
      .getByRole("button", { name: "All", exact: true })
      .evaluate((el) => (el as HTMLElement).offsetHeight);
    expect(h).toBeGreaterThanOrEqual(40);
  });
});

test.describe("StepRail", () => {
  test("current step carries aria-current and the rule; done steps have Change", async ({ page }) => {
    await page.goto(url("step-rail", "step-3"));
    const items = page.getByRole("listitem");
    await expect(items.nth(2)).toHaveAttribute("aria-current", "step");
    await expect(items.nth(2)).toHaveClass(/shadow-rule-primary/);
    await expect(page.getByRole("button", { name: /Change/ })).toHaveCount(2);
    await expect(items.nth(0).locator("svg")).toHaveCount(1);
    await expect(items.nth(3)).toContainText("4");
  });

  test("step 1 has no Change link", async ({ page }) => {
    await page.goto(url("step-rail", "step-1"));
    await expect(page.getByRole("button", { name: /Change/ })).toHaveCount(0);
  });

  test("phone layout shows four bars and 'Step 2 of 4 · Add-ons'", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(url("step-rail", "phone-2"));
    await expect(page.getByText("Step 2 of 4 · Add-ons")).toBeVisible();
    await expect(page.getByRole("listitem")).toHaveCount(4);
  });

  test("AR: rtl and the first step sits at the right", async ({ page }) => {
    await page.goto(url("step-rail", "step-2", "ar"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const items = page.getByRole("listitem");
    const first = await items.nth(0).boundingBox();
    const last = await items.nth(3).boundingBox();
    expect(first!.x).toBeGreaterThan(last!.x);
  });
});

test.describe("InclusionsList", () => {
  test("panel shows title, note and seven items with no price or control", async ({ page }) => {
    await page.goto(url("inclusions-list", "panel"));
    const box = page.getByTestId("harness-inclusions");
    await expect(box).toContainText("Included in your journey");
    await expect(box).toContainText("No extra charge");
    await expect(box.getByRole("listitem")).toHaveCount(7);
    await expect(box.locator("button, input")).toHaveCount(0);
    await expect(box).not.toContainText("AED");
  });

  test("compact joins the labels in one line", async ({ page }) => {
    await page.goto(url("inclusions-list", "compact"));
    await expect(page.getByTestId("harness-inclusions")).toContainText("Airport meet");
    await expect(page.getByTestId("harness-inclusions").getByRole("listitem")).toHaveCount(0);
  });

  test("empty renders nothing", async ({ page }) => {
    await page.goto(url("inclusions-list", "empty"));
    await expect(page.getByTestId("harness-inclusions")).toBeEmpty();
  });

  test("AR panel is rtl", async ({ page }) => {
    await page.goto(url("inclusions-list", "panel", "ar"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByTestId("harness-inclusions").getByRole("listitem")).toHaveCount(7);
  });
});
