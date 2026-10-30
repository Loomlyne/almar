import { expect, test, type Page, type Route } from "@playwright/test";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_PAGES_COPY } from "../lib/copy/ops-pages";
import { DASHBOARD_COPY } from "../lib/copy/dashboard";
import { PAGE_SECTIONS, type PageKey } from "../lib/data/page-sections";
import { openDashboard, openRow } from "./helpers/ops-catalog-api";

// Content -> Pages (plan 06-02 Task 4) on the real page with every /api/ops/* answered here, shaped like
// lib/ops/site-pages-handlers.ts. The request bodies are asserted. Written, NOT run (owner rule, 2026-10-21).

const PAGE_PATH = "/dashboard/content/pages";
const AT = "2026-10-27T08:00:00.000Z";
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

type Section = Record<string, unknown> & { id: string; page: PageKey; section: string; is_shown: boolean };

function sectionsOf(page: PageKey, lockedAr: string[] = []): Section[] {
  return PAGE_SECTIONS[page].map((spec, i) => {
    const en: Record<string, unknown> = { status: "published" };
    const ar: Record<string, unknown> = { status: "published", locked_fields: lockedAr };
    for (const column of spec.text) {
      en[column] = column === "paragraphs" ? ["[Paragraph one]", "[Paragraph two]"] : `[${spec.section} ${column}]`;
      ar[column] = column === "paragraphs" ? ["[AR one]", "[AR two]"] : `[AR ${spec.section} ${column}]`;
    }
    return {
      id: ID(i + 1),
      page,
      section: spec.section,
      is_shown: true,
      video_url: null,
      media: Object.fromEntries(spec.media.map((slot) => [slot.slot, []])),
      translations: { en, ar, es: null },
      translation_state: { en: "published", ar: "published", es: "missing" },
      updated_at: AT,
      ...(spec.items ? { items: [] } : {}),
    };
  });
}

type Api = { posts: { path: string; body: Record<string, unknown> }[]; of: (path: string) => Record<string, unknown>[] };

async function mockPagesApi(page: Page, { lockedAr = [] as string[] } = {}): Promise<Api> {
  const store: Record<PageKey, Section[]> = {
    home: sectionsOf("home", lockedAr),
    about: sectionsOf("about", lockedAr),
    destinations: sectionsOf("destinations", lockedAr),
    experiences: sectionsOf("experiences", lockedAr),
    contact: sectionsOf("contact", lockedAr),
  };
  const api: Api = { posts: [], of: (path) => api.posts.filter((p) => p.path === path).map((p) => p.body) };
  const reply = (route: Route, status: number, json: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
  await page.route("**/api/ops/site-status", (route) =>
    reply(route, 200, { ok: true, site: { state: "up_to_date", requested_seq: 1, live_seq: 1, requested_at: AT, built_at: AT, last_hook_at: AT, last_hook_result: "ok" } }),
  );
  await page.route(/\/api\/ops\/(pages|page-items|translate)(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split("/").pop() ?? "";
    if (request.method() === "GET") {
      const key = url.searchParams.get("page") as PageKey | null;
      if (key) return reply(route, 200, { ok: true, item: { page: key, sections: store[key] } });
      return reply(route, 200, {
        ok: true,
        items: (Object.keys(store) as PageKey[]).map((p) => ({ page: p, shown: store[p].filter((s) => s.is_shown).length, total: store[p].length })),
      });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    api.posts.push({ path, body });
    if (path === "translate") {
      const sent = body as { target: string; fields: Record<string, string | string[]> };
      const tag = `[${sent.target.toUpperCase()}]`;
      const out = Object.fromEntries(Object.entries(sent.fields).map(([k, v]) => [k, Array.isArray(v) ? v.map((x) => `${tag} ${x}`) : `${tag} ${v}`]));
      return reply(route, 200, { ok: true, target: sent.target, fields: out });
    }
    if (path === "pages") {
      for (const list of Object.values(store)) {
        const found = list.find((s) => s.id === body.id);
        if (found && typeof body.is_shown === "boolean") found.is_shown = body.is_shown;
      }
      return reply(route, 200, { ok: true, id: body.id, affects_site: true });
    }
    return reply(route, 200, { ok: true, id: ID(99), affects_site: true });
  });
  return api;
}

const posted = async (api: Api, path: string, count = 1) => {
  await expect.poll(() => api.of(path).length, { timeout: 15_000 }).toBeGreaterThanOrEqual(count);
  return api.of(path);
};

test.describe("behaviour", () => {
  test.setTimeout(120_000);
  const locale = "en" as const;
  const copy = OPS_PAGES_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const title = DASHBOARD_COPY[locale].rail.pages;
  const open = (page: Page, baseURL: string | undefined) => openDashboard(page, PAGE_PATH, "desktop", locale, baseURL, title);

  test("hiding Gallery and saving sends is_shown: false; the other sections keep their place", async ({ page, baseURL }) => {
    const api = await mockPagesApi(page);
    await open(page, baseURL);
    await openRow(page, copy.pageNames.home).click();
    await openRow(page, copy.sections.home.gallery).click();
    await page.getByRole("switch", { name: copy.showOnSite }).click();
    await page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true }).click();
    const [save] = await posted(api, "pages");
    expect(save.is_shown).toBe(false);
    expect(save.id).toBe(ID(3));
  });

  test("a hero shows the fixed line and no Show on site switch, and sends no is_shown", async ({ page, baseURL }) => {
    const api = await mockPagesApi(page);
    await open(page, baseURL);
    await openRow(page, copy.pageNames.contact).click();
    await openRow(page, copy.sections.contact.title).click();
    await expect(page.getByText(copy.heroFixed, { exact: true })).toBeVisible();
    await expect(page.getByRole("switch", { name: copy.showOnSite })).toHaveCount(0);
    await page.getByLabel(copy.fields.heading).fill("[New heading]");
    await page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true }).click();
    const [save] = await posted(api, "pages");
    expect("is_shown" in save).toBe(false);
  });

  test("an http video address is refused before any request", async ({ page, baseURL }) => {
    const api = await mockPagesApi(page);
    await open(page, baseURL);
    await openRow(page, copy.pageNames.about).click();
    await openRow(page, copy.sections.about.hero).click();
    await page.getByLabel(copy.video).fill("http://media.example/hero.mp4");
    await expect(page.getByText(copy.videoBad, { exact: true })).toBeVisible();
    const save = page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true });
    await expect(save).toBeDisabled();
    await save.click({ force: true });
    await page.waitForTimeout(500);
    expect(api.of("pages")).toHaveLength(0);
    expect(api.of("translate")).toHaveLength(0);
  });

  test("editing English on a section with a locked Arabic field sends that Arabic untouched, with its lock", async ({ page, baseURL }) => {
    const api = await mockPagesApi(page, { lockedAr: ["heading"] });
    await open(page, baseURL);
    await openRow(page, copy.pageNames.home).click();
    await openRow(page, copy.sections.home.gallery).click();
    await page.getByLabel(copy.fields.heading).fill("[Gallery heading, edited]");
    await page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true }).click();
    const [save] = await posted(api, "pages");
    const translations = save.translations as Record<string, Record<string, unknown>>;
    expect(translations.ar.heading).toBe("[AR gallery heading]");
    expect(translations.ar.locked_fields).toEqual(["heading"]);
    // The translate call for Arabic does not ask for the locked field.
    const ar = api.of("translate").find((t) => t.target === "ar") as { fields: Record<string, unknown> } | undefined;
    expect(ar ? "heading" in ar.fields : false).toBe(false);
  });
});
