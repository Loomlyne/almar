import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { OPS_STAYS_COPY } from "../lib/copy/ops-stays";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// Catalog -> Stays on its harness scene (tests/journey/scenes/ops-stays.tsx). The API is never called: the scene holds
// its own state and writes every handler the list calls into a hidden log (`ops-stays-log`). Nothing here waits for
// /api/ops/*. The behaviour block (request bodies against /api/ops/* mocks) comes with the wiring, after the owner has
// signed the pictures and chosen the panel.

type Locale = "en" | "ar" | "es";

const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-stays&s=${state}&l=${locale}`;

async function openScene(page: Page, state: string, viewport: Viewport, locale: Locale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(harnessUrl(state, locale));
  await settle(page);
  // The dev server's own indicator can sit over the page corner.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

// ---- copy ---------------------------------------------------------------------------------------------------------
// Every label is a string, none empty, the same keys in all three languages (a duplicate key once printed "[object Object]").

test("copy: every label is a non-empty string in en, ar and es", () => {
  const keys = Object.keys(OPS_STAYS_COPY.en).sort();
  for (const locale of ["en", "ar", "es"] as const) {
    expect(Object.keys(OPS_STAYS_COPY[locale]).sort(), `${locale} keys`).toEqual(keys);
    for (const [key, value] of Object.entries(OPS_STAYS_COPY[locale])) {
      expect(typeof value, `${locale}.${key}`).toBe("string");
      expect((value as string).trim(), `${locale}.${key} empty`).not.toBe("");
      expect(value as string, `${locale}.${key}`).not.toContain("[object");
    }
  }
});

// ---- pictures -----------------------------------------------------------------------------------------------------
// Full-page PNGs for the owner's signature, written outside tests/ (page.screenshot, not toHaveScreenshot), so no
// baseline is committed under tests/. States x 3 widths x 3 languages. The block runs only when asked:
// OPS_STAYS_PICTURES=1 writes into the planning folder, OPS_STAYS_PICTURES=<absolute folder> writes there.

const PICTURES_DEFAULT = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-07");
const PICTURES_TO = process.env.OPS_STAYS_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : PICTURES_DEFAULT;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const PICTURE_LOCALES = ["en", "ar", "es"] as const;

test.describe("pictures", () => {
  test.skip(!PICTURES_TO, "set OPS_STAYS_PICTURES=1 (or an absolute folder) to shoot the pictures");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("ops-stays")) {
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await openScene(page, state, viewport, locale);
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          // The picture must show strings, never an object that was printed by mistake.
          const body = (await page.locator("body").innerText()) ?? "";
          expect(body, "no [object] in the scene").not.toContain("[object");
          // Network idle is capped (a bare wait times out on a cold dev server), then a short settle.
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          await page.screenshot({ path: join(PICTURES, `${state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});
