import { expect, test } from "@playwright/test";
import { OPS_CATALOG_COPY, type OpsCatalogCopy } from "../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import type { Locale3 } from "../components/ops/api-types";
import { mockCatalogApi, openDashboard, openRow, postsTo, refusal } from "./helpers/ops-catalog-api";
import type { Viewport } from "./journey/matrix";
import { definePictures } from "./helpers/ops-catalog-pictures";
import { numbered, words } from "./journey/scenes/_ops-catalog-words";

// Catalog -> Destinations (plan 03.2-06) on its harness scene tests/journey/scenes/ops-destinations.tsx.
// Task 1: the pictures. Task 2: the behaviour block at the end, on the real page with every /api/ops/* answered by
// page.route fixtures shaped like the contract (tests/helpers/ops-catalog-api.ts); the request bodies are asserted.

const PLURAL_FORMS = new Set(["zero", "one", "two", "few", "many", "other"]);

/** A plural block ({ one, other, ... }): the languages differ in which forms they need, so the block is one key. */
function isPlural(value: object): boolean {
  const keys = Object.keys(value);
  return keys.includes("other") && keys.every((key) => PLURAL_FORMS.has(key));
}

/** Every string of a copy object, with its path; a plural block counts once for the key parity and each form as a string. */
function leaves(value: unknown, path: string[] = []): { path: string; value: unknown; plural: boolean }[] {
  if (value !== null && typeof value === "object") {
    if (isPlural(value)) return Object.entries(value).map(([form, inner]) => ({ path: [...path, form].join("."), value: inner, plural: true }));
    return Object.entries(value).flatMap(([key, inner]) => leaves(inner, [...path, key]));
  }
  return [{ path: path.join("."), value, plural: false }];
}

/** The keys the three languages must share: a plural block is its own path, not its forms. */
function keysOf(copy: OpsCatalogCopy): string[] {
  const all = [...leaves(copy.destinations).map((l) => ({ ...l, path: `destinations.${l.path}` })), ...leaves(copy.items).map((l) => ({ ...l, path: `items.${l.path}` }))];
  const out = new Set<string>();
  for (const leaf of all) out.add(leaf.plural ? leaf.path.slice(0, leaf.path.lastIndexOf(".")) : leaf.path);
  return [...out];
}

test.describe("copy", () => {
  test("every label of ops-catalog is a non-empty string in en, ar and es, with the same keys", () => {
    const reference = keysOf(OPS_CATALOG_COPY.en);
    for (const locale of ["en", "ar", "es"] as const) {
      const all = [...leaves(OPS_CATALOG_COPY[locale].destinations), ...leaves(OPS_CATALOG_COPY[locale].items)];
      for (const leaf of all) {
        expect(typeof leaf.value, `${locale}.${leaf.path}`).toBe("string");
        expect((leaf.value as string).trim().length, `${locale}.${leaf.path} is empty`).toBeGreaterThan(0);
      }
      expect(keysOf(OPS_CATALOG_COPY[locale]), `${locale} keys`).toEqual(reference);
    }
  });
});

definePictures("ops-destinations", {
  list: {
    panel: false,
    check: async (page, l) => [
      page.getByRole("heading", { level: 1, name: OPS_CATALOG_COPY[l].destinations.title }),
      page.getByText(numbered(l, "destination", 1), { exact: true }),
      page.getByRole("button", { name: OPS_CATALOG_COPY[l].destinations.newDestination }),
    ],
  },
  "list-empty": {
    panel: false,
    check: async (page, l) => [page.getByText(OPS_CATALOG_COPY[l].destinations.empty, { exact: true })],
  },
  "editor-new": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const copy = OPS_CATALOG_COPY[l].destinations;
      const kit = OPS_KIT_COPY[l];
      await expect(page.getByRole("tab")).toHaveCount(0);
      // A new destination has no stays and no connections yet, and no Delete.
      await expect(page.getByRole("heading", { level: 2, name: kit.editor.sections.connections, exact: true })).toHaveCount(0);
      await expect(page.getByRole("button", { name: copy.deleteDestination, exact: true })).toHaveCount(0);
      return [
        page.getByRole("button", { name: copy.title, exact: true }),
        page.getByRole("heading", { level: 2, name: kit.editor.sections.text, exact: true }),
        page.getByRole("heading", { level: 2, name: kit.editor.sections.photo, exact: true }),
        page.getByRole("heading", { level: 2, name: kit.editor.sections.settings, exact: true }),
        page.getByText(kit.editor.englishOnly, { exact: true }),
        page.getByText(kit.publishNeeds, { exact: true }),
        page.getByText(copy.fieldInsetPhoto, { exact: true }),
        page.getByLabel(copy.fieldSlug),
        page.getByLabel(copy.fieldNightsLine),
        page.getByLabel(copy.fieldRegion),
      ];
    },
  },
  "editor-published": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const copy = OPS_CATALOG_COPY[l].destinations;
      const kit = OPS_KIT_COPY[l];
      await expect(page.getByRole("button", { name: copy.deleteDestination, exact: true })).toBeDisabled();
      // The locked web address is text, not a box that looks editable; no read-only control anywhere.
      await expect(page.getByRole("textbox", { name: copy.fieldSlug })).toHaveCount(0);
      await expect(page.locator("input[readonly], textarea[readonly]")).toHaveCount(0);
      return [
        page.getByText(words(l).webAddress, { exact: true }),
        page.getByRole("heading", { level: 2, name: kit.editor.sections.connections, exact: true }),
        page.getByRole("heading", { level: 2, name: `${copy.tabStays} (3)`, exact: true }),
        page.getByText(copy.staysNote, { exact: true }),
        page.getByText(numbered(l, "stay", 1), { exact: true }),
        page.getByText(copy.experiencesHint, { exact: true }),
        page.getByText(copy.slugLocked, { exact: true }),
        page.getByRole("button", { name: kit.unpublish, exact: true }),
        page.getByText(kit.unpublishFirst, { exact: true }),
      ];
    },
  },
  "editor-delete-blocked": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const copy = OPS_CATALOG_COPY[l].destinations;
      await expect(page.getByRole("button", { name: copy.deleteDestination, exact: true })).toBeDisabled();
      return [page.getByText(copy.deleteNeedsMove, { exact: true }), page.getByRole("button", { name: copy.deleteDestination, exact: true })];
    },
  },
});

const COMBOS: { viewport: Viewport; locale: Locale3 }[] = [
  { viewport: "desktop", locale: "en" },
  { viewport: "phone", locale: "ar" },
];
const PAGE_PATH = "/dashboard/catalog/destinations";

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);

  for (const { viewport, locale } of COMBOS) {
    const copy = OPS_CATALOG_COPY[locale].destinations;
    const kit = OPS_KIT_COPY[locale];
    const at = `${viewport} ${locale}`;
    const open = async (page: import("@playwright/test").Page, baseURL: string | undefined) =>
      openDashboard(page, PAGE_PATH, viewport, locale, baseURL, copy.title);

    test(`Save: English only, the AI fills Arabic and Spanish as drafts, the save carries them (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await openRow(page, "Medellin").click();
      await expect(page.getByRole("heading", { level: 1, name: "Medellin" })).toBeVisible();
      await page.getByLabel(copy.fieldName).fill("Medellin City");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [save] = await postsTo(api, "destinations");
      expect(api.of("translate").map((t) => t.target).sort()).toEqual(["ar", "es"]);
      expect(api.of("translate")[0]!.fields).toMatchObject({ name: "Medellin City", short_line: "Medellin line" });
      expect(save).toEqual({
        action: "save",
        item: {
          id: "d2",
          slug: "medellin",
          hero_media_id: "h-d2",
          inset_media_id: null,
          translations: {
            en: { name: "Medellin City", short_line: "Medellin line", region: null, summary: null, nights_label: null, status: "published" },
            ar: { name: "[AR] Medellin City", short_line: "[AR] Medellin line", region: null, summary: null, nights_label: null, status: "draft" },
            es: { name: "[ES] Medellin City", short_line: "[ES] Medellin line", region: null, summary: null, nights_label: null, status: "draft" },
          },
        },
      });
      await expect(page.getByText(kit.editor.translationsUpdated, { exact: true })).toBeVisible();
      expect(api.of("publish")).toHaveLength(0);
    });

    test(`Publish: one save with Arabic and Spanish published, then the publish call (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await openRow(page, "Medellin").click();
      await page.getByRole("button", { name: kit.publish, exact: true }).click();
      const [publish] = await postsTo(api, "publish");
      const saves = api.of("destinations");
      expect(saves).toHaveLength(1);
      const tr = (saves[0]!.item as { translations: Record<string, { status: string } | null> }).translations;
      expect(tr.ar!.status).toBe("published");
      expect(tr.es!.status).toBe("published");
      expect(publish).toEqual({ entity: "destination", id: "d2", published: true });
      // The save came before the publish call.
      expect(api.posts.findIndex((p) => p.path === "destinations")).toBeLessThan(api.posts.findIndex((p) => p.path === "publish"));
      await expect(page.getByRole("button", { name: kit.unpublish, exact: true })).toBeVisible();
    });

    test(`Unpublish refused while stays are published: the sentence, no code (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page, (path, body) => (path === "publish" && body.published === false ? refusal(409, "has_published_stays") : null));
      await open(page, baseURL);
      await openRow(page, "Cartagena").click();
      await page.getByRole("button", { name: kit.unpublish, exact: true }).click();
      await postsTo(api, "publish");
      await expect(page.getByText(kit.errors.has_published_stays, { exact: true })).toBeVisible();
      await expect(page.getByText("has_published_stays")).toHaveCount(0);
    });

    test(`Stays card: the destination's stays read-only; no stay request but the list (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await openRow(page, "Cartagena").click();
      const card = page.getByRole("region", { name: `${copy.tabStays} (2)` });
      await expect(card.getByText("Casa Uno", { exact: true })).toBeVisible();
      await expect(card.getByText("Casa Dos", { exact: true })).toBeVisible();
      await expect(card.getByText("Finca Tres", { exact: true })).toHaveCount(0);
      await expect(card.getByRole("button")).toHaveCount(0);
      expect(api.gets.filter((u) => u.pathname.endsWith("/stays")).every((u) => !u.searchParams.has("id"))).toBe(true);
      expect(api.of("stays")).toHaveLength(0);
      // Delete waits until the stays are moved (and the kit says Unpublish first on a published one).
      await expect(page.getByRole("button", { name: copy.deleteDestination, exact: true })).toBeDisabled();
    });

    test(`Connect and Remove at destination level: one catalog save per item, with its new destinations (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await openRow(page, "Cartagena").click();
      const picker = page.getByRole("region", { name: copy.experiencesTitle });
      await picker.getByText("Chef dinner", { exact: true }).click();
      await picker.getByRole("button", { name: kit.connectSelected, exact: true }).click();
      const [connect] = await postsTo(api, "catalog");
      expect(connect).toEqual({ action: "save", item: { id: "c3", destination_ids: ["d1"] } });
      await picker.getByRole("button", { name: kit.removeNamed.replace("{name}", "Coffee farm"), exact: true }).click();
      const saves = await postsTo(api, "catalog", 2);
      expect(saves[1]).toEqual({ action: "save", item: { id: "c1", destination_ids: [] } });
    });

    test(`Delete: an unpublished destination with no stays, after the question (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await openRow(page, "Medellin").click();
      await page.getByRole("button", { name: copy.deleteDestination, exact: true }).click();
      await page.getByRole("alertdialog").getByRole("button", { name: kit.delete, exact: true }).click();
      const [del] = await postsTo(api, "destinations");
      expect(del).toEqual({ action: "delete", id: "d2" });
      await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
      await expect(openRow(page, "Medellin")).toHaveCount(0);
    });

    test(`Reorder: Move down sends the full id list (${at})`, async ({ page, baseURL }) => {
      const api = await mockCatalogApi(page);
      await open(page, baseURL);
      await page.getByRole("button", { name: kit.moveDown }).filter({ visible: true }).first().click();
      const [reorder] = await postsTo(api, "destinations");
      expect(reorder).toEqual({ action: "reorder", ids: ["d2", "d1", "d3"] });
    });
  }
});
