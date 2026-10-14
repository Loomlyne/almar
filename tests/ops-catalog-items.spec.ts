import { expect, test, type Page } from "@playwright/test";
import { OPS_CATALOG_COPY } from "../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { definePictures, type PictureLocale } from "./helpers/ops-catalog-pictures";
import { numbered } from "./journey/scenes/_ops-catalog-words";

// Catalog -> Experiences and services (plan 03.2-06) on its harness scene tests/journey/scenes/ops-catalog-items.tsx.
// Task 1: the pictures. The behaviour block (every /api/ops/* answered by page.route) joins this file in Task 2.
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
        page.getByText(kit.editor.unsaved, { exact: true }),
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
      return [
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
    const keys = [...src.slice(src.indexOf("export const scenes")).matchAll(/^ {2}"([a-z-]+)":/gm)].map((m) => m[1]);
    expect(keys).toEqual(["list-filtered", "editor", "editor-translations", "editor-home-pickup-refused", "editor-published-no-price"]);
  });
});
