import { expect, test, type Page } from "@playwright/test";

// D-60 anchor: the /account language select works and is screenshot-tested in EN and AR.
// /account needs a session since 02-02, so the hub renders through the harness with a fixture guest.

test.use({ viewport: { width: 1440, height: 900 } });

async function open(page: Page) {
  await page.goto("/__harness?c=guest-account&s=hub&l=en");
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  return page.locator("#account-language");
}

async function shoot(page: Page, name: string) {
  const trigger = page.locator("#account-language");
  const list = page.getByRole("listbox");
  const a = (await trigger.boundingBox())!;
  const b = (await list.isVisible()) ? (await list.boundingBox())! : a;
  const x = Math.max(0, Math.min(a.x, b.x) - 16);
  const y = Math.max(0, Math.min(a.y, b.y) - 16);
  const right = Math.max(a.x + a.width, b.x + b.width) + 16;
  const bottom = Math.max(a.y + a.height, b.y + b.height) + 16;
  await page.waitForTimeout(300);
  await expect(page).toHaveScreenshot(["account-select", name], {
    clip: { x, y, width: right - x, height: bottom - y },
  });
}

test("account language select: EN closed and open, then AR closed and open", async ({ page }) => {
  const trigger = await open(page);
  await expect(trigger).toHaveAccessibleName("Language: English");
  await shoot(page, "en-closed.png");

  await trigger.click();
  await expect(page.getByRole("option", { name: "العربية" })).toBeVisible();
  await shoot(page, "en-open.png");

  await page.getByRole("option", { name: "العربية" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("الحساب");
  await expect(trigger).toHaveAccessibleName("اللغة: العربية");
  await page.mouse.move(0, 0);
  await shoot(page, "ar-closed.png");

  await trigger.click();
  await expect(page.getByRole("option", { name: "Español" })).toBeVisible();
  await shoot(page, "ar-open.png");

  await page.getByRole("option", { name: "English" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
});

test("Escape closes the list and returns focus to the trigger", async ({ page }) => {
  const trigger = await open(page);
  await trigger.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the currency control lists AED, USD and EUR", async ({ page }) => {
  await open(page);
  await page.locator("#account-currency").click();
  const options = page.getByRole("option");
  await expect(options).toHaveText(["AED", "USD", "EUR"]);
});
