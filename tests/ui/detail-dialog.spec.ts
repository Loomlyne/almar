import { test, type Locator, type Page } from "@playwright/test";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open, style, token } from "./_helpers";

// MediaCard onOpen + Dialog size "detail" (plan 03.3-11), card -> overlay -> back, in EN, AR and ES at 390,
// 834 and 1440. Scenes: tests/journey/scenes/{media-card-open,dialog-detail}.tsx. Dev-server config
// (ALMAR_HARNESS=1). Every colour is read through token(), never typed.

async function box(loc: Locator) {
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}

/** Wait until an element stops moving (the sheet animation), then return its box. */
async function stableBox(loc: Locator) {
  let last = await box(loc);
  for (let i = 0; i < 30; i += 1) {
    await loc.page().waitForTimeout(100);
    const now = await box(loc);
    if (now.x === last.x && now.y === last.y && now.width === last.width && now.height === last.height) return now;
    last = now;
  }
  return last;
}

const textBox = (loc: Locator) =>
  loc.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent?.trim()) node = walker.nextNode();
    if (!node) throw new Error("no text");
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    return { x: r.x, right: r.right };
  });

/** Click or hover the middle of an element by coordinates: the stretched button sits over the picture, so a
 * locator action on the img would (rightly) report it as intercepted. */
async function centre(page: Page, loc: Locator) {
  const b = await box(loc);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "[Title]" });
const insideDialog = (page: Page) =>
  dialogOf(page).evaluate((d) => d.contains(document.activeElement));

for (const viewport of WIDTHS) {
  for (const locale of LOCALES) {
    const vp = VIEWPORTS[viewport];
    const where = `${locale} ${vp.width}`;
    const rtl = locale === "ar";
    const phone = viewport === "phone";

    test.describe(`MediaCard open form ${where}`, () => {
      test("one button named by the title, no link, every part of the card opens it once", async ({ page }) => {
        await open(page, "media-card-open", "open", locale, viewport);
        const card = page.locator("article");
        await expect(card).toHaveCount(1);
        const button = card.getByRole("button", { name: "[Title]" });
        await expect(button).toHaveCount(1);
        await expect(button).toHaveAttribute("aria-haspopup", "dialog");
        await expect(card.getByRole("link")).toHaveCount(0);
        const at = await centre(page, card.locator("img"));
        await page.mouse.click(at.x, at.y);
        await expect(page.getByTestId("open-calls")).toHaveText("1");
        const line = await centre(page, card.getByText("[Detail line]"));
        await page.mouse.click(line.x, line.y);
        await expect(page.getByTestId("open-calls")).toHaveText("2");
        await button.click();
        await expect(page.getByTestId("open-calls")).toHaveText("3");
        await button.focus();
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("open-calls")).toHaveText("4");
        await page.keyboard.press("Space");
        await expect(page.getByTestId("open-calls")).toHaveText("5");
      });

      test("openRef receives the button; focus ring, hover underline and the title at the inline start", async ({ page }) => {
        await open(page, "media-card-open", "open", locale, viewport);
        const card = page.locator("article");
        const button = card.getByRole("button", { name: "[Title]" });
        await page.getByRole("button", { name: "[focus card]" }).click();
        await expect(button).toBeFocused();
        await page.getByRole("button", { name: "[focus card]" }).focus();
        await page.keyboard.press("Shift+Tab");
        await expect(button).toBeFocused();
        expect(await style(button, "outline-style")).toBe("solid");
        expect(await style(button, "outline-width")).toBe("2px");
        expect(await style(button, "outline-color")).toBe(await token(page, "teal"));
        await page.mouse.move(0, 0);
        const over = await centre(page, card.locator("img"));
        await page.mouse.move(over.x, over.y);
        expect(await style(button, "text-decoration-line")).toContain("underline");
        expect(await style(button, "text-decoration-thickness")).toBe("1px");
        expect(await style(button, "text-decoration-color")).toBe(await token(page, "gold"));
        const c = await box(card);
        const t = await textBox(button);
        if (rtl) expect(Math.abs(c.x + c.width - t.right)).toBeLessThanOrEqual(2);
        else expect(Math.abs(t.x - c.x)).toBeLessThanOrEqual(2);
      });

      test("an action beside the title is its own control and does not open the card", async ({ page }) => {
        await open(page, "media-card-open", "open-action", locale, viewport);
        await page.getByRole("button", { name: "[Other]" }).click();
        await expect(page.getByTestId("other-calls")).toHaveText("1");
        await expect(page.getByTestId("open-calls")).toHaveText("0");
        await expect(page.locator("button button")).toHaveCount(0);
      });
    });

    test.describe(`Dialog detail ${where}`, () => {
      const openIt = async (page: Page) => {
        await open(page, "dialog-detail", "from-card", locale, viewport);
        const card = page.getByRole("button", { name: "[Title]" });
        await card.click();
        await expect(dialogOf(page)).toBeVisible();
        await stableBox(dialogOf(page));
      };
      const cardButton = (page: Page) => page.getByRole("button", { name: "[Title]" });

      test("opens named by its h2, the kicker above it, focus inside", async ({ page }) => {
        await openIt(page);
        const dialog = dialogOf(page);
        const h2 = dialog.locator("h2", { hasText: "[Title]" });
        await expect(h2).toHaveCount(1);
        const kicker = dialog.getByText("[Experience · Place]");
        expect((await box(kicker)).y).toBeLessThan((await box(h2)).y);
        expect(await insideDialog(page)).toBe(true);
      });

      test("geometry: full screen on phone, a centred 760px panel from md; media, close square and footer", async ({ page }) => {
        await openIt(page);
        const dialog = dialogOf(page);
        const d = await box(dialog);
        const img = await box(dialog.locator("img"));
        if (phone) {
          expect(Math.abs(d.x)).toBeLessThanOrEqual(1);
          expect(Math.abs(d.y)).toBeLessThanOrEqual(1);
          expect(Math.abs(d.width - vp.width)).toBeLessThanOrEqual(1);
          expect(Math.abs(d.height - vp.height)).toBeLessThanOrEqual(1);
          expect(Math.abs(img.height - 220)).toBeLessThanOrEqual(1);
        } else {
          expect(Math.abs(d.width - 760)).toBeLessThanOrEqual(1);
          expect(Math.abs(d.x - (vp.width - d.x - d.width))).toBeLessThanOrEqual(1);
          expect(d.y).toBeGreaterThanOrEqual(0);
          expect(d.y + d.height).toBeLessThanOrEqual(vp.height + 1);
          expect(Math.abs(img.height - 280)).toBeLessThanOrEqual(1);
        }
        const close = dialog.getByRole("button", { name: "[Close]" });
        const c = await box(close);
        expect(Math.abs(c.width - 44)).toBeLessThanOrEqual(1);
        expect(Math.abs(c.height - 44)).toBeLessThanOrEqual(1);
        expect(Math.abs(c.y - img.y - 8)).toBeLessThanOrEqual(1);
        if (rtl) expect(Math.abs(c.x - img.x - 8)).toBeLessThanOrEqual(1);
        else expect(Math.abs(img.x + img.width - (c.x + c.width) - 8)).toBeLessThanOrEqual(1);
        expect(await style(close, "background-color")).toBe(await token(page, "surface"));
        expect(await style(close, "color")).toBe(await token(page, "teal"));
        expect(await style(close, "border-radius")).toBe("0px");
        expect(await style(dialog, "border-radius")).toBe("0px");
        const footer = dialog.getByRole("link", { name: "[Request Inquiry]" }).locator("xpath=..");
        const f = await box(footer);
        expect(Math.abs(f.height - 88)).toBeLessThanOrEqual(1);
        expect(Math.abs(f.y + f.height - (d.y + d.height))).toBeLessThanOrEqual(1);
        expect(await style(footer, "border-top-width")).toBe("1px");
        expect(await style(footer, "background-color")).toBe(await token(page, "ivory"));
        const kicker = dialog.getByText("[Experience · Place]");
        expect(await style(kicker, "font-size")).toBe("12px");
        expect(await style(kicker, "text-transform")).toBe(rtl ? "none" : "uppercase");
      });

      test("Escape closes and focus returns to the card", async ({ page }) => {
        await openIt(page);
        await page.keyboard.press("Escape");
        await expect(dialogOf(page)).toHaveCount(0);
        await expect(cardButton(page)).toBeFocused();
      });

      test("the close square closes and focus returns to the card", async ({ page }) => {
        await openIt(page);
        await dialogOf(page).getByRole("button", { name: "[Close]" }).click();
        await expect(dialogOf(page)).toHaveCount(0);
        await expect(cardButton(page)).toBeFocused();
      });

      test("a scrim click closes (md up); on phone no scrim is reachable", async ({ page }) => {
        await openIt(page);
        if (phone) {
          const inside = await page.evaluate(() => {
            const el = document.elementFromPoint(5, 5);
            return Boolean(el?.closest('[role="dialog"]'));
          });
          expect(inside).toBe(true);
          return;
        }
        await page.mouse.click(5, 5);
        await expect(dialogOf(page)).toHaveCount(0);
        await expect(cardButton(page)).toBeFocused();
      });

      test("Tab and Shift+Tab never leave the dialog", async ({ page }) => {
        await openIt(page);
        for (let i = 0; i < 15; i += 1) {
          await page.keyboard.press("Tab");
          expect(await insideDialog(page)).toBe(true);
        }
        for (let i = 0; i < 15; i += 1) {
          await page.keyboard.press("Shift+Tab");
          expect(await insideDialog(page)).toBe(true);
        }
      });

      test("the footer link works", async ({ page }) => {
        await openIt(page);
        await dialogOf(page).getByRole("link", { name: "[Request Inquiry]" }).click();
        await expect(page).toHaveURL(/s=inquiry/);
      });

      test("long body scrolls inside the panel while the footer stays docked", async ({ page }) => {
        await open(page, "dialog-detail", "long", locale, viewport);
        const dialog = dialogOf(page);
        await expect(dialog).toBeVisible();
        await stableBox(dialog);
        const footer = dialog.getByRole("link", { name: "[Request Inquiry]" }).locator("xpath=..");
        const scroller = dialog.locator('[class*="overflow-y-auto"]').first();
        const m = await scroller.evaluate((el) => ({ sh: el.scrollHeight, ch: el.clientHeight }));
        expect(m.sh).toBeGreaterThan(m.ch);
        const f0 = await box(footer);
        const img0 = await box(dialog.locator("img"));
        await scroller.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        const f1 = await box(footer);
        const img1 = await box(dialog.locator("img"));
        expect(Math.abs(f1.y - f0.y)).toBeLessThanOrEqual(1);
        expect(f1.y + f1.height).toBeLessThanOrEqual(vp.height + 1);
        expect(Math.abs(img1.y - img0.y)).toBeLessThanOrEqual(1);
        expect(await page.evaluate(() => window.scrollY)).toBe(0);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: "[before]" })).toBeFocused();
      });

      test("without media the close square and the h2 do not overlap", async ({ page }) => {
        await open(page, "dialog-detail", "no-media", locale, viewport);
        const dialog = dialogOf(page);
        await expect(dialog).toBeVisible();
        await stableBox(dialog);
        await expect(dialog.locator("img")).toHaveCount(0);
        const c = await box(dialog.getByRole("button", { name: "[Close]" }));
        const h = await box(dialog.locator("h2"));
        const apart = c.x + c.width <= h.x || h.x + h.width <= c.x || c.y + c.height <= h.y || h.y + h.height <= c.y;
        expect(apart).toBe(true);
      });
    });
  }
}
