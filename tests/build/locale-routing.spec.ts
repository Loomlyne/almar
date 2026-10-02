import { existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  LOCALES,
  localeAlternates,
  localeDir,
  localeHrefs,
  localePath,
  type Locale,
} from "../../lib/locale-path";

// The per-locale route matrix on the assembled out/, served by local wrangler (the Cloudflare asset rules).
// Plans 04, 05 and 06 narrow it to their own path:
//   ROUTING_PATHS=/private-stays ROUTING_LOCALES=ar,es PW_PORT=<free> \
//     npx playwright test -c playwright.build.config.ts -g "server routing|language links" --workers=1
// Every test title starts with its group name and contains the path, so -g can select one path.

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
const DEFAULT_PATHS = ["/", "/private-stays", ...STAYS.map((s) => `/private-stays/${s}`)];
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
    return await run(await context.newPage());
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
  await page.locator(`a[hreflang="${target}"]`).click();
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
        });

        test(`language links: ${locale} ${path} at ${viewport.width}`, async ({ page, browser, baseURL }) => {
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

          for (const target of LOCALES.filter((l) => l !== locale)) {
            await page.goto(url);
            await switchByLink(page, locale, target, path);
            await withoutScript(browser, baseURL!, viewport, async (bare) => {
              await bare.goto(url);
              await switchByLink(bare, locale, target, path);
            });
          }
        });

        // The header LocaleSelect (plan 02's SiteNav). Runs on the real pages only, not in the probe run.
        test(`language select: ${locale} ${path} at ${viewport.width}`, async ({ page, context }) => {
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

// Once, no viewport. Runs at the end of the slice (all 14 pages converted), with the default PATHS and locales.
test("slice inventory: out/ holds exactly 42 React documents, 12 Framer documents and three 404s", async () => {
  test.skip(
    Boolean(process.env.ROUTING_PATHS || process.env.ROUTING_LOCALES),
    "the inventory is for the full 14 pages x 3 locales, not a narrowed run",
  );
  const files = htmlFiles("out").sort();
  const react = LOCALES.flatMap((l) =>
    PATHS.map((p) => {
      const url = localePath(l, p);
      return url.endsWith("/") ? `${url.slice(1)}index.html` : `${url.slice(1)}.html`;
    }),
  );
  const notFound = ["404.html", "ar/404.html", "es/404.html"];
  const rest = files.filter((f) => !react.includes(f) && !notFound.includes(f));
  expect(react.filter((f) => !files.includes(f)), "missing React documents").toEqual([]);
  expect(react).toHaveLength(42);
  expect(notFound.filter((f) => !files.includes(f))).toEqual([]);
  expect(rest, "12 Framer documents and nothing else").toHaveLength(12);
});
