import { expect, test } from "@playwright/test";
import { OPS_CATALOG_COPY } from "../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { definePictures } from "./helpers/ops-catalog-pictures";
import { numbered } from "./journey/scenes/_ops-catalog-words";

// Catalog -> Experiences and services (plan 03.2-06) on its harness scene tests/journey/scenes/ops-catalog-items.tsx.
// Task 1: the pictures. The behaviour block (every /api/ops/* answered by page.route) joins this file in Task 2.
// The copy-shape test lives in tests/ops-destinations.spec.ts (one copy file serves both screens).

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
  "panel-details": {
    panel: true,
    check: async (page, l) => {
      const copy = OPS_CATALOG_COPY[l].items;
      return [
        page.getByText(copy.homePickupHint, { exact: true }),
        page.getByText(copy.priceHint, { exact: true }),
        page.getByLabel(copy.fieldDuration),
        page.getByRole("button", { name: copy.kindExperience, exact: true }),
        page.getByRole("button", { name: copy.kindService, exact: true }),
        page.getByRole("button", { name: OPS_KIT_COPY[l].publish, exact: true }),
      ];
    },
  },
  "panel-home-pickup-refused": {
    panel: true,
    check: async (page, l) => {
      const copy = OPS_CATALOG_COPY[l].items;
      return [page.getByText(copy.isUae, { exact: true }), page.getByText(copy.isHomePickup, { exact: true }), page.getByText(copy.homePickupRefused, { exact: true })];
    },
  },
  "panel-connections": {
    panel: true,
    check: async (page, l) => {
      const copy = OPS_CATALOG_COPY[l].items;
      return [page.getByText(copy.connectionsIntro, { exact: true }), page.getByLabel(copy.searchDestinations), page.getByLabel(copy.searchStays)];
    },
  },
  "panel-published-no-price": {
    panel: true,
    check: async (page, l) => [
      page.getByText(OPS_KIT_COPY[l].warnNoPrice, { exact: true }),
      page.getByRole("button", { name: OPS_KIT_COPY[l].saveAndUpdateSite, exact: true }),
      page.getByRole("button", { name: OPS_KIT_COPY[l].unpublish, exact: true }),
    ],
  },
});

test.describe("scene", () => {
  test("the scene states are the five signed ones", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync(`${__dirname}/journey/scenes/ops-catalog-items.tsx`, "utf8");
    const keys = [...src.slice(src.indexOf("export const scenes")).matchAll(/^ {2}"([a-z-]+)":/gm)].map((m) => m[1]);
    expect(keys).toEqual(["list-filtered", "panel-details", "panel-home-pickup-refused", "panel-connections", "panel-published-no-price"]);
  });
});
