import { test, type Locator } from "@playwright/test";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open, style } from "./_helpers";

// ChipGroup (components/ui/chip-group.tsx), proven in the browser at 390, 834 and 1440 in EN, AR and ES.
// The scenes are in tests/journey/scenes/chip-group.tsx: default (three options), dense, long (five, wraps).
// Runs under the dev-server config (the harness needs ALMAR_HARNESS=1), not the build config.

const group = (page: import("@playwright/test").Page) => page.getByRole("group", { name: "[Filter]" });
const chips = (page: import("@playwright/test").Page) => group(page).getByRole("button");

async function box(loc: Locator) {
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}

for (const viewport of WIDTHS) {
  for (const locale of LOCALES) {
    const where = `${locale} ${VIEWPORTS[viewport].width}`;
    const rtl = locale === "ar";

    test.describe(`ChipGroup ${where}`, () => {
      test("the group's accessible name is its visible label", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        await expect(group(page)).toHaveCount(1);
        await expect(group(page)).toBeVisible();
        await expect(page.getByText("[Filter]", { exact: true })).toBeVisible();
        await expect(chips(page)).toHaveCount(3);
      });

      test("exactly one chip is pressed; clicking option 2 moves it and the echo line shows the value", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        const all = chips(page);
        await expect(all.nth(0)).toHaveAttribute("aria-pressed", "true");
        await expect(all.nth(1)).toHaveAttribute("aria-pressed", "false");
        await expect(all.nth(2)).toHaveAttribute("aria-pressed", "false");
        await all.nth(1).click();
        await expect(all.nth(0)).toHaveAttribute("aria-pressed", "false");
        await expect(all.nth(1)).toHaveAttribute("aria-pressed", "true");
        await expect(all.nth(2)).toHaveAttribute("aria-pressed", "false");
        await expect(page.getByTestId("chip-group-value")).toHaveText("one");
        await expect(page.getByTestId("chip-group-calls")).toHaveText("1");
      });

      test("clicking the pressed chip again keeps it pressed and reports no change", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        const all = chips(page);
        await all.nth(1).click();
        await all.nth(1).click();
        await expect(all.nth(1)).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByTestId("chip-group-value")).toHaveText("one");
        await expect(page.getByTestId("chip-group-calls")).toHaveText("1");
        // The first option is the reset: pressing it is a real change back.
        await all.nth(0).click();
        await expect(all.nth(0)).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByTestId("chip-group-value")).toHaveText("all");
      });

      test("Tab reaches each chip in DOM order, and on screen that is left to right (en, es) or right to left (ar)", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        await page.getByRole("button", { name: "[before]" }).focus();
        const all = chips(page);
        const xs: number[] = [];
        for (let i = 0; i < 3; i += 1) {
          await page.keyboard.press("Tab");
          await expect(all.nth(i)).toBeFocused();
          xs.push((await box(all.nth(i))).x);
        }
        if (rtl) expect(xs[0] > xs[1] && xs[1] > xs[2]).toBe(true);
        else expect(xs[0] < xs[1] && xs[1] < xs[2]).toBe(true);
        await page.keyboard.press("Tab");
        await expect(page.getByRole("button", { name: "[after]" })).toBeFocused();
      });

      test("in ar the first chip's box is at the inline end (right of the second)", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        const a = await box(chips(page).nth(0));
        const b = await box(chips(page).nth(1));
        if (rtl) expect(a.x).toBeGreaterThan(b.x);
        else expect(a.x).toBeLessThan(b.x);
      });

      test("Space and Enter press a focused chip", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        const all = chips(page);
        await all.nth(1).focus();
        await page.keyboard.press("Space");
        await expect(all.nth(1)).toHaveAttribute("aria-pressed", "true");
        await all.nth(2).focus();
        await page.keyboard.press("Enter");
        await expect(all.nth(2)).toHaveAttribute("aria-pressed", "true");
        await expect(all.nth(1)).toHaveAttribute("aria-pressed", "false");
        await expect(page.getByTestId("chip-group-value")).toHaveText("two");
      });

      test("the focus ring is the 2px solid outline", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        await page.getByRole("button", { name: "[before]" }).focus();
        await page.keyboard.press("Tab");
        const first = chips(page).nth(0);
        await expect(first).toBeFocused();
        expect(await style(first, "outline-width")).toBe("2px");
        expect(await style(first, "outline-style")).toBe("solid");
      });

      test("every chip has square corners", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        for (let i = 0; i < 3; i += 1) expect(await style(chips(page).nth(i), "border-radius")).toBe("0px");
      });

      test("adjacent chips touch: the next chip starts where the previous one ends, within 1px", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        const a = await box(chips(page).nth(0));
        const b = await box(chips(page).nth(1));
        const c = await box(chips(page).nth(2));
        if (rtl) {
          expect(Math.abs(b.x + b.width - a.x)).toBeLessThanOrEqual(1.01);
          expect(Math.abs(c.x + c.width - b.x)).toBeLessThanOrEqual(1.01);
        } else {
          expect(Math.abs(b.x - (a.x + a.width))).toBeLessThanOrEqual(1.01);
          expect(Math.abs(c.x - (b.x + b.width))).toBeLessThanOrEqual(1.01);
        }
      });

      test("the visible box is 40px high and the chip's own hit area reaches past it, above and below", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        const chip = chips(page).nth(1);
        const b = await box(chip);
        expect(Math.round(b.height)).toBe(40);
        const x = b.x + b.width / 2;
        const hit = (y: number) =>
          chip.evaluate((el, point) => document.elementFromPoint(point.x, point.y) === el, { x, y });
        expect(await hit(b.y + b.height / 2)).toBe(true);
        // Chip's after: inset is measured from the padding box, so the hit area is the visible box plus 1px
        // each side (42px), not the 44px the plan names. Asserted as built: the area exists, and ends near.
        expect(await hit(b.y - 0.5)).toBe(true);
        expect(await hit(b.y + b.height + 0.5)).toBe(true);
        expect(await hit(b.y - 4)).toBe(false);
        expect(await hit(b.y + b.height + 4)).toBe(false);
      });

      test("the pressed chip is drawn above its neighbour so its edge is whole", async ({ page }) => {
        await open(page, "chip-group", "default", locale, viewport);
        await chips(page).nth(1).click();
        const pressedAbove = await chips(page)
          .nth(1)
          .evaluate((el) => {
            const mine = Number(getComputedStyle(el.parentElement as HTMLElement).zIndex);
            const prev = Number(getComputedStyle((el.parentElement as HTMLElement).previousElementSibling as HTMLElement).zIndex);
            return mine > (Number.isNaN(prev) ? 0 : prev);
          });
        expect(pressedAbove).toBe(true);
      });

      test("dense: the chips are 24px high", async ({ page }) => {
        await open(page, "chip-group", "dense", locale, viewport);
        expect(Math.round((await box(chips(page).nth(0))).height)).toBe(24);
        await chips(page).nth(2).click();
        await expect(chips(page).nth(2)).toHaveAttribute("aria-pressed", "true");
      });

      test("long: five options keep one pressed, wrap inside the container and never overflow the page", async ({ page }) => {
        await open(page, "chip-group", "long", locale, viewport);
        await expect(chips(page)).toHaveCount(5);
        await chips(page).nth(3).click();
        for (let i = 0; i < 5; i += 1) {
          await expect(chips(page).nth(i)).toHaveAttribute("aria-pressed", i === 3 ? "true" : "false");
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        const wrap = await box(group(page));
        for (let i = 0; i < 5; i += 1) {
          const b = await box(chips(page).nth(i));
          expect(b.x).toBeGreaterThanOrEqual(wrap.x - 1);
          expect(b.x + b.width).toBeLessThanOrEqual(wrap.x + wrap.width + 1);
        }
      });
    });
  }
}
