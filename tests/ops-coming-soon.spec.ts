import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { DASHBOARD_COPY } from "../lib/copy/dashboard";
import { OPS_CONTENT_COPY } from "../lib/copy/ops-content";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// Content -> Pages, Blog, Legal and Navigation and footer as Coming soon pages, and the Content rail with its Soon chips
// (plan 03.2-12). The real pages run in the preview shell next dev serves without a session; the harness scene
// (tests/journey/scenes/ops-coming-soon.tsx) frames the same four states for the pictures block.

type Locale = "en" | "ar" | "es";
const KINDS = ["pages", "blog", "legal", "navigation"] as const;
const SOON_RAIL = ["pages", "blog", "legal", "navigation"];

async function openReal(page: Page, baseURL: string | undefined, kind: string, viewport: Viewport, locale: Locale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: baseURL ?? "http://127.0.0.1:3010" }]);
  await page.goto(`/dashboard/content/${kind}`);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.locator("main h2")).toBeVisible({ timeout: 40_000 });
  await page.waitForFunction((l) => document.documentElement.dir === (l === "ar" ? "rtl" : "ltr"), locale);
}

const labelOf = (kind: string, locale: Locale) =>
  kind === "navigation" ? OPS_CONTENT_COPY[locale].rail.navigation : DASHBOARD_COPY[locale].rail[kind as "pages" | "blog" | "legal"];

// ---- pictures ------------------------------------------------------------------------------------------------------
// The signed pictures are in pictures/03.2-12 (made before the code, build-pictures.mjs). This block shoots the REAL pages
// from the harness scenes so they can be compared with them: it runs only when OPS_COMING_SOON_PICTURES=<absolute folder>.
const PICTURES_TO = process.env.OPS_COMING_SOON_PICTURES;
test.describe("pictures", () => {
  test.skip(!PICTURES_TO || !isAbsolute(PICTURES_TO), "set OPS_COMING_SOON_PICTURES=<absolute folder> to shoot the real pages");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (PICTURES_TO && isAbsolute(PICTURES_TO)) mkdirSync(PICTURES_TO, { recursive: true });
  for (const state of sceneStates("ops-coming-soon").filter((one) => !one.startsWith("ops-host"))) {
    for (const viewport of ["phone", "tablet", "desktop"] as Viewport[]) {
      for (const locale of ["en", "ar", "es"] as Locale[]) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page, baseURL }) => {
          await page.setViewportSize(VIEWPORTS[viewport]);
          // The dashboard reads its language from the almar-locale cookie, not from the harness `l`.
          await page.context().addCookies([{ name: "almar-locale", value: locale, url: baseURL ?? "http://127.0.0.1:3010" }]);
          await page.goto(`/__harness?c=ops-coming-soon&s=${state}&l=${locale}`);
          await settle(page);
          await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
          await page.waitForTimeout(300);
          await page.screenshot({ path: join(PICTURES_TO!, `${state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});

// ---- behaviour -----------------------------------------------------------------------------------------------------
test.describe("coming soon pages", () => {
  test.setTimeout(120_000);

  for (const locale of ["en", "ar"] as Locale[]) {
    for (const kind of KINDS) {
      test(`${kind} (${locale}) shows its words and has no control in main`, async ({ page, baseURL }) => {
        await openReal(page, baseURL, kind, "desktop", locale);
        const block = OPS_CONTENT_COPY[locale].comingSoon[kind];
        await expect(page.locator("main h1")).toHaveText(labelOf(kind, locale));
        await expect(page.locator("main h2")).toHaveText(block.title);
        await expect(page.locator("main p")).toHaveText(block.line);
        await expect(page.locator("main li")).toHaveCount(block.list.length);
        await expect(page.locator("main")).toContainText(OPS_CONTENT_COPY[locale].soon);
        // Nothing in main can be pressed or typed into.
        await expect(page.locator("main button, main input, main textarea, main select, main a, main [role=button]")).toHaveCount(0);
        expect(await page.locator("main").innerText()).not.toContain("[object");
      });
    }
  }

  test("every rail label is a real string, four links carry the Soon chip and Packages, Team and Media carry none", async ({ page, baseURL }) => {
    for (const locale of ["en", "ar", "es"] as Locale[]) {
      await openReal(page, baseURL, "legal", "desktop", locale);
      const nav = page.locator("nav");
      await nav.getByRole("button").first().click(); // the Catalog disclosure, so Packages is in view
      const links = nav.getByRole("link");
      const count = await links.count();
      expect(count).toBe(16);
      const texts = await nav.locator("a, button, p").allInnerTexts();
      for (const text of texts) {
        expect(text.trim(), `${locale}: empty rail text`).not.toBe("");
        expect(text, `${locale}: bad rail text`).not.toMatch(/\[object|undefined|NaN/);
      }
      const named = await links.evaluateAll((all) => all.filter((a) => a.hasAttribute("aria-label")).map((a) => a.getAttribute("href")));
      expect(named.map((href) => href?.split("/").pop())).toEqual(SOON_RAIL);
      const soon = OPS_CONTENT_COPY[locale].soon;
      await expect(nav.locator("span", { hasText: new RegExp(`^${soon}$`) })).toHaveCount(4);
      for (const kind of KINDS) {
        const name = OPS_CONTENT_COPY[locale].soonNamed.replace("{label}", labelOf(kind, locale));
        await expect(nav.getByRole("link", { name })).toHaveAttribute("href", `/dashboard/content/${kind}`);
      }
      for (const href of ["/dashboard/catalog/packages", "/dashboard/content/team", "/dashboard/content/media"]) {
        await expect(nav.locator(`a[href="${href}"]`)).not.toHaveAttribute("aria-label", /.+/);
        await expect(nav.locator(`a[href="${href}"] span`)).toHaveCount(0);
      }
    }
  });

  test("the rail reaches Legal and Navigation and footer", async ({ page, baseURL }) => {
    await openReal(page, baseURL, "pages", "desktop", "en");
    await page.locator("nav").getByRole("link", { name: "Legal, soon" }).click();
    await expect(page).toHaveURL(/\/dashboard\/content\/legal$/);
    await expect(page.locator("main h2")).toHaveText(OPS_CONTENT_COPY.en.comingSoon.legal.title);
    await page.locator("nav").getByRole("link", { name: "Navigation and footer, soon" }).click();
    await expect(page).toHaveURL(/\/dashboard\/content\/navigation$/);
    await expect(page.locator("main h2")).toHaveText(OPS_CONTENT_COPY.en.comingSoon.navigation.title);
    await expect(page.locator("nav a[aria-current=page]")).toHaveCount(1);
  });

  for (const locale of ["en", "ar"] as Locale[]) {
    test(`at 390 the Menu drawer shows the chips and its first row sits below the header (${locale})`, async ({ page, baseURL }) => {
      await openReal(page, baseURL, "navigation", "phone", locale);
      await expect(page.locator("nav")).toBeHidden();
      await page.getByRole("button", { name: DASHBOARD_COPY[locale].menu }).click();
      const nav = page.locator("nav");
      await expect(nav).toBeVisible();
      await expect(nav.locator("span", { hasText: new RegExp(`^${OPS_CONTENT_COPY[locale].soon}$`) })).toHaveCount(4);
      const header = await page.locator("header").boundingBox();
      const first = await nav.getByRole("link").first().boundingBox();
      expect(first!.y).toBeGreaterThanOrEqual(header!.y + header!.height);
    });
  }

  test("the harness scene frames the page in the preview shell", async ({ page, baseURL }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.context().addCookies([{ name: "almar-locale", value: "es", url: baseURL ?? "http://127.0.0.1:3010" }]);
    await page.goto("/__harness?c=ops-coming-soon&s=blog&l=es");
    await settle(page);
    await expect(page.locator("main h2")).toHaveText(OPS_CONTENT_COPY.es.comingSoon.blog.title);
  });

  // The ops host: the (ops) layout puts a live section's page in OpsShell mode="ops", anything else shows "Not ready.".
  for (const locale of ["en", "ar"] as Locale[]) {
    for (const kind of KINDS) {
      test(`ops host: ${kind} (${locale}) opens as the Coming soon screen, not Not ready`, async ({ page, baseURL }) => {
        await page.setViewportSize(VIEWPORTS.desktop);
        await page.context().addCookies([{ name: "almar-locale", value: locale, url: baseURL ?? "http://127.0.0.1:3010" }]);
        await page.goto(`/__harness?c=ops-coming-soon&s=ops-host-${kind}&l=${locale}`);
        await settle(page);
        const main = page.locator("main#content");
        await expect(main.locator("h2")).toHaveText(OPS_CONTENT_COPY[locale].comingSoon[kind].title);
        await expect(main.locator("h1")).toHaveText(labelOf(kind, locale));
        await expect(main).not.toContainText(DASHBOARD_COPY[locale].notReady);
        // It is the ops shell (Sign out in the rail), with hrefs without /dashboard.
        await expect(page.locator("nav button", { hasText: DASHBOARD_COPY[locale].signOut })).toBeVisible();
        await expect(page.locator(`nav a[href="/content/${kind}"]`)).toHaveCount(1);
        await expect(main.locator("button, input, textarea, select, a")).toHaveCount(0);
      });
    }
  }

  test("ops host: a section that is not live (Team) still shows Not ready", async ({ page, baseURL }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.context().addCookies([{ name: "almar-locale", value: "en", url: baseURL ?? "http://127.0.0.1:3010" }]);
    await page.goto("/__harness?c=ops-coming-soon&s=ops-host-team&l=en");
    await settle(page);
    await expect(page.locator("main#content h1")).toHaveText(DASHBOARD_COPY.en.notReady);
    await expect(page.locator("main#content h2")).toHaveCount(0);
  });
});
