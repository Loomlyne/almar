import { expect, test } from "@playwright/test";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_TEAM_COPY } from "../lib/copy/ops-team";
import type { Locale3 } from "../components/ops/api-types";
import { openDashboard, openRow } from "./helpers/ops-catalog-api";
import { definePictures } from "./helpers/ops-team-pictures";
import { NEW_ID, mockTeamApi, refusal, teamPostsTo as posts, warmTeamDashboard } from "./helpers/ops-team-api";
import type { Viewport } from "./journey/matrix";
import { numberedTeam } from "./journey/scenes/_ops-team-words";

// Content -> Team (plan 03.2-08) on its harness scene tests/journey/scenes/ops-team.tsx.
// Task 1: the copy check and the pictures. Task 2: the behaviour block at the end, on the real page with every
// /api/ops/* answered by page.route fixtures shaped like the contract (tests/helpers/ops-team-api.ts); the request bodies
// are asserted.

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
      await expect(page.getByLabel(copy.fieldSlug, { exact: true })).toHaveValue("");
      await expect(page.getByRole("button", { name: kit.save, exact: true })).toBeDisabled();
      // Publish is held by the same need, never on while Save is off.
      await expect(page.getByRole("button", { name: kit.publish, exact: true })).toBeDisabled();
      // The need line is the screen's own (under the bar); the kit's list stays for publish gaps.
      await expect(page.getByText(kit.publishNeeds, { exact: true })).toHaveCount(0);
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
      await expect(page.getByLabel(copy.linkAddress, { exact: true })).toHaveCount(2);
      // The typed address follows the rule, so the link is the only thing holding Save.
      await expect(page.getByLabel(copy.fieldSlug, { exact: true })).toHaveValue("web-address");
      await expect(page.getByText(copy.problemSlugNeeded, { exact: true })).toHaveCount(0);
      // Publish is held by the same link, never on while Save is off.
      await expect(page.getByRole("button", { name: kit.publish, exact: true })).toBeDisabled();
      // Nothing of the screen's own is added to the kit's list.
      await expect(page.getByText(kit.publishNeeds, { exact: true })).toHaveCount(0);
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
      await expect(page.getByLabel(copy.fieldSlug, { exact: true })).toHaveCount(0);
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

const PAGE_PATH = "/dashboard/content/team";
const COMBOS: { viewport: Viewport; locale: Locale3 }[] = [
  { viewport: "desktop", locale: "en" },
  { viewport: "phone", locale: "ar" },
];

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  test.beforeAll(async ({ browser, baseURL }) => {
    test.setTimeout(300_000);
    await warmTeamDashboard(browser, PAGE_PATH, baseURL, OPS_TEAM_COPY.en.team.title);
  });

  for (const { viewport, locale } of COMBOS) {
    const copy = OPS_TEAM_COPY[locale].team;
    const kit = OPS_KIT_COPY[locale];
    const at = `${viewport} ${locale}`;
    const open = async (page: import("@playwright/test").Page, baseURL: string | undefined) =>
      openDashboard(page, PAGE_PATH, viewport, locale, baseURL, copy.title);

    test(`Team starts empty; a new member is saved with the typed web address, email, link and drafts (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page, { team: "empty" });
      await open(page, baseURL);
      await expect(page.getByText(copy.empty, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: copy.newMember }).filter({ visible: true }).first().click();
      await page.getByLabel(copy.fieldName).fill("[New member]");
      await page.getByLabel(copy.fieldRole).fill("[Role]");
      // Nothing is filled in silently: Save waits for the web address.
      await expect(page.getByLabel(copy.fieldSlug, { exact: true })).toHaveValue("");
      await expect(page.getByRole("button", { name: kit.save, exact: true })).toBeDisabled();
      await page.getByLabel(copy.fieldSlug, { exact: true }).fill("new-member");
      await page.getByLabel(copy.fieldEmail).fill("new@example.com");
      await page.getByRole("button", { name: copy.addLink }).click();
      await page.getByLabel(copy.linkAddress, { exact: true }).fill("https://www.instagram.com/new");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [save] = await posts(api, "team");
      expect(api.of("translate").map((t) => t.target).sort()).toEqual(["ar", "es"]);
      expect(save).toEqual({
        action: "save",
        item: {
          slug: "new-member",
          photo_media_id: null,
          email: "new@example.com",
          links: [{ label: "Instagram", url: "https://www.instagram.com/new" }],
          translations: {
            en: { name: "[New member]", role: "[Role]", bio: null, status: "published" },
            ar: { name: "[AR] [New member]", role: "[AR] [Role]", bio: null, status: "draft" },
            es: { name: "[ES] [New member]", role: "[ES] [Role]", bio: null, status: "draft" },
          },
        },
      });
      expect(api.of("publish")).toHaveLength(0);
      // Read back by the id the server gave.
      await expect.poll(() => api.gets.some((u) => u.searchParams.get("id") === NEW_ID)).toBe(true);
      await expect(page.getByRole("heading", { level: 1, name: "[New member]" })).toBeVisible();
    });

    test(`A link that is not https keeps Save off and nothing is sent (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Member 2]").click();
      await expect(page.getByRole("heading", { level: 1, name: "[Member 2]" })).toBeVisible();
      await page.getByLabel(copy.linkAddress, { exact: true }).fill("http://www.instagram.com/account");
      await expect(page.getByText(copy.linkNeedsHttps, { exact: true })).toBeVisible();
      const save = page.getByRole("button", { name: kit.save, exact: true });
      await expect(save).toBeDisabled();
      await expect(page.getByRole("button", { name: kit.publish, exact: true })).toBeDisabled();
      await save.click({ force: true });
      await page.waitForTimeout(500);
      expect(api.of("team")).toHaveLength(0);
      expect(api.of("publish")).toHaveLength(0);
    });

    test(`Web address taken: the refusal is said under the address (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page, { answer: (path) => (path === "team" ? refusal(409, "slug_taken", "slug") : null) });
      await open(page, baseURL);
      await openRow(page, "[Member 2]").click();
      await page.getByLabel(copy.fieldSlug, { exact: true }).fill("member-one");
      await page.getByRole("button", { name: kit.save, exact: true }).click();
      const [save] = await posts(api, "team");
      expect((save!.item as { slug: string }).slug).toBe("member-one");
      await expect(page.getByText(kit.errors.slug_taken, { exact: true })).toBeVisible();
      await expect(page.getByText("slug_taken")).toHaveCount(0);
    });

    test(`Publish: one save with Arabic and Spanish published, then the publish call (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Member 2]").click();
      await page.getByRole("button", { name: kit.publish, exact: true }).click();
      const [publish] = await posts(api, "publish");
      const saves = api.of("team");
      expect(saves).toHaveLength(1);
      const item = saves[0]!.item as { id: string; slug: string; translations: Record<string, { status: string } | null> };
      expect(item.id).toBe("t2");
      expect(item.slug, "not yet published: the address goes as it is").toBe("member-two");
      expect(item.translations.ar!.status).toBe("published");
      expect(item.translations.es!.status).toBe("published");
      expect(publish).toEqual({ entity: "team_member", id: "t2", published: true });
      expect(api.posts.findIndex((p) => p.path === "team")).toBeLessThan(api.posts.findIndex((p) => p.path === "publish"));
      await expect(page.getByRole("button", { name: kit.unpublish, exact: true })).toBeVisible();
    });

    test(`Published member: Save never sends the web address (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Member 1]").click();
      await expect(page.getByLabel(copy.fieldSlug, { exact: true })).toHaveCount(0);
      await expect(page.getByText("member-one", { exact: true })).toBeVisible();
      await page.getByLabel(copy.fieldRole).fill("[Role two]");
      await page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true }).click();
      const [save] = await posts(api, "team");
      const item = save!.item as Record<string, unknown> & { translations: Record<string, { status: string } | null> };
      expect(item.id).toBe("t1");
      expect("slug" in item, "a published address is not sent").toBe(false);
      expect(item.email).toBe("one@example.com");
      expect(item.translations.ar!.status).toBe("published");
    });

    test(`Delete waits while published; after Unpublish it deletes after the question (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await openRow(page, "[Member 1]").click();
      const del = page.getByRole("button", { name: copy.deleteMember, exact: true });
      await expect(del).toBeDisabled();
      await page.getByRole("button", { name: kit.unpublish, exact: true }).click();
      const [unpublish] = await posts(api, "publish");
      expect(unpublish).toEqual({ entity: "team_member", id: "t1", published: false });
      await expect(del).toBeEnabled();
      await del.click();
      await page.getByRole("dialog").getByRole("button", { name: kit.delete, exact: true }).click();
      const [remove] = await posts(api, "team");
      expect(remove).toEqual({ action: "delete", id: "t1" });
      await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
      await expect(openRow(page, "[Member 1]")).toHaveCount(0);
    });

    test(`Reorder: Move down sends the full id list (${at})`, async ({ page, baseURL }) => {
      const api = await mockTeamApi(page);
      await open(page, baseURL);
      await page.getByRole("button", { name: kit.moveDown }).filter({ visible: true }).first().click();
      const [reorder] = await posts(api, "team");
      expect(reorder).toEqual({ action: "reorder", ids: ["t2", "t1", "t3"] });
    });
  }
});
