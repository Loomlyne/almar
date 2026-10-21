import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { DASHBOARD_COPY } from "../lib/copy/dashboard";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// The editor kit on its harness scene (tests/journey/scenes/ops-kit.tsx). The API is never called: the scene holds
// its own state and writes every handler the kit calls into a hidden log (`ops-kit-log`), so this spec proves that
// each control reaches its prop. Nothing here waits for /api/ops/*.

type Locale = "en" | "ar";

const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-kit&s=${state}&l=${locale}`;

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
// baseline is committed under tests/. 9 states x 3 widths x 2 languages. The owner signed the drawer versions on 2026-10-05 (kit panel B replaced the drawer), so the
// block runs only when asked: OPS_KIT_PICTURES=1 writes into the planning folder, OPS_KIT_PICTURES=<folder> writes there.

const SIGNED_PICTURES = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-11");
const PICTURES_TO = process.env.OPS_KIT_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : SIGNED_PICTURES;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const PICTURE_LOCALES = ["en", "ar"] as const;

/** Bring a scene to the state its picture shows, using only what a person does (a key press, a click, a tick). */
async function prepare(page: Page, state: string) {
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
  test.skip(!PICTURES_TO, "the pictures are signed; set OPS_KIT_PICTURES=1 (or a folder) to shoot them again");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("ops-kit")) {
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await openScene(page, state, viewport, locale);
          await prepare(page, state);
          // The page focuses its title on open; the ring is real but is not what the picture is for.
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
// At 390 and 1440, in English and Arabic: the keyboard, the questions, the order, the connections, the mirror.

const COMBOS: { viewport: Viewport; locale: Locale }[] = [
  { viewport: "phone", locale: "en" },
  { viewport: "phone", locale: "ar" },
  { viewport: "desktop", locale: "en" },
  { viewport: "desktop", locale: "ar" },
];

/** Words of the scene (its own bracket data), by language: only what a test has to find. */
const SCENE_WORDS = {
  en: {
    stays: "Stays",
    name: "[Name]",
    nameLabel: "Name",
    shortLine: "Short line",
    description: "description",
    fromDestination: "From the destination",
    searchStays: "Search stays to connect",
    stay: (n: number) => `[Stay ${n}]`,
    row: (n: number) => `[Name ${n}]`,
  },
  ar: {
    stays: "الإقامات",
    name: "[الاسم]",
    nameLabel: "الاسم",
    shortLine: "سطر قصير",
    description: "الوصف",
    fromDestination: "من الوجهة",
    searchStays: "ابحث عن إقامات للربط",
    stay: (n: number) => `[الإقامة ${n}]`,
    row: (n: number) => `[الاسم ${n}]`,
  },
} as const;

type TranslateCall = { target: string; fields: Record<string, unknown> };

/**
 * Answers POST /api/ops/translate (contract 5.11) and records each call. `ok` returns every field as "[AR] <English>"
 * or "[ES] <English>"; `fail` is 502 translate_failed, `limit` 429 translate_limit, `busy` 503 translate_busy. Workers AI
 * is never reached.
 */
async function mockTranslate(page: Page, mode: "ok" | "fail" | "limit" | "busy"): Promise<TranslateCall[]> {
  const seen: TranslateCall[] = [];
  await page.route("**/api/ops/translate", async (route) => {
    const body = route.request().postDataJSON() as TranslateCall;
    seen.push(body);
    const json = (status: number, payload: unknown) =>
      route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(payload) });
    if (mode === "ok") {
      const tag = `[${body.target.toUpperCase()}]`;
      const fields = Object.fromEntries(
        Object.entries(body.fields).map(([name, value]) => [name, Array.isArray(value) ? value.map((item) => `${tag} ${item}`) : `${tag} ${value}`]),
      );
      return json(200, { ok: true, target: body.target, fields });
    }
    const [status, code] = mode === "limit" ? [429, "translate_limit"] : mode === "busy" ? [503, "translate_busy"] : [502, "translate_failed"];
    return json(status, { ok: false, error: { code, field: null, locale: null, detail: null } });
  });
  return seen;
}

/** Everything the kit has called so far, in order: `save`, `move:r2:-1`, `range:2026-10-20:null` ... */
async function calls(page: Page): Promise<string[]> {
  const text = (await page.getByTestId("ops-kit-log").textContent()) ?? "";
  return text.length === 0 ? [] : text.split(" | ");
}
const expectCalled = (page: Page, entry: string | RegExp) =>
  expect.poll(async () => (await calls(page)).some((one) => (typeof entry === "string" ? one === entry : entry.test(one))), { timeout: 10_000, message: `the kit called ${entry}` }).toBe(true);
const expectNotCalled = async (page: Page, entry: string) => expect(await calls(page)).not.toContain(entry);

async function expectNoRadio(page: Page) {
  await expect(page.locator('input[type="radio"], [role="radio"]')).toHaveCount(0);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(overflow.scroll, "page scrollWidth").toBeLessThanOrEqual(overflow.client);
}

const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });
/** The page's alerts (Next's own route announcer is an empty role=alert too). */
const alerts = (page: Page) => page.locator('[role="alert"]:not([id="__next-route-announcer__"])');
/** The status chip on the editor page (the hidden list behind it has its own chips). */
const chip = (page: Page, name: string) => page.locator("[data-edit-page]").getByText(name, { exact: true });

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);

  for (const { viewport, locale } of COMBOS) {
    const width = VIEWPORTS[viewport].width;
    const copy = OPS_KIT_COPY[locale];
    const dashboard = DASHBOARD_COPY[locale];
    const words = SCENE_WORDS[locale];
    const rtl = locale === "ar";
    const at = `${width} ${locale}`;

    test.describe(at, () => {
      // ---- the editor page (kit panel B) -------------------------------------------------------------------------

      test(`the editor page replaces the list: back link, title, status, Save and Publish; two columns at 1440, one at 390, mirrored in Arabic (${at})`, async ({ page }) => {
        await mockTranslate(page, "ok");
        await openScene(page, "page-draft", viewport, locale);
        await expect(page.locator("html")).toHaveAttribute("dir", rtl ? "rtl" : "ltr");
        await expect(page.getByRole("table")).toHaveCount(0);
        const title = page.getByRole("heading", { level: 1 });
        await expect(title).toHaveText(words.name);
        await expect(title).toBeFocused();
        await expect(button(page, dashboard.rail.destinations)).toBeVisible();
        await expect(chip(page, copy.draft)).toBeVisible();
        await expect(button(page, copy.save)).toBeDisabled();
        await expect(button(page, copy.publish)).toBeEnabled();
        await expect(page.getByRole("tablist")).toHaveCount(0);
        await expect(page.getByRole("dialog")).toHaveCount(0);

        const text = await page.getByRole("region", { name: copy.editor.sections.text }).boundingBox();
        const side = await page.getByRole("region", { name: copy.editor.sections.settings }).boundingBox();
        expect(text && side, "both cards are drawn").toBeTruthy();
        if (!text || !side) return;
        if (viewport === "desktop") {
          expect(Math.abs(side.y - text.y), "side by side").toBeLessThan(2);
          expect(side.width, "the side column is the narrow one").toBeLessThan(text.width);
          if (rtl) expect(side.x + side.width, "Arabic: the side column is on the left").toBeLessThanOrEqual(text.x + 1);
          else expect(side.x, "English: the side column is on the right").toBeGreaterThanOrEqual(text.x + text.width - 1);
        } else {
          expect(side.y, "one column: the side card comes under").toBeGreaterThanOrEqual(text.y + text.height - 1);
          expect(Math.round(side.width)).toBe(Math.round(text.width));
        }
        await expectNoRadio(page);
        await expectNoSidewaysScroll(page);
      });

      test(`Save asks the AI for the changed English only, fills Arabic and Spanish and says so (${at})`, async ({ page }) => {
        const calls = await mockTranslate(page, "ok");
        await openScene(page, "page-draft", viewport, locale);
        await page.locator("#kit-short").fill("[New short line]");
        await expect(page.getByRole("status").filter({ hasText: copy.editor.unsaved })).toBeVisible();
        await button(page, copy.save).click();
        await expect(page.getByRole("status").filter({ hasText: copy.editor.translationsUpdated })).toBeVisible();
        expect(calls.map((call) => call.target).sort()).toEqual(["ar", "es"]);
        for (const call of calls) expect(call.fields).toEqual({ short_line: "[New short line]" });
        await expectCalled(page, "save:save:complete");
        await expect(button(page, copy.save)).toBeDisabled();
        await expect(button(page, copy.publish)).toBeEnabled();

        await button(page, copy.editor.editTranslations).click();
        await expect(page.getByLabel(`${words.shortLine} · AR`)).toHaveValue("[AR] [New short line]");
        await expect(page.getByLabel(`${words.shortLine} · ES`)).toHaveValue("[ES] [New short line]");
        await expect(page.getByLabel(`${words.nameLabel} · AR`)).toHaveValue(words.name);
      });

      test(`a translation that fails holds Publish and says why; Save tries again (${at})`, async ({ page }) => {
        const calls = await mockTranslate(page, "fail");
        await openScene(page, "page-draft", viewport, locale);
        await page.locator("#kit-name").fill("[Renamed]");
        await button(page, copy.save).click();
        const alert = alerts(page).filter({ hasText: copy.editor.translationFailed });
        await expect(alert).toBeVisible();
        await expectCalled(page, "save:save:incomplete");
        const publish = button(page, copy.publish);
        await expect(publish).toBeDisabled();
        const reason = await publish.getAttribute("aria-describedby");
        expect(reason).toBeTruthy();
        await expect(page.locator(`[id="${reason}"]`)).toHaveText(copy.editor.translationFailed);
        // The old Arabic and Spanish names were of the old English: they are empty now, waiting for a translation.
        await button(page, copy.editor.editTranslations).click();
        await expect(page.getByLabel(`${words.nameLabel} · AR`)).toHaveValue("");
        await expect(page.getByLabel(`${words.nameLabel} · ES`)).toHaveValue("");
        // Nothing edited, but Save is live: it tries the translation once more.
        await expect(button(page, copy.save)).toBeEnabled();
        await page.unroute("**/api/ops/translate");
        const again = await mockTranslate(page, "ok");
        await button(page, copy.save).click();
        await expect(page.getByRole("status").filter({ hasText: copy.editor.translationsUpdated })).toBeVisible();
        await expect(alert).toHaveCount(0);
        await expect(publish).toBeEnabled();
        for (const call of again) expect(call.fields).toEqual({ name: "[Renamed]" });
        expect(calls.length + again.length).toBe(4);
        await expect(page.getByLabel(`${words.nameLabel} · AR`)).toHaveValue("[AR] [Renamed]");
      });

      test(`the daily limit and a busy service are said in their own words (${at})`, async ({ page }) => {
        await mockTranslate(page, "limit");
        await openScene(page, "page-draft", viewport, locale);
        await page.locator("#kit-name").fill("[Renamed]");
        await button(page, copy.save).click();
        await expect(alerts(page)).toHaveText(copy.editor.translationLimit);
        await page.unroute("**/api/ops/translate");
        await mockTranslate(page, "busy");
        await button(page, copy.save).click();
        await expect(alerts(page)).toHaveText(copy.editor.translationBusy);
      });

      test(`Publish with unsaved English saves, translates and publishes in one go; a failure saves without publishing (${at})`, async ({ page }) => {
        await mockTranslate(page, "ok");
        await openScene(page, "page-draft", viewport, locale);
        await page.locator("#kit-name").fill("[Renamed]");
        await button(page, copy.publish).click();
        await expectCalled(page, "save:publish:complete");
        await expect(chip(page, copy.published)).toBeVisible();
        await expect(button(page, copy.saveAndUpdateSite)).toBeDisabled();

        await page.unroute("**/api/ops/translate");
        await mockTranslate(page, "fail");
        await page.reload();
        await settle(page);
        await page.locator("#kit-name").fill("[Renamed again]");
        await button(page, copy.publish).click();
        await expectCalled(page, "save:save:incomplete");
        await expectNotCalled(page, "save:publish:incomplete");
        await expect(chip(page, copy.draft)).toBeVisible();
        await expect(button(page, copy.publish)).toBeDisabled();
      });

      test(`a published item: a failed translation saves nothing and the site keeps what it has (${at})`, async ({ page }) => {
        await mockTranslate(page, "fail");
        await openScene(page, "page-published", viewport, locale);
        await expect(button(page, copy.saveAndUpdateSite)).toBeDisabled();
        await expect(button(page, copy.unpublish)).toBeEnabled();
        await expect(button(page, copy.publish)).toHaveCount(0);
        await expect(button(page, copy.delete)).toBeDisabled();
        await expect(page.getByText(copy.unpublishFirst)).toBeVisible();
        await page.locator("#kit-name").fill("[Renamed]");
        await button(page, copy.saveAndUpdateSite).click();
        await expect(alerts(page)).toHaveText(copy.editor.translationFailedLive);
        expect((await calls(page)).filter((entry) => entry.startsWith("save:"))).toEqual([]);
        // Unpublish re-reads the item: with the rename still unsaved it asks first (PR #19 review, kit follow-up).
        const question = page.getByRole("dialog", { name: copy.discardTitle });
        await button(page, copy.unpublish).click();
        await expect(question).toBeVisible();
        await button(page, copy.keepEditing).click();
        await expect(question).toHaveCount(0);
        await expectNotCalled(page, "unpublish");
        await expect(page.locator("#kit-name")).toHaveValue("[Renamed]");
        await button(page, copy.unpublish).click();
        await button(page, copy.discard).click();
        await expect(question).toHaveCount(0);
        // Discard runs Unpublish once, not twice.
        await expect.poll(async () => (await calls(page)).filter((entry) => entry === "unpublish").length, { timeout: 10_000 }).toBe(1);
      });

      test(`Unpublish on a page with nothing unsaved asks nothing (${at})`, async ({ page }) => {
        await mockTranslate(page, "ok");
        await openScene(page, "page-published", viewport, locale);
        await button(page, copy.unpublish).click();
        await expect(page.getByRole("dialog", { name: copy.discardTitle })).toHaveCount(0);
        await expectCalled(page, "unpublish");
      });

      test(`Edit translations opens Arabic and Spanish for a fix; a word typed there is kept, not translated over (${at})`, async ({ page }) => {
        const calls = await mockTranslate(page, "ok");
        await openScene(page, "page-draft", viewport, locale);
        const link = button(page, copy.editor.editTranslations);
        await expect(link).toHaveAttribute("aria-expanded", "false");
        await expect(page.getByLabel(`${words.nameLabel} · AR`)).toHaveCount(0);
        await link.click();
        await expect(button(page, copy.editor.hideTranslations)).toHaveAttribute("aria-expanded", "true");
        await expect(page.getByText(copy.editor.translationsNote)).toBeVisible();
        const ar = page.getByLabel(`${words.nameLabel} · AR`);
        await expect(ar).toHaveValue(words.name);
        await expect(page.locator('fieldset [lang="ar"][dir="rtl"]').filter({ has: ar })).toHaveCount(1);
        await expect(page.locator('fieldset [lang="es"][dir="ltr"]').filter({ has: page.getByLabel(`${words.nameLabel} · ES`) })).toHaveCount(1);

        await ar.fill("[Typed in Arabic]");
        await expectCalled(page, "translation:ar:name");
        await page.locator("#kit-name").fill("[Renamed]");
        await button(page, copy.save).click();
        await expectCalled(page, "save:save:complete");
        expect(calls.map((call) => call.target)).toEqual(["es"]);
        expect(calls[0]!.fields).toEqual({ name: "[Renamed]" });
        await expect(ar).toHaveValue("[Typed in Arabic]");
        await expect(page.getByLabel(`${words.nameLabel} · ES`)).toHaveValue("[ES] [Renamed]");
        await button(page, copy.editor.hideTranslations).click();
        await expect(ar).toHaveCount(0);
      });

      test(`leaving with unsaved changes asks "Discard changes?"; Keep editing stays, Discard goes back and focus returns to the row (${at})`, async ({ page }) => {
        await mockTranslate(page, "ok");
        await openScene(page, "page-draft", viewport, locale);
        // Nothing changed: the back link goes at once.
        await button(page, dashboard.rail.destinations).click();
        await expectCalled(page, "close");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(dashboard.rail.destinations);

        // Open a row with the keyboard path a person uses (a click), change a word, then try to leave.
        const row = page.locator("button:visible", { hasText: words.row(2) });
        await row.click();
        await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
        await page.locator("#kit-short").fill("[Changed]");
        const question = page.getByRole("dialog", { name: copy.discardTitle });
        await button(page, dashboard.rail.destinations).click();
        await expect(question).toBeVisible();
        await button(page, copy.keepEditing).click();
        await expect(question).toHaveCount(0);
        await expect(page.locator("#kit-short")).toHaveValue("[Changed]");

        await page.keyboard.press("Escape");
        await expect(question).toBeVisible();
        await button(page, copy.discard).click();
        await expect(question).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(dashboard.rail.destinations);
        await expect(page.locator("button:visible", { hasText: words.row(2) })).toBeFocused();
      });

      test(`a new item: Publish waits only for the photo; the Arabic and Spanish gaps are Save's to fill; no Delete (${at})`, async ({ page }) => {
        await mockTranslate(page, "ok");
        await openScene(page, "page-new", viewport, locale);
        const publish = button(page, copy.publish);
        await expect(publish).toBeDisabled();
        await expect(button(page, copy.save)).toBeEnabled();
        const reasonId = await publish.getAttribute("aria-describedby");
        await expect(page.locator(`[id="${reasonId}"] li`)).toHaveCount(1);
        await expect(page.locator(`[id="${reasonId}"] li`)).toHaveText(copy.fields.photo);
        await expect(button(page, copy.delete)).toHaveCount(0);
        await expect(button(page, copy.unpublish)).toHaveCount(0);
        await publish.click({ force: true });
        await expectNotCalled(page, "publish");
      });

      test(`a published item without a rate or a price says so in words (${at})`, async ({ page }) => {
        await openScene(page, "page-warning", viewport, locale);
        await expect(page.getByText(copy.warnNoBaseRate)).toBeVisible();
        await expect(page.getByText(copy.warnNoPrice)).toBeVisible();
        await expect(button(page, copy.saveAndUpdateSite)).toBeVisible();
      });

      test(`a 409 publish_incomplete is shown through the same list and clears when the owner edits (${at})`, async ({ page }) => {
        await openScene(page, "page-error", viewport, locale);
        const list = page.getByText(copy.publishNeeds).locator("xpath=following-sibling::ul/li");
        await expect(list).toHaveCount(3);
        await expect(button(page, copy.publish)).toBeDisabled();
        await expect(alerts(page)).toHaveCount(0);
        await expect(button(page, copy.publish)).toHaveAttribute("aria-describedby", /.+/);
        const gap = (language: "ar" | "es", field: string) => copy.missingLine.replace("{language}", copy.languages[language]).replace("{field}", field);
        const upper = (value: string) => value.charAt(0).toLocaleUpperCase() + value.slice(1);
        await expect(list.nth(0)).toHaveText(upper(gap("ar", words.description)));
        await expect(list.nth(1)).toHaveText(upper(gap("es", copy.fields.short_line)));
        await expect(list.nth(2)).toHaveText(upper(copy.fields.photo));
        await page.locator("#kit-name").fill("x");
        await expect(page.getByText(copy.publishNeeds)).toHaveCount(0);
        await expect(button(page, copy.publish)).toBeEnabled();
      });

      test(`the browser asks before the tab is left with unsaved changes (${at})`, async ({ page }) => {
        await openScene(page, "page-draft", viewport, locale);
        await page.locator("#kit-name").fill("[Changed]");
        const asked = page.waitForEvent("dialog", { timeout: 10_000 });
        void page.close({ runBeforeUnload: true });
        const dialog = await asked;
        expect(dialog.type()).toBe("beforeunload");
        await dialog.dismiss();
      });

      // ---- the list ---------------------------------------------------------------------------------------------

      test(`a list is a table from 768 and a stack of cards below; open and Move up and Move down reach their handlers (${at})`, async ({ page }) => {
        await openScene(page, "list", viewport, locale);
        if (viewport === "phone") {
          await expect(page.getByRole("table")).toHaveCount(0);
          await expect(page.getByRole("list", { name: dashboard.rail.destinations })).toBeVisible();
        } else {
          await expect(page.getByRole("table", { name: dashboard.rail.destinations })).toBeVisible();
          await expect(page.getByRole("list", { name: dashboard.rail.destinations })).toHaveCount(0);
        }
        const names = page.getByRole("button", { name: /\[[^\]]+ \d\]/ });
        const up = button(page, copy.moveUp);
        const down = button(page, copy.moveDown);
        await expect(names).toHaveCount(6);
        await expect(up).toHaveCount(6);
        await expect(down).toHaveCount(6);
        await expect(up.nth(0)).toBeDisabled();
        await expect(down.nth(5)).toBeDisabled();
        await expect(up.nth(1)).toBeEnabled();

        const firstBefore = await names.nth(0).textContent();
        const secondBefore = await names.nth(1).textContent();
        await up.nth(1).click();
        await expectCalled(page, "move:r2:-1");
        await expect(names.nth(0)).toHaveText(secondBefore ?? "");
        await expect(names.nth(1)).toHaveText(firstBefore ?? "");
        await down.nth(0).click();
        await expectCalled(page, "move:r2:1");
        await expect(names.nth(0)).toHaveText(firstBefore ?? "");

        await names.nth(2).click();
        await expectCalled(page, "open:r3");
        await expectNoRadio(page);
        await expectNoSidewaysScroll(page);
      });

      if (viewport === "desktop") {
        test(`a row opens from any cell, and a drag by the handle reports the full new order (${at})`, async ({ page }) => {
          await openScene(page, "list", viewport, locale);
          const rows = page.getByRole("table").getByRole("row");
          // Row 0 is the header. A click on a plain cell opens the row.
          await rows.nth(2).getByRole("cell").nth(2).click();
          await expectCalled(page, "open:r2");

          const handles = page.getByTestId("drag-handle");
          await expect(handles).toHaveCount(6);
          await handles.nth(0).dragTo(rows.nth(3));
          await expectCalled(page, "drop:r2,r3,r1,r4,r5,r6");
          // The parent put the rows in the new order: the dragged row is third now.
          const order = await page.getByRole("table").getByRole("button", { name: /\[[^\]]+ \d\]/ }).allTextContents();
          expect(order.map((entry) => entry.replace(/\D/g, ""))).toEqual(["2", "3", "1", "4", "5", "6"]);
        });
      } else {
        test(`no drag handle on a phone; the buttons are the way to reorder (${at})`, async ({ page }) => {
          await openScene(page, "list", viewport, locale);
          await expect(page.getByTestId("drag-handle").first()).toBeHidden();
          await expect(button(page, copy.moveUp)).toHaveCount(6);
        });
      }

      test(`an empty list says so and its New button reaches its handler (${at})`, async ({ page }) => {
        await openScene(page, "list-empty", viewport, locale);
        await expect(page.getByText(dashboard.noDestinationsYet)).toBeVisible();
        await expect(page.getByRole("table")).toHaveCount(0);
        await expect(button(page, copy.moveUp)).toHaveCount(0);
        await button(page, dashboard.newDestination).click();
        await expectCalled(page, "new");
      });

      // ---- the date range -------------------------------------------------------------------------------------

      test(`a date range: first day, last day, a day before the first starts again, the same day twice is one day, Escape closes (${at})`, async ({ page }) => {
        await openScene(page, "date-range", viewport, locale);
        const one = page.locator("#kit-one-day");
        const range = page.locator("#kit-range");
        await expect(one).toHaveText(`${shown(dayFromToday(3))}`);
        await expect(range).toContainText(`${shown(dayFromToday(7))} – ${shown(dayFromToday(12))}`);
        const grid = page.getByRole("grid");

        await range.click();
        await expect(grid).toBeVisible();
        await pickDay(page, dayFromToday(14));
        await expectCalled(page, `range:${dayFromToday(14)}:null`);
        await expect(grid).toBeVisible();
        await pickDay(page, dayFromToday(16));
        await expectCalled(page, `range:${dayFromToday(14)}:${dayFromToday(16)}`);
        await expect(grid).toHaveCount(0);
        await expect(range).toBeFocused();
        await expect(range).toContainText(`${shown(dayFromToday(14))} – ${shown(dayFromToday(16))}`);

        // A pick before the first day starts again; the same day twice is one day.
        await range.click();
        await pickDay(page, dayFromToday(10));
        await expectCalled(page, `range:${dayFromToday(10)}:null`);
        await pickDay(page, dayFromToday(10));
        await expectCalled(page, `range:${dayFromToday(10)}:${dayFromToday(10)}`);
        await expect(range).toHaveText(shown(dayFromToday(10)));

        // Escape closes and returns focus to the field.
        await range.click();
        await expect(grid).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(grid).toHaveCount(0);
        await expect(range).toBeFocused();
        await expectNoRadio(page);
      });

      // ---- the connect picker -------------------------------------------------------------------------------------

      test(`connect picker: search, tick three, Connect selected adds them at the end, Remove drops one (${at})`, async ({ page }) => {
        await openScene(page, "connect", viewport, locale);
        const stay = words.stay;
        const picker = page.getByRole("region", { name: words.stays, exact: true });
        const connectedList = picker.getByRole("heading", { name: copy.connected, exact: true }).locator("xpath=following-sibling::ul");
        const pickList = picker.getByRole("list").filter({ has: page.getByRole("checkbox") });
        const connect = button(page, copy.connectSelected);
        const selected = (n: number) => (n === 1 ? copy.selectedOne : copy.selected).replace("{n}", String(n));

        // s1 and s2 are connected; s3 to s7 can be picked; s7 is also listed, read-only, in the group.
        await expect(connectedList.getByRole("listitem")).toHaveCount(2);
        await expect(pickList.getByRole("checkbox")).toHaveCount(5);
        await expect(page.getByText(words.fromDestination)).toBeVisible();
        await expect(page.getByText(selected(0))).toBeVisible();
        await expect(connect).toBeDisabled();

        // Search is folded and narrows the list.
        const search = page.getByLabel(words.searchStays);
        await search.fill(stay(5).replace(/[[\]]/g, ""));
        await expect(pickList.getByRole("checkbox")).toHaveCount(1);
        await expect(pickList.getByRole("checkbox", { name: stay(5) })).toBeVisible();
        await search.fill("zzz-nothing");
        await expect(page.getByText(copy.noResults)).toBeVisible();
        await search.fill("");
        await expect(pickList.getByRole("checkbox")).toHaveCount(5);

        for (const n of [3, 4, 5]) await pickList.getByRole("checkbox", { name: stay(n) }).check();
        await expect(page.getByText(selected(3))).toBeVisible();
        await expect(connect).toBeEnabled();
        await connect.click();
        await expectCalled(page, "connected:s1,s2,s3,s4,s5");
        await expect(connectedList.getByRole("listitem")).toHaveCount(5);
        await expect(connectedList.getByRole("listitem").nth(4)).toContainText(stay(5));
        await expect(pickList.getByRole("checkbox")).toHaveCount(2);
        await expect(page.getByText(selected(0))).toBeVisible();

        await page.getByRole("button", { name: copy.removeNamed.replace("{name}", stay(2)) }).click();
        await expectCalled(page, "connected:s1,s3,s4,s5");
        await expect(connectedList.getByRole("listitem")).toHaveCount(4);
        await expect(pickList.getByRole("checkbox", { name: stay(2) })).toBeVisible();
        await expectNoRadio(page);
        await expectNoSidewaysScroll(page);
      });
    });
  }
});

// ---- the Back guard (follow-up 2) -----------------------------------------------------------------------------------
// Dev only (next dev, React strict mode: effects run twice, the harder case): a production build drops the harness
// scenes (03.2-12), so the build path is not browser-tested here. The node side of the same cases is
// tests/ops-back-guard.test.mjs.

test.describe("Back guard", () => {
  test.setTimeout(120_000);
  const copy = OPS_KIT_COPY.en;
  const question = (page: Page) => page.getByRole("dialog", { name: copy.discardTitle });
  const sceneOf = (page: Page) => new URL(page.url()).searchParams.get("s");
  const back = (page: Page) => page.evaluate(() => window.history.back());

  test("opened with unsaved changes, nothing is asked until Back; Back asks, Keep editing stays", async ({ page }) => {
    await openScene(page, "page-dirty", "desktop", "en");
    await expect(page.locator("#kit-name")).toHaveValue("[Unsaved]");
    await page.waitForTimeout(1_500);
    await expect(question(page), "strict mode's double effect asks nothing").toHaveCount(0);
    await back(page);
    await expect(question(page)).toBeVisible();
    await button(page, copy.keepEditing).click();
    await expect(question(page)).toHaveCount(0);
    expect(sceneOf(page)).toBe("page-dirty");
    await back(page);
    await expect(question(page), "the guard is back on after Keep editing").toBeVisible();
  });

  test("Save, then a navigation at once: it is neither aborted nor undone", async ({ page }) => {
    await mockTranslate(page, "ok");
    await openScene(page, "page-draft", "desktop", "en");
    await page.locator("#kit-name").fill("[Renamed]");
    await button(page, copy.save).click();
    await expectCalled(page, "save:save:complete");
    const response = await page.goto(harnessUrl("list", "en"));
    expect(response?.ok(), "page.goto is not aborted (net::ERR_ABORTED)").toBe(true);
    await page.waitForTimeout(1_000);
    expect(sceneOf(page), "no late Back undid the navigation").toBe("list");
  });

  test("after Save, one Back leaves the page", async ({ page }) => {
    await mockTranslate(page, "ok");
    await openScene(page, "list", "desktop", "en");
    await openScene(page, "page-draft", "desktop", "en");
    await page.locator("#kit-name").fill("[Renamed]");
    await button(page, copy.save).click();
    await expectCalled(page, "save:save:complete");
    await back(page);
    await expect.poll(() => sceneOf(page), { timeout: 10_000 }).toBe("list");
  });

  test("a reload with unsaved changes, then Forward: one Back still leaves the page", async ({ page }) => {
    page.on("dialog", (dialog) => void dialog.accept());
    await openScene(page, "list", "desktop", "en");
    await openScene(page, "page-draft", "desktop", "en");
    await page.locator("#kit-name").fill("[Changed]");
    await page.reload();
    await settle(page);
    await page.waitForTimeout(1_000);
    await page.goForward().catch(() => null);
    await settle(page);
    await page.waitForTimeout(1_000);
    expect(sceneOf(page)).toBe("page-draft");
    await back(page);
    await expect.poll(() => sceneOf(page), { timeout: 10_000, message: "Forward did not leave a spare entry under the page" }).toBe("list");
  });
});

// ---- dates --------------------------------------------------------------------------------------------------------

/** Today in Dubai plus `days`, as YYYY-MM-DD (the scene seeds its ranges the same way). */
function dayFromToday(days: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [year, month, day] = today.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** DD/MM/YYYY, as the field writes it. */
function shown(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** The calendar's own key for a day: not zero padded. */
function cellKey(iso: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  return `${year}-${month}-${day}`;
}

/** Click a day in the open calendar, moving to its month first. */
async function pickDay(page: Page, iso: string) {
  const [year, month] = iso.split("-").map(Number);
  const cell = page.locator(`[data-date="${cellKey(iso)}"]`);
  for (let step = 0; step < 4 && !(await cell.isVisible()); step += 1) {
    const here = await page.locator("[data-date]").first().getAttribute("data-date");
    const [shownYear, shownMonth] = (here ?? "").split("-").map(Number);
    const behind = year * 12 + month - (shownYear * 12 + shownMonth);
    await page.getByRole("button", { name: behind > 0 ? "Next month" : "Previous month" }).click();
  }
  await cell.click();
}
