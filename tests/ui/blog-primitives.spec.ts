import { test } from "@playwright/test";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open, style, token } from "./_helpers";

// Plan 03.3-31: the post page's primitives, proven at 390, 834 and 1440 in EN, AR and ES.

for (const viewport of WIDTHS) {
  for (const locale of LOCALES) {
    const where = `${locale} ${VIEWPORTS[viewport].width}`;

    test.describe(`RichText ${where}`, () => {
      test("two h2 with ids, one blockquote on teal-tint, square, no injected HTML", async ({ page }) => {
        await open(page, "rich-text", "full", locale, viewport);
        const root = page.getByTestId("harness-rich");
        const h2 = root.locator("h2");
        await expect(h2).toHaveCount(2);
        await expect(h2.nth(0)).toHaveAttribute("id", "section-1");
        await expect(h2.nth(1)).toHaveAttribute("id", "section-2");
        const quote = root.locator("blockquote");
        await expect(quote).toHaveCount(1);
        expect(await style(quote, "background-color")).toBe(await token(page, "teal-tint"));
        expect(await style(quote, "border-radius")).toBe("0px");
        await expect(root.locator("[dangerouslysetinnerhtml]")).toHaveCount(0);
        await expect(root.locator("p")).toHaveCount(4);
      });

      test("three paragraphs render three <p>", async ({ page }) => {
        await open(page, "rich-text", "paragraphs", locale, viewport);
        await expect(page.getByTestId("harness-rich").locator("p")).toHaveCount(3);
      });

      test("the Arabic text scene mirrors under rtl", async ({ page }) => {
        await open(page, "rich-text", "long-ar", locale, viewport);
        await expect(page.getByTestId("harness-rich").locator("h2")).toHaveCount(2);
        expect(await page.evaluate(() => document.documentElement.dir)).toBe(locale === "ar" ? "rtl" : "ltr");
      });
    });

    test.describe(`OnThisPage ${where}`, () => {
      test("four links; clicking the third brings its heading into view and sets the hash", async ({ page }) => {
        await open(page, "on-this-page", "four", locale, viewport);
        const nav = page.getByRole("navigation", { name: "[On this page]" });
        await expect(nav.getByRole("link")).toHaveCount(4);
        await nav.getByRole("link").nth(2).click();
        await expect.poll(() => page.evaluate(() => location.hash)).toBe("#section-3");
        await expect
          .poll(async () => {
            const top = await page.locator("#section-3").evaluate((el) => el.getBoundingClientRect().top);
            return top >= 0 && top < window_height(viewport);
          })
          .toBe(true);
      });

      test("one item or none renders no nav", async ({ page }) => {
        for (const state of ["one", "none"]) {
          await open(page, "on-this-page", state, locale, viewport);
          await expect(page.locator("nav[aria-label='[On this page]']")).toHaveCount(0);
        }
      });
    });

    test.describe(`CopyLinkButton ${where}`, () => {
      test("copies exactly the url and announces it", async ({ page, context, browserName }) => {
        test.skip(browserName !== "chromium", "clipboard permissions are chromium only");
        await context.grantPermissions(["clipboard-read", "clipboard-write"]);
        await open(page, "copy-link", "default", locale, viewport);
        const button = page.getByRole("button", { name: "[Copy link]" });
        await expect(button).toBeVisible();
        await button.click();
        expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("https://almarprivatejourney.com/blog/[post]");
        await expect(page.getByRole("status").filter({ hasText: "[Link copied]" }).first()).toBeVisible();
      });

      test("without a clipboard no button renders", async ({ page }) => {
        await open(page, "copy-link", "no-clipboard", locale, viewport);
        await expect(page.getByRole("button", { name: "[Copy link]" })).toHaveCount(0);
      });
    });

    test.describe(`PortraitCard kicker ${where}`, () => {
      test("with href: one link named by the title, kicker visible", async ({ page }) => {
        await open(page, "portrait-card", "portrait-kicker", locale, viewport);
        const card = page.getByTestId("harness-portrait");
        await expect(card.getByRole("link")).toHaveCount(1);
        const link = card.getByRole("link", { name: /\[Title\]/ });
        await expect(link).toHaveAttribute("href", /__harness/);
        const kicker = card.getByText("[Featured stay]");
        await expect(kicker).toBeVisible();
        expect(await style(kicker, "font-size")).toBe("12px");
        expect(await style(kicker, "text-transform")).toBe(locale === "ar" ? "none" : "uppercase");
        expect(await style(link, "border-radius")).toBe("0px");
      });

      test("without href: no link, a div, kicker visible", async ({ page }) => {
        await open(page, "portrait-card", "portrait-article", locale, viewport);
        const card = page.getByTestId("harness-portrait");
        await expect(card.getByRole("link")).toHaveCount(0);
        await expect(card.getByText("[Featured experience]")).toBeVisible();
        await expect(card.getByText("[Title]")).toBeVisible();
      });

      test("the text block sits at the inline start and mirrors in Arabic", async ({ page }) => {
        await open(page, "portrait-card", "portrait-kicker", locale, viewport);
        const card = page.getByTestId("harness-portrait").locator("a");
        const cardBox = (await card.boundingBox())!;
        // The kicker box stretches the card's text column; measure where its text actually sits.
        const kickerBox = await page.getByText("[Featured stay]").evaluate((el) => {
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          return { x: r.x, width: r.width };
        });
        const startGap = locale === "ar" ? cardBox.x + cardBox.width - (kickerBox.x + kickerBox.width) : kickerBox.x - cardBox.x;
        const endGap = locale === "ar" ? kickerBox.x - cardBox.x : cardBox.x + cardBox.width - (kickerBox.x + kickerBox.width);
        expect(startGap).toBeLessThan(endGap);
      });
    });
  }
}

function window_height(viewport: (typeof WIDTHS)[number]) {
  return VIEWPORTS[viewport].height;
}
