import { expect, test } from "@playwright/test";
import { BLOG_COPY } from "../lib/copy/blog";

// The /<locale>/blog search island (plan 06-03 Task 4) on the built or dev site: no box before the page is interactive,
// a query filters the cards (case and accents ignored), the no-match line with Clear, Escape clears. Written, NOT run
// (owner rule, 2026-10-21).

for (const locale of ["en", "ar", "es"] as const) {
  const copy = BLOG_COPY[locale].list;

  test(`no search box without script; every card is there (${locale})`, async ({ browser, baseURL }) => {
    const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(`/${locale}/blog`);
    await expect(page.getByRole("searchbox")).toHaveCount(0);
    expect(await page.locator("main li").count()).toBeGreaterThan(0);
    await context.close();
  });

  test(`a query filters, no match says so, Clear and Escape bring the list back (${locale})`, async ({ page }) => {
    await page.goto(`/${locale}/blog`);
    const box = page.getByLabel(copy.searchLabel);
    await expect(box).toBeVisible();
    const all = await page.locator("main li").count();
    const first = (await page.locator("main li h3, main li [class*='title']").first().textContent())?.trim() ?? "";
    // The first word of a card's title, upper-cased and with its accents taken off, still finds it.
    const word = first.split(/\s+/)[0]!.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
    await box.fill(word);
    await expect.poll(() => page.locator("main li").count()).toBeGreaterThan(0);
    await box.fill("zzzzqqq");
    await expect(page.getByText(copy.searchNoMatch.replace("{q}", "zzzzqqq"), { exact: true })).toBeVisible();
    await page.getByRole("button", { name: copy.searchClear }).click();
    await expect(page.locator("main li")).toHaveCount(all);
    await box.fill("zzzzqqq");
    await box.press("Escape");
    await expect(page.locator("main li")).toHaveCount(all);
  });
}
