import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_STAYS_COPY } from "../lib/copy/ops-stays";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// Catalog -> Stays on its harness scene (tests/journey/scenes/ops-stays.tsx): the list and the stay editor on the kit's
// editor page (kit panel B). The API is never called: the scene holds its own state and writes every handler into a
// hidden log (`ops-stays-log`). The behaviour block (request bodies against /api/ops/* mocks) comes with the wiring,
// after the owner has signed the pictures.

type Locale = "en" | "ar" | "es";

const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-stays&s=${state}&l=${locale}`;

async function openScene(page: Page, state: string, viewport: Viewport, locale: Locale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  // The dev server can read a build manifest while webpack rewrites it (Next's load-manifest: readFileSync, then
  // JSON.parse; "Unexpected end of JSON input" on /__harness under load) and answer 500 once: load the scene again.
  const first = await page.goto(harnessUrl(state, locale));
  if (!first || first.status() >= 500) await page.goto(harnessUrl(state, locale));
  await settle(page);
  // The dev server's own indicator can sit over the page corner.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
  if (locale === "ar") await assertArabicFont(page);
}

/**
 * The real Arabic face, not a fallback (controller, 2026-10-15): a network drop makes next/font/google fall back to
 * Arial and the webpack cache keeps it. If this fails, delete .next/cache/webpack and restart the dev server.
 */
async function assertArabicFont(page: Page) {
  const font = await page.evaluate(async () => {
    await document.fonts.load('16px "Noto Sans Arabic"', "عربي");
    return {
      check: document.fonts.check('16px "Noto Sans Arabic"', "عربي"),
      faces: [...document.fonts].filter((face) => face.family.replace(/["']/g, "") === "Noto Sans Arabic").length,
    };
  });
  expect(font.faces, "a FontFace named Noto Sans Arabic").toBeGreaterThan(0);
  expect(font.check, "Noto Sans Arabic loaded for Arabic text").toBe(true);
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
      expect(value as string, `${locale}.${key}`).not.toMatch(/\[object|undefined|NaN/);
    }
  }
});

// ---- what a reviewer judges in the editor pictures, asserted in the DOM ------------------------------------------

async function editorChecks(page: Page, state: string, viewport: Viewport, locale: Locale) {
  const copy = OPS_STAYS_COPY[locale];
  const editor = page.locator("[data-edit-page]");
  await expect(editor).toBeVisible();
  // Every visible box has a drawn border (a field without a box once passed a text-only gate).
  const borderless = await editor.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("input:not([type=checkbox]), textarea, button[role=combobox]")]
      .filter((el) => el.offsetParent !== null && parseFloat(getComputedStyle(el).borderTopWidth) < 1)
      .map((el) => el.id || el.outerHTML.slice(0, 80)),
  );
  expect(borderless, "boxes without a border").toEqual([]);
  // Square corners on the cards and boxes.
  const rounded = await editor.evaluate((root) =>
    [...root.querySelectorAll<HTMLElement>("section, input, textarea, button[role=combobox]")]
      .filter((el) => el.offsetParent !== null && parseFloat(getComputedStyle(el).borderTopLeftRadius) > 0)
      .map((el) => el.id || el.tagName),
  );
  expect(rounded, "rounded corners").toEqual([]);
  // No price field: the nightly rate lives in Rates (03.2-15).
  await expect(editor.getByText("Price per night", { exact: true })).toHaveCount(0);
  // Two columns at desktop width (Text left, Place right), one on a phone.
  const text = await editor.getByRole("heading", { level: 2, name: copy.sectionText, exact: true }).boundingBox();
  const place = await editor.getByRole("heading", { level: 2, name: copy.sectionPlace, exact: true }).boundingBox();
  expect(text && place, "Text and Place cards").toBeTruthy();
  if (viewport === "desktop") expect(Math.abs(text!.y - place!.y), "side by side").toBeLessThan(4);
  if (viewport === "phone") expect(place!.y, "one column").toBeGreaterThan(text!.y + text!.height);
  // The pet fee box shows only for "Allowed with a fee"; the lock and the needs speak under the bar.
  await expect(editor.locator("#stay-petsFee")).toHaveCount(state === "editor-pets-fee" ? 1 : 0);
  if (state === "editor-pets-fee") await expect(editor.getByText(copy.problemFeeNeeded, { exact: true })).toBeVisible();
  if (state === "editor-new") await expect(editor.getByText(copy.problemDestinationNeeded, { exact: true })).toBeVisible();
  if (state === "editor-translations") await expect(editor.getByText(copy.amenitiesMismatch.split(":")[0]!, { exact: false })).toBeVisible();
  if (state === "editor-published") {
    await expect(editor.getByText(OPS_KIT_COPY[locale].warnNoBaseRate, { exact: true })).toBeVisible();
    await expect(editor.getByText(OPS_KIT_COPY[locale].unpublishFirst, { exact: true })).toBeVisible();
  }
  // "From the destination" names its items with their kind, never a raw id (03.2-07 review, 2026-10-16: "e3", "v2").
  if (state !== "editor-new") {
    const fromDestination = editor.locator("[data-stay-from-destination] li");
    await expect(fromDestination).toHaveCount(2);
    const rows = await fromDestination.allInnerTexts();
    expect(rows.map((row) => row.replace(/\s+/g, " ").trim())).toEqual([`[Experience 3] ${copy.kindExperience}`, `[Service 2] ${copy.kindService}`]);
  }
  // Arabic reads right to left.
  if (locale === "ar") expect(await page.evaluate(() => getComputedStyle(document.querySelector("[data-edit-page]")!).direction)).toBe("rtl");
}

async function listChecks(page: Page, state: string, viewport: Viewport, locale: Locale) {
  const copy = OPS_STAYS_COPY[locale];
  // The filter shows "All destinations", never an empty box (Radix reads "" as no value: the list sends "all").
  await expect(page.locator("#stays-destination")).toHaveText(copy.allDestinations);
  // One stay has one destination: the column says so in the singular. No match draws no table, so no header there.
  if (state === "list-no-match") await expect(page.getByText(copy.noMatch, { exact: true })).toBeVisible();
  if (state === "list" && viewport !== "phone") await expect(page.getByRole("columnheader", { name: copy.columnDestination, exact: true })).toBeVisible();
}

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
  // A loaded Mac draws an editor picture in about 80 s (2026-10-16 shoot): room for that.
  test.setTimeout(240_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("ops-stays")) {
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await openScene(page, state, viewport, locale);
          if (state === "editor-translations") {
            // The owner's path: open Edit translations, then take one line out of the Arabic amenities, so the lock speaks.
            await page.getByRole("button", { name: OPS_KIT_COPY[locale].editor.editTranslations, exact: true }).click();
            const arabic = page.getByLabel(`${OPS_STAYS_COPY[locale].amenities} · AR`, { exact: true });
            const lines = (await arabic.inputValue()).split("\n");
            await arabic.fill(lines.slice(0, -1).join("\n"));
            await expect(page.getByRole("dialog")).toHaveCount(0);
          }
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          // The picture must show strings, never an object, undefined or NaN printed by mistake.
          const body = (await page.locator("body").innerText()) ?? "";
          expect(body, "no [object] in the scene").not.toMatch(/\[object|undefined|NaN/);
          if (state.startsWith("editor-")) await editorChecks(page, state, viewport, locale);
          if (state === "list" || state === "list-no-match") await listChecks(page, state, viewport, locale);
          // Network idle is capped (a bare wait times out on a cold dev server), then a short settle.
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          // Capture only: the shell's sticky header would be drawn again partway down a full-page shot.
          await page.addStyleTag({ content: "header.sticky { position: static !important; }" });
          await page.screenshot({ path: join(PICTURES, `${state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});
