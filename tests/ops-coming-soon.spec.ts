import { expect, test, type Page } from "@playwright/test";
import { DASHBOARD_COPY } from "../lib/copy/dashboard";
import { OPS_CONTENT_COPY } from "../lib/copy/ops-content";
import { isLiveOpsPath } from "../lib/ops-routes";
import { NOT_LIVE_OPS_PATH } from "./journey/scenes/ops-not-live-path";
import { VIEWPORTS, settle } from "./journey/matrix";

// The ops host's rail and its "Not ready." (plan 03.2-12). Legal was the last Coming soon page (06-04): the Coming soon
// behaviour left with it, and no rail link carries the Soon chip. ComingSoonScreen stays unused until the controller removes
// it. Written, not run (owner rule, 2026-10-21).

type Locale = "en" | "ar" | "es";

// Plan 03.2-05: in mode "ops" the header mounts the publish status line, which reads /api/ops/site-status on mount; an unanswered
// call comes back 401 from the dev server and the client sends the page to /sign-in. Every ops-mode test answers it.
async function answerSiteStatus(page: Page) {
  await page.route("**/api/ops/site-status", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        site: { state: "up_to_date", requested_seq: 5, live_seq: 5, requested_at: "2026-10-13T10:02:00.000Z", built_at: "2026-10-13T10:05:00.000Z", last_hook_at: "2026-10-13T10:02:00.000Z", last_hook_result: "ok" },
      }),
    }),
  );
}

async function openHost(page: Page, baseURL: string | undefined, locale: Locale, viewport: keyof typeof VIEWPORTS) {
  await answerSiteStatus(page);
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: baseURL ?? "http://127.0.0.1:3010" }]);
  await page.goto(`/__harness?c=ops-coming-soon&s=ops-host-home&l=${locale}`);
  await settle(page);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

test.describe("the ops host's rail and Not ready", () => {
  test.setTimeout(120_000);

  test("every rail label is a real string and no link carries the Soon chip", async ({ page, baseURL }) => {
    for (const locale of ["en", "ar", "es"] as Locale[]) {
      await openHost(page, baseURL, locale, "desktop");
      const nav = page.locator("nav");
      await nav.getByRole("button").first().click(); // the Catalog disclosure, so Packages is in view
      const texts = await nav.locator("a, button, p").allInnerTexts();
      for (const text of texts) {
        expect(text.trim(), `${locale}: empty rail text`).not.toBe("");
        expect(text, `${locale}: bad rail text`).not.toMatch(/\[object|undefined|NaN/);
      }
      await expect(nav.getByRole("link").and(page.locator("[aria-label]"))).toHaveCount(0);
      await expect(nav.locator("span", { hasText: new RegExp(`^${OPS_CONTENT_COPY[locale].soon}$`) })).toHaveCount(0);
      await expect(nav.locator('a[href="/content/legal"]')).toHaveCount(1);
    }
  });

  test("ops host: a section that is not live (Home) still shows Not ready", async ({ page, baseURL }) => {
    // Scene ops-host-home passes NOT_LIVE_OPS_PATH to the layout: it needs a section that is not live. When that section
    // is wired, change the one constant in tests/journey/scenes/ops-not-live-path.ts to the next section still off.
    expect(isLiveOpsPath(NOT_LIVE_OPS_PATH), `${NOT_LIVE_OPS_PATH} is live now: change NOT_LIVE_OPS_PATH to a section still not live`).toBe(false);
    await openHost(page, baseURL, "en", "desktop");
    await expect(page.locator("main#content h1")).toHaveText(DASHBOARD_COPY.en.notReady);
    await expect(page.locator("main#content")).not.toContainText("stand-in page");
  });

  // Plan 03.2-05 puts the publish status line on its own row under the logo at 390 (mode "ops" only), so the header is two
  // rows tall there. The drawer must start below the REAL header (Grok's finding on PR #12; it was a fixed pt-20).
  for (const locale of ["en", "ar"] as Locale[]) {
    test(`ops host at 390: the Menu drawer starts below the two-row header, status line visible (${locale})`, async ({ page, baseURL }) => {
      await openHost(page, baseURL, locale, "phone");
      const status = page.locator("header [data-site-state]");
      await expect(status).toBeVisible();
      const logo = await page.locator("header img").boundingBox();
      const line = await status.boundingBox();
      // The status line is on its own row: under the logo, not beside it.
      expect(line!.y).toBeGreaterThanOrEqual(logo!.y + logo!.height - 1);
      await page.getByRole("button", { name: DASHBOARD_COPY[locale].menu }).click();
      await expect(page.locator("nav")).toBeVisible();
      const header = await page.locator("header").boundingBox();
      expect(header!.height, "the header is two rows here").toBeGreaterThan(110);
      const first = await page.locator("nav").getByRole("link").first().boundingBox();
      expect(first!.y, "the first rail link starts below the header").toBeGreaterThanOrEqual(header!.y + header!.height);
      await expect(page.locator("nav").getByRole("link").first()).toBeInViewport();
    });
  }
});
