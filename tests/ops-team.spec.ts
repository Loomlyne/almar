import { expect, test } from "@playwright/test";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_TEAM_COPY } from "../lib/copy/ops-team";
import { definePictures } from "./helpers/ops-team-pictures";
import { numberedTeam } from "./journey/scenes/_ops-team-words";

// Content -> Team (plan 03.2-08) on its harness scene tests/journey/scenes/ops-team.tsx.
// Task 1: the copy check and the pictures. The behaviour block (every /api/ops/* answered by page.route) joins this file
// in Task 2, after the owner signs the pictures.

/** Every string of a copy object, with its path. */
function leaves(value: unknown, path: string[] = []): { path: string; value: unknown }[] {
  if (value !== null && typeof value === "object") return Object.entries(value).flatMap(([key, inner]) => leaves(inner, [...path, key]));
  return [{ path: path.join("."), value }];
}

test.describe("copy", () => {
  test("every label of ops-team is a non-empty string in en, ar and es, with the same keys", () => {
    const reference = leaves(OPS_TEAM_COPY.en).map((leaf) => leaf.path);
    for (const locale of ["en", "ar", "es"] as const) {
      const all = leaves(OPS_TEAM_COPY[locale]);
      for (const leaf of all) {
        expect(typeof leaf.value, `${locale}.${leaf.path}`).toBe("string");
        expect((leaf.value as string).trim().length, `${locale}.${leaf.path} is empty`).toBeGreaterThan(0);
      }
      expect(all.map((leaf) => leaf.path), `${locale} keys`).toEqual(reference);
    }
  });
});

definePictures("ops-team", {
  "team-list": {
    panel: false,
    check: async (page, l) => {
      const copy = OPS_TEAM_COPY[l].team;
      return [
        page.getByRole("heading", { level: 1, name: copy.title }),
        page.getByText(copy.publicNote, { exact: true }),
        page.getByText(numberedTeam("en", "member", 1), { exact: true }),
        page.getByRole("button", { name: copy.newMember }),
        page.getByText(copy.orderNote, { exact: true }),
      ];
    },
  },
  "team-list-empty": {
    panel: false,
    check: async (page, l) => {
      const copy = OPS_TEAM_COPY[l].team;
      // Team starts empty: no row, one New member button.
      await expect(page.getByRole("button", { name: copy.newMember })).toHaveCount(1);
      return [page.getByText(copy.empty, { exact: true }), page.getByText(copy.publicNote, { exact: true })];
    },
  },
  "team-editor-new": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const copy = OPS_TEAM_COPY[l].team;
      const kit = OPS_KIT_COPY[l];
      await expect(page.getByRole("tab")).toHaveCount(0);
      // A new member has no Delete yet.
      await expect(page.getByRole("button", { name: copy.deleteMember, exact: true })).toHaveCount(0);
      // No web address yet: the owner types it (never filled in silently), and Save waits for it.
      await expect(page.getByLabel(copy.fieldSlug)).toHaveValue("");
      await expect(page.getByRole("button", { name: kit.save, exact: true })).toBeDisabled();
      return [
        page.getByRole("heading", { level: 2, name: kit.editor.sections.settings, exact: true }),
        page.getByText(copy.slugHint, { exact: true }),
        page.getByText(copy.problemSlugNeeded, { exact: true }),
        page.getByRole("button", { name: copy.title, exact: true }),
        page.getByRole("heading", { level: 2, name: kit.editor.sections.text, exact: true }),
        page.getByRole("heading", { level: 2, name: kit.editor.sections.photo, exact: true }),
        page.getByRole("heading", { level: 2, name: copy.links, exact: true }),
        page.getByRole("heading", { level: 2, name: copy.emailSection, exact: true }),
        page.getByText(kit.editor.englishOnly, { exact: true }),
        page.getByLabel(copy.fieldName),
        page.getByLabel(copy.fieldRole),
        page.getByLabel(copy.fieldBio),
        page.getByLabel(copy.fieldEmail),
        page.getByText(copy.emailNote, { exact: true }),
        page.getByText(copy.linksNote, { exact: true }),
        page.getByRole("button", { name: copy.addLink }),
      ];
    },
  },
  "team-editor-links-error": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const copy = OPS_TEAM_COPY[l].team;
      const kit = OPS_KIT_COPY[l];
      // A link that is not https keeps Save off and says why under the address.
      await expect(page.getByRole("button", { name: kit.save, exact: true })).toBeDisabled();
      await expect(page.getByLabel(copy.linkAddress)).toHaveCount(2);
      // The typed address follows the rule, so the link is the only thing holding Save.
      await expect(page.getByLabel(copy.fieldSlug)).toHaveValue("web-address");
      await expect(page.getByText(copy.problemSlugNeeded, { exact: true })).toHaveCount(0);
      return [
        page.getByText(copy.linkNeedsHttps, { exact: true }),
        page.getByRole("combobox", { name: `${copy.linkPlatform}: LinkedIn` }),
        page.getByRole("combobox", { name: `${copy.linkPlatform}: Instagram` }),
      ];
    },
  },
  "team-editor-published": {
    panel: true,
    folder: "editor",
    check: async (page, l) => {
      const copy = OPS_TEAM_COPY[l].team;
      const kit = OPS_KIT_COPY[l];
      await expect(page.getByRole("button", { name: copy.deleteMember, exact: true })).toBeDisabled();
      // Published: the address is text, not a box (it cannot change).
      await expect(page.getByLabel(copy.fieldSlug)).toHaveCount(0);
      return [
        page.getByText("web-address", { exact: true }),
        page.getByText(copy.slugLocked, { exact: true }),
        page.getByRole("button", { name: kit.unpublish, exact: true }),
        page.getByText(kit.unpublishFirst, { exact: true }),
        page.getByRole("button", { name: copy.deleteMember, exact: true }),
        page.getByText(copy.emailNote, { exact: true }),
      ];
    },
  },
});
