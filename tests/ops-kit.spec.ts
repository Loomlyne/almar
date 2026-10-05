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
// baseline is committed under tests/. 10 states x 3 widths x 2 languages. The owner signed them on 2026-10-05, so the
// block runs only when asked: OPS_KIT_PICTURES=1 writes into the planning folder, OPS_KIT_PICTURES=<folder> writes there.

const SIGNED_PICTURES = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-11");
const PICTURES_TO = process.env.OPS_KIT_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : SIGNED_PICTURES;
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
  en: { stays: "Stays", note: "[Content of this tab]", fromDestination: "From the destination", searchStays: "Search stays to connect", stay: (n: number) => `[Stay ${n}]` },
  ar: { stays: "الإقامات", note: "[محتوى هذا التبويب]", fromDestination: "من الوجهة", searchStays: "ابحث عن إقامات للربط", stay: (n: number) => `[الإقامة ${n}]` },
} as const;

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

const languageTabs = (page: Page, locale: Locale) => page.getByRole("tablist", { name: OPS_KIT_COPY[locale].languageTabs }).getByRole("tab");
const button = (page: Page, name: string) => page.getByRole("button", { name, exact: true });

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
      // ---- the edit panel ---------------------------------------------------------------------------------------

      test(`language tabs: one Tab stop, arrows follow the reading direction, the panel carries lang and dir (${at})`, async ({ page }) => {
        await openScene(page, "panel-draft-ar", viewport, locale);
        const tabs = languageTabs(page, locale);
        await expect(tabs).toHaveCount(3);
        for (const [index, label] of ["EN", "AR", "ES"].entries()) await expect(tabs.nth(index)).toContainText(label);
        const panel = page.locator('[role="tabpanel"][lang]');
        await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
        await expect(panel).toHaveAttribute("lang", "ar");
        await expect(panel).toHaveAttribute("dir", "rtl");
        // One Tab stop: the chosen tab only.
        await expect(tabs.nth(1)).toHaveAttribute("tabindex", "0");
        await expect(tabs.nth(0)).toHaveAttribute("tabindex", "-1");
        await expect(tabs.nth(2)).toHaveAttribute("tabindex", "-1");

        // Arrows: the tab to the reading-direction end is "next": Right in English, Left in Arabic.
        const forward = rtl ? "ArrowLeft" : "ArrowRight";
        const back = rtl ? "ArrowRight" : "ArrowLeft";
        await tabs.nth(1).focus();
        await page.keyboard.press(forward);
        await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
        await expect(tabs.nth(2)).toBeFocused();
        await expect(panel).toHaveAttribute("lang", "es");
        await expect(panel).toHaveAttribute("dir", "ltr");
        await page.keyboard.press(forward);
        await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
        await expect(panel).toHaveAttribute("lang", "en");
        await page.keyboard.press(back);
        await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");
        await page.keyboard.press("Home");
        await expect(tabs.nth(0)).toHaveAttribute("aria-selected", "true");
        await page.keyboard.press("End");
        await expect(tabs.nth(2)).toHaveAttribute("aria-selected", "true");

        // Tab leaves the tab list; it does not walk the other tabs.
        await page.keyboard.press("Tab");
        await expect(page.locator('[role="tab"]:focus')).toHaveCount(0);
        // A click chooses too.
        await tabs.nth(1).click();
        await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
        await expectNoRadio(page);
        await expectNoSidewaysScroll(page);
      });

      test(`Draft and Missing chips, and "I checked this translation" only on Arabic and Spanish (${at})`, async ({ page }) => {
        await openScene(page, "panel-draft-ar", viewport, locale);
        const tabs = languageTabs(page, locale);
        const checkbox = page.getByRole("checkbox", { name: copy.checkedTranslation });
        await expect(tabs.nth(0)).toHaveText("EN");
        await expect(tabs.nth(1)).toContainText(copy.draft);
        await expect(tabs.nth(2)).toContainText(copy.missing);
        await expect(page.getByText(copy.draftNote)).toBeVisible();
        await expect(checkbox).toBeVisible();
        await expect(checkbox).not.toBeChecked();

        await checkbox.check();
        await expectCalled(page, "checked:ar:true");
        await expect(tabs.nth(1)).toContainText(copy.published);
        await expect(page.getByText(copy.draftNote)).toHaveCount(0);
        await checkbox.uncheck();
        await expectCalled(page, "checked:ar:false");
        await expect(tabs.nth(1)).toContainText(copy.draft);

        // Spanish has no text yet: nothing to check, and the box says so by being off.
        await tabs.nth(2).click();
        await expect(checkbox).toBeDisabled();
        // English is the source: no box.
        await tabs.nth(0).click();
        await expect(checkbox).toHaveCount(0);
      });

      test(`closing with unsaved changes asks "Discard changes?"; Keep editing stays, Discard closes (${at})`, async ({ page }) => {
        await openScene(page, "panel-draft-ar", viewport, locale);
        const question = page.getByRole("dialog", { name: copy.discardTitle });
        await button(page, copy.close).click();
        await expect(question).toBeVisible();
        await expect(button(page, copy.discard)).toBeVisible();
        await button(page, copy.keepEditing).click();
        await expect(question).toHaveCount(0);
        await expect(button(page, copy.close)).toBeVisible();
        await expectNotCalled(page, "close");

        // Escape asks the same question.
        await page.keyboard.press("Escape");
        await expect(question).toBeVisible();
        await button(page, copy.discard).click();
        await expectCalled(page, "close");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      });

      test(`closing a panel with nothing changed closes at once (${at})`, async ({ page }) => {
        await openScene(page, "panel-new", viewport, locale);
        await button(page, copy.close).click();
        await expectCalled(page, "close");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      });

      test(`Publish stays off while anything is missing, and the gaps are listed in words (${at})`, async ({ page }) => {
        await openScene(page, "panel-new", viewport, locale);
        const publish = button(page, copy.publish);
        await expect(publish).toBeDisabled();
        await expect(button(page, copy.save)).toBeEnabled();
        await expect(page.getByText(copy.publishNeeds)).toBeVisible();
        await expect(page.getByText(copy.publishNeeds).locator("xpath=following-sibling::ul/li")).toHaveCount(3);
        await publish.click({ force: true });
        await expectNotCalled(page, "publish");
        // A new item has no Delete, no Unpublish and no Save and update site.
        await expect(button(page, copy.delete)).toHaveCount(0);
        await expect(button(page, copy.unpublish)).toHaveCount(0);
        await expect(button(page, copy.saveAndUpdateSite)).toHaveCount(0);
        await button(page, copy.save).click();
        await expectCalled(page, "save");
        await expectNoRadio(page);
      });

      test(`filling the missing text turns Publish on, and it reaches its handler (${at})`, async ({ page }) => {
        await openScene(page, "panel-draft-ar", viewport, locale);
        const publish = button(page, copy.publish);
        await expect(publish).toBeDisabled();
        await expect(page.getByText(copy.publishNeeds).locator("xpath=following-sibling::ul/li")).toHaveCount(3);
        await languageTabs(page, locale).nth(2).click();
        await page.locator("#kit-name").fill("x");
        await page.locator("#kit-short").fill("x");
        await expect(publish).toBeDisabled();
        await page.locator("#kit-description").fill("x");
        await expect(page.getByText(copy.publishNeeds)).toHaveCount(0);
        await expect(publish).toBeEnabled();
        await publish.click();
        await expectCalled(page, "publish");
      });

      test(`an unpublished saved item: Save, Publish and a live Delete reach their handlers (${at})`, async ({ page }) => {
        await openScene(page, "panel-draft-ar", viewport, locale);
        await button(page, copy.save).click();
        await expectCalled(page, "save");
        // Saved: nothing is dirty any more, so Save rests.
        await expect(button(page, copy.save)).toBeDisabled();
        const remove = button(page, copy.delete);
        await expect(remove).toBeEnabled();
        await remove.click();
        await expectCalled(page, "delete");
      });

      test(`a published item: Save and update site and Unpublish; Delete waits for Unpublish (${at})`, async ({ page }) => {
        await openScene(page, "panel-published", viewport, locale);
        await expect(button(page, copy.saveAndUpdateSite)).toBeEnabled();
        await expect(button(page, copy.unpublish)).toBeEnabled();
        await expect(button(page, copy.publish)).toHaveCount(0);
        await expect(button(page, copy.save)).toHaveCount(0);
        await expect(button(page, copy.delete)).toBeDisabled();
        await expect(page.getByText(copy.unpublishFirst)).toBeVisible();
        await expect(page.getByText(copy.publishNeeds)).toHaveCount(0);

        await button(page, copy.saveAndUpdateSite).click();
        await expectCalled(page, "save");
        await expect(button(page, copy.saveAndUpdateSite)).toBeDisabled();
        await button(page, copy.unpublish).click();
        await expectCalled(page, "unpublish");
      });

      test(`a published item without a rate or a price says so in words (${at})`, async ({ page }) => {
        await openScene(page, "panel-warning", viewport, locale);
        await expect(page.getByText(copy.warnNoBaseRate)).toBeVisible();
        await expect(page.getByText(copy.warnNoPrice)).toBeVisible();
        await expect(button(page, copy.saveAndUpdateSite)).toBeVisible();
      });

      test(`a 409 publish_incomplete is shown through the same list and clears when the owner edits (${at})`, async ({ page }) => {
        await openScene(page, "panel-error", viewport, locale);
        const list = page.getByText(copy.publishNeeds).locator("xpath=following-sibling::ul/li");
        await expect(list).toHaveCount(3);
        await expect(button(page, copy.publish)).toBeDisabled();
        await expect(page.getByRole("alert")).toHaveCount(0);
        // The server's own words for the Arabic and Spanish gaps and the photo, in the language of the dashboard.
        const gap = (language: "ar" | "es", field: string) => copy.missingLine.replace("{language}", copy.languages[language]).replace("{field}", field);
        const upper = (value: string) => value.charAt(0).toLocaleUpperCase() + value.slice(1);
        await expect(list.nth(0)).toHaveText(upper(gap("ar", copy.fields.description)));
        await expect(list.nth(1)).toHaveText(upper(gap("es", copy.fields.short_line)));
        await expect(list.nth(2)).toHaveText(upper(copy.fields.photo));

        await page.locator("#kit-name").fill("x");
        await expect(page.getByText(copy.publishNeeds)).toHaveCount(0);
        await expect(button(page, copy.publish)).toBeEnabled();
      });

      test(`the section tabs change the panel body (${at})`, async ({ page }) => {
        await openScene(page, "panel-published", viewport, locale);
        const sections = page.getByRole("tablist", { name: copy.sections }).getByRole("tab");
        await expect(sections).toHaveCount(3);
        await expect(sections.nth(0)).toHaveAttribute("aria-selected", "true");
        await expect(languageTabs(page, locale)).toHaveCount(3);
        await sections.nth(1).click();
        await expect(sections.nth(1)).toHaveAttribute("aria-selected", "true");
        await expect(sections.nth(1)).toHaveText(words.stays);
        await expect(page.getByText(words.note)).toBeVisible();
        await expect(languageTabs(page, locale)).toHaveCount(0);
        await sections.nth(0).click();
        await expect(languageTabs(page, locale)).toHaveCount(3);
      });

      test(`a panel is a full-screen sheet at 390 and docks to the inline end from 768, mirrored in Arabic (${at})`, async ({ page }) => {
        await openScene(page, "panel-published", viewport, locale);
        await expect(page.locator("html")).toHaveAttribute("dir", rtl ? "rtl" : "ltr");
        const panel = page.getByRole("dialog");
        await expect(panel).toBeVisible();
        const view = VIEWPORTS[viewport];
        const box = await panel.boundingBox();
        expect(box, "panel box").not.toBeNull();
        if (!box) return;
        if (viewport === "phone") {
          expect(Math.round(box.x)).toBe(0);
          expect(Math.round(box.y)).toBe(0);
          expect(Math.round(box.width)).toBe(view.width);
          expect(Math.round(box.height)).toBe(view.height);
        } else {
          expect(box.width, "docked, not full width").toBeLessThan(view.width / 2);
          if (rtl) expect(Math.round(box.x), "Arabic docks at the left").toBe(0);
          else expect(Math.round(box.x + box.width), "English docks at the right").toBe(view.width);
        }
        await expectNoSidewaysScroll(page);
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
