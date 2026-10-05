import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { DASHBOARD_COPY } from "../lib/copy/dashboard";
import { OPS_CONTENT_COPY, type ComingSoonKind } from "../lib/copy/ops-content";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// The four Coming soon pages of Content (Pages, Blog, Legal, Navigation and footer) and the rail that links to them, on
// the harness scene tests/journey/scenes/ops-coming-soon.tsx. Nothing here calls the API: the pages hold no data.

type Locale = "en" | "ar";

const KINDS: ComingSoonKind[] = ["pages", "blog", "legal", "navigation"];
const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-coming-soon&s=${state}&l=${locale}`;

async function openScene(page: Page, state: string, viewport: Viewport, locale: Locale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(harnessUrl(state, locale));
  await settle(page);
  // The dev server's own indicator can sit over the page corner.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

// ---- pictures -----------------------------------------------------------------------------------------------------
// Full-page PNGs for the owner's signature (page.screenshot, not toHaveScreenshot: no baseline is committed under
// tests/): 4 states x 3 widths x 2 languages. COMING_SOON_PICTURES=<absolute folder> writes somewhere else (for a
// side-by-side comparison); the default is the planning folder the owner signs from.

const SIGNED_PICTURES = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-12");
const PICTURES_TO = process.env.COMING_SOON_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : SIGNED_PICTURES;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const PICTURE_LOCALES = ["en", "ar"] as const;

test.describe("pictures", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("ops-coming-soon")) {
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await openScene(page, state, viewport, locale);
          if (viewport === "desktop") {
            // Open the Catalog group, as a person would, so the picture also shows Packages without a Soon chip.
            await page.getByRole("button", { name: DASHBOARD_COPY[locale].rail.catalog, exact: true }).click();
            await expect(page.getByRole("link", { name: DASHBOARD_COPY[locale].rail.packages, exact: true })).toBeVisible();
            // The pointer rests in the middle of the page, on neither rail (left in English, right in Arabic): a hover tint is not part of the picture.
            await page.mouse.move(VIEWPORTS[viewport].width / 2, VIEWPORTS[viewport].height - 40);
          }
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          // Network idle is capped (a bare wait times out on a cold dev server), then a short settle.
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          await page.screenshot({ path: join(PICTURES, `${state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});

// ---- behaviour ----------------------------------------------------------------------------------------------------
// At 390 and 1440, in English and Arabic: the words, no control on the page, the direction, the rail.

const COMBOS: { viewport: Viewport; locale: Locale }[] = [
  { viewport: "phone", locale: "en" },
  { viewport: "phone", locale: "ar" },
  { viewport: "desktop", locale: "en" },
  { viewport: "desktop", locale: "ar" },
];

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(overflow.scroll, "page scrollWidth").toBeLessThanOrEqual(overflow.client);
}

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);

  for (const { viewport, locale } of COMBOS) {
    const width = VIEWPORTS[viewport].width;
    const dashboard = DASHBOARD_COPY[locale];
    const content = OPS_CONTENT_COPY[locale];
    const rtl = locale === "ar";
    const at = `${width} ${locale}`;

    test.describe(at, () => {
      for (const kind of KINDS) {
        test(`${kind}: title, line and list are the signed words; no button, no input; direction (${at})`, async ({ page }) => {
          await openScene(page, kind, viewport, locale);
          const block = content.comingSoon[kind];
          const main = page.locator("#content");
          await expect(page.locator("html")).toHaveAttribute("dir", rtl ? "rtl" : "ltr");
          await expect(main.getByRole("heading", { level: 1 })).toHaveText(dashboard.rail[kind]);
          const card = main.getByTestId("coming-soon");
          await expect(card).toHaveAttribute("data-kind", kind);
          await expect(card.getByText(content.soon, { exact: true })).toBeVisible();
          await expect(card.getByRole("heading", { level: 2 })).toHaveText(block.title);
          await expect(card.getByText(block.text, { exact: true })).toBeVisible();
          // The list is there only where the canvas draws one (Pages, Blog); Legal and Navigation have none.
          await expect(card.getByRole("listitem")).toHaveCount(block.items.length);
          for (const item of block.items) await expect(card.getByRole("listitem").filter({ hasText: item })).toHaveCount(1);

          // Nothing on the page can be pressed or typed in.
          await expect(main.locator("button, input, select, textarea, a[href], [role='button'], [role='radio'], [contenteditable]")).toHaveCount(0);
          await expect(page.locator('input[type="radio"], [role="radio"]')).toHaveCount(0);
          await expectNoSidewaysScroll(page);
        });
      }

      test(`rail: Content lists Pages, Blog, Team, Legal, Media, Navigation and footer; four carry Soon; Packages does not (${at})`, async ({ page }) => {
        await openScene(page, "pages", viewport, locale);
        if (viewport === "phone") {
          // Below 1280 px the rail is the Menu drawer.
          await page.getByRole("button", { name: dashboard.menu, exact: true }).click();
        }
        const nav = page.getByRole("navigation", { name: dashboard.dashboardName });
        await expect(nav).toBeVisible();

        const hrefs = await nav.locator('a[href^="/dashboard/content/"]').evaluateAll((links) => links.map((link) => link.getAttribute("href")));
        expect(hrefs).toEqual(
          ["pages", "blog", "team", "legal", "media", "navigation"].map((section) => `/dashboard/content/${section}`),
        );

        // The accessible name ends with the chip's word: "Pages, Soon" ("الصفحات، قريبًا").
        const separator = rtl ? "، " : ", ";
        const soon = [
          ["pages", dashboard.rail.pages],
          ["blog", dashboard.rail.blog],
          ["legal", dashboard.rail.legal],
          ["navigation", dashboard.rail.navigation],
        ] as const;
        for (const [section, label] of soon) {
          const link = nav.locator(`a[href="/dashboard/content/${section}"]`);
          await expect(link).toHaveAccessibleName(`${label}${separator}${dashboard.soon}`);
          await expect(link.getByText(dashboard.soon, { exact: true })).toBeVisible();
        }
        for (const [section, label] of [
          ["team", dashboard.rail.team],
          ["media", dashboard.rail.media],
        ] as const) {
          const link = nav.locator(`a[href="/dashboard/content/${section}"]`);
          await expect(link).toHaveAccessibleName(label);
          await expect(link.getByText(dashboard.soon, { exact: true })).toHaveCount(0);
        }

        // Pages is the current entry on its own page.
        await expect(nav.locator('a[href="/dashboard/content/pages"]')).toHaveAttribute("aria-current", "page");

        // Packages (Catalog group, closed until it is pressed) carries no chip: C-15 made it a live section.
        await nav.getByRole("button", { name: dashboard.rail.catalog, exact: true }).click();
        const packages = nav.locator('a[href="/dashboard/catalog/packages"]');
        await expect(packages).toBeVisible();
        await expect(packages).toHaveAccessibleName(dashboard.rail.packages);
        await expect(packages.getByText(dashboard.soon, { exact: true })).toHaveCount(0);

        // The chip sits at the end of the row in the reading direction: right in English, left in Arabic.
        const chip = nav.locator('a[href="/dashboard/content/legal"]').getByText(dashboard.soon, { exact: true });
        const row = nav.locator('a[href="/dashboard/content/legal"]');
        const [chipBox, rowBox] = [await chip.boundingBox(), await row.boundingBox()];
        expect(chipBox && rowBox).toBeTruthy();
        if (chipBox && rowBox) {
          if (rtl) expect(chipBox.x - rowBox.x, "chip near the left edge of the row").toBeLessThan(rowBox.width / 2);
          else expect(chipBox.x - rowBox.x, "chip near the right edge of the row").toBeGreaterThan(rowBox.width / 2);
        }
        await expectNoSidewaysScroll(page);
      });
    });
  }
});
