import { expect } from "@playwright/test";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_TEAM_COPY } from "../lib/copy/ops-team";
import { definePictures } from "./helpers/ops-team-pictures";
import { AMOUNT_PLACEHOLDER, numberedTeam } from "./journey/scenes/_ops-team-words";

// Catalog -> Packages, the three home journeys (plan 03.2-08), on its harness scene tests/journey/scenes/ops-journeys.tsx.
// Task 1: the pictures (the copy check is in tests/ops-team.spec.ts: one copy file). The behaviour block joins in Task 2.

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
      return [page.getByText(kit.publishNeeds, { exact: true }), page.getByRole("button", { name: kit.publish, exact: true })];
    },
  },
});
