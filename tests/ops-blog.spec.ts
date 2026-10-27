import { expect, test, type Page, type Route } from "@playwright/test";
import { DASHBOARD_COPY } from "../lib/copy/dashboard";
import { OPS_BLOG_COPY } from "../lib/copy/ops-blog";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { openDashboard, openRow } from "./helpers/ops-catalog-api";

// Content -> Blog (plan 06-03 Task 4) on the real page with /api/ops/* answered here, shaped like
// lib/ops/posts-handlers.ts. The request bodies are asserted. Written, NOT run (owner rule, 2026-10-21).

const PAGE_PATH = "/dashboard/content/blog";
const AT = "2026-10-20T08:00:00.000Z";
const ID = "00000000-0000-4000-8000-000000000001";
const NEW_ID = "00000000-0000-4000-8000-0000000000ff";
const MEDIA = { id: "00000000-0000-4000-8000-0000000000aa", key: "test/photo.webp", url: "https://media.almarprivatejourney.com/test/photo.webp", width: 1600, height: 1067, alt_en: "[Alt]" };

function post(published: boolean, opts: { arLocked?: boolean; esBlock?: boolean } = {}) {
  return {
    id: ID,
    slug: "[post]",
    cover_media_id: MEDIA.id,
    cover: MEDIA,
    published_at: AT,
    destination_id: null,
    featured_stay_id: null,
    featured_experience_id: null,
    is_published: published,
    blocks: [
      {
        id: "b1",
        position: 1,
        kind: "paragraph",
        media_id: null,
        image: null,
        translations: {
          en: { text: "[Paragraph]", status: "published" },
          ar: { text: "[AR fixed]", status: "published", locked_fields: opts.arLocked ? ["text"] : [] },
          es: opts.esBlock === false ? null : { text: "[ES Paragraph]", status: "published" },
        },
      },
    ],
    translations: {
      en: { title: "[Post one]", excerpt: "[Excerpt]", seo_title: null, seo_description: null, status: "published" },
      ar: { title: "[AR title]", excerpt: "[AR excerpt]", seo_title: null, seo_description: null, status: "published" },
      es: { title: "[ES title]", excerpt: "[ES excerpt]", seo_title: null, seo_description: null, status: "published" },
    },
    translation_state: { en: "published", ar: "published", es: "published" },
    updated_at: AT,
  };
}

type Api = { posts: { path: string; body: Record<string, unknown> }[]; of: (path: string) => Record<string, unknown>[] };

async function mockBlogApi(page: Page, detail = post(false)): Promise<Api> {
  const api: Api = { posts: [], of: (path) => api.posts.filter((p) => p.path === path).map((p) => p.body) };
  const reply = (route: Route, status: number, json: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
  await page.route("**/api/ops/site-status", (route) =>
    reply(route, 200, { ok: true, site: { state: "up_to_date", requested_seq: 1, live_seq: 1, requested_at: AT, built_at: AT, last_hook_at: AT, last_hook_result: "ok" } }),
  );
  await page.route(/\/api\/ops\/(destinations|stays|catalog)(\?.*)?$/, (route) => reply(route, 200, { ok: true, items: [] }));
  await page.route(/\/api\/ops\/(posts|publish|translate)(\?.*)?$/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.split("/").pop() ?? "";
    if (request.method() === "GET") {
      if (url.searchParams.get("id")) return reply(route, 200, { ok: true, item: detail });
      const summary = { id: ID, slug: detail.slug, title_en: detail.translations.en.title, published_at: AT, is_published: detail.is_published, cover: MEDIA, translation_state: detail.translation_state, updated_at: AT };
      return reply(route, 200, { ok: true, items: [summary, { ...summary, id: "00000000-0000-4000-8000-000000000002", title_en: "[Cartagena notes]" }] });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    api.posts.push({ path, body });
    if (path === "translate") {
      const sent = body as { target: string; fields: Record<string, string> };
      return reply(route, 200, { ok: true, target: sent.target, fields: Object.fromEntries(Object.entries(sent.fields).map(([k, v]) => [k, `[${sent.target.toUpperCase()}] ${v}`])) });
    }
    if (path === "publish") return reply(route, 200, { ok: true, id: body.id, is_published: body.published, affects_site: true, warnings: [] });
    return reply(route, 200, { ok: true, id: (body.id as string | undefined) ?? NEW_ID, affects_site: false });
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
  const copy = OPS_BLOG_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const open = (page: Page, baseURL: string | undefined) => openDashboard(page, PAGE_PATH, "desktop", locale, baseURL, DASHBOARD_COPY[locale].rail.blog);

  test("the list search filters by title, accents ignored, with the no-match line", async ({ page, baseURL }) => {
    await mockBlogApi(page);
    await open(page, baseURL);
    await page.getByLabel(copy.search).fill("cartagéna");
    await expect(openRow(page, "[Cartagena notes]")).toBeVisible();
    await expect(page.getByRole("button", { name: "[Post one]", exact: true }).filter({ visible: true })).toHaveCount(0);
    await page.getByLabel(copy.search).fill("zzz");
    await expect(page.getByText(copy.noMatch.replace("{q}", "zzz"), { exact: true })).toBeVisible();
  });

  test("blocks added, moved and deleted are saved in that order", async ({ page, baseURL }) => {
    const api = await mockBlogApi(page);
    await open(page, baseURL);
    await openRow(page, "[Post one]").click();
    await page.getByRole("button", { name: copy.add.heading }).click();
    await page.getByLabel("Heading 2").fill("[New heading]");
    await page.getByRole("button", { name: `${kit.moveUp}, Heading 2` }).click();
    await page.getByRole("button", { name: copy.add.quote }).click();
    await page.getByRole("button", { name: `${copy.deleteBlock}, Quote 3` }).click();
    await page.getByRole("button", { name: kit.save, exact: true }).click();
    const [save] = await posted(api, "posts");
    const kinds = (save.blocks as { kind: string }[]).map((b) => b.kind);
    expect(kinds).toEqual(["heading", "paragraph"]);
  });

  test("a published post shows its address as a locked line, and Unpublish posts published: false", async ({ page, baseURL }) => {
    const api = await mockBlogApi(page, post(true));
    await open(page, baseURL);
    await openRow(page, "[Post one]").click();
    await expect(page.getByText(copy.f.addressLocked, { exact: true })).toBeVisible();
    await expect(page.getByLabel(copy.f.address, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: kit.unpublish, exact: true }).click();
    const confirm = page.getByRole("alertdialog").getByRole("button", { name: kit.unpublish, exact: true });
    if (await confirm.count()) await confirm.click();
    const [unpublish] = await posted(api, "publish");
    expect(unpublish).toEqual({ entity: "post", id: ID, published: false });
  });

  test("Publish waits while a Spanish block text is missing, and names it", async ({ page, baseURL }) => {
    await mockBlogApi(page, post(false, { esBlock: false }));
    await open(page, baseURL);
    await openRow(page, "[Post one]").click();
    await expect(page.getByText(copy.missingEs.replace("{n}", "1"))).toBeVisible();
    await expect(page.getByRole("button", { name: kit.publish, exact: true })).toBeDisabled();
  });

  test("a locked Arabic block text is not sent to translate after an English change, and is saved with its lock", async ({ page, baseURL }) => {
    const api = await mockBlogApi(page, post(false, { arLocked: true }));
    await open(page, baseURL);
    await openRow(page, "[Post one]").click();
    await page.getByLabel("Paragraph 1").fill("[Paragraph, edited]");
    await page.getByRole("button", { name: kit.save, exact: true }).click();
    const [save] = await posted(api, "posts");
    const ar = api.of("translate").find((t) => t.target === "ar") as { fields: Record<string, unknown> } | undefined;
    expect(Object.values(ar?.fields ?? {})).not.toContain("[Paragraph, edited]");
    const block = (save.blocks as { translations: Record<string, { text: string; locked_fields?: string[] }> }[])[0];
    expect(block.translations.ar).toEqual({ text: "[AR fixed]", status: "published", locked_fields: ["text"] });
  });
});
