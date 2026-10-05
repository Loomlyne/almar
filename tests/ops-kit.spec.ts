import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// The editor kit on its harness scene (tests/journey/scenes/ops-kit.tsx). The API is never called: the scene holds
// its own state, so nothing here waits for /api/ops/*.

const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-kit&s=${state}&l=${locale}`;

// ---- pictures -----------------------------------------------------------------------------------------------------
// Full-page PNGs for the owner's signature, written outside tests/ (page.screenshot, not toHaveScreenshot), so no
// baseline is committed under tests/. 10 states x 3 widths x 2 languages.

const PICTURES = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-11");
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const PICTURE_LOCALES = ["en", "ar"] as const;

/** Bring a scene to the state its picture shows, using only what a person does (a key press, a click, a tick). */
async function prepare(page: Page, state: string) {
  if (state === "discard") {
    // Closing a panel with unsaved changes asks first.
    await page.keyboard.press("Escape");
    // The panel stays in the page (hidden from the accessibility tree while the question is open): two dialogs.
    await expect(page.locator('[role="dialog"]')).toHaveCount(2, { timeout: 10_000 });
  }
  if (state === "date-range") {
    await page.locator("#kit-range").click();
    await page.getByRole("grid").waitFor({ state: "visible", timeout: 10_000 });
  }
  if (state === "connect") {
    const boxes = page.locator("section ul input[type=checkbox]");
    for (const at of [0, 1, 2]) await boxes.nth(at).check();
  }
}

test.describe("pictures", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("ops-kit")) {
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await page.setViewportSize(VIEWPORTS[viewport]);
          await page.goto(harnessUrl(state, locale));
          await settle(page);
          // The dev server's own indicator can sit over the page corner.
          await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
          await page.waitForFunction((l) => document.documentElement.lang === l, locale);
          await prepare(page, state);
          // The panel focuses its first control on open; the ring is real but is not what the picture is for.
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
