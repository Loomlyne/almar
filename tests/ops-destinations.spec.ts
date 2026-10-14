import { expect, test } from "@playwright/test";
import { OPS_CATALOG_COPY, type OpsCatalogCopy } from "../lib/copy/ops-catalog";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { definePictures } from "./helpers/ops-catalog-pictures";
import { numbered, words } from "./journey/scenes/_ops-catalog-words";

// Catalog -> Destinations (plan 03.2-06) on its harness scene tests/journey/scenes/ops-destinations.tsx.
// Task 1: the pictures. The behaviour block (every /api/ops/* answered by page.route) joins this file in Task 2.

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
