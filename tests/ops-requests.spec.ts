import { expect, test, type Page, type Route } from "@playwright/test";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_REQUESTS_COPY } from "../lib/copy/ops-requests";
import { openDashboard, openRow } from "./helpers/ops-catalog-api";

// Plan 06-05 Task 5: Requests and Content -> Consultation on the real pages with /api/ops/* answered here, shaped like
// lib/ops/requests-handlers.ts. The request bodies are asserted. Written, NOT run (owner rule 2026-10-21).

const AT = "2026-10-28T07:20:00.000Z";
const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const c = OPS_REQUESTS_COPY.en;

const PLAN = {
  id: ID(1),
  kind: "plan",
  locale: "en",
  name: "Plan Guest",
  email: "plan@example.com",
  payload: { name: "Plan Guest", email: "plan@example.com", phone: "+34 600 000 000", destination: "Cartagena", guests: 2, from: "2026-12-12", to: "2026-12-19", airport: "DXB", budget: "around 20k", notes: "Quiet" },
  created_at: AT,
  handled_at: null,
  handled_by: null,
  consultation: null,
};
const CALL = {
  ...PLAN,
  id: ID(2),
  kind: "consultation",
  name: "Call Guest",
  email: "call@example.com",
  payload: { name: "Call Guest", email: "call@example.com", phone: "+34 600 000 001", slot_start: "2026-11-03T11:00:00.000Z", time_zone: "Europe/Madrid" },
  consultation: { booking_id: ID(9), slot_start: "2026-11-03T11:00:00.000Z", status: "booked" },
};

type Api = { requests: Array<Record<string, unknown>>; consult: Array<Record<string, unknown>>; queries: string[] };

async function mockApi(page: Page): Promise<Api> {
  const api: Api = { requests: [], consult: [], queries: [] };
  const reply = (route: Route, status: number, json: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });
  await page.route("**/api/ops/site-status", (route) =>
    reply(route, 200, { ok: true, site: { state: "up_to_date", requested_seq: 1, live_seq: 1, requested_at: AT, built_at: AT, last_hook_at: AT, last_hook_result: "ok" } }),
  );
  await page.route(/\/api\/ops\/requests(\?.*)?$/, (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      api.requests.push(body);
      return reply(route, 200, { ok: true, id: body.id, handled_at: body.handled ? AT : null, handled_by: body.handled ? ID(5) : null, affects_site: false });
    }
    const url = new URL(request.url());
    api.queries.push(url.search);
    const kind = url.searchParams.get("kind");
    const items = [PLAN, CALL].filter((row) => kind === "all" || kind === row.kind);
    return reply(route, 200, { ok: true, items });
  });
  const setup = { notice_hours: null as number | null, horizon_days: null as number | null, slot_minutes: 30, open: false, hours: [] as unknown[], days_off: [] as string[], upcoming: [] };
  await page.route(/\/api\/ops\/consult(\?.*)?$/, (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON() as Record<string, unknown>;
      api.consult.push(body);
      if (body.action === "cancel") return reply(route, 200, { ok: true, id: body.booking_id, status: "cancelled", affects_site: false });
      Object.assign(setup, body);
      return reply(route, 200, { ok: true, id: "consult", item: setup, affects_site: false });
    }
    return reply(route, 200, { ok: true, item: setup });
  });
  return api;
}

test.describe("Requests", () => {
  test("filters are toggle buttons and read the list; Not handled comes first", async ({ page, baseURL }) => {
    const api = await mockApi(page);
    await openDashboard(page, "/dashboard/requests", "desktop", "en", baseURL, c.title);
    await expect(page.getByRole("button", { name: c.st.not, exact: true })).toHaveAttribute("aria-pressed", "true");
    expect(api.queries.at(-1)).toContain("handled=no");
    await page.getByRole("button", { name: c.kinds.plan, exact: true }).click();
    await expect(page.getByRole("button", { name: c.kinds.plan, exact: true })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => api.queries.at(-1)).toContain("kind=plan");
    await expect(page.locator('input[type="radio"]')).toHaveCount(0);
  });

  test("detail: every field, Mark handled posts the id and shows Handled by you", async ({ page, baseURL }) => {
    const api = await mockApi(page);
    await openDashboard(page, "/dashboard/requests", "desktop", "en", baseURL, c.title);
    await openRow(page, "Plan Guest").click();
    await expect(page.getByRole("heading", { level: 1, name: "Plan Guest" })).toBeVisible();
    for (const value of ["Cartagena", "around 20k", "Dubai International (DXB)", "Quiet"]) await expect(page.getByText(value, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: c.reply })).toHaveAttribute("href", "mailto:plan@example.com");
    await expect(page.getByRole("link", { name: c.wa })).toHaveAttribute("href", "https://wa.me/34600000000");
    await page.getByRole("button", { name: c.markHandled }).click();
    await expect(page.getByRole("button", { name: c.markNot })).toBeVisible();
    expect(api.requests).toEqual([{ id: ID(1), handled: true }]);
    await expect(page.getByText(/by you/)).toBeVisible();
  });

  test("a booked consultation: Cancel asks first; Keep the call sends nothing; confirm posts the booking id", async ({ page, baseURL }) => {
    const api = await mockApi(page);
    await openDashboard(page, "/dashboard/requests", "desktop", "en", baseURL, c.title);
    await openRow(page, "Call Guest").click();
    await expect(page.getByText("Europe/Madrid", { exact: false })).toBeVisible();
    await page.getByRole("button", { name: c.cancelC }).click();
    await expect(page.getByRole("dialog")).toContainText(c.cancelText);
    await page.getByRole("button", { name: c.keep }).click();
    expect(api.consult).toEqual([]);
    await page.getByRole("button", { name: c.cancelC }).click();
    await page.getByRole("dialog").getByRole("button", { name: c.cancelC }).click();
    await expect(page.getByRole("button", { name: c.cancelC })).toHaveCount(0);
    expect(api.consult).toEqual([{ action: "cancel", booking_id: ID(9) }]);
  });

  test("Arabic mirrors", async ({ page, baseURL }) => {
    await mockApi(page);
    await openDashboard(page, "/dashboard/requests", "phone", "ar", baseURL, OPS_REQUESTS_COPY.ar.title);
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

test.describe("Content -> Consultation", () => {
  test("closed: notice and horizon start empty with the note; nothing is filled for her", async ({ page, baseURL }) => {
    await mockApi(page);
    await openDashboard(page, "/dashboard/content/consultation", "desktop", "en", baseURL, c.ctitle);
    await expect(page.getByText(c.closedNote)).toBeVisible();
    await expect(page.getByLabel(c.notice)).toHaveValue("");
    await expect(page.getByLabel(c.horizon)).toHaveValue("");
    await expect(page.getByText(c.closed, { exact: true })).toHaveCount(7);
  });

  test("errors: a word in the horizon; no post", async ({ page, baseURL }) => {
    const api = await mockApi(page);
    await openDashboard(page, "/dashboard/content/consultation", "desktop", "en", baseURL, c.ctitle);
    await page.getByLabel(c.horizon).fill("abc");
    await page.getByRole("button", { name: OPS_KIT_COPY.en.save, exact: true }).click();
    await expect(page.getByText(c.err.num)).toBeVisible();
    expect(api.consult).toEqual([]);
  });

  test("a new range with no time chosen says so; no hour is invented", async ({ page, baseURL }) => {
    const api = await mockApi(page);
    await openDashboard(page, "/dashboard/content/consultation", "desktop", "en", baseURL, c.ctitle);
    await page.getByRole("button", { name: c.addHours }).first().click();
    await page.getByRole("button", { name: OPS_KIT_COPY.en.save, exact: true }).click();
    await expect(page.getByText(c.err.start)).toBeVisible();
    expect(api.consult).toEqual([]);
  });

  test("save sends only what changed and says Saved; the note goes once both are filled", async ({ page, baseURL }) => {
    const api = await mockApi(page);
    await openDashboard(page, "/dashboard/content/consultation", "desktop", "en", baseURL, c.ctitle);
    await page.getByLabel(c.notice).fill("12");
    await page.getByLabel(c.horizon).fill("10");
    await expect(page.getByText(c.closedNote)).toHaveCount(0);
    await page.getByRole("button", { name: OPS_KIT_COPY.en.save, exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: c.saved })).toBeVisible();
    expect(api.consult).toEqual([{ action: "save", notice_hours: 12, horizon_days: 10 }]);
  });
});
