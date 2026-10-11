import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { OPS_TRANSLATE_COPY, type OpsTranslateLocale } from "../lib/copy/ops-translate";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// The Translate button (plan 03.2-10) on its harness scene (tests/journey/scenes/ops-translate.tsx). Workers AI is
// never called: Task 1's draft button makes no request, and the scene renders each state directly.

const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-translate&s=${state}&l=${locale}`;

async function openScene(page: Page, state: string, viewport: Viewport, locale: OpsTranslateLocale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(harnessUrl(state, locale));
  await settle(page);
  // The dev server's own indicator can sit over the page corner.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

// ---- pictures -----------------------------------------------------------------------------------------------------
// Full-page PNGs for the owner's signature, written outside tests/ (page.screenshot, not toHaveScreenshot), so no
// baseline is committed under tests/. 8 states x 3 widths x 3 languages (EN, AR and the ES the owner's rule asks for).
// Not signed yet, so the block runs by default into the planning folder; OPS_TRANSLATE_PICTURES=<absolute folder>
// writes elsewhere. Once signed, gate it behind the variable as tests/ops-kit.spec.ts does.

const PLANNING_PICTURES = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-10");
const PICTURES_TO = process.env.OPS_TRANSLATE_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : PLANNING_PICTURES;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const PICTURE_LOCALES: OpsTranslateLocale[] = ["en", "ar", "es"];

/** The line each state must show, so a picture never captures the wrong state. */
function expectedLine(state: string, locale: OpsTranslateLocale): string {
  const copy = OPS_TRANSLATE_COPY[locale];
  switch (state) {
    case "disabled-no-english":
      return copy.needEnglish;
    case "confirm":
      return copy.confirmTitle;
    case "busy":
      return copy.busy;
    case "done":
      return copy.done;
    case "partial":
      return copy.partialArabicOnly;
    case "limit":
      return copy.limit;
    case "failed":
      return copy.failed;
    default:
      return copy.action;
  }
}

test.describe("pictures", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("ops-translate")) {
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await openScene(page, state, viewport, locale);
          await expect(page.getByText(expectedLine(state, locale), { exact: true }).first()).toBeVisible({ timeout: 10_000 });
          await expect(page.locator('input[type="radio"], [role="radio"]')).toHaveCount(0);
          if (state === "disabled-no-english") {
            await expect(page.getByRole("button", { name: OPS_TRANSLATE_COPY[locale].action, exact: true })).toBeDisabled();
          }
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
