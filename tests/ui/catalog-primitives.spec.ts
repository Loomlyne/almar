import { test, type Locator, type Page } from "@playwright/test";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open, style, token } from "./_helpers";

// Slice 2 catalogue primitives (plan 03.3-11): ChipGroup vertical, Chip removable, CheckboxGroup, CountBadge,
// and the SiteNav current-page mark on localised pages. Scenes: tests/journey/scenes/{chip-group-vertical,
// chip-remove,checkbox-group,count-badge,site-nav-localised}.tsx. Runs under the dev-server config
// (ALMAR_HARNESS=1), not the build config. Every colour is read through token(), never typed.

async function box(loc: Locator) {
  const b = await loc.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}

/** The box of the first text node inside an element, so the start of the text can be compared with its container. */
const textBox = (loc: Locator) =>
  loc.evaluate((el) => {
    const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
    let node = walker.nextNode();
    while (node && !node.textContent?.trim()) node = walker.nextNode();
    if (!node) throw new Error("no text");
    const range = document.createRange();
    range.selectNodeContents(node);
    const r = range.getBoundingClientRect();
    return { x: r.x, right: r.right, width: r.width };
  });

const group = (page: Page, name: string) => page.getByRole("group", { name });

for (const viewport of WIDTHS) {
  for (const locale of LOCALES) {
    const where = `${locale} ${VIEWPORTS[viewport].width}`;
    const rtl = locale === "ar";
    const phone = viewport === "phone";

    test.describe(`ChipGroup vertical ${where}`, () => {
      test("stacked full-width 44px toggles, 8px apart, one pressed", async ({ page }) => {
        await open(page, "chip-group-vertical", "default", locale, viewport);
        const g = group(page, "[Type]");
        await expect(g).toBeVisible();
        const chips = g.getByRole("button");
        await expect(chips).toHaveCount(3);
        const gb = await box(g);
        const boxes = [await box(chips.nth(0)), await box(chips.nth(1)), await box(chips.nth(2))];
        for (let i = 0; i < 3; i += 1) {
          expect(Math.abs(boxes[i].x - boxes[0].x)).toBeLessThanOrEqual(1);
          expect(Math.abs(boxes[i].width - gb.width)).toBeLessThanOrEqual(1);
          expect(Math.abs(boxes[i].height - 44)).toBeLessThanOrEqual(1);
          if (i > 0) {
            expect(boxes[i].y).toBeGreaterThan(boxes[i - 1].y);
            expect(Math.abs(boxes[i].y - (boxes[i - 1].y + boxes[i - 1].height) - 8)).toBeLessThanOrEqual(1);
          }
        }
        await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "true");
        await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "false");
        await expect(chips.nth(2)).toHaveAttribute("aria-pressed", "false");
      });

      test("pressing the second moves the press; pressing it again is no change", async ({ page }) => {
        await open(page, "chip-group-vertical", "default", locale, viewport);
        const chips = group(page, "[Type]").getByRole("button");
        await chips.nth(1).click();
        await expect(chips.nth(0)).toHaveAttribute("aria-pressed", "false");
        await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
        await expect(chips.nth(2)).toHaveAttribute("aria-pressed", "false");
        await expect(page.getByTestId("cgv-value")).toHaveText("experience");
        await expect(page.getByTestId("cgv-calls")).toHaveText("1");
        await chips.nth(1).click();
        await expect(page.getByTestId("cgv-calls")).toHaveText("1");
      });

      test("Tab visits the three top to bottom; Space and Enter press a focused chip", async ({ page }) => {
        await open(page, "chip-group-vertical", "default", locale, viewport);
        const chips = group(page, "[Type]").getByRole("button");
        await page.getByRole("button", { name: "[before]" }).focus();
        for (let i = 0; i < 3; i += 1) {
          await page.keyboard.press("Tab");
          await expect(chips.nth(i)).toBeFocused();
        }
        await page.keyboard.press("Tab");
        await expect(page.getByRole("button", { name: "[after]" })).toBeFocused();
        await chips.nth(1).focus();
        await page.keyboard.press("Space");
        await expect(chips.nth(1)).toHaveAttribute("aria-pressed", "true");
        await chips.nth(2).focus();
        await page.keyboard.press("Enter");
        await expect(chips.nth(2)).toHaveAttribute("aria-pressed", "true");
        await expect(page.getByTestId("cgv-value")).toHaveText("service");
      });

      test("style: surface when off, teal when on, square, label 12px uppercase (not in ar), text at the inline start", async ({
        page,
      }) => {
        await open(page, "chip-group-vertical", "default", locale, viewport);
        const chips = group(page, "[Type]").getByRole("button");
        expect(await style(chips.nth(1), "background-color")).toBe(await token(page, "surface"));
        expect(await style(chips.nth(0), "background-color")).toBe(await token(page, "teal"));
        expect(await style(chips.nth(1), "border-radius")).toBe("0px");
        const label = page.getByText("[Type]", { exact: true });
        expect(await style(label, "font-size")).toBe("12px");
        expect(await style(label, "text-transform")).toBe(rtl ? "none" : "uppercase");
        const b = await box(chips.nth(1));
        const t = await textBox(chips.nth(1));
        if (rtl) expect(b.x + b.width - t.right).toBeLessThanOrEqual(17);
        else expect(t.x - b.x).toBeLessThanOrEqual(17);
      });

      test("one state drives a vertical rail and a horizontal row", async ({ page }) => {
        await open(page, "chip-group-vertical", "both", locale, viewport);
        await group(page, "[Type rail]").getByRole("button", { name: "[Services]" }).click();
        await expect(group(page, "[Type row]").getByRole("button", { name: "[Services]" })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
        await expect(group(page, "[Type rail]").getByRole("button", { name: "[Services]" })).toHaveAttribute(
          "aria-pressed",
          "true",
        );
      });
    });

    test.describe(`Chip removable ${where}`, () => {
      const names = ["[Cartagena]", "[Medellín]", "[A much longer private stay name that wraps]"];
      const remove = (page: Page, text: string) =>
        page.getByRole("button", { name: `[Remove filter]: ${text}`, exact: true });

      test("named by removeLabel, no aria-pressed, contains its text, glyph hidden", async ({ page }) => {
        await open(page, "chip-remove", "filters", locale, viewport);
        for (const text of names) {
          const chip = remove(page, text);
          await expect(chip).toHaveCount(1);
          await expect(chip).not.toHaveAttribute("aria-pressed", /.*/);
          await expect(chip).toContainText(text);
          await expect(chip.locator("svg")).toHaveAttribute("aria-hidden", "true");
        }
      });

      test("click, Enter and Space each remove one", async ({ page }) => {
        await open(page, "chip-remove", "filters", locale, viewport);
        await remove(page, names[1]).click();
        await expect(page.getByTestId("chips-left")).toHaveText([names[0], names[2]].join(","));
        await remove(page, names[0]).focus();
        await page.keyboard.press("Enter");
        await expect(page.getByTestId("chips-left")).toHaveText(names[2]);
        await remove(page, names[2]).focus();
        await page.keyboard.press("Space");
        await expect(page.getByTestId("chips-left")).toHaveText("");
      });

      test("style: teal-tint ground, teal text, 40px, square, 14px, glyph at the inline end", async ({ page }) => {
        await open(page, "chip-remove", "filters", locale, viewport);
        const chip = remove(page, names[0]);
        expect(await style(chip, "background-color")).toBe(await token(page, "teal-tint"));
        expect(await style(chip, "color")).toBe(await token(page, "teal"));
        expect(Math.abs((await box(chip)).height - 40)).toBeLessThanOrEqual(0.5);
        expect(await style(chip, "border-top-width")).toBe("0px");
        expect(await style(chip, "border-radius")).toBe("0px");
        expect(await style(chip, "font-size")).toBe("14px");
        const t = await textBox(chip);
        const s = await box(chip.locator("svg"));
        if (rtl) expect(s.x).toBeLessThan(t.x);
        else expect(s.x).toBeGreaterThan(t.x);
      });

      test("no horizontal overflow and every chip inside the viewport", async ({ page }) => {
        await open(page, "chip-remove", "filters", locale, viewport);
        const over = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
        expect(over).toBe(true);
        for (const text of names) {
          const b = await box(remove(page, text));
          expect(b.x).toBeGreaterThanOrEqual(-1);
          expect(b.x + b.width).toBeLessThanOrEqual(VIEWPORTS[viewport].width + 1);
        }
      });
    });

    test.describe(`CheckboxGroup ${where}`, () => {
      const boxes = (page: Page) => group(page, "[Destination]").getByRole("checkbox");

      test("five unchecked checkboxes; toggling reports options order", async ({ page }) => {
        await open(page, "checkbox-group", "default", locale, viewport);
        await expect(boxes(page)).toHaveCount(5);
        for (let i = 0; i < 5; i += 1) await expect(boxes(page).nth(i)).not.toBeChecked();
        await page.getByText("[Option C]", { exact: true }).click();
        await expect(boxes(page).nth(2)).toBeChecked();
        await expect(page.getByTestId("cbg-value")).toHaveText("c");
        await page.getByText("[Option A]", { exact: true }).click();
        await expect(page.getByTestId("cbg-value")).toHaveText("a,c");
        await page.getByText("[Option C]", { exact: true }).click();
        await expect(page.getByTestId("cbg-value")).toHaveText("a");
      });

      test("keyboard: Tab to A, Space toggles it off, Tab through B..E then out", async ({ page }) => {
        await open(page, "checkbox-group", "default", locale, viewport);
        await page.getByText("[Option A]", { exact: true }).click();
        await page.getByRole("button", { name: "[before]" }).focus();
        await page.keyboard.press("Tab");
        await expect(boxes(page).nth(0)).toBeFocused();
        await page.keyboard.press("Space");
        await expect(page.getByTestId("cbg-value")).toHaveText("");
        for (let i = 1; i < 5; i += 1) {
          await page.keyboard.press("Tab");
          await expect(boxes(page).nth(i)).toBeFocused();
        }
        await page.keyboard.press("Tab");
        await expect(page.getByRole("button", { name: "[after]" })).toBeFocused();
      });

      test("geometry and style: rows >= 44px, 20px square boxes, teal when checked, legend 12px muted", async ({ page }) => {
        await open(page, "checkbox-group", "default", locale, viewport);
        const g = group(page, "[Destination]");
        for (let i = 0; i < 5; i += 1) {
          const row = g.locator("label").nth(i);
          expect((await box(row)).height).toBeGreaterThanOrEqual(43.5);
          const b = await box(boxes(page).nth(i));
          expect(Math.abs(b.width - 20)).toBeLessThanOrEqual(0.5);
          expect(Math.abs(b.height - 20)).toBeLessThanOrEqual(0.5);
          expect(await style(boxes(page).nth(i), "border-radius")).toBe("0px");
        }
        await page.getByText("[Option B]", { exact: true }).click();
        expect(await style(boxes(page).nth(1), "background-color")).toBe(await token(page, "teal"));
        await expect(g.locator("label").nth(1).locator("svg")).toBeVisible();
        const legend = g.locator("legend");
        expect(await style(legend, "font-size")).toBe("12px");
        expect(await style(legend, "color")).toBe(await token(page, "muted"));
        expect(await style(legend, "text-transform")).toBe(rtl ? "none" : "uppercase");
        const cb = await box(boxes(page).nth(0));
        const t = await textBox(g.locator("label").nth(0).locator("span").last());
        if (rtl) expect(cb.x).toBeGreaterThan(t.x);
        else expect(cb.x).toBeLessThan(t.x);
        await expect(page.locator("input[type=radio]")).toHaveCount(0);
      });

      test("no options renders nothing; a stale value is dropped from the next report", async ({ page }) => {
        await open(page, "checkbox-group", "empty", locale, viewport);
        await expect(page.locator("fieldset")).toHaveCount(0);
        await open(page, "checkbox-group", "stale", locale, viewport);
        await expect(boxes(page).nth(1)).toBeChecked();
        await page.getByText("[Option A]", { exact: true }).click();
        await expect(page.getByTestId("cbg-value")).toHaveText("a,b");
      });
    });

    test.describe(`CountBadge ${where}`, () => {
      test("digits, size, tokens and accessible name", async ({ page }) => {
        await open(page, "count-badge", "in-button", locale, viewport);
        const bdi = page.locator("bdi");
        await expect(bdi).toHaveText("2");
        expect(await bdi.textContent()).toMatch(/^[0-9]+$/);
        const badge = bdi.locator("xpath=..");
        const b = await box(badge);
        expect(Math.abs(b.height - 20)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(b.width - 20)).toBeLessThanOrEqual(0.5);
        expect(await style(badge, "background-color")).toBe(await token(page, "teal"));
        expect(await style(badge, "color")).toBe(await token(page, "ivory"));
        expect(await style(badge, "font-size")).toBe("12px");
        expect(await style(badge, "font-variant-numeric")).toContain("tabular-nums");
        expect(await style(badge, "border-radius")).toBe("0px");
        await expect(page.getByRole("button", { name: /\[Filters\].*\[2 filters on\]/ })).toHaveCount(1);
        await expect(badge).toHaveAttribute("aria-hidden", "true");
        await page.getByRole("button", { name: "[+1]" }).click();
        await expect(bdi).toHaveText("3");
        await expect(page.getByRole("button", { name: /\[3 filters on\]/ })).toHaveCount(1);
      });

      test("zero renders nothing", async ({ page }) => {
        await open(page, "count-badge", "zero", locale, viewport);
        await expect(page.locator("bdi")).toHaveCount(0);
        await expect(page.getByRole("button")).toHaveText("[Filters]");
      });

      test("two digits widen the badge, never its height", async ({ page }) => {
        await open(page, "count-badge", "large", locale, viewport);
        const bdi = page.locator("bdi");
        await expect(bdi).toHaveText("17");
        const b = await box(bdi.locator("xpath=.."));
        expect(Math.abs(b.height - 20)).toBeLessThanOrEqual(0.5);
        expect(b.width).toBeGreaterThan(20);
      });
    });

    test.describe(`SiteNav current page ${where}`, () => {
      const expected = rtl ? "/ar/experiences" : locale === "es" ? "/es/experiences" : "/experiences";

      for (const state of ["english-path", "localised-path"]) {
        test(`${state}: exactly one link is current and it is underlined`, async ({ page }) => {
          await open(page, "site-nav-localised", state, locale, viewport);
          if (viewport !== "desktop") await page.locator("header button[aria-controls]").first().click();
          const current = page.locator('header a[aria-current="page"]');
          await expect(current).toHaveCount(1);
          await expect(current).toHaveAttribute("href", expected);
          await expect(current).toBeVisible();
          expect(await style(current, "text-decoration-line")).toContain("underline");
          expect(await style(current, "text-decoration-thickness")).toBe("2px");
        });
      }

      test("a page that is not in the nav marks none", async ({ page }) => {
        await open(page, "site-nav-localised", "not-in-nav", locale, viewport);
        await expect(page.locator('header a[aria-current="page"]')).toHaveCount(0);
      });
    });
  }
}
