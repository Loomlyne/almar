import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { OPS_CATALOG_COPY } from "../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { VIEWPORTS, settle } from "./journey/matrix";

// The three panel options for Experiences and services (plan 03.2-06, owner 2026-10-14), on the harness scene
// tests/journey/scenes/ops-panel-options.tsx. Pictures only: nothing is wired. The block runs only when asked:
// OPS_PANEL_OPTIONS=1 writes into pictures/03.2-06/panel-options/, =<absolute folder> writes there.
// Frames per option: main (1440, 390, and 390 with the Arabic dashboard), translations (Edit translations open) and
// failed (the AI did not finish: Publish waits and says why), the last two at 1440 and 390.

const TO = process.env.OPS_PANEL_OPTIONS;
const FOLDER = TO && isAbsolute(TO) ? TO : join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-06", "panel-options");
const OPTIONS = ["a", "b", "c"] as const;
const SHOTS: { frame: "main" | "translations" | "failed"; width: 1440 | 390; locale: "en" | "ar" }[] = [
  { frame: "main", width: 1440, locale: "en" },
  { frame: "main", width: 390, locale: "en" },
  { frame: "main", width: 390, locale: "ar" },
  { frame: "translations", width: 1440, locale: "en" },
  { frame: "translations", width: 390, locale: "en" },
  { frame: "failed", width: 1440, locale: "en" },
  { frame: "failed", width: 390, locale: "en" },
];
/** Tall pages, so the whole panel is in the picture. */
const HEIGHT = { 1440: 2600, 390: 4200 } as const;

async function inPicture(page: Page, target: Locator) {
  const shown = target.filter({ visible: true }).first();
  await expect(shown).toBeVisible({ timeout: 10_000 });
  const box = await shown.boundingBox();
  const size = page.viewportSize();
  expect(box).not.toBeNull();
  if (box && size) {
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
  }
}

test.describe("panel options", () => {
  test.skip(!TO, "pictures for the owner's choice; set OPS_PANEL_OPTIONS=1 (or a folder) to shoot them");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (TO) mkdirSync(FOLDER, { recursive: true });

  for (const option of OPTIONS) {
    for (const shot of SHOTS) {
      test(`${option} ${shot.frame} ${shot.width} ${shot.locale}`, async ({ page }) => {
        const copy = OPS_CATALOG_COPY[shot.locale];
        const kit = OPS_KIT_COPY[shot.locale];
        await page.setViewportSize({ width: shot.width, height: HEIGHT[shot.width] });
        await page.goto(`/__harness?c=ops-panel-options&s=${option}-${shot.frame}&l=${shot.locale}`);
        await settle(page);
        await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
        await page.waitForFunction((l) => document.documentElement.lang === l, shot.locale);

        const publish = page.getByRole("button", { name: kit.publish, exact: true });
        const lines: Locator[] = [
          page.getByRole("heading", { name: copy.panel.sectionText }),
          page.getByRole("heading", { name: copy.panel.sectionPrice }),
          page.getByRole("heading", { name: copy.panel.sectionPhoto }),
          page.getByRole("heading", { name: copy.panel.sectionSettings }),
          page.getByRole("heading", { name: copy.panel.sectionConnections }),
          page.getByText(copy.panel.englishOnly, { exact: true }),
          page.getByText(copy.items.isHomePickup, { exact: true }),
          page.getByRole("button", { name: kit.save, exact: true }),
          publish,
        ];
        if (shot.frame === "main") {
          lines.push(page.getByText(copy.panel.translationsUpdated, { exact: true }), page.getByRole("button", { name: copy.panel.editTranslations }));
          await expect(publish).toBeEnabled();
        }
        if (shot.frame === "translations") {
          lines.push(page.getByText(copy.panel.translationsNote, { exact: true }), page.getByRole("button", { name: copy.panel.hideTranslations }));
          // Arabic and Spanish fields are in the picture, the Arabic one reading right to left.
          await expect(page.locator('[lang="ar"][dir="rtl"]').first()).toBeVisible();
          await expect(page.locator('[lang="es"]').first()).toBeVisible();
        }
        if (shot.frame === "failed") {
          lines.push(page.getByText(copy.panel.translationFailed, { exact: true }), page.getByRole("button", { name: copy.panel.editTranslations }));
          await expect(publish).toBeDisabled();
        }
        for (const line of lines) await inPicture(page, line);

        // A wide panel really is wide (A and C), and the page never scrolls sideways.
        if (shot.width === 1440 && option !== "b") {
          const box = await page.getByTestId("panel-box").boundingBox();
          expect(box?.width ?? 0).toBeGreaterThanOrEqual(option === "a" ? 700 : 1000);
        }
        const text = await page.locator("body").innerText();
        expect(text, "no label printed as an object").not.toContain("[object");
        expect(text).not.toMatch(/\bundefined\b|\bNaN\b/);
        await expect(page.locator('input[type="radio"], [role="radio"]')).toHaveCount(0);
        const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(wide, "the page scrolls sideways").toBeLessThanOrEqual(1);

        await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
        await page.waitForTimeout(400);
        await page.screenshot({ path: join(FOLDER, `${option.toUpperCase()}-${shot.frame}-${shot.width}-${shot.locale}.png`), fullPage: true });
      });
    }
  }
});
