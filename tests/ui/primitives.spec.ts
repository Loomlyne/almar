import { test } from "@playwright/test";
import { HOME_COPY } from "../../lib/copy/home";
import { convertWrittenAmount, formatConverted, rewriteHomeAmounts } from "../../lib/fx/rates";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open, style, token } from "./_helpers";

// Same fixed rates as tests/journey/scenes/amount.tsx.
const RATES = { aed: 3.6725, eur: 0.92, date: "2026-10-01" };

// Nine new primitives, proven in the browser at 390, 834 and 1440 in EN, AR and ES.
// Every block runs for the full width x locale matrix.

for (const viewport of WIDTHS) {
  for (const locale of LOCALES) {
    const where = `${locale} ${VIEWPORTS[viewport].width}`;

    test.describe(`MediaCard ${where}`, () => {
      test("with href the card is one link named by its title; click follows it", async ({ page }) => {
        await open(page, "media-card", "link", locale, viewport);
        const card = page.getByTestId("harness-card");
        await expect(card.getByRole("link")).toHaveCount(1);
        await expect(card.getByRole("link", { name: /\[Title\]/ })).toBeVisible();
        await card.getByRole("link").click();
        await expect(page).toHaveURL(new RegExp(`c=_smoke.*l=${locale}`));
      });

      test("without href it is an article with no link", async ({ page }) => {
        await open(page, "media-card", "article", locale, viewport);
        const card = page.getByTestId("harness-card");
        await expect(card.locator("article")).toHaveCount(1);
        await expect(card.getByRole("link")).toHaveCount(0);
      });

      test("an action beside a link is a sibling control, never inside the link", async ({ page }) => {
        await open(page, "media-card", "action", locale, viewport);
        const card = page.getByTestId("harness-card");
        await expect(card.getByRole("link")).toHaveCount(1);
        await expect(card.getByRole("button", { name: "[Add]" })).toHaveCount(1);
        await expect(card.locator("a button")).toHaveCount(0);
      });

      test("picture: 4:3, square, 1px line outline pulled in by 1px", async ({ page }) => {
        await open(page, "media-card", "link", locale, viewport);
        const img = page.getByTestId("harness-card").locator("img");
        const box = await img.boundingBox();
        expect(box!.height / box!.width).toBeCloseTo(0.75, 1);
        expect(await style(img, "outline-width")).toBe("1px");
        expect(await style(img, "outline-style")).toBe("solid");
        expect(await style(img, "outline-offset")).toBe("-1px");
        expect(await style(img, "border-radius")).toBe("0px");
      });

      test("hover draws a gold 1px underline on the title", async ({ page }) => {
        await open(page, "media-card", "link", locale, viewport);
        const title = page.getByText("[Title]");
        expect(await style(title, "text-decoration-line")).toBe("none");
        await page.getByTestId("harness-card").getByRole("link").hover();
        expect(await style(title, "text-decoration-line")).toBe("underline");
        expect(await style(title, "text-decoration-thickness")).toBe("1px");
        expect(await style(title, "text-decoration-color")).toBe(await token(page, "gold"));
      });

      test("keyboard reaches the card and the focus ring is the 2px teal outline", async ({ page }) => {
        await open(page, "media-card", "link", locale, viewport);
        const link = page.getByTestId("harness-card").getByRole("link");
        // The dev server may put its own indicator first in the Tab order; Tab until the card.
        for (let i = 0; i < 6 && !(await link.evaluate((el) => el === document.activeElement)); i += 1) {
          await page.keyboard.press("Tab");
        }
        await expect(link).toBeFocused();
        expect(await style(link, "outline-width")).toBe("2px");
        expect(await style(link, "outline-color")).toBe(await token(page, "teal"));
      });

      test("the title starts at the inline start (right edge in ar, left edge otherwise)", async ({ page }) => {
        await open(page, "media-card", "link", locale, viewport);
        const edge = await page.evaluate(() => {
          const card = document.querySelector("[data-testid=harness-card] a")!;
          const title = Array.from(card.querySelectorAll("span")).find((s) => s.textContent === "[Title]")!;
          const range = document.createRange();
          range.selectNodeContents(title);
          const text = range.getBoundingClientRect();
          const img = card.querySelector("img")!.getBoundingClientRect();
          return { textLeft: text.left, textRight: text.right, imgLeft: img.left, imgRight: img.right };
        });
        if (locale === "ar") expect(Math.abs(edge.textRight - edge.imgRight)).toBeLessThan(2);
        else expect(Math.abs(edge.textLeft - edge.imgLeft)).toBeLessThan(2);
      });
    });

    test.describe(`Section ${where}`, () => {
      test("a 2px gold line on top, 24px above the kicker, no radius", async ({ page }) => {
        await open(page, "section", "head", locale, viewport);
        const head = page.getByTestId("harness-section").locator("> div");
        expect(await style(head, "border-top-width")).toBe("2px");
        expect(await style(head, "border-top-style")).toBe("solid");
        expect(await style(head, "border-top-color")).toBe(await token(page, "gold"));
        expect(await style(head, "padding-top")).toBe("24px");
        expect(await style(head, "border-radius")).toBe("0px");
      });

      test("kicker is uppercase, except in Arabic", async ({ page }) => {
        await open(page, "section", "head", locale, viewport);
        const kicker = page.getByText("[Kicker]");
        expect(await style(kicker, "text-transform")).toBe(locale === "ar" ? "none" : "uppercase");
        expect(await style(kicker, "letter-spacing")).toBe(locale === "ar" ? "normal" : "1.44px");
      });

      test("heading level follows the prop and a Section is named by its heading", async ({ page }) => {
        await open(page, "section", "head", locale, viewport);
        await expect(page.getByRole("heading", { level: 3, name: "[Heading]" })).toBeVisible();
        await open(page, "section", "full", locale, viewport);
        await expect(page.getByRole("heading", { level: 2, name: "[Heading]" })).toBeVisible();
        await expect(page.getByRole("region", { name: "[Heading]" })).toBeVisible();
      });

      test("the block stays within a reading measure", async ({ page }) => {
        await open(page, "section", "full", locale, viewport);
        const box = await page.getByTestId("harness-section").locator("section > div").boundingBox();
        expect(box!.width).toBeLessThanOrEqual(768);
      });

      test("an action sits on the head's trailing side", async ({ page }) => {
        await open(page, "section", "action", locale, viewport);
        const button = page.getByRole("button", { name: "[View all]" });
        await expect(button).toBeVisible();
        const head = await page.getByTestId("harness-section").locator("> div").boundingBox();
        const btn = await button.boundingBox();
        if (viewport !== "phone") {
          if (locale === "ar") expect(btn!.x).toBeLessThan(head!.x + head!.width / 2);
          else expect(btn!.x).toBeGreaterThan(head!.x + head!.width / 2);
        }
      });
    });

    test(`PageShell ${where}: a size container with a 358 / 770 / 1240 column`, async ({ page }) => {
      await open(page, "page-shell", "default", locale, viewport);
      const content = page.getByTestId("harness-shell-content");
      const expected = { phone: 358, tablet: 770, desktop: 1240 }[viewport];
      const box = await content.boundingBox();
      expect(Math.round(box!.width)).toBe(expected);
      const outer = content.locator("xpath=../..");
      expect(await style(outer, "container-type")).toBe("inline-size");
    });

    test.describe(`FactList ${where}`, () => {
      test("labelled rows are a description list, 44px minimum with a hairline", async ({ page }) => {
        await open(page, "fact-list", "one-column", locale, viewport);
        const list = page.getByTestId("harness-facts");
        await expect(list.locator("dl")).toHaveCount(1);
        await expect(list.locator("dt")).toHaveCount(4);
        await expect(list.locator("dd")).toHaveCount(4);
        const row = list.locator("dl > div").first();
        expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        expect(await style(row, "border-bottom-width")).toBe("1px");
        expect(await style(row, "border-bottom-color")).toBe(await token(page, "line"));
      });

      test("plain rows with a check are a list; two columns from the tablet width up", async ({ page }) => {
        await open(page, "fact-list", "two-columns", locale, viewport);
        const items = page.getByTestId("harness-facts").locator("li");
        await expect(items).toHaveCount(4);
        await expect(items.first().locator("svg")).toHaveCount(1);
        const a = await items.nth(0).boundingBox();
        const b = await items.nth(1).boundingBox();
        if (viewport === "phone") expect(Math.abs(a!.x - b!.x)).toBeLessThan(1);
        else {
          expect(Math.abs(a!.y - b!.y)).toBeLessThan(1);
          if (locale === "ar") expect(a!.x).toBeGreaterThan(b!.x);
          else expect(a!.x).toBeLessThan(b!.x);
        }
      });
    });

    test.describe(`ResultCount ${where}`, () => {
      test("one polite live line; Clear sits outside it and works", async ({ page }) => {
        await open(page, "result-count", "zero", locale, viewport);
        const live = page.locator("[aria-live=polite]");
        await expect(live).toHaveCount(1);
        await expect(live).toHaveText("[0 results]");
        await expect(live.getByRole("button")).toHaveCount(0);
        await page.getByRole("button", { name: "[Clear filters]" }).click();
        await expect(live).toHaveText("[12 results]");
        await page.getByRole("button", { name: "[more]" }).click();
        await expect(live).toHaveText("[13 results]");
      });

      test("no Clear control without onClear", async ({ page }) => {
        await open(page, "result-count", "one", locale, viewport);
        await expect(page.getByRole("button", { name: "[Clear filters]" })).toHaveCount(0);
        await expect(page.locator("[aria-live=polite]")).toHaveText("[1 results]");
      });
    });

    test.describe(`StickyDock ${where}`, () => {
      test("88px tall, on the viewport bottom after scrolling, content not hidden behind it", async ({ page }) => {
        await open(page, "sticky-dock", "with-action", locale, viewport);
        await page.mouse.wheel(0, 5000);
        await page.waitForFunction(() => window.scrollY > 0);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        const dock = page.locator("div.fixed");
        const box = await dock.boundingBox();
        const vh = VIEWPORTS[viewport].height;
        expect(Math.round(box!.height)).toBe(88);
        expect(Math.round(box!.y + box!.height)).toBe(vh);
        const last = await page.getByTestId("harness-last-line").boundingBox();
        expect(last!.y + last!.height).toBeLessThanOrEqual(box!.y + 0.5);
        expect(await style(dock, "border-top-width")).toBe("1px");
        expect(await style(dock, "border-top-color")).toBe(await token(page, "line"));
        expect(await style(dock, "background-color")).toBe(await token(page, "ivory"));
        await expect(dock.getByRole("button", { name: "[Continue]" })).toBeVisible();
      });

      test("no action element when action is absent", async ({ page }) => {
        await open(page, "sticky-dock", "no-action", locale, viewport);
        const dock = page.locator("div.fixed");
        await expect(dock).toContainText("[Summary only]");
        await expect(dock.getByRole("button")).toHaveCount(0);
        await expect(dock.locator("> div")).toHaveCount(1);
      });
    });

    test.describe(`Select ${where}`, () => {
      test("click opens a listbox of three, the chosen row is checked, choosing changes the value", async ({ page }) => {
        await open(page, "select", "chosen", locale, viewport);
        const trigger = page.getByRole("combobox", { name: "[Filter]: [Option A]" });
        expect(Math.round((await trigger.boundingBox())!.height)).toBe(44);
        expect(await style(trigger, "border-radius")).toBe("0px");
        await trigger.click();
        await expect(page.getByRole("listbox")).toBeVisible();
        await expect(page.getByRole("option")).toHaveCount(3);
        await expect(page.getByRole("option", { name: "[Option A]" }).locator("svg")).toHaveCount(1);
        await expect(page.getByRole("option", { name: "[Option B]" }).locator("svg")).toHaveCount(0);
        await page.getByRole("option", { name: "[Option B]" }).click();
        await expect(page.getByTestId("select-value")).toHaveText("b");
        await expect(page.getByTestId("select-calls")).toHaveText("1");
        await expect(page.getByRole("combobox", { name: "[Filter]: [Option B]" })).toBeVisible();
      });

      test("choosing the row that is already chosen is not a change", async ({ page }) => {
        await open(page, "select", "chosen", locale, viewport);
        await page.getByRole("combobox").click();
        await page.getByRole("option", { name: "[Option A]" }).click();
        await expect(page.getByTestId("select-calls")).toHaveText("0");
      });

      test("keyboard opens, moves and chooses; Escape closes", async ({ page }) => {
        await open(page, "select", "chosen", locale, viewport);
        const trigger = page.getByRole("combobox");
        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("listbox")).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("listbox")).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page.getByRole("option", { name: "[Option A]" })).toBeFocused();
        await page.keyboard.press("ArrowDown");
        await expect(page.getByRole("option", { name: "[Option B]" })).toBeFocused();
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("select-value")).toHaveText("b");
      });

      test("no choice yet: the placeholder shows, nothing is checked, choosing the first option is a real change", async ({ page }) => {
        await open(page, "select", "none", locale, viewport);
        const trigger = page.getByRole("combobox", { name: "[Filter]: [None]" });
        await expect(trigger).toContainText("[None]");
        await trigger.click();
        await expect(page.getByRole("option")).toHaveCount(3);
        await expect(page.getByRole("listbox").locator("svg")).toHaveCount(0);
        await page.getByRole("option", { name: "[Option A]" }).click();
        await expect(page.getByTestId("select-value")).toHaveText("a");
        await expect(page.getByTestId("select-calls")).toHaveText("1");
      });
    });

    test.describe(`Amount ${where}`, () => {
      test("with no choice yet, or no rates, the published text is byte-identical", async ({ page }) => {
        await open(page, "amount", "rates", locale, viewport);
        for (const [i, tier] of HOME_COPY.en.journeys.entries()) {
          await expect(page.getByTestId(`price-${i}`)).toHaveText(tier.price);
        }
        await expect(page.getByTestId("price-aed")).toHaveText("AED 80,000");
        await open(page, "amount", "no-rates", locale, viewport);
        await expect(page.getByRole("combobox")).toContainText("USD");
        for (const [i, tier] of HOME_COPY.en.journeys.entries()) {
          await expect(page.getByTestId(`price-${i}`)).toHaveText(tier.price);
        }
      });

      test("choosing USD converts AED 80,000 to the amount formatConverted returns; Western digits in ar", async ({ page }) => {
        await open(page, "amount", "rates", locale, viewport);
        await page.getByRole("combobox").click();
        await page.getByRole("option", { name: "USD" }).click();
        const usd = convertWrittenAmount({ amount: 80000, currency: "AED" }, "USD", RATES)!;
        const expected = formatConverted("USD", usd, locale);
        expect(expected).not.toBe("AED 80,000");
        await expect(page.getByTestId("price-aed")).toHaveText(expected);
        expect(expected).toMatch(/^USD [0-9][0-9,.]*$/);
        const first = HOME_COPY.en.journeys[0].price;
        await expect(page.getByTestId("price-0")).toHaveText(rewriteHomeAmounts(first, "USD", RATES, locale));
      });

      test("choosing AED with no choice yet is a real change that keeps the AED text", async ({ page }) => {
        await open(page, "amount", "rates", locale, viewport);
        await expect(page.getByRole("combobox")).toContainText("[Currency]");
        await page.getByRole("combobox").click();
        await page.getByRole("option", { name: "AED" }).click();
        await expect(page.getByRole("combobox")).toContainText("AED");
        await expect(page.getByTestId("price-aed")).toHaveText("AED 80,000");
      });

      test("the amount sits in a bdi with tabular figures", async ({ page }) => {
        await open(page, "amount", "rates", locale, viewport);
        const bdi = page.getByTestId("price-aed").locator("bdi");
        await expect(bdi).toHaveCount(1);
        expect(await style(bdi, "font-variant-numeric")).toContain("tabular-nums");
      });
    });
  }
}
