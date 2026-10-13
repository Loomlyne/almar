import { expect, test, type Page, type Route } from "@playwright/test";
import { OPS_SITE_STATUS_COPY, type OpsSiteStatusLocale } from "../lib/copy/ops-site-status";
import { VIEWPORTS, settle, type Viewport } from "./journey/matrix";

// Plan 03.2-05 Task 3: the real site status line in the real ops shell header (harness scene ops-site-status), against
// the signed pictures' layout: inline at 834 and 1440, its own full-width row under the logo at 390, never over the menu
// button or the logo, no sideways scroll, in EN, AR and ES. Every /api/ops/site-* call is answered here.

const SITES = {
  up_to_date: { state: "up_to_date", requested_seq: 5, live_seq: 5, requested_at: "2026-10-13T10:02:00.000Z", built_at: "2026-10-13T10:05:00.000Z", last_hook_at: "2026-10-13T10:02:00.000Z", last_hook_result: "ok" },
  updating: { state: "updating", requested_seq: 6, live_seq: 5, requested_at: "2026-10-13T10:02:00.000Z", built_at: "2026-10-13T09:00:00.000Z", last_hook_at: "2026-10-13T10:02:00.000Z", last_hook_result: "ok" },
  failed: { state: "failed", requested_seq: 6, live_seq: 5, requested_at: "2026-10-13T10:29:00.000Z", built_at: null, last_hook_at: "2026-10-13T10:30:00.000Z", last_hook_result: "error:503" },
} as const;
type State = keyof typeof SITES | "unavailable";

const json = (route: Route, status: number, body: unknown) =>
  route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(body) });

async function answerStatus(page: Page, state: State) {
  await page.route("**/api/ops/site-status", (route) =>
    state === "unavailable"
      ? json(route, 503, { ok: false, error: { code: "unavailable", field: null, locale: null, detail: null } })
      : json(route, 200, { ok: true, site: SITES[state] }),
  );
}

async function open(page: Page, viewport: Viewport, locale: OpsSiteStatusLocale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(`/__harness?c=ops-site-status&s=shell&l=${locale}`);
  await settle(page);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

function expected(state: State, locale: OpsSiteStatusLocale): string {
  const c = OPS_SITE_STATUS_COPY[locale];
  if (state === "up_to_date") return `${c.upToDate}·14:05`;
  if (state === "updating") return `${c.updatingSince} 14:02`;
  if (state === "failed") return `${c.failed}·14:30·${c.tryAgain}`;
  return c.unavailable;
}

const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const LOCALES: OpsSiteStatusLocale[] = ["en", "ar", "es"];
const STATES: State[] = ["up_to_date", "updating", "failed", "unavailable"];

for (const viewport of WIDTHS) {
  for (const locale of LOCALES) {
    test(`${viewport} ${locale}: every state reads as signed and sits where the pictures put it`, async ({ page }) => {
      for (const state of STATES) {
        await page.unrouteAll({ behavior: "ignoreErrors" });
        await answerStatus(page, state);
        await open(page, viewport, locale);
        const line = page.locator('header [role="status"]');
        await expect(line).toHaveAttribute("data-site-state", state);
        const text = (await line.innerText()).replace(/\s*·\s*/g, "·").replace(/\s+/g, " ").trim();
        expect(text, state).toBe(expected(state, locale));
        await expect(line.getByRole("button")).toHaveCount(state === "failed" ? 1 : 0);

        const geo = await page.evaluate(() => {
          const box = (el: Element | null) => (el && (el as HTMLElement).offsetParent !== null ? el.getBoundingClientRect() : null);
          const header = document.querySelector("header")!;
          const line = box(header.querySelector('[role="status"]'));
          const brand = box(header.querySelector("a"));
          const menu = box(header.querySelector("button[aria-controls]"));
          const hit = (a: DOMRect | null, b: DOMRect | null) => !!a && !!b && !(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top);
          return {
            overflow: document.documentElement.scrollWidth > window.innerWidth,
            overMenu: hit(line, menu),
            overBrand: hit(line, brand),
            line: line && { left: line.left, right: line.right, top: line.top, height: line.height },
            brandBottom: brand?.bottom ?? 0,
            width: window.innerWidth,
          };
        });
        expect(geo.overflow, `${state}: no sideways scroll`).toBe(false);
        expect(geo.overMenu, `${state}: never over the menu button`).toBe(false);
        expect(geo.overBrand, `${state}: never over the logo`).toBe(false);
        if (viewport === "phone") {
          expect(geo.line!.top, `${state}: own row under the logo`).toBeGreaterThanOrEqual(geo.brandBottom - 1);
          expect(Math.round(geo.line!.left)).toBe(0);
          expect(Math.round(geo.line!.right)).toBe(geo.width);
        } else {
          expect(geo.line!.height, `${state}: one row`).toBeLessThanOrEqual(46);
          expect(geo.line!.top, `${state}: inline in the header`).toBeLessThan(geo.brandBottom);
        }
      }
    });
  }
}

test("Try again: one POST of {} to /api/ops/site-update, disabled while it runs, then the returned state", async ({ page }) => {
  await answerStatus(page, "failed");
  const posts: string[] = [];
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/ops/site-update", async (route) => {
    posts.push(route.request().postData() ?? "");
    await gate;
    await json(route, 200, { ok: true, site: SITES.updating });
  });
  await open(page, "desktop", "en");
  const line = page.locator('header [role="status"]');
  await expect(line).toHaveAttribute("data-site-state", "failed");
  const button = line.getByRole("button", { name: "Try again" });
  await button.click();
  await expect(button).toBeDisabled();
  release();
  await expect(line).toHaveAttribute("data-site-state", "updating");
  await expect(line).toContainText("Updating since 14:02");
  expect(posts).toEqual(["{}"]);
});

test("a failed Try again shows Status unavailable, never a guessed state", async ({ page }) => {
  await answerStatus(page, "failed");
  await page.route("**/api/ops/site-update", (route) => json(route, 503, { ok: false, error: { code: "unavailable", field: null, locale: null, detail: null } }));
  await open(page, "desktop", "en");
  const line = page.locator('header [role="status"]');
  await line.getByRole("button", { name: "Try again" }).click();
  await expect(line).toHaveAttribute("data-site-state", "unavailable");
  await expect(line).toHaveText("Status unavailable");
});
