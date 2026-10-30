import { expect, test, type Page, type Route } from "@playwright/test";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_LEGAL_COPY } from "../lib/copy/ops-legal";
import { openDashboard, openRow } from "./helpers/ops-catalog-api";
import type { Viewport } from "./journey/matrix";

// Content -> Legal (plan 06-04 Task 5) on the real page with /api/ops/* answered here, shaped like lib/ops/legal-handlers.ts.
// The request bodies are asserted. Stand-ins are bracketed: no legal text is written by us (F-07). Written, NOT run (owner
// rule, 2026-10-21).

const PAGE_PATH = "/dashboard/content/legal";
const ID = "00000000-0000-4000-8000-000000000001";
const AT = "2026-10-30T08:00:00.000Z";
const KINDS = ["privacy", "terms", "booking_terms", "waiver", "disclaimer", "cookie_banner"] as const;
type Kind = (typeof KINDS)[number];

const VIEWS: Viewport[] = ["phone", "tablet", "desktop"];

function detail(kind: Kind, published = false) {
  const banner = kind === "cookie_banner";
  const record = (locale: string) => ({
    title: `[${kind} ${locale}]`,
    seo_title: null,
    seo_description: null,
    ...(banner ? { necessary_label: `[n ${locale}]`, necessary_body: null, analytics_label: `[a ${locale}]`, analytics_body: null } : {}),
    status: "published",
    locked_fields: [],
  });
  const text = (value: string) => ({ text: value, status: "published", locked_fields: [] });
  return {
    id: ID,
    kind,
    is_published: published,
    updated_at: AT,
    translation_state: { en: "published", ar: "published", es: "published" },
    translations: { en: record("en"), ar: record("ar"), es: record("es") },
    blocks: banner
      ? []
      : [
          { id: "b1", position: 1, kind: "heading", translations: { en: text("[h]"), ar: text("[h ar]"), es: text("[h es]") } },
          { id: "b2", position: 2, kind: "paragraph", translations: { en: text("[p]"), ar: text("[p ar]"), es: text("[p es]") } },
        ],
  };
}

type Sent = { url: string; body: Record<string, any> };

async function answer(page: Page, opts: { published?: boolean } = {}) {
  const sent: Sent[] = [];
  const json = (route: Route, body: unknown) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/ops/legal*", async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      sent.push({ url: "legal", body: request.postDataJSON() });
      return json(route, { ok: true, id: ID, affects_site: Boolean(opts.published) });
    }
    const kind = new URL(request.url()).searchParams.get("kind") as Kind | null;
    if (kind) return json(route, { ok: true, item: detail(kind, opts.published) });
    return json(route, {
      ok: true,
      items: KINDS.map((one, i) => ({ id: `${ID}${i}`, kind: one, title_en: i === 0 ? "[privacy en]" : null, is_published: i === 0 && Boolean(opts.published), block_count: 0, translation_state: {}, updated_at: AT })),
    });
  });
  await page.route("**/api/ops/publish", async (route) => {
    sent.push({ url: "publish", body: route.request().postDataJSON() });
    return json(route, { ok: true, id: ID, is_published: true, affects_site: true, warnings: [] });
  });
  await page.route("**/api/ops/translate", (route) => {
    const { target, fields } = route.request().postDataJSON() as { target: string; fields: Record<string, string> };
    return json(route, { ok: true, target, fields: Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, `[${target}] ${v}`])) });
  });
  return sent;
}

async function openKind(page: Page, name: string) {
  await openRow(page, name).click();
  await expect(page.locator("[data-edit-page] h1")).toHaveText(name);
}

const copy = OPS_LEGAL_COPY.en;
const kit = OPS_KIT_COPY.en;
const open = (page: Page, baseURL: string | undefined, locale: "en" | "ar" | "es" = "en", viewport: Viewport = "desktop") =>
  openDashboard(page, PAGE_PATH, viewport, locale, baseURL, OPS_LEGAL_COPY[locale].title);

test.describe("Content -> Legal", () => {
  test.setTimeout(120_000);

  test("the list has the six kinds with their status, and the rail no Soon chip", async ({ page, baseURL }) => {
    await answer(page);
    await open(page, baseURL);
    for (const kind of KINDS) await expect(openRow(page, copy.kinds[kind])).toBeVisible();
    await expect(page.getByText(copy.status.draft, { exact: true }).filter({ visible: true })).toHaveCount(1);
    await expect(page.getByText(copy.status.none, { exact: true }).filter({ visible: true })).toHaveCount(5);
    await expect(page.locator('nav a[href$="/content/legal"]')).not.toHaveAttribute("aria-label", /.+/);
  });

  test("add, move and remove a block; the save body holds them in order", async ({ page, baseURL }) => {
    const sent = await answer(page);
    await open(page, baseURL);
    await openKind(page, copy.kinds.privacy);
    await page.getByRole("button", { name: copy.f.addQuote }).click();
    await page.getByLabel(`${copy.bk.quote} 3`).fill("[q]");
    await page.getByRole("button", { name: `${kit.moveUp}, ${copy.bk.quote} 3` }).click();
    await expect(page.getByLabel(`${copy.bk.quote} 2`)).toHaveValue("[q]");
    await page.getByRole("button", { name: `${copy.f.remove}, ${copy.bk.heading} 1` }).click();
    await page.getByRole("button", { name: kit.save, exact: true }).click();
    await expect.poll(() => sent.filter((one) => one.url === "legal").length).toBe(1);
    const body = sent.find((one) => one.url === "legal")!.body;
    expect(body.kind).toBe("privacy");
    expect(body.blocks.map((b: { kind: string }) => b.kind)).toEqual(["quote", "paragraph"]);
  });

  test("the banner fields are on the cookie banner only; it has no search engine card", async ({ page, baseURL }) => {
    await answer(page);
    await open(page, baseURL);
    await openKind(page, copy.kinds.cookie_banner);
    await expect(page.getByLabel(copy.f.necLabel)).toBeVisible();
    await expect(page.getByLabel(copy.f.anText)).toBeVisible();
    await expect(page.getByLabel(copy.f.seoTitle)).toHaveCount(0);
    await page.getByRole("button", { name: copy.title, exact: true }).click();
    await openKind(page, copy.kinds.terms);
    await expect(page.getByLabel(copy.f.necLabel)).toHaveCount(0);
    await expect(page.getByLabel(copy.f.seoTitle)).toBeVisible();
  });

  test("booking terms carry the signed note, and no other kind does", async ({ page, baseURL }) => {
    await answer(page);
    await open(page, baseURL);
    await openKind(page, copy.kinds.booking_terms);
    await expect(page.getByText(copy.bookingNote)).toBeVisible();
    await page.getByRole("button", { name: copy.title, exact: true }).click();
    await openKind(page, copy.kinds.waiver);
    await expect(page.getByText(copy.bookingNote)).toHaveCount(0);
  });

  test("Publish calls /api/ops/publish with entity legal_page", async ({ page, baseURL }) => {
    const sent = await answer(page);
    await open(page, baseURL);
    await openKind(page, copy.kinds.privacy);
    await page.getByRole("button", { name: kit.publish, exact: true }).click();
    await expect.poll(() => sent.find((one) => one.url === "publish")?.body).toEqual({ entity: "legal_page", id: ID, published: true });
  });

  test("right to left in Arabic and usted in Spanish", async ({ page, baseURL }) => {
    await answer(page);
    await open(page, baseURL, "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("heading", { name: OPS_LEGAL_COPY.ar.title, level: 1 })).toBeVisible();
    await open(page, baseURL, "es");
    await expect(openRow(page, OPS_LEGAL_COPY.es.kinds.booking_terms)).toBeVisible();
    expect(OPS_LEGAL_COPY.es.empty).toContain("publique");
  });

  for (const viewport of VIEWS) {
    test(`no sideways scroll, and the first Add button takes focus, on ${viewport}`, async ({ page, baseURL }) => {
      await answer(page);
      await open(page, baseURL, "en", viewport);
      await openKind(page, copy.kinds.privacy);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const add = page.getByRole("button", { name: copy.f.addHeading });
      await add.focus();
      await expect(add).toBeFocused();
    });
  }
});
