import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { VIEWPORTS, settle, type Viewport } from "../journey/matrix";

// The picture block shared by tests/ops-team.spec.ts and tests/ops-journeys.spec.ts (plan 03.2-08, Task 1); the same
// pattern as 03.2-06's helper.
// Full-page PNGs for the owner's signature, written outside tests/ (page.screenshot, not toHaveScreenshot), so no
// baseline is committed under tests/. States x 390, 834, 1440 x EN, AR, ES. The block runs only when asked, as
// tests/ops-kit.spec.ts: OPS_TEAM_PICTURES=1 writes into the planning folder, OPS_TEAM_PICTURES=<absolute folder>
// writes there. OPS_TEAM_PICTURE_LOCALES=es (comma list) shoots only those languages, so a copy change in one language
// re-shoots only its files. OPS_TEAM_PICTURE_STATES=a,b (comma list) shoots only those states.

export type PictureLocale = "en" | "ar" | "es";

const PLANNING_PICTURES = join(__dirname, "..", "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-08");
const PICTURES_TO = process.env.OPS_TEAM_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : PLANNING_PICTURES;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const ALL_LOCALES: PictureLocale[] = ["en", "ar", "es"];
const ONLY_LOCALES = process.env.OPS_TEAM_PICTURE_LOCALES?.split(",").map((l) => l.trim());
const ONLY_STATES = process.env.OPS_TEAM_PICTURE_STATES?.split(",").map((s) => s.trim());
const LOCALES = ONLY_LOCALES ? ALL_LOCALES.filter((l) => ONLY_LOCALES.includes(l)) : ALL_LOCALES;

/** A panel is taller than the screen: the picture is taken on a taller page so the whole form is in it. */
const PANEL_HEIGHT: Record<Viewport, number> = { phone: 3600, tablet: 3200, desktop: 2400 };

export type PictureState = {
  /** A panel state is shot on the tall page. */
  panel: boolean;
  /** A subfolder of the picture folder (the kit editor states go to `editor/`, apart from the signed list pictures). */
  folder?: string;
  /** The lines this state must show, so a picture never captures the wrong state. Each is checked to be fully in the picture. */
  check: (page: Page, locale: PictureLocale) => Promise<Locator[]>;
};

/** True when every part of the element sits inside the page the picture will show. */
async function expectInPicture(page: Page, target: Locator) {
  // The list is both a table and a stack of cards (CSS shows one): look at the one that is on the page.
  const shown = target.filter({ visible: true }).first();
  await expect(shown).toBeVisible({ timeout: 10_000 });
  const box = await shown.boundingBox();
  const size = page.viewportSize();
  expect(box, "the line has a box").not.toBeNull();
  if (box && size) {
    expect(box.x).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width).toBeLessThanOrEqual(size.width + 1);
    expect(box.y).toBeGreaterThanOrEqual(-1);
    expect(box.y + box.height).toBeLessThanOrEqual(size.height + 1);
  }
}

/** Registers one test per state x width x language. Call inside the spec file, once per scene. */
export function definePictures(scene: string, states: Record<string, PictureState>) {
  test.describe(`pictures ${scene}`, () => {
    test.skip(!PICTURES_TO, "the pictures are for the owner's signature; set OPS_TEAM_PICTURES=1 (or a folder) to shoot them");
    test.describe.configure({ mode: "parallel" });
    test.setTimeout(120_000);
    if (PICTURES_TO) for (const def of Object.values(states)) mkdirSync(join(PICTURES, def.folder ?? ""), { recursive: true });

    for (const [state, def] of Object.entries(states)) {
      if (ONLY_STATES && !ONLY_STATES.includes(state)) continue;
      for (const viewport of WIDTHS) {
        for (const locale of LOCALES) {
          const width = VIEWPORTS[viewport].width;
          test(`${state} ${width} ${locale}`, async ({ page }) => {
            await page.setViewportSize({ width, height: def.panel ? PANEL_HEIGHT[viewport] : VIEWPORTS[viewport].height });
            await page.goto(`/__harness?c=${scene}&s=${state}&l=${locale}`);
            await settle(page);
            // The dev server's own indicator can sit over the page corner.
            await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
            await page.waitForFunction((l) => document.documentElement.lang === l, locale);
            for (const line of await def.check(page, locale)) await expectInPicture(page, line);
            // Every label is a string: a value that was an object would print "[object Object]".
            const text = await page.locator("body").innerText();
            expect(text, "no label printed as an object").not.toContain("[object");
            expect(text, "no label printed as undefined").not.toMatch(/\bundefined\b|\bNaN\b/);
            await expect(page.locator('input[type="radio"], [role="radio"]')).toHaveCount(0);
            // No question open over the page (a stray "Discard changes?" would cover the state).
            await expect(page.locator('[role="dialog"], [role="alertdialog"]')).toHaveCount(0);
            // No sideways scroll: the page is as wide as the screen.
            const wide = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
            expect(wide, "the page scrolls sideways").toBeLessThanOrEqual(1);
            // The editor focuses its title on open; the ring is real but is not what the picture is for.
            await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
            // Network idle is capped (a bare wait times out on a cold dev server), then a short settle.
            await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
            await page.waitForTimeout(400);
            await page.screenshot({ path: join(PICTURES, def.folder ?? "", `${state}-${width}-${locale}.png`), fullPage: true });
          });
        }
      }
    }
  });
}
