import { mkdirSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { BLOG_COPY } from "../../../lib/copy/blog";
import { HOME_COPY } from "../../../lib/copy/home";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { MEDIA_BASE_URL } from "../../../lib/data/media";
import { localeAlternates, localeDir } from "../../../lib/locale-path";
import { BLOG_DOCUMENTS, FORBIDDEN_HOSTS, VIEWPORTS, heldNames, hydrated, nameOfCurrency, visit } from "./_helpers";

// Plan 03.3-33 Task 2: the sweep. 12 documents x 3 widths on the assembled out/: status, one h1, no overflow, four hreflang
// links, canonical without a slash, no third-party host, every image on the media host, and every held control absent
// from the DOM by role and by this language's own label. A full-page screenshot per document and width goes to
// test-results/blog/ for the hand-over (not committed, not compared).
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/blog/sweep.spec.ts --workers=1

const SHOTS = "test-results/blog";
mkdirSync(SHOTS, { recursive: true });

for (const vp of VIEWPORTS) {
  for (const doc of BLOG_DOCUMENTS) {
    const { locale, path, url, slug } = doc;
    const name = `${locale} ${path} at ${vp.width}`;
    const isPost = slug !== null;

    test(`sweep: ${name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const { media, requests } = await visit(page, url);
      if (isPost) await hydrated(page);

      // Served: status was 200 (visit navigated); one h1; direction; no overflow.
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      expect(await page.evaluate(() => document.documentElement.dir)).toBe(localeDir(locale));
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(locale);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

      // Scroll through once so the view-reveals show, then the hand-over picture (before the Menu is opened below).
      for (let y = 0; y < (await page.evaluate(() => document.documentElement.scrollHeight)); y += 600) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(80);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${SHOTS}/${locale}-${vp.width}-${slug ?? "list"}.png`, fullPage: true });

      // Head: four hreflang links, canonical without a trailing slash.
      const want = localeAlternates(locale, path);
      expect(await page.locator('link[rel="alternate"][hreflang]').count()).toBe(4);
      expect(await page.locator('link[rel="canonical"]').getAttribute("href")).toBe(want.canonical);
      expect(want.canonical.endsWith("/")).toBe(false);

      // Images: every <img src> on the media host (the nav and footer wordmarks apart), none missing from the manifest.
      const srcs = await page.locator("img[src]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("src") ?? ""));
      const outside = srcs.filter((src) => !src.startsWith(`${MEDIA_BASE_URL}/`));
      for (const src of outside) expect(src.startsWith("data:image/svg+xml") || /^\/_next\/static\/media\/[A-Za-z_]+\.[0-9a-f]+\.svg$/.test(src), src.slice(0, 80)).toBe(true);
      expect(media.missing).toEqual([]);
      expect(requests.filter((u) => FORBIDDEN_HOSTS.test(u))).toEqual([]);

      // Held controls absent: by label (button and link, exact), by shape (no field, no submit but the hero's Search).
      if (vp.width < 1152) await page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true }).click();
      for (const held of heldNames(locale)) {
        await expect(page.getByRole("button", { name: held, exact: true }), `button ${held}`).toHaveCount(0);
        await expect(page.getByRole("link", { name: held, exact: true }), `link ${held}`).toHaveCount(0);
      }
      for (const code of ["USD", "AED", "EUR", "COP"]) {
        await expect(page.getByRole("combobox", { name: nameOfCurrency(locale, code) }), `currency ${code}`).toHaveCount(0);
      }
      await expect(page.locator("input[type=email], textarea, form[action]")).toHaveCount(0);
      await expect(page.getByRole("textbox")).toHaveCount(0);
      await expect(page.locator("footer form")).toHaveCount(0);
      // No Plan this journey section and no hand-off link: the hero's working bar is the one planner on the page.
      await expect(page.getByRole("heading", { name: /Plan this journey|Planifica este viaje|خطط لهذه الرحلة/i })).toHaveCount(0);
      await expect(page.getByText(/See private stays in/i)).toHaveCount(0);
      // The Search: a post has exactly one submit, inside the hero bar's form at md and up; none shown below md (the bar is hidden there; the sheet's is a plain button) and none on the list.
      const submits = page.locator("button[type=submit]:visible");
      await expect(submits).toHaveCount(isPost && vp.width >= 768 ? 1 : 0);
      if (isPost) await expect(page.getByRole("region", { name: BLOG_COPY[locale].post.barLabel }).getByRole("button", { name: JOURNEY_COPY[locale].bar.search, exact: true })).toHaveCount(vp.width >= 768 ? 1 : 0);
    });
  }
}
