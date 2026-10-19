import { expect, test } from "@playwright/test";
import type { Locale3 } from "../components/ops/api-types";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_MEDIA_COPY } from "../lib/copy/ops-media";
import { OPS_TEAM_COPY } from "../lib/copy/ops-team";
import { openDashboard, openRow } from "./helpers/ops-catalog-api";
import { definePictures } from "./helpers/ops-team-pictures";
import { mockTeamApi, teamPostsTo as posts, warmTeamDashboard } from "./helpers/ops-team-api";
import type { Viewport } from "./journey/matrix";
import { AMOUNT_PLACEHOLDER, numberedTeam } from "./journey/scenes/_ops-team-words";

// Catalog -> Packages, the three home journeys (plan 03.2-08), on its harness scene tests/journey/scenes/ops-journeys.tsx.
// Task 1: the pictures (the copy check is in tests/ops-team.spec.ts: one copy file). Task 2: the behaviour block at the
// end, on the real page with every /api/ops/* answered by page.route (tests/helpers/ops-team-api.ts); bodies asserted.

definePictures("ops-journeys", {
  "journey-list": {
    panel: false,
    check: async (page, l) => {
      const copy = OPS_TEAM_COPY[l].journeys;
      const kit = OPS_KIT_COPY[l];
      // No Delete in the list: the three journeys stay (C-15). (No New either: the view has no such prop.)
      await expect(page.getByRole("button", { name: kit.delete })).toHaveCount(0);
      return [
        page.getByRole("heading", { level: 1, name: copy.title }),
        page.getByText(copy.intro, { exact: true }),
        page.getByText(numberedTeam("en", "journey", 1), { exact: true }),
        page.getByRole("button", { name: kit.moveDown }).first(),
      ];
    },
  },
  "journey-editor": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const copy = OPS_TEAM_COPY[l].journeys;
      const kit = OPS_KIT_COPY[l];
      await expect(page.getByRole("tab")).toHaveCount(0);
      await expect(page.getByRole("button", { name: kit.delete })).toHaveCount(0);
      const reading = copy.readingFrom.replace("{currency}", "USD").replace("{amount}", AMOUNT_PLACEHOLDER);
      return [
        page.getByRole("heading", { level: 2, name: kit.editor.sections.text, exact: true }),
        page.getByRole("heading", { level: 2, name: kit.editor.sections.photo, exact: true }),
        page.getByRole("heading", { level: 2, name: kit.editor.sections.price, exact: true }),
        page.getByLabel(copy.fieldPrice),
        page.getByText(copy.priceHint, { exact: true }),
        page.getByText(reading, { exact: true }),
        page.getByText(copy.noDelete, { exact: true }),
        page.getByRole("button", { name: kit.unpublish, exact: true }),
      ];
    },
  },
  "journey-editor-price-unreadable": {
    panel: true,
    folder: "editor",
    check: async (page, l) => [page.getByText(OPS_TEAM_COPY[l].journeys.readingNone, { exact: true })],
  },
  "journey-editor-hidden": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const kit = OPS_KIT_COPY[l];
      await expect(page.getByRole("button", { name: kit.publish, exact: true })).toBeDisabled();
      return [
        page.getByText(kit.publishNeeds, { exact: true }),
        page.getByText(kit.fields.photo, { exact: true }),
        page.getByRole("button", { name: kit.publish, exact: true }),
      ];
    },
  },
});

const PAGE_PATH = "/dashboard/catalog/packages";
const COMBOS: { viewport: Viewport; locale: Locale3 }[] = [
  { viewport: "desktop", locale: "en" },
  { viewport: "phone", locale: "ar" },
];

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  test.beforeAll(async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    await warmTeamDashboard(browser, PAGE_PATH, baseURL, OPS_TEAM_COPY.en.journeys.title);
  });

  for (const { viewport, locale } of COMBOS) {
    const copy = OPS_TEAM_COPY[locale].journeys;
    const kit = OPS_KIT_COPY[locale];
    const at = `${viewport} ${locale}`;
    const open = async (page: import("@playwright/test").Page, baseURL: string | undefined) =>
      openDashboard(page, PAGE_PATH, viewport, locale, baseURL, copy.title);

    test(`The three journeys: no New and no Delete, in the list or the editor (${at})`, async ({ page, baseURL }) => {
      await mockTeamApi(page);
      await open(page, baseURL);
      for (const name of ["[Journey 1]", "[Journey 2]", "[Journey 3]"]) await expect(openRow(page, name)).toBeVisible();
      await expect(page.getByRole("button", { name: kit.delete })).toHaveCount(0);
      await openRow(page, "[Journey 1]").click();
      await expect(page.getByRole("heading", { level: 1, name: "[Journey 1]" })).toBeVisible();
      await expect(page.getByRole("button", { name: kit.delete })).toHaveCount(0);
      await expect(page.getByText(copy.noDelete, { exact: true })).toBeVisible();
    });

    test(`Save: the price line as typed, no price column sent; the reading is the saved line's (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Journey 1]").click();
      await expect(page.getByText(copy.readingFrom.replace("{currency}", "USD").replace("{amount}", "1,000"), { exact: true })).toBeVisible();
      await page.getByLabel(copy.fieldPrice).fill("From USD 3,000 per person");
      await page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true }).click();
      const [save] = await posts(api, "journeys");
      expect(save!.action).toBe("save");
      const item = save!.item as Record<string, unknown> & { translations: Record<string, Record<string, string | null> | null> };
      expect(Object.keys(item).sort(), "no slug, no price column").toEqual(["id", "is_featured", "media_id", "translations"]);
      expect(item).toMatchObject({ id: "j1", is_featured: false, media_id: "m-j1" });
      expect(item.translations.en).toMatchObject({ name: "[Journey 1]", price_label: "From USD 3,000 per person", status: "published" });
      expect(api.of("translate").map((t) => t.target).sort()).toEqual(["ar", "es"]);
      expect(item.translations.ar).toMatchObject({ price_label: "[AR] From USD 3,000 per person", status: "published" });
      expect(item.translations.es).toMatchObject({ price_label: "[ES] From USD 3,000 per person", status: "published" });
      // Read back: the reading follows what the server parsed from the saved English line.
      await expect(page.getByText(copy.readingFrom.replace("{currency}", "USD").replace("{amount}", "3,000"), { exact: true })).toBeVisible();
      expect(api.of("publish")).toHaveLength(0);
    });

    test(`Publish a hidden journey: one save with Arabic and Spanish published, then the publish call (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Journey 3]").click();
      await expect(page.getByText(copy.readingNone, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: kit.publish, exact: true }).click();
      const [publish] = await posts(api, "publish");
      const saves = api.of("journeys");
      expect(saves).toHaveLength(1);
      const tr = (saves[0]!.item as { translations: Record<string, { status: string } | null> }).translations;
      expect(tr.ar!.status).toBe("published");
      expect(tr.es!.status).toBe("published");
      expect(publish).toEqual({ entity: "journey_tier", id: "j3", published: true });
      expect(api.posts.findIndex((p) => p.path === "journeys")).toBeLessThan(api.posts.findIndex((p) => p.path === "publish"));
      await expect(page.getByRole("button", { name: kit.unpublish, exact: true })).toBeVisible();
    });

    test(`Unpublish sends the publish call with published false (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Journey 1]").click();
      await page.getByRole("button", { name: kit.unpublish, exact: true }).click();
      const [unpublish] = await posts(api, "publish");
      expect(unpublish).toEqual({ entity: "journey_tier", id: "j1", published: false });
      await expect(page.getByRole("button", { name: kit.publish, exact: true })).toBeVisible();
      expect(api.of("journeys")).toHaveLength(0);
    });

    test(`A shown journey with its photo removed: Save waits and nothing is sent (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Journey 1]").click();
      await page.getByRole("button", { name: OPS_MEDIA_COPY[locale].removePhoto, exact: true }).click();
      const save = page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true });
      await expect(save).toBeDisabled();
      await save.click({ force: true });
      await page.waitForTimeout(500);
      expect(api.of("journeys")).toHaveLength(0);
    });

    test(`Reorder: Move down sends the full id list (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await page.getByRole("button", { name: kit.moveDown }).filter({ visible: true }).first().click();
      const [reorder] = await posts(api, "journeys");
      expect(reorder).toEqual({ action: "reorder", ids: ["j2", "j1", "j3"] });
    });
  }
});
