import { expect, test, type Page } from "@playwright/test";
import { OPS_CATALOG_COPY } from "../lib/copy/ops-catalog";
import { OPS_KIT_COPY, fillCopy } from "../lib/copy/ops-kit";
import type { Locale3 } from "../components/ops/api-types";
import { mockCatalogApi, openDashboard, openRow, postsTo, refusal } from "./helpers/ops-catalog-api";
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

    test(`A price that is not money is refused in words before any request (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await openRow(page, "Airport transfer").click();
      await page.getByLabel(copy.fieldPrice).fill("abc");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      await expect(page.getByText(fillCopy(kit.invalidField, { field: copy.fieldPrice.toLocaleLowerCase(locale) }), { exact: true })).toBeVisible();
      expect(api.of("catalog")).toHaveLength(0);
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
