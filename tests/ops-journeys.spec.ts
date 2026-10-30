import { expect, test } from "@playwright/test";
import type { Locale3 } from "../components/ops/api-types";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_MEDIA_COPY } from "../lib/copy/ops-media";
import { OPS_TEAM_COPY } from "../lib/copy/ops-team";
import { openDashboard, openRow } from "./helpers/ops-catalog-api";
import { definePictures } from "./helpers/ops-team-pictures";
import { mockTeamApi, teamPostsTo as posts } from "./helpers/ops-team-api";
import type { Viewport } from "./journey/matrix";
import { AMOUNT_PLACEHOLDER, numberedTeam } from "./journey/scenes/_ops-team-words";

// Catalog -> Packages (plans 03.2-08, 06-06), on its harness scene tests/journey/scenes/ops-journeys.tsx. Task 1: the pictures
// (the copy check is in tests/ops-team.spec.ts: one copy file). Task 2: the behaviour block at the end, on the real page with
// every /api/ops/* answered by page.route (tests/helpers/ops-team-api.ts); bodies asserted. Plan 06-06's block (New, web address,
// cities, add-ons, Delete) is written, NOT run (owner rule 2026-10-21).

definePictures("ops-journeys", {
  "journey-list": {
    panel: false,
    check: async (page, l) => {
      const copy = OPS_TEAM_COPY[l].journeys;
      const kit = OPS_KIT_COPY[l];
      // No Delete in the list: it sits in the editor, under Settings (signed decision 5).
      await expect(page.getByRole("button", { name: kit.delete })).toHaveCount(0);
      return [
        page.getByRole("heading", { level: 1, name: copy.title }),
        page.getByText(copy.intro, { exact: true }),
        page.getByRole("button", { name: copy.newPackage, exact: true }),
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
      await expect(page.getByRole("button", { name: copy.deletePkg, exact: true })).toBeDisabled();
      const reading = copy.readingFrom.replace("{currency}", "USD").replace("{amount}", AMOUNT_PLACEHOLDER);
      return [
        page.getByRole("heading", { level: 2, name: kit.editor.sections.text, exact: true }),
        page.getByRole("heading", { level: 2, name: kit.editor.sections.photo, exact: true }),
        page.getByRole("heading", { level: 2, name: kit.editor.sections.price, exact: true }),
        page.getByLabel(copy.fieldPrice),
        page.getByText(copy.priceHint, { exact: true }),
        page.getByText(reading, { exact: true }),
        page.getByText(copy.cannotDelete, { exact: true }),
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

const DEST_A = "11111111-1111-4111-8111-111111111111";
const DEST_B = "22222222-2222-4222-8222-222222222222";
const STAY_A = "33333333-3333-4333-8333-333333333333";
const ITEM_A = "44444444-4444-4444-8444-444444444444";
const PICKUP = "55555555-5555-4555-8555-555555555555";

/** The three lists the screen reads for the cities and the add-on picker (tests/helpers/ops-team-api.ts does not answer them). */
async function mockOptions(page: import("@playwright/test").Page) {
  const reply = (route: import("@playwright/test").Route, items: unknown[]) =>
    route.fulfill({ status: 200, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify({ ok: true, items }) });
  await page.route(/\/api\/ops\/destinations(\?.*)?$/, (route) =>
    reply(route, [
      { id: DEST_A, slug: "a", name_en: "[Destination A]", name_ar: null, name_es: null, is_published: true, position: 1, stay_count: 1, published_stay_count: 1, hero: null },
      { id: DEST_B, slug: "b", name_en: "[Destination B]", name_ar: null, name_es: null, is_published: true, position: 2, stay_count: 0, published_stay_count: 0, hero: null },
    ]),
  );
  await page.route(/\/api\/ops\/stays(\?.*)?$/, (route) => reply(route, [{ id: STAY_A, slug: "s", title_en: "[Stay A]", destination_id: DEST_A, is_published: true, position: 1 }]));
  await page.route(/\/api\/ops\/catalog(\?.*)?$/, (route) =>
    reply(route, [
      { id: ITEM_A, slug: "i", name_en: "[Item A]", is_home_pickup: false, position: 1, destination_ids: [] },
      { id: PICKUP, slug: "p", name_en: "[Home pickup]", is_home_pickup: true, position: 2, destination_ids: [] },
    ]),
  );
}

const COMBOS: { viewport: Viewport; locale: Locale3 }[] = [
  { viewport: "desktop", locale: "en" },
  { viewport: "phone", locale: "ar" },
];

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  test.beforeAll(async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    // As warmTeamDashboard, with the screen's three option lists answered too (that helper has no slot in this plan).
    const page = await browser.newPage({ baseURL });
    try {
      await mockOptions(page);
      await mockTeamApi(page);
      await openDashboard(page, PAGE_PATH, "desktop", "en", baseURL, OPS_TEAM_COPY.en.journeys.title);
    } finally {
      await page.close();
    }
  });
  test.beforeEach(async ({ page }) => {
    await mockOptions(page);
  });

  for (const { viewport, locale } of COMBOS) {
    const copy = OPS_TEAM_COPY[locale].journeys;
    const kit = OPS_KIT_COPY[locale];
    const at = `${viewport} ${locale}`;
    const open = async (page: import("@playwright/test").Page, baseURL: string | undefined) =>
      openDashboard(page, PAGE_PATH, viewport, locale, baseURL, copy.title);

    test(`The list has New package; a shown package's Delete is off and says why (${at})`, async ({ page, baseURL }) => {
      await mockTeamApi(page);
      await open(page, baseURL);
      for (const name of ["[Journey 1]", "[Journey 2]", "[Journey 3]"]) await expect(openRow(page, name)).toBeVisible();
      await expect(page.getByRole("button", { name: copy.newPackage, exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: kit.delete })).toHaveCount(0);
      await openRow(page, "[Journey 1]").click();
      await expect(page.getByRole("heading", { level: 1, name: "[Journey 1]" })).toBeVisible();
      await expect(page.getByRole("button", { name: copy.deletePkg, exact: true })).toBeDisabled();
      await expect(page.getByText(copy.cannotDelete, { exact: true })).toBeVisible();
    });

    test(`New package: the web address is typed, the body has a slug and no id, cities go whole (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await page.getByRole("button", { name: copy.newPackage, exact: true }).click();
      await expect(page.getByRole("heading", { level: 1, name: copy.newPackage })).toBeVisible();
      await expect(page.getByRole("heading", { level: 2, name: copy.addons })).toHaveCount(0);
      await expect(page.getByRole("button", { name: copy.deletePkg, exact: true })).toHaveCount(0);
      await page.getByLabel(copy.fieldName).fill("[New package]");
      await page.getByLabel(copy.fieldPrice).fill("[Price line]");
      await page.getByLabel(copy.fieldSlug).fill("bad slug");
      await expect(page.getByText(kit.errors.invalid, { exact: true })).toBeVisible();
      await page.getByLabel(copy.fieldSlug).fill("new-package");
      await page.getByRole("button", { name: copy.addCity }).click();
      await page.getByLabel(copy.nights).fill("[3 nights]");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [save] = await posts(api, "journeys");
      const item = save!.item as Record<string, unknown> & { legs: { destination_id: string; stay_id: string | null; translations: Record<string, { nights_label: string; status: string } | null> }[]; addon_ids: string[] };
      expect(item.id).toBeUndefined();
      expect(item.slug).toBe("new-package");
      expect(item.addon_ids).toEqual([]);
      expect(item.legs).toHaveLength(1);
      expect(item.legs[0]).toMatchObject({ destination_id: DEST_A, stay_id: null });
      expect(item.legs[0]!.translations.en).toEqual({ nights_label: "[3 nights]", status: "published" });
      // The nights line is translated with the package's text, under its own flat field name.
      const translated = api.of("translate")[0] as { fields: Record<string, string> };
      expect(Object.entries(translated.fields).some(([name, value]) => /^leg_\d+$/.test(name) && value === "[3 nights]")).toBe(true);
    });

    test(`Cities: a stay of that destination, a changed destination clears it, move and remove; add-ons from the catalog, never the pickup (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Journey 3]").click();
      const addCity = page.getByRole("button", { name: copy.addCity });
      await addCity.click();
      await addCity.click();
      await addCity.click();
      const nights = page.getByLabel(copy.nights);
      await nights.nth(0).fill("[3 nights]");
      await nights.nth(1).fill("[2 nights]");
      await nights.nth(2).fill("[1 night]");
      const destination = page.getByRole("combobox", { name: new RegExp(`^${copy.destination}: `) }).first();
      const stay = page.getByRole("combobox", { name: new RegExp(`^${copy.stay}: `) }).first();
      // A stay of that destination; another destination clears it, and has no stay of its own to offer.
      await stay.click();
      await page.getByRole("option", { name: "[Stay A]" }).click();
      await expect(stay).toHaveAccessibleName(`${copy.stay}: [Stay A]`);
      await destination.click();
      await page.getByRole("option", { name: "[Destination B]" }).click();
      await expect(stay).toHaveAccessibleName(`${copy.stay}: ${copy.noStay}`);
      await destination.click();
      await page.getByRole("option", { name: "[Destination A]" }).click();
      await stay.click();
      await page.getByRole("option", { name: "[Stay A]" }).click();
      // Remove the third, move the first down: at the end, its Move down is off.
      await page.getByRole("button", { name: new RegExp(`^${copy.removeCity}: `) }).last().click();
      await expect(nights).toHaveCount(2);
      const moveDown = page.getByRole("button", { name: new RegExp(`^${kit.moveDown}: `) });
      await moveDown.first().click();
      await expect(moveDown.last()).toBeDisabled();
      await expect(page.getByRole("checkbox", { name: "[Home pickup]" })).toHaveCount(0);
      await page.getByRole("checkbox", { name: "[Item A]" }).check();
      await page.getByRole("button", { name: kit.connectSelected, exact: true }).click();
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [save] = await posts(api, "journeys");
      const item = save!.item as { legs: { stay_id: string | null; translations: { en: { nights_label: string } } }[]; addon_ids: string[] };
      expect(item.legs.map((leg) => leg.translations.en.nights_label)).toEqual(["[2 nights]", "[3 nights]"]);
      expect(item.legs.map((leg) => leg.stay_id)).toEqual([null, STAY_A]);
      expect(item.addon_ids).toEqual([ITEM_A]);
    });

    test(`Delete: only a hidden package; it asks first, then sends the delete action and the list comes back (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Journey 3]").click();
      await page.getByRole("button", { name: copy.deletePkg, exact: true }).click();
      await expect(page.getByText(copy.deleteText, { exact: true })).toBeVisible();
      await page.getByRole("dialog").getByRole("button", { name: copy.deletePkg, exact: true }).click();
      const [remove] = await posts(api, "journeys");
      expect(remove).toEqual({ action: "delete", id: "j3" });
      await expect(openRow(page, "[Journey 1]")).toBeVisible();
      await expect(openRow(page, "[Journey 3]")).toHaveCount(0);
    });

    test(`A shown package's web address is locked text (${at})`, async ({ page, baseURL }) => {
      await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Journey 1]").click();
      await expect(page.getByText(copy.slugLocked, { exact: true })).toBeVisible();
      await expect(page.getByLabel(copy.fieldSlug)).toHaveCount(0);
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
      expect(Object.keys(item).sort(), "published: no slug; never a price column").toEqual(["addon_ids", "id", "is_featured", "legs", "media_id", "translations"]);
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
