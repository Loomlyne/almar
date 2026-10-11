import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { test, type Page } from "@playwright/test";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// The photo field, the picker, the upload form and the Media library on their harness scene
// (tests/journey/scenes/ops-media.tsx). The API is never called. Task 1 of 03.2-09 writes the pictures only; the
// behaviour block comes with Task 3, after the owner signs.

type Locale = "en" | "ar";

const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-media&s=${state}&l=${locale}`;

async function openScene(page: Page, state: string, viewport: Viewport, locale: Locale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(harnessUrl(state, locale));
  await settle(page);
  // The dev server's own indicator can sit over the page corner.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

// ---- pictures -----------------------------------------------------------------------------------------------------
// Full-page PNGs for the owner's signature, written outside tests/ (page.screenshot, not toHaveScreenshot), so no
// baseline is committed under tests/. 9 states x 3 widths x 2 languages. The block runs only when asked:
// OPS_MEDIA_PICTURES=1 writes into the planning folder, OPS_MEDIA_PICTURES=<folder> writes there.

const SIGNED_PICTURES = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-09");
const PICTURES_TO = process.env.OPS_MEDIA_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : SIGNED_PICTURES;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const PICTURE_LOCALES = ["en", "ar"] as const;

test.describe("pictures", () => {
  test.skip(!PICTURES_TO, "set OPS_MEDIA_PICTURES=1 (or a folder) to shoot the pictures");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("ops-media")) {
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await openScene(page, state, viewport, locale);
          // A docked panel or a phone sheet scrolls inside the viewport, and a picture cannot scroll: show the whole
          // panel on a taller screen so all three alt boxes and the buttons are in the picture.
          if (state === "library-panel") {
            await page.setViewportSize({ width: VIEWPORTS[viewport].width, height: viewport === "phone" ? 1400 : 1100 });
            await page.waitForTimeout(300);
          }
          // A panel focuses its first control on open; the ring is real but is not what the picture is for.
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          // Photos below the fold are lazy in the page; a full-page picture needs them loaded.
          await page.evaluate(() => Array.from(document.images).forEach((image) => (image.loading = "eager")));
          // The photos come from the media host: wait until every visible one has loaded before the shot.
          await page
            .waitForFunction(() => Array.from(document.images).every((image) => image.complete), undefined, { timeout: 15_000 })
            .catch(() => undefined);
          await page.waitForTimeout(400);
          await page.screenshot({ path: join(PICTURES, `${state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});
