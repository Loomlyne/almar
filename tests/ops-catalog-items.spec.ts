import { expect, test, type Page } from "@playwright/test";
import { OPS_CATALOG_COPY, fillCatalogCopy } from "../lib/copy/ops-catalog";
import { OPS_KIT_COPY, fillCopy } from "../lib/copy/ops-kit";
import type { Locale3 } from "../components/ops/api-types";
import { missingLine } from "../components/ops/error-text";
import { NEW_ID, activeName, countPosts, holdPost, mockCatalogApi, openDashboard, openRow, postsTo, refusal, warmDashboard } from "./helpers/ops-catalog-api";
import type { Viewport } from "./journey/matrix";
import { definePictures, type PictureLocale } from "./helpers/ops-catalog-pictures";
import { numbered, words } from "./journey/scenes/_ops-catalog-words";

// Catalog -> Experiences and services (plan 03.2-06) on its harness scene tests/journey/scenes/ops-catalog-items.tsx.
// Task 1: the pictures. Task 2: the behaviour block at the end, on the real page with every /api/ops/* answered by
// page.route fixtures shaped like the contract (tests/helpers/ops-catalog-api.ts); the request bodies are asserted.
// The copy-shape test lives in tests/ops-destinations.spec.ts (one copy file serves both screens).

/** The five cards of the item editor (signed option B): Text, Photo, Connections, Price, Settings. */
function sectionHeadings(page: Page, l: PictureLocale) {
  const s = OPS_KIT_COPY[l].editor.sections;
  return [s.text, s.photo, s.connections, s.price, s.settings].map((name) => page.getByRole("heading", { level: 2, name, exact: true }));
}

definePictures("ops-catalog-items", {
  "list-filtered": {
    panel: false,
    check: async (page, l) => {
      const copy = OPS_CATALOG_COPY[l].items;
      // Services connected to destination 1: items 2 and 3 only.
      await expect(page.getByText(numbered(l, "item", 1), { exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: copy.filterServices, exact: true })).toHaveAttribute("aria-pressed", "true");
      return [
        page.getByRole("heading", { level: 1, name: copy.title }),
        page.getByText(numbered(l, "item", 2), { exact: true }),
        page.getByText(numbered(l, "item", 3), { exact: true }),
        page.getByText(copy.priceNotSet, { exact: true }),
      ];
    },
  },
  editor: {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const copy = OPS_CATALOG_COPY[l].items;
      const kit = OPS_KIT_COPY[l];
      // English fields only: no language tabs, no Translate button, no Draft badge.
      await expect(page.getByRole("tab")).toHaveCount(0);
      await expect(page.getByLabel(`${copy.fieldName} · AR`)).toHaveCount(0);
      return [
        page.getByRole("button", { name: copy.title, exact: true }),
        ...sectionHeadings(page, l),
        page.getByText(kit.editor.englishOnly, { exact: true }),
        page.getByRole("button", { name: kit.editor.editTranslations }),
        page.getByLabel(copy.fieldDuration),
        page.getByText(copy.priceHint, { exact: true }),
        page.getByText(copy.homePickupHint, { exact: true }),
        page.getByRole("button", { name: kit.save, exact: true }),
        page.getByRole("button", { name: kit.publish, exact: true }),
      ];
    },
  },
  "editor-translations": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const copy = OPS_CATALOG_COPY[l].items;
      const kit = OPS_KIT_COPY[l];
      await page.getByRole("button", { name: kit.editor.editTranslations }).click();
      return [
        page.getByText(kit.editor.translationsNote, { exact: true }),
        page.getByLabel(`${copy.fieldName} · AR`),
        page.getByLabel(`${copy.fieldName} · ES`),
        page.getByRole("button", { name: kit.editor.hideTranslations }),
      ];
    },
  },
  "editor-home-pickup-refused": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const copy = OPS_CATALOG_COPY[l].items;
      return [page.getByText(copy.isUae, { exact: true }), page.getByText(copy.isHomePickup, { exact: true }), page.getByText(copy.homePickupRefused, { exact: true })];
    },
  },
  "editor-published-no-price": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const kit = OPS_KIT_COPY[l];
      // The locked web address is text, not a box that looks editable; no read-only control anywhere.
      await expect(page.getByRole("textbox", { name: OPS_CATALOG_COPY[l].items.fieldSlug })).toHaveCount(0);
      await expect(page.locator("input[readonly], textarea[readonly]")).toHaveCount(0);
      return [
        page.getByText(words(l).webAddress, { exact: true }),
        page.getByText(kit.warnNoPrice, { exact: true }),
        page.getByRole("button", { name: kit.unpublish, exact: true }),
        page.getByText(OPS_CATALOG_COPY[l].items.slugLocked, { exact: true }),
        page.getByText(kit.unpublishFirst, { exact: true }),
      ];
    },
  },
});

test.describe("scene", () => {
  test("the scene states are the signed list and the four editor states", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(`${__dirname}/journey/scenes/ops-catalog-items.tsx`, "utf8");
    const keys = [...src.slice(src.indexOf("export const scenes")).matchAll(/^ {2}"?([a-z-]+)"?:/gm)].map((m) => m[1]);
    expect(keys).toEqual(["list-filtered", "editor", "editor-translations", "editor-home-pickup-refused", "editor-published-no-price"]);
  });
});

const COMBOS: { viewport: Viewport; locale: Locale3 }[] = [
  { viewport: "desktop", locale: "en" },
  { viewport: "phone", locale: "ar" },
];
const PAGE_PATH = "/dashboard/catalog/experiences";

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  test.beforeAll(async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    await warmDashboard(browser, PAGE_PATH, baseURL, OPS_CATALOG_COPY.en.items.title);
  });

  for (const { viewport, locale } of COMBOS) {
    const copy = OPS_CATALOG_COPY[locale].items;
    const kit = OPS_KIT_COPY[locale];
    const at = `${viewport} ${locale}`;
    const open = async (page: Page, baseURL: string | undefined) => openDashboard(page, PAGE_PATH, viewport, locale, baseURL, copy.title);

    test(`New item: Save sends the facts, the price as a two-decimal string and AI drafts in Arabic and Spanish (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await page.getByRole("button", { name: copy.newItem, exact: true }).first().click();
      await page.getByLabel(copy.fieldName).fill("Sunset sail");
      await page.getByLabel(copy.fieldSlug).fill("sunset-sail");
      await page.getByLabel(copy.fieldPrice).fill("12.5");
      await page.getByRole("button", { name: copy.kindService, exact: true }).click();
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [save] = await postsTo(api, "catalog");
      expect(save).toEqual({
        action: "save",
        item: {
          slug: "sunset-sail",
          kind: "service",
          unit: "person",
          price_aed: "12.50",
          is_uae: false,
          is_home_pickup: false,
          media_id: null,
          destination_ids: [],
          stay_ids: [],
          translations: {
            en: { name: "Sunset sail", summary: null, duration_label: null, status: "published" },
            ar: { name: "[AR] Sunset sail", summary: null, duration_label: null, status: "draft" },
            es: { name: "[ES] Sunset sail", summary: null, duration_label: null, status: "draft" },
          },
        },
      });
      // The editor now shows the saved item (read back by its new id).
      await expect(page.getByRole("heading", { level: 1, name: "Sunset sail" })).toBeVisible();
    });

    test(`A price that is not money is refused as it is typed: Save and Publish wait, no AI translate, no save (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await openRow(page, "Airport transfer").click();
      const refused = page.getByText(fillCopy(kit.invalidField, { field: copy.fieldPrice.toLocaleLowerCase(locale) }), { exact: true });
      const save = page.getByRole("button", { name: kit.save, exact: true });
      // A name change too, so a Save would ask the AI for Arabic and Spanish first.
      await page.getByLabel(copy.fieldName).fill("Airport transfer VIP");
      for (const typed of ["abc", "12345678901"]) {
        await page.getByLabel(copy.fieldPrice).fill(typed);
        await expect(refused, typed).toBeVisible();
        await expect(save, typed).toBeDisabled();
        await expect(page.getByRole("button", { name: kit.publish, exact: true }), typed).toBeDisabled();
      }
      await save.click({ force: true });
      await page.waitForTimeout(500);
      expect(api.of("translate"), "no AI translate").toHaveLength(0);
      expect(api.of("catalog"), "no save").toHaveLength(0);
      // The Publish list says a valid price is needed, not that the price is empty.
      await expect(page.getByRole("listitem").filter({ hasText: copy.validPrice })).toHaveCount(1);
      await page.getByLabel(copy.fieldPrice).fill("9999999999.5");
      await expect(refused).toHaveCount(0);
      await expect(save).toBeEnabled();
    });

    test(`Home pickup refused by the server: the line under that toggle, the form kept (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page, (path, body) => (path === "catalog" && body.action === "save" ? refusal(409, "invalid", "is_home_pickup") : null));
      await open(page, baseURL);
      await openRow(page, "Airport transfer").click();
      await page.getByText(copy.isHomePickup, { exact: true }).click();
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [save] = await postsTo(api, "catalog");
      expect((save!.item as { is_home_pickup: boolean }).is_home_pickup).toBe(true);
      await expect(page.getByText(copy.homePickupRefused, { exact: true })).toBeVisible();
      await expect(page.getByRole("checkbox", { name: copy.isHomePickup })).toBeChecked();
    });

    test(`Publish refused as incomplete: the server's missing list in words (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page, (path) =>
        path === "publish" ? refusal(409, "publish_incomplete", null, { missing: [{ locale: "es", field: "summary" }] }) : null,
      );
      await open(page, baseURL);
      await openRow(page, "Airport transfer").click();
      await page.getByRole("button", { name: kit.publish, exact: true }).click();
      const [publish] = await postsTo(api, "publish");
      expect(publish).toEqual({ entity: "catalog_item", id: "c2", published: true });
      await expect(page.getByText(kit.publishNeeds, { exact: true })).toBeVisible();
      await expect(page.getByText("publish_incomplete")).toHaveCount(0);
    });

    test(`Unpublish and Delete on a published item: Delete waits, Unpublish calls publish false (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await openRow(page, "Coffee farm").click();
      await expect(page.getByText(kit.unpublishFirst, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: kit.delete, exact: true })).toBeDisabled();
      await page.getByRole("button", { name: kit.unpublish, exact: true }).click();
      const [publish] = await postsTo(api, "publish");
      expect(publish).toEqual({ entity: "catalog_item", id: "c1", published: false });
      await page.getByRole("button", { name: kit.delete, exact: true }).click();
      await page.getByRole("dialog").getByRole("button", { name: kit.delete, exact: true }).click();
      const [del] = await postsTo(api, "catalog");
      expect(del).toEqual({ action: "delete", id: "c1" });
    });

    test(`Publish refused after the save was taken: the save went first, the editor reads the item back, the refusal in words (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page, (path) => (path === "publish" ? refusal(503, "unavailable") : null));
      await open(page, baseURL);
      await openRow(page, "Airport transfer").click();
      const itemReads = () => api.gets.filter((u) => u.pathname.endsWith("/catalog") && u.searchParams.get("id") === "c2").length;
      await expect.poll(itemReads).toBe(1);
      await page.getByRole("button", { name: kit.publish, exact: true }).click();
      await postsTo(api, "publish");
      expect(api.of("catalog")).toHaveLength(1);
      expect(api.posts.findIndex((p) => p.path === "catalog")).toBeLessThan(api.posts.findIndex((p) => p.path === "publish"));
      await expect.poll(itemReads, { message: "read back after the refused publish" }).toBe(2);
      await expect(page.getByText(kit.errors.unavailable, { exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: kit.publish, exact: true })).toBeVisible();
    });

    test(`A new item whose read-back fails keeps its id: the next Save updates it, not a second create (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page, undefined, (path, query) => (path === "catalog" && query.get("id") === NEW_ID ? refusal(503, "unavailable") : null));
      await open(page, baseURL);
      await page.getByRole("button", { name: copy.newItem, exact: true }).first().click();
      await page.getByLabel(copy.fieldName).fill("Sunset sail");
      await page.getByLabel(copy.fieldSlug).fill("sunset-sail");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [first] = await postsTo(api, "catalog");
      expect((first!.item as { id?: string }).id).toBeUndefined();
      await expect(page.getByText(kit.errors.unavailable, { exact: true })).toBeVisible();
      await page.getByLabel(copy.fieldName).fill("Sunset sail at dusk");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const saves = await postsTo(api, "catalog", 2);
      expect((saves[1]!.item as { id?: string }).id).toBe(NEW_ID);
    });

    // A pin for "one request": the kit disables Save and Publish in the first click's own event, so the second click of
    // a double-click lands on a disabled button. The screen's ref guard is a second line a UI click cannot reach (its
    // bite check did not fail, 2026-10-15); this test keeps the one-request behaviour from regressing either way.
    test(`A double-click on Save sends one save; on Publish one save and one publish (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await openRow(page, "Airport transfer").click();
      await page.getByLabel(copy.fieldName).fill("Airport transfer VIP");
      await page.getByRole("button", { name: kit.save, exact: true }).dblclick();
      await postsTo(api, "catalog");
      await page.waitForTimeout(1_000);
      expect(api.of("catalog"), "one save").toHaveLength(1);
      await expect(page.getByRole("button", { name: kit.save, exact: true })).toBeDisabled();
      await page.getByRole("button", { name: kit.publish, exact: true }).dblclick();
      await postsTo(api, "publish");
      await page.waitForTimeout(1_000);
      expect(api.of("catalog"), "one more save").toHaveLength(2);
      expect(api.of("publish"), "one publish").toHaveLength(1);
    });

    test(`Reorder: one order at a time while the list is busy; a refusal is said on the list (${at})`, async ({ page, baseURL }) => {
      await mockCatalogApi(page);
      const hold = await holdPost(page, "catalog", (body) => body.action === "reorder");
      const reorders = countPosts(page, "catalog", (body) => body.action === "reorder");
      await open(page, baseURL);
      const down = page.getByRole("button", { name: kit.moveDown }).filter({ visible: true }).first();
      await down.click();
      await hold.seen;
      await expect(page.locator('[aria-busy="true"]').filter({ has: down })).toHaveCount(1);
      // The buttons stay enabled (keyboard focus is kept); the screen takes no second move meanwhile.
      await expect(down).toBeEnabled();
      await down.click();
      hold.release(refusal(503, "unavailable"));
      await expect(page.getByText(kit.errors.unavailable, { exact: true })).toBeVisible();
      expect(reorders(), "the second move was not sent").toBe(1);
    });

    test(`Reorder by keyboard: after the move, focus is on the moved row's move button (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await page.getByRole("button", { name: kit.moveDown }).filter({ visible: true }).first().focus();
      await page.keyboard.press("Enter");
      const [reorder] = await postsTo(api, "catalog");
      expect(reorder).toEqual({ action: "reorder", ids: ["c2", "c1", "c3"] });
      const moved = page.locator("tr, li").filter({ visible: true }).filter({ has: page.getByRole("button", { name: "Coffee farm", exact: true }) });
      await expect(moved.getByRole("button", { name: kit.moveDown })).toBeFocused();
    });

    test(`Reorder by keyboard: a Tab away while the order is on its way keeps focus where the owner put it (${at})`, async ({ page, baseURL }) => {
      await mockCatalogApi(page);
      const hold = await holdPost(page, "catalog", (body) => body.action === "reorder");
      await open(page, baseURL);
      await page.getByRole("button", { name: kit.moveDown }).filter({ visible: true }).first().focus();
      await page.keyboard.press("Enter");
      await hold.seen;
      // The owner moves on before the list is read back; the view must not pull focus back to the moved row.
      await page.keyboard.press("Tab");
      const away = await activeName(page);
      expect(away, "Tab reached a control").not.toBeNull();
      expect(away).not.toBe(kit.moveDown);
      hold.release({ status: 200, json: { ok: true, affects_site: true } });
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
      // A late refocus would land just after the read-back: the focused control must stay put for 500 ms, read every
      // two animation frames (a poll would pass on its first try and miss it).
      const until = Date.now() + 500;
      do {
        expect(await activeName(page), "focus stayed where the owner Tabbed to").toBe(away);
        await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))));
      } while (Date.now() < until);
      expect(await activeName(page), "focus stayed where the owner Tabbed to").toBe(away);
    });

    test(`Published item: with its only destination removed, Save waits and says what it needs (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await openRow(page, "Coffee farm").click();
      const save = page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true });
      await page.getByRole("button", { name: kit.removeNamed.replace("{name}", "Cartagena"), exact: true }).click();
      await expect(page.getByText(fillCatalogCopy(copy.liveNeeds, { list: missingLine(kit, { locale: null, field: "destination_ids" }) }), { exact: true })).toBeVisible();
      await expect(save).toBeDisabled();
      await save.click({ force: true });
      await page.waitForTimeout(500);
      expect(api.of("catalog")).toHaveLength(0);
      expect(api.of("translate")).toHaveLength(0);
    });

    test(`Stay filter: one read of the picked stay, kept for the session; no read per item (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      const stayReads = () => api.gets.filter((u) => u.pathname.endsWith("/stays") && u.searchParams.has("id")).map((u) => u.searchParams.get("id"));
      const itemReads = () => api.gets.filter((u) => u.pathname.endsWith("/catalog") && u.searchParams.has("id")).length;
      await page.getByRole("combobox", { name: copy.allStays }).click();
      await page.getByRole("option", { name: "Finca Tres" }).click();
      await expect(openRow(page, "Coffee farm")).toHaveCount(0);
      await expect(openRow(page, "Airport transfer")).toBeVisible();
      expect(stayReads()).toEqual(["s3"]);
      await page.getByRole("combobox", { name: "Finca Tres" }).click();
      await page.getByRole("option", { name: "Casa Uno" }).click();
      await expect(openRow(page, "Coffee farm")).toBeVisible();
      await expect(openRow(page, "Airport transfer")).toHaveCount(0);
      await page.getByRole("combobox", { name: "Casa Uno" }).click();
      await page.getByRole("option", { name: "Finca Tres" }).click();
      await expect(openRow(page, "Airport transfer")).toBeVisible();
      expect(stayReads(), "each stay read once").toEqual(["s3", "s1"]);
      expect(itemReads(), "no read per item").toBe(0);
    });

    test(`Stay filter: a stay that does not load says why and leaves the filter on all stays (${at})`, async ({ page, baseURL }) => {
      await mockCatalogApi(page, undefined, (path, query) => (path === "stays" && query.has("id") ? refusal(503, "unavailable") : null));
      await open(page, baseURL);
      await page.getByRole("combobox", { name: copy.allStays }).click();
      await page.getByRole("option", { name: "Finca Tres" }).click();
      await expect(page.getByText(kit.errors.unavailable, { exact: true })).toBeVisible();
      await expect(page.getByRole("combobox", { name: copy.allStays })).toBeVisible();
      await expect(openRow(page, "Coffee farm")).toBeVisible();
      await expect(openRow(page, "Airport transfer")).toBeVisible();
    });
  }
});
