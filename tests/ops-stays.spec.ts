import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_STAYS_COPY } from "../lib/copy/ops-stays";
import { DASHBOARD_COPY } from "../lib/copy/dashboard";
import type { Locale3 } from "../components/ops/api-types";
import { openDashboard, openRow } from "./helpers/ops-catalog-api";
import { STAY_NEW_ID, mockStaysApi, postsTo, refusal, warmStays } from "./helpers/ops-stays-api";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";
import { routeStayTabs } from "./helpers/stay-tabs-routes";

// Catalog -> Stays on its harness scene (tests/journey/scenes/ops-stays.tsx): the list and the stay editor on the kit's
// editor page (kit panel B). The API is never called: the scene holds its own state and writes every handler into a
// hidden log (`ops-stays-log`). The behaviour block at the end runs on the real page (/dashboard/catalog/stays, next
// dev) with every /api/ops/* answered by page.route fixtures shaped like the contract (tests/helpers/ops-stays-api.ts);
// the request bodies are asserted.

type Locale = "en" | "ar" | "es";

const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-stays&s=${state}&l=${locale}`;

async function openScene(page: Page, state: string, viewport: Viewport, locale: Locale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  // 03.2-15: a saved stay shows the Rates, Availability and Access cards, which read their own routes.
  await routeStayTabs(page, locale);
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

// ---- connections order (owner 2026-10-17: Move up / Move down) --------------------------------------------------

test("Move up / Move down reorder a stay's experiences within their kind, and focus stays on the moved row", async ({ page }) => {
  test.setTimeout(240_000);
  await openScene(page, "editor-draft", "desktop", "en");
  const kit = OPS_KIT_COPY.en;
  const rows = page.locator("[data-connect-row]");
  const order = () => rows.evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.connectRow));
  const button = (id: string, way: "up" | "down") => page.locator(`[data-connect-row="${id}"] button[data-move="${way}"]`);
  await expect.poll(order).toEqual(["e1", "e2", "v1"]);
  await expect(button("e1", "up")).toHaveText(kit.moveUp);
  await expect(button("e1", "up")).toBeDisabled();
  // The last experience cannot go below the first service: the save keeps one order per kind.
  await expect(button("e2", "down")).toBeDisabled();
  await expect(button("v1", "up")).toBeDisabled();

  await button("e1", "down").click();
  await expect.poll(order).toEqual(["e2", "e1", "v1"]);
  // e1 reached the end of the experiences, so its Move down is off and focus is on its Move up.
  await expect(button("e1", "up")).toBeFocused();
  // The page counts the new order as unsaved work.
  await expect(page.getByText(kit.editor.unsaved, { exact: true })).toBeVisible();

  await page.keyboard.press("Enter");
  await expect.poll(order).toEqual(["e1", "e2", "v1"]);
  await expect(button("e1", "down")).toBeFocused();
  // Back in the saved order: nothing is unsaved any more.
  await expect(page.getByText(kit.editor.unsaved, { exact: true })).toHaveCount(0);
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
            // The Text card's control by its exact accessible name; 03.2-15's Access card shows the same words but is named
            // "Edit translations: Notes", so an exact match finds only this one.
            const editText = page.getByRole("button", { name: OPS_KIT_COPY[locale].editor.editTranslations, exact: true });
            await expect(editText).toHaveCount(1);
            await editText.click();
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

// ---- behaviour: the real page, the API mocked -------------------------------------------------------------------

const PAGE_PATH = "/dashboard/catalog/stays";
const COMBOS: { viewport: Viewport; locale: Locale3 }[] = [
  { viewport: "desktop", locale: "en" },
  { viewport: "phone", locale: "ar" },
];

type SaveItem = { id?: string; translations?: Record<string, Record<string, unknown> | null>; connections?: unknown; gallery_media_ids?: unknown } & Record<string, unknown>;
const itemOf = (body: Record<string, unknown>) => body.item as SaveItem;

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  test.beforeAll(async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    await warmStays(browser, PAGE_PATH, baseURL, DASHBOARD_COPY.en.rail.stays);
  });

  for (const { viewport, locale } of COMBOS) {
    const copy = OPS_STAYS_COPY[locale];
    const kit = OPS_KIT_COPY[locale];
    const heading = DASHBOARD_COPY[locale].rail.stays;
    const at = `${viewport} ${locale}`;
    // 03.2-15: a saved stay shows the Rates, Availability and Access cards, which read their own routes.
    const open = async (page: Page, baseURL: string | undefined) => {
      await routeStayTabs(page, locale);
      await openDashboard(page, PAGE_PATH, viewport, locale, baseURL, heading);
    };
    const openStay = async (page: Page, title: string) => {
      await openRow(page, title).click();
      await expect(page.getByRole("heading", { level: 1, name: title })).toBeVisible();
    };

    test(`Save on a draft: English as typed, the AI's Arabic and Spanish as drafts, no join set resent (${at})`, async ({ page, baseURL }) => {
      const api = await mockStaysApi(page);
      await open(page, baseURL);
      await openStay(page, "[Casa Dos]");
      await page.locator("#stay-tagline").fill("[New tagline]");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [save] = await postsTo(api, "stays");
      expect(api.of("translate").map((t) => t.target).sort()).toEqual(["ar", "es"]);
      const item = itemOf(save!);
      expect(save!.action).toBe("save");
      expect(item).toMatchObject({ id: "s2", slug: "casa-dos", destination_id: "d1", min_nights: 2, pets_rule: "not_allowed", pets_fee_aed: null, hero_media_id: "h-s2" });
      expect(item.translations!.en).toMatchObject({ title: "[Casa Dos]", tagline: "[New tagline]", status: "draft" });
      expect(item.translations!.ar).toMatchObject({ tagline: "[AR] [New tagline]", status: "draft" });
      expect(item.translations!.es).toMatchObject({ tagline: "[ES] [New tagline]", status: "draft" });
      // The gallery and the connections did not change, so they are not sent (a key not sent is left alone).
      expect("gallery_media_ids" in item).toBe(false);
      expect("connections" in item).toBe(false);
      expect(api.of("publish")).toHaveLength(0);
      await expect(page.getByText(kit.editor.translationsUpdated, { exact: true })).toBeVisible();
    });

    test(`Publish a saved draft: one save with every language published, then the publish call; the no-rate warning (${at})`, async ({ page, baseURL }) => {
      const api = await mockStaysApi(page);
      await open(page, baseURL);
      await openStay(page, "[Casa Dos]");
      await page.getByRole("button", { name: kit.publish, exact: true }).click();
      const [publish] = await postsTo(api, "publish");
      const saves = api.of("stays");
      expect(saves).toHaveLength(1);
      const tr = itemOf(saves[0]!).translations!;
      expect([tr.en!.status, tr.ar!.status, tr.es!.status]).toEqual(["published", "published", "published"]);
      expect(publish).toEqual({ entity: "stay", id: "s2", published: true });
      expect(api.posts.findIndex((p) => p.path === "stays")).toBeLessThan(api.posts.findIndex((p) => p.path === "publish"));
      await expect(page.getByRole("button", { name: kit.unpublish, exact: true })).toBeVisible();
      await expect(page.getByText(kit.warnNoBaseRate, { exact: true })).toBeVisible();
    });

    test(`Delete waits while published; Unpublish sends publish false, then Delete asks and sends delete (${at})`, async ({ page, baseURL }) => {
      const api = await mockStaysApi(page);
      await open(page, baseURL);
      await openStay(page, "[Casa Uno]");
      const remove = page.getByRole("button", { name: copy.deleteStay, exact: true });
      await expect(remove).toBeDisabled();
      await page.getByRole("button", { name: kit.unpublish, exact: true }).click();
      const [publish] = await postsTo(api, "publish");
      expect(publish).toEqual({ entity: "stay", id: "s1", published: false });
      await expect(remove).toBeEnabled();
      await remove.click();
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      await dialog.getByRole("button", { name: copy.deleteStay, exact: true }).click();
      await expect.poll(() => api.of("stays").filter((b) => b.action === "delete")).toEqual([{ action: "delete", id: "s1" }]);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(openRow(page, "[Casa Uno]")).toHaveCount(0);
    });

    test(`Reorder: Move down on the first stay sends every id in the new order (${at})`, async ({ page, baseURL }) => {
      const api = await mockStaysApi(page);
      await open(page, baseURL);
      await page.getByRole("button", { name: kit.moveDown, exact: true }).filter({ visible: true }).first().click();
      await expect.poll(() => api.of("stays")).toEqual([{ action: "reorder", ids: ["s2", "s1", "s3"] }]);
    });

    test(`Connections order: Move down on an experience, Save sends each kind in the order shown (${at})`, async ({ page, baseURL }) => {
      const api = await mockStaysApi(page);
      await open(page, baseURL);
      await openStay(page, "[Casa Dos]");
      await page.locator('[data-connect-row="e1"] button[data-move="down"]').click();
      await expect.poll(() => page.locator("[data-connect-row]").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.connectRow))).toEqual(["e2", "e1", "v1"]);
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [save] = await postsTo(api, "stays");
      expect(itemOf(save!).connections).toEqual({ experience_ids: ["e2", "e1"], service_ids: ["v1"] });
      // Read back: the editor shows the stored order.
      await expect.poll(() => page.locator("[data-connect-row]").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.connectRow))).toEqual(["e2", "e1", "v1"]);
    });

    test(`A direct link to a destination's own item survives a move and Save (review round 1) (${at})`, async ({ page, baseURL }) => {
      const api = await mockStaysApi(page);
      // [Experience 3] belongs to [Destination 1]; [Casa Dos] (in d1) also links it directly, between e1 and e2.
      api.store.stays.find((s) => s.id === "s2")!.experience_ids = ["e1", "e3", "e2"];
      await open(page, baseURL);
      await openStay(page, "[Casa Dos]");
      await expect(page.locator('[data-connect-row="e3"]')).toHaveCount(0);
      await page.locator('[data-connect-row="e1"] button[data-move="down"]').click();
      await expect.poll(() => page.locator("[data-connect-row]").evaluateAll((els) => els.map((el) => (el as HTMLElement).dataset.connectRow))).toEqual(["e2", "e1", "v1"]);
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [save] = await postsTo(api, "stays");
      expect(itemOf(save!).connections).toEqual({ experience_ids: ["e2", "e3", "e1"], service_ids: ["v1"] });
    });

    test(`A stay whose read fails shows 0 on the list; opening it says the kit's sentence on the list (review round 2) (${at})`, async ({ page, baseURL }) => {
      await mockStaysApi(page);
      // Registered after the mock, so it answers first: every read of [Casa Dos] (3 connected) by its id fails.
      let reads = 0;
      await page.route(/\/api\/ops\/stays\?(.*&)?id=s2(&|$)/, (route) => {
        reads += 1;
        const { status, json } = refusal(500, "unavailable");
        return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
      });
      await open(page, baseURL);
      const row = page.locator("tr, li").filter({ hasText: "[Casa Dos]", visible: true });
      await expect(row.locator("td, dd").filter({ hasText: /^0$/ })).toHaveCount(1);
      await expect(page.getByRole("alert").filter({ hasText: kit.errors.unavailable })).toHaveCount(0);
      const before = reads;
      await openRow(page, "[Casa Dos]").click();
      await expect(page.getByRole("alert").filter({ hasText: kit.errors.unavailable })).toBeVisible();
      expect(reads).toBeGreaterThan(before);
      // The page did not open: the list and its heading are still there.
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(openRow(page, "[Finca Tres]")).toBeVisible();
    });

    // Every read of [Casa Dos] by its id fails (registered after the mock, so it answers first).
    const failCasaDos = (page: Page) =>
      page.route(/\/api\/ops\/stays\?(.*&)?id=s2(&|$)/, (route) => {
        const { status, json } = refusal(500, "unavailable");
        return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
      });

    test(`The list's alert does not come back after New stay or after closing a stay (review round 3) (${at})`, async ({ page, baseURL }) => {
      const api = await mockStaysApi(page);
      await failCasaDos(page);
      // After the first reads, every read of the whole list fails (a Save reads it again while the page is open).
      let failList = false;
      await page.route(/\/api\/ops\/stays(\?.*)?$/, (route) => {
        const url = new URL(route.request().url());
        if (!failList || route.request().method() !== "GET" || url.searchParams.get("id")) return route.fallback();
        const { status, json } = refusal(500, "unavailable");
        return route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
      });
      await open(page, baseURL);
      const alert = page.getByRole("alert").filter({ hasText: kit.errors.unavailable });
      // New stay: the alert from opening [Casa Dos] is gone when the list comes back.
      await openRow(page, "[Casa Dos]").click();
      await expect(alert).toBeVisible();
      await page.getByRole("button", { name: DASHBOARD_COPY[locale].newStay, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: DASHBOARD_COPY[locale].newStay })).toBeVisible();
      await page.getByRole("button", { name: heading, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(alert).toHaveCount(0);
      // Close: a Save whose list read fails sets the alert while the page is open; closing the page drops it.
      await openStay(page, "[Finca Tres]");
      failList = true;
      await page.locator("#stay-tagline").fill("[Changed]");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      await postsTo(api, "stays");
      await expect.poll(() => page.evaluate(() => [...document.querySelectorAll("[role=alert]")].some((el) => el.closest("[hidden]")))).toBe(true);
      await page.getByRole("button", { name: heading, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(alert).toHaveCount(0);
    });

    test(`The list's alert appears without the list being drawn again: keyboard focus stays on the row (review round 3) (${at})`, async ({ page, baseURL }) => {
      await mockStaysApi(page);
      await failCasaDos(page);
      await open(page, baseURL);
      const row = openRow(page, "[Casa Dos]");
      await row.focus();
      await row.evaluate((el) => el.setAttribute("data-before-alert", ""));
      await page.keyboard.press("Enter");
      await expect(page.getByRole("alert").filter({ hasText: kit.errors.unavailable })).toBeVisible();
      // The same element (not a new one drawn in its place) still has the focus.
      expect(await page.evaluate(() => document.activeElement?.hasAttribute("data-before-alert") ?? false)).toBe(true);
    });

    test(`A save the server refuses (destination not published) is said in words, the form kept (${at})`, async ({ page, baseURL }) => {
      const api = await mockStaysApi(page, (path, body) => (path === "stays" && body.action === "save" ? refusal(409, "parent_unpublished") : null));
      await open(page, baseURL);
      await openStay(page, "[Casa Uno]");
      await page.locator("#stay-tagline").fill("[Changed]");
      await page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true }).click();
      await postsTo(api, "stays");
      await expect(page.getByText(kit.errors.parent_unpublished, { exact: true })).toBeVisible();
      await expect(page.getByText("parent_unpublished")).toHaveCount(0);
      await expect(page.locator("#stay-tagline")).toHaveValue("[Changed]");
    });

    test(`New stay: Save creates it with every fact, empty join sets and the English, then edits it by its id (${at})`, async ({ page, baseURL }) => {
      const api = await mockStaysApi(page);
      await open(page, baseURL);
      await page.getByRole("button", { name: DASHBOARD_COPY[locale].newStay, exact: true }).click();
      await page.locator("#stay-title").fill("[Casa Nueva]");
      await page.locator("#stay-destination").click();
      await page.getByRole("option", { name: "[Destination 1]", exact: true }).click();
      await page.locator("#stay-slug").fill("casa-nueva");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [create] = await postsTo(api, "stays");
      const item = itemOf(create!);
      expect("id" in item).toBe(false);
      expect(item).toMatchObject({ slug: "casa-nueva", destination_id: "d1", min_nights: 1, pets_rule: null, pets_fee_aed: null, infants_count: null, hero_media_id: null });
      expect(item.gallery_media_ids).toEqual([]);
      expect(item.connections).toEqual({ experience_ids: [], service_ids: [] });
      expect(item.translations!.en).toMatchObject({ title: "[Casa Nueva]", status: "draft" });
      await expect(page.getByRole("heading", { level: 1, name: "[Casa Nueva]" })).toBeVisible();
      // The next Save edits the stay it created, by its id.
      await page.locator("#stay-tagline").fill("[Second]");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const saves = await postsTo(api, "stays", 2);
      expect(itemOf(saves[1]!).id).toBe(STAY_NEW_ID);
    });
  }
});
