import { test, expect } from "@playwright/test";

const url = (c: string, s: string, l = "en") => `/__harness?c=${c}&s=${s}&l=${l}`;

test.describe("JourneyCart rail", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("rail is sticky at 112px and 400px wide", async ({ page }) => {
    await page.goto(url("journey-cart", "rail-filled"));
    const aside = page.getByRole("complementary", { name: "Your journey" });
    await expect(aside).toBeVisible();
    const css = await aside.evaluate((el) => {
      const s = getComputedStyle(el);
      return { position: s.position, top: s.top, width: s.width };
    });
    expect(css).toEqual({ position: "sticky", top: "112px", width: "400px" });
  });

  test("lists stay, add-ons with quantity, totals and the note", async ({ page }) => {
    await page.goto(url("journey-cart", "rail-filled"));
    const aside = page.getByRole("complementary", { name: "Your journey" });
    await expect(aside).toContainText("Stay · 5 nights");
    await expect(aside).toContainText("3 add-ons");
    await expect(aside).toContainText("Cartagena Heritage Tours");
    await expect(aside).toContainText("× 2");
    await expect(aside).toContainText("7 inclusions");
    await expect(aside).toContainText("Included");
    await expect(aside).toContainText("Subtotal");
    await expect(aside).toContainText("VAT [RATE]%");
    await expect(aside).toContainText("Total");
    await expect(aside).toContainText("Nothing is charged before Pay");
    await expect(aside).not.toContainText(/AED \d/);
  });

  test("Total line is Lato 700 title size with tabular numbers", async ({ page }) => {
    await page.goto(url("journey-cart", "rail-filled"));
    const total = page.getByText("Total", { exact: true }).locator("..");
    const css = await total.evaluate((el) => {
      const s = getComputedStyle(el);
      return { weight: s.fontWeight, size: s.fontSize, nums: s.fontVariantNumeric };
    });
    expect(css.weight).toBe("700");
    expect(css.size).toBe("20px");
    expect(css.nums).toContain("tabular-nums");
  });

  test("Remove is 44px, removes the row and moves focus to the next Remove", async ({ page }) => {
    await page.goto(url("journey-cart", "rail-filled"));
    const first = page.getByRole("button", { name: "Remove Home pickup" });
    const box = await first.boundingBox();
    expect(box?.width).toBe(44);
    expect(box?.height).toBe(44);
    await first.click();
    await expect(page.getByText("Home pickup")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remove Cartagena Heritage Tours" })).toBeFocused();
  });

  test("removing the last row focuses the previous row; emptying focuses the group kicker", async ({ page }) => {
    await page.goto(url("journey-cart", "rail-filled"));
    await page.getByRole("button", { name: "Remove 24/7 Private Concierge" }).click();
    await expect(page.getByRole("button", { name: "Remove Cartagena Heritage Tours" })).toBeFocused();
    await page.getByRole("button", { name: "Remove Cartagena Heritage Tours" }).click();
    await page.getByRole("button", { name: "Remove Home pickup" }).click();
    await expect(page.getByText("Nothing added yet.")).toBeVisible();
    await expect(page.getByText("0 add-ons")).toBeFocused();
  });

  test("empty rail shows the empty line and no Remove", async ({ page }) => {
    await page.goto(url("journey-cart", "rail-empty"));
    await expect(page.getByText("Nothing added yet.")).toBeVisible();
    await expect(page.getByRole("button", { name: /^Remove/ })).toHaveCount(0);
  });

  test("loading shows skeleton lines instead of rows", async ({ page }) => {
    await page.goto(url("journey-cart", "loading"));
    await expect(page.getByText("Stay · 5 nights")).toHaveCount(0);
    await expect(page.locator("[aria-hidden=true].animate-pulse, [aria-hidden=true] > .animate-pulse").first()).toBeVisible();
  });

  test("AR rail sits at the inline-end side under rtl", async ({ page }) => {
    await page.goto(url("journey-cart", "rail-filled", "ar"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    const aside = page.locator("aside");
    const box = await aside.boundingBox();
    // The scene right-aligns via justify-end (flex end = left in rtl): rail is at the visual left.
    expect(box!.x + box!.width / 2).toBeLessThan(720);
    const remove = page.locator("[data-remove-id]").first();
    const rb = await remove.boundingBox();
    const ab = await aside.locator("img").boundingBox();
    // Remove sits at the inline-end (left) edge of its row in rtl.
    expect(rb!.x).toBeLessThan(ab!.x + ab!.width / 2);
  });
});

test.describe("JourneyCart phone", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
  });

  test("dock shows caption, bold total and Continue", async ({ page }) => {
    await page.goto(url("journey-cart", "phone-dock"));
    await expect(page.getByText("Total · stay + 3 add-ons")).toBeVisible();
    await expect(page.getByRole("button", { name: "Continue" })).toBeVisible();
    const amount = page.getByRole("button", { name: /Total · stay/ }).getByText("AED [AMOUNT]");
    expect(await amount.evaluate((el) => getComputedStyle(el).fontWeight)).toBe("700");
    const dock = await page.getByRole("button", { name: "Continue" }).evaluate((el) => el.parentElement!.getBoundingClientRect().height);
    expect(dock).toBe(88);
  });

  test("tapping the total opens a full-screen dialog with the same content and closes", async ({ page }) => {
    await page.goto(url("journey-cart", "phone-dock"));
    await page.getByRole("button", { name: /Total · stay/ }).click();
    const dialog = page.getByRole("dialog", { name: "Your journey" });
    await expect(dialog).toBeVisible();
    // Wait out the 250ms sheet-in animation before measuring.
    await expect
      .poll(async () => dialog.boundingBox())
      .toMatchObject({ x: 0, y: 0, width: 390, height: 800 });
    await expect(dialog).toContainText("Nothing is charged before Pay");
    await expect(dialog.getByRole("button", { name: "Remove Home pickup" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Continue" })).toBeVisible();
    await dialog.getByRole("button", { name: "Close" }).click();
    await expect(dialog).toHaveCount(0);
  });

  test("phone-open scene starts open; Remove works inside it", async ({ page }) => {
    await page.goto(url("journey-cart", "phone-open"));
    const dialog = page.getByRole("dialog", { name: "Your journey" });
    await dialog.getByRole("button", { name: "Remove Home pickup" }).click();
    await expect(dialog.getByText("Home pickup")).toHaveCount(0);
    await expect(dialog.getByText("Total · stay + 2 add-ons")).toBeVisible();
  });
});

test.describe("TeamSection", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
  });

  test("zero members renders nothing", async ({ page }) => {
    await page.goto(url("team-section", "none"));
    const root = page.getByTestId("harness-team");
    await expect(root).toBeAttached();
    await expect(root).toBeEmpty();
    await expect(page.getByRole("heading")).toHaveCount(0);
  });

  test("one placeholder shows title, [Name], [Role], monogram block and no photo", async ({ page }) => {
    await page.goto(url("team-section", "one-placeholder"));
    await expect(page.getByRole("heading", { level: 2 })).toHaveText("Local insight, personally delivered.");
    await expect(page.getByRole("heading", { level: 3, name: "[Name]" })).toBeVisible();
    await expect(page.getByText("[Role]")).toBeVisible();
    await expect(page.locator("[data-team-placeholder]")).toHaveCount(1);
    await expect(page.getByTestId("harness-team").locator("img:not([alt=''])")).toHaveCount(0);
    const b = await page.locator("[data-team-placeholder]").boundingBox();
    expect(Math.abs(b!.height / b!.width - 1.5)).toBeLessThan(0.01);
  });

  test("grid is 1 column at phone, 2 at tablet, 3 at desktop", async ({ page }) => {
    const cols = async () =>
      page.locator("ul").evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(" ").length);
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(url("team-section", "three-placeholder"));
    expect(await cols()).toBe(1);
    await page.setViewportSize({ width: 800, height: 900 });
    expect(await cols()).toBe(2);
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await cols()).toBe(3);
  });

  test("email is a mailto link with a 44px hit area; no social links", async ({ page }) => {
    await page.goto(url("team-section", "with-email"));
    const link = page.getByRole("link", { name: "[email]@example.com" });
    await expect(link).toHaveAttribute("href", "mailto:[email]@example.com");
    expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await expect(link.locator("svg")).toHaveAttribute("width", "16");
    await expect(page.locator("a[href*=facebook], a[href*=youtube], a[href*=instagram]")).toHaveCount(0);
  });

  test("AR pass is rtl", async ({ page }) => {
    await page.goto(url("team-section", "one-placeholder", "ar"));
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { level: 2 })).toHaveText(/^معرفة محلية/);
  });
});
