import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  LOCALES,
  PUBLIC_PAGES,
  localeAlternates,
  localeDir,
  localeHrefs,
  localePath,
  type Locale,
} from "../../lib/locale-path";
import { isLivePost } from "../../scripts/post-live.mjs";
import { framerRoutes } from "../helpers/site-links.mjs";
import { clickClearOfDock } from "../helpers/click-clear-of-dock";
import { routeMedia } from "../helpers/media-route";

// The per-locale route matrix on the assembled out/, served by local wrangler (the Cloudflare asset rules).
// Plans 04, 05 and 06 narrow it to their own path:
//   ROUTING_PATHS=/private-stays ROUTING_LOCALES=ar,es PW_PORT=<free> \
//     npx playwright test -c playwright.build.config.ts -g "server routing|language links" --workers=1
// Every test title starts with its group name and contains the path, so -g can select one path.
//
// The "language links" hang. 10 of 108 of these tests (always `ar /private-stays/<slug>`) timed out at 30 s in the
// controller's run, and about 1 in 15 hangs at any machine load: the click on a footer language link never lands.
// Measured cause (call log of the stuck click): the stay page pins an 88 px dock over the bottom of the screen, the
// page's height is still changing when the link is scrolled to the bottom edge (not isolated; the Arabic font swap is the
// likely cause), so the link ends up behind the dock, and Playwright, which counts it as "in view", retries the same
// position until the timeout. The fix is in how the
// test clicks: clickClearOfDock() centres the link on every attempt (0 failures in 60 clicks, at most 2 attempts).
// Three smaller changes, none of which weakens an assertion, make the file cheaper on a busy Mac:
//   - "language links" is one test per target language (about four page loads each instead of eight) and, like
//     "language select", is test.slow() (three times the 30 s budget);
//   - images are answered by routeMedia (plan 07), as in every other build spec, so no load waits on the live media host.
// Neither of those two cured the hang by itself (it recurred with both), so they are not the fix.

const STAYS = [
  "getsemani-colonial-house",
  "getsemani-courtyard-residence",
  "cartagena-historic-center-house",
  "baru-island-private-villa",
  "bocagrande-beach-house",
  "casa-jardin-san-diego",
  "casa-juliana-historic-center",
  "casa-mariana-historic-center",
  "private-island-cartagena",
  "private-island-estate-cartagena",
  "santa-fe-farm-antioquia",
  "sopetran-country-estate",
];
// The live posts (lib/data/fixtures/posts.json: published and dated now or earlier, as lib/data/posts.ts decides), for the inventory below.
const POSTS = (
  JSON.parse(readFileSync("lib/data/fixtures/posts.json", "utf8")) as Array<{ slug: string; is_published: boolean; published_at: string }>
)
  .filter((p) => isLivePost(p))
  .map((p) => p.slug);
const DEFAULT_PATHS = ["/", "/private-stays", "/destinations", "/experiences", ...STAYS.map((s) => `/private-stays/${s}`)];
const list = (value: string | undefined) => (value ? value.split(",").map((v) => v.trim()).filter(Boolean) : null);

const PATHS = list(process.env.ROUTING_PATHS) ?? DEFAULT_PATHS;
const ROUTING_LOCALES = (list(process.env.ROUTING_LOCALES) ?? [...LOCALES]) as Locale[];

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 834, height: 1194 },
  { width: 1440, height: 900 },
];

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[1] ?? m[2]) : null;
}

const linkTags = (raw: string) => [...raw.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);

async function withoutScript<T>(
  browser: Browser,
  baseURL: string,
  viewport: { width: number; height: number },
  run: (page: Page) => Promise<T>,
): Promise<T> {
  const context = await browser.newContext({ baseURL, viewport, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    const media = await routeMedia(page);
    const result = await run(page);
    expect(media.missing, "image keys the manifest does not know (no-script page)").toEqual([]);
    return result;
  } finally {
    await context.close();
  }
}

/** Click a language link and prove the switch costs no redirect and lands on the target's own document. */
async function switchByLink(page: Page, from: Locale, target: Locale, path: string) {
  const expected = localePath(target, path);
  const statuses: number[] = [];
  page.on("response", (r) => {
    if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) statuses.push(r.status());
  });
  const landed = page.waitForResponse(
    (r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === expected,
  );
  await clickClearOfDock(page.locator(`a[hreflang="${target}"]`));
  const response = await landed;
  expect(response.status(), `${from} -> ${target}`).toBe(200);
  expect(statuses.filter((s) => s >= 300 && s < 400), `${from} -> ${target} must not redirect`).toEqual([]);
  expect(new URL(page.url()).pathname).toBe(expected);
  const tag = /<html\b[^>]*>/i.exec(await response.text())?.[0] ?? "";
  expect(attr(tag, "lang")).toBe(target);
  expect(attr(tag, "dir")).toBe(localeDir(target));
}

for (const viewport of VIEWPORTS) {
  test.describe(`routing at ${viewport.width}`, () => {
    test.use({ viewport });

    for (const locale of ROUTING_LOCALES) {
      for (const path of PATHS) {
        const url = localePath(locale, path);
        const dir = localeDir(locale);

        test(`server routing: ${locale} ${path} at ${viewport.width}`, async ({ page, request, browser, baseURL }) => {
          const media = await routeMedia(page);
          const response = await page.goto(url);
          expect(response?.status()).toBe(200);
          expect(response?.request().redirectedFrom()).toBeNull();

          // Served HTML, before any script runs.
          const raw = (await response?.text()) ?? "";
          const tag = /<html\b[^>]*>/i.exec(raw)?.[0] ?? "";
          expect(attr(tag, "lang")).toBe(locale);
          expect(attr(tag, "dir")).toBe(dir);
          const want = localeAlternates(locale, path);
          const links = linkTags(raw);
          const alternates = links.filter((l) => /hreflang/i.test(l));
          expect(Object.fromEntries(alternates.map((l) => [attr(l, "hreflang"), attr(l, "href")]))).toEqual(
            want.languages,
          );
          expect(alternates).toHaveLength(4);
          const canonical = links.filter((l) => /rel\s*=\s*["']canonical["']/i.test(l));
          expect(canonical.map((l) => attr(l, "href"))).toEqual([want.canonical]);

          // The same document with JavaScript off.
          await withoutScript(browser, baseURL!, viewport, async (bare) => {
            await bare.goto(url);
            expect(await bare.evaluate(() => document.documentElement.lang)).toBe(locale);
            expect(await bare.evaluate(() => document.documentElement.dir)).toBe(dir);
            expect(await bare.evaluate(() => getComputedStyle(document.body).direction)).toBe(dir);
          });

          // Cloudflare's canonical forms: a locale home keeps its slash, a page has none.
          if (locale !== "en") {
            const noSlash = await request.get(`/${locale}`, { maxRedirects: 0 });
            expect(noSlash.status()).toBe(307);
            expect(new URL(noSlash.headers()["location"], "http://x").pathname).toBe(`/${locale}/`);
            if (path !== "/") {
              const slashed = await request.get(`${url}/`, { maxRedirects: 0 });
              expect(slashed.status()).toBe(307);
              expect(new URL(slashed.headers()["location"], "http://x").pathname).toBe(url);
            }
          }
          expect(media.missing, "image keys the manifest does not know").toEqual([]);
        });

        for (const target of LOCALES.filter((l) => l !== locale)) {
          test(`language links: ${locale} ${path} at ${viewport.width} to ${target}`, async ({ page, browser, baseURL }) => {
            test.slow();
            const media = await routeMedia(page);
            await page.goto(url);
            const links = page.locator("a[hreflang]");
            await expect(links).toHaveCount(3);
            const found: Record<string, string | null> = {};
            for (const el of await links.all()) {
              const code = (await el.getAttribute("hreflang")) ?? "";
              found[code] = await el.getAttribute("href");
              expect(await el.getAttribute("lang"), `lang on the ${code} link`).toBeTruthy();
            }
            expect(found).toEqual(localeHrefs(path));

            // With JavaScript on, then with it off in a fresh context: the same click, the same landing.
            await switchByLink(page, locale, target, path);
            await withoutScript(browser, baseURL!, viewport, async (bare) => {
              await bare.goto(url);
              await switchByLink(bare, locale, target, path);
            });
            expect(media.missing, "image keys the manifest does not know").toEqual([]);
          });
        }

        // The header LocaleSelect (plan 02's SiteNav). Runs on the real pages only, not in the probe run.
        test(`language select: ${locale} ${path} at ${viewport.width}`, async ({ page, context }) => {
          test.slow();
          const media = await routeMedia(page);
          for (const target of LOCALES.filter((l) => l !== locale)) {
            await page.goto(url);
            if (viewport.width < 1152) await page.locator("header button[aria-expanded]").first().click();
            const statuses: number[] = [];
            page.on("response", (r) => {
              if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) statuses.push(r.status());
            });
            await page.getByRole("combobox", { name: /^(Language|اللغة|Idioma):/ }).click();
            const expected = localePath(target, path);
            const landed = page.waitForResponse(
              (r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === expected,
            );
            const names = { en: "English", ar: "العربية", es: "Español" } as const;
            await page.getByRole("option", { name: names[target] }).click();
            const response = await landed;
            expect(statuses.filter((s) => s >= 300 && s < 400)).toEqual([]);
            expect(new URL(page.url()).pathname).toBe(expected);
            const tag = /<html\b[^>]*>/i.exec(await response.text())?.[0] ?? "";
            expect(attr(tag, "lang")).toBe(target);
            expect(attr(tag, "dir")).toBe(localeDir(target));
            const cookie = (await context.cookies()).find((c) => c.name === "almar-locale");
            expect(cookie?.value).toBe(target);
            page.removeAllListeners("response");
          }
          expect(media.missing, "image keys the manifest does not know").toEqual([]);
        });
      }
    }
  });
}

function htmlFiles(dir: string, found: string[] = []): string[] {
  for (const name of existsSync(dir) ? readdirSync(dir) : []) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name !== "_next") htmlFiles(full, found);
    } else if (name.endsWith(".html")) found.push(relative("out", full).split("\\").join("/"));
  }
  return found;
}

// The Framer documents by name: every app route.ts that still holds a Framer export (English only).
function framerDocuments(dir = "app", out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) framerDocuments(full, out);
    else if (name === "route.ts" && readFileSync(full, "utf8").includes('const HTML = "')) {
      out.push(`${full.replace(/^app\//, "").replace(/\/?route\.ts$/, "")}.html`);
    }
  }
  return out;
}

// Once, no viewport. The inventory is derived, so the next slice that converts a page changes no literal: the React
// documents are every PUBLIC_PAGES pattern (with [stay] and [post] expanded to the published slugs) in the three
// locales; the Framer documents are the route.ts files that still serve a Framer export (English only).
test("slice inventory: out/ holds every React document, every remaining Framer document and three 404s", async () => {
  test.skip(
    Boolean(process.env.ROUTING_PATHS || process.env.ROUTING_LOCALES),
    "the inventory is for every page x 3 locales, not a narrowed run",
  );
  const files = htmlFiles("out").sort();
  const paths = PUBLIC_PAGES.flatMap((pattern) =>
    pattern === "/private-stays/[stay]"
      ? STAYS.map((s) => `/private-stays/${s}`)
      : pattern === "/blog/[post]"
        ? POSTS.map((s) => `/blog/${s}`)
        : [pattern],
  );
  const react = LOCALES.flatMap((l) =>
    paths.map((p) => {
      const url = localePath(l, p);
      return url.endsWith("/") ? `${url.slice(1)}index.html` : `${url.slice(1)}.html`;
    }),
  );
  const notFound = ["404.html", "ar/404.html", "es/404.html"];
  const rest = files.filter((f) => !react.includes(f) && !notFound.includes(f));
  expect(react.filter((f) => !files.includes(f)), "missing React documents").toEqual([]);
  expect(react).toHaveLength(LOCALES.length * paths.length);
  expect(notFound.filter((f) => !files.includes(f))).toEqual([]);
  expect(rest, "the Framer documents that remain, and nothing else").toHaveLength(framerRoutes("app").length);
  expect(rest, "the Framer documents by name").toEqual(framerDocuments().sort());
});
