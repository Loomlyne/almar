import { expect, test, type Page, type Route } from "@playwright/test";
import { HOME_COPY } from "../lib/copy/home";
import { OPS_CONTENT_COPY } from "../lib/copy/ops-content";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_NAV_COPY } from "../lib/copy/ops-nav";
import { NAV_TARGET_KEYS } from "../lib/site-nav";
import { openDashboard, openRow } from "./helpers/ops-catalog-api";

// Content -> Navigation and footer (plan 06-02 Task 4) on the real page with /api/ops/nav answered here, shaped like
// lib/ops/site-pages-handlers.ts getNav / postNav. The request bodies are asserted. Written, NOT run (owner rule).

const PAGE_PATH = "/dashboard/content/navigation";
const AT = "2026-10-27T08:00:00.000Z";
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

const LINKS = ["destinations", "experiences", "about", "contact"] as const;

function area(name: "header" | "footer", offset: number) {
  return LINKS.map((target, i) => ({
    id: ID(offset + i),
    area: name,
    position: i + 1,
    is_shown: true,
    link_kind: "internal",
    target,
    translations: {
      en: { label: HOME_COPY.en.nav[target], status: "published" },
      ar: { label: HOME_COPY.ar.nav[target], status: "published" },
      es: { label: HOME_COPY.es.nav[target], status: "published" },
    },
    translation_state: { en: "published", ar: "published", es: "published" },
  }));
}

type Api = { posts: Record<string, unknown>[]; translate: Record<string, unknown>[] };

async function mockNavApi(page: Page): Promise<Api> {
  const api: Api = { posts: [], translate: [] };
  const reply = (route: Route, status: number, json: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
  await page.route("**/api/ops/site-status", (route) =>
    reply(route, 200, { ok: true, site: { state: "up_to_date", requested_seq: 1, live_seq: 1, requested_at: AT, built_at: AT, last_hook_at: AT, last_hook_result: "ok" } }),
  );
  const store = { header: area("header", 1), footer: area("footer", 11) };
  await page.route(/\/api\/ops\/(nav|translate)(\?.*)?$/, async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname.split("/").pop();
    if (request.method() === "GET") {
      const targets = NAV_TARGET_KEYS.map((key) => ({ key, available: !["list-with-us", "plan-with-us"].includes(key) && !key.startsWith("legal-") }));
      return reply(route, 200, { ok: true, ...store, targets });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    if (path === "translate") {
      api.translate.push(body);
      const sent = body as { target: string; fields: Record<string, string> };
      return reply(route, 200, { ok: true, target: sent.target, fields: Object.fromEntries(Object.entries(sent.fields).map(([k, v]) => [k, `[${sent.target.toUpperCase()}] ${v}`])) });
    }
    api.posts.push(body);
    const links = body.links as { id?: string }[];
    return reply(route, 200, { ok: true, area: body.area, ids: links.map((l, i) => l.id ?? ID(90 + i)), affects_site: true });
  });
  return api;
}

test.describe("behaviour", () => {
  test.setTimeout(120_000);
  const locale = "en" as const;
  const copy = OPS_NAV_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const title = OPS_CONTENT_COPY[locale].rail.navigation;
  const open = (page: Page, baseURL: string | undefined) => openDashboard(page, PAGE_PATH, "desktop", locale, baseURL, title);

  test("a header link moved up sends the whole header in the new order", async ({ page, baseURL }) => {
    const api = await mockNavApi(page);
    await open(page, baseURL);
    const header = page.getByRole("region", { name: copy.header });
    await header.getByRole("button", { name: new RegExp(`${kit.moveUp}.*${HOME_COPY.en.nav.about}`) }).filter({ visible: true }).first().click();
    await expect.poll(() => api.posts.length).toBe(1);
    const [save] = api.posts;
    expect(save.area).toBe("header");
    expect((save.links as { target: string }[]).map((l) => l.target)).toEqual(["destinations", "about", "experiences", "contact"]);
  });

  test("Login, currency and language are fixed text with no control", async ({ page, baseURL }) => {
    await mockNavApi(page);
    await open(page, baseURL);
    const header = page.getByRole("region", { name: copy.header });
    await expect(header.getByText(copy.loginFixed, { exact: true })).toBeVisible();
    await expect(header.getByText(copy.toolsFixed, { exact: true })).toHaveCount(2);
    await expect(header.getByRole("button", { name: HOME_COPY.en.nav.login, exact: true })).toHaveCount(0);
    await expect(header.getByRole("button", { name: new RegExp(HOME_COPY.en.nav.login) })).toHaveCount(0);
  });

  test("a web address that is not https keeps Save off and nothing is sent", async ({ page, baseURL }) => {
    const api = await mockNavApi(page);
    await open(page, baseURL);
    const footer = page.getByRole("region", { name: copy.footer });
    await footer.getByRole("button", { name: copy.addLink }).click();
    await page.getByLabel(copy.label).fill("[Partner]");
    await page.getByRole("button", { name: copy.web }).click();
    await page.getByLabel(copy.webField).fill("http://example.com");
    await expect(page.getByText(copy.webBad, { exact: true })).toBeVisible();
    const save = page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true });
    await expect(save).toBeDisabled();
    await save.click({ force: true });
    await page.waitForTimeout(500);
    expect(api.posts).toHaveLength(0);
    expect(api.translate).toHaveLength(0);
  });

  test("a new footer link to an https address is added at the end of the footer, English published", async ({ page, baseURL }) => {
    const api = await mockNavApi(page);
    await open(page, baseURL);
    await page.getByRole("region", { name: copy.footer }).getByRole("button", { name: copy.addLink }).click();
    await page.getByLabel(copy.label).fill("[Partner]");
    await page.getByRole("button", { name: copy.web }).click();
    await page.getByLabel(copy.webField).fill("https://example.com/partner");
    await page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true }).click();
    await expect.poll(() => api.posts.length).toBe(1);
    const links = api.posts[0].links as Record<string, unknown>[];
    expect(api.posts[0].area).toBe("footer");
    expect(links).toHaveLength(5);
    expect(links[4]).toMatchObject({ link_kind: "external", target: "https://example.com/partner", is_shown: true });
    expect((links[4].translations as Record<string, { label: string; status: string }>).en).toEqual({ label: "[Partner]", status: "published" });
  });

  test("a link to a page not on the site yet says so in the editor", async ({ page, baseURL }) => {
    await mockNavApi(page);
    await open(page, baseURL);
    await openRow(page, HOME_COPY.en.nav.about).click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: `${copy.targets["list-with-us"]} ${copy.notYet}` }).click();
    await expect(page.getByText(copy.notYetLine, { exact: true })).toBeVisible();
  });
});
