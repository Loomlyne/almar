import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { HOME_COPY } from "../../lib/copy/home";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { getCatalogItem } from "../../lib/data/experiences";
import { fill } from "../../lib/journey-format";
import { SITE_ORIGIN, localeAlternates, localeDir, localePath, type Locale } from "../../lib/locale-path";
import { pointerOff } from "../helpers/pointer-off";
import { routeMedia } from "../helpers/media-route";
import { data as catalogData, cards as catalogCards, dialog as catalogDialog, filtersButton, groupHeads, visit as visitExperiences } from "./experiences/_helpers";
import { LOCALES, SLUGS, WIDTHS, watch } from "./stay-detail/_helpers";
import { DESTINATIONS_PAGE_COPY } from "../../lib/copy/destinations-page";
import { getDestinations } from "../../lib/data/destinations";

// Plan 03.3-17, task 2. The browser sweep of slice 2, on the assembled out/ served by local wrangler dev
// (playwright.build.config.ts; workerd, never --remote):
//   node scripts/assemble-cloudflare.mjs
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/slice2-sweep.spec.ts --workers=1
//
// A  the document list is computed twice (publicDocuments() and localePath over PUBLIC_PAGES) and the two agree (the blog,
//    About and Contact less; each has its own sweep).
// B+C every document x 390, 834, 1440: status, served lang and dir, structure, images, WhatsApp, footer, the held
//    controls by name and text (with the Menu closed and, below the nav row, open), one screenshot each.
// D  /experiences: the overlay and, below 1024, the Filters sheet, checked for the same held controls.
// E  the /services redirects on local wrangler dev, with the Worker of job 10 in front of the assets.
// F  JavaScript off, /destinations and /experiences.
// G  /destinations matched to Framer: layout as relationships, signed sizes, enter animations, the hero slideshow.
// Screenshots: test-results/slice2/<locale>/<page>-<width>.png (gitignored).
//
// Every expected string comes from lib/copy, lib/locale-path or the data layer. The redirect sources of section E are typed
// because they ARE the contract (design 5.2).

const FORBIDDEN_HOSTS = ["framerusercontent.com", "files.catbox.moe", "videos.pexels.com"];
const SHOTS = path.join("test-results", "slice2");
const NAV_ROW_MIN = 1152; // the nav is a Menu below this width (components/ui/nav.tsx)
const WA = "https://wa.me/971563883302";
const INSTAGRAM = "https://www.instagram.com/almarprivatejourney/";
const AUTOPLAY_MS = Number(/export const AUTOPLAY_MS = (\d+)/.exec(fs.readFileSync("components/ui/slider.tsx", "utf8"))![1]);
const REGION = '[aria-roledescription="carousel"]';
const MD = 768;

// Job 11's footer is on this branch (its landing, with slice 1, is 65672af): exactly one social link, Instagram.
const JOB11_FOOTER = true;

const CART = /\bcart\b|carrito|عربة|سلة/i;
const PACKAGES = /packages|paquetes|الباقات|باقات/i;
const CURRENCY = /\b(AED|USD|EUR|COP)\b|\$|€/;

// ---- A. the document list, computed ---------------------------------------------------------------------------------

type Kind = "home" | "list" | "destinations" | "experiences" | "stay";
type Doc = { locale: Locale; name: string; base: string; kind: Kind; url: string };

/** publicDocuments() (scripts/media-lib.mjs) read once in a child process: that module imports .ts files. */
function computedDocuments(): string[] {
  const script =
    'import { publicDocuments } from "./scripts/media-lib.mjs"; process.stdout.write(JSON.stringify(publicDocuments()));';
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(out) as string[];
}

/** An out/ path to its address: index.html is "/", ar/index.html is "/ar/", x.html is "/x". */
function outToUrl(file: string): string {
  if (file === "index.html") return "/";
  if (file.endsWith("/index.html")) return `/${file.slice(0, -"index.html".length)}`;
  return `/${file.slice(0, -".html".length)}`;
}

const PAGES: Array<{ name: string; base: string; kind: Kind }> = [
  { name: "home", base: "/", kind: "home" },
  { name: "private-stays", base: "/private-stays", kind: "list" },
  { name: "destinations", base: "/destinations", kind: "destinations" },
  { name: "experiences", base: "/experiences", kind: "experiences" },
  ...SLUGS.map((slug) => ({ name: `stay-${slug}`, base: `/private-stays/${slug}`, kind: "stay" as Kind })),
];
const DOCUMENTS: Doc[] = LOCALES.flatMap((locale) => PAGES.map((p) => ({ locale, ...p, url: localePath(locale, p.base) })));

// The blog's documents (slice 4) are swept by tests/build/blog/sweep.spec.ts, About and Contact (slice 3A) by
// tests/build/about and tests/build/contact; this sweep is every other public document.
const isBlog = (url: string) => /^\/(?:(?:ar|es)\/)?blog(?:\/|$)/.test(url);
const isSlice3 = (url: string) => /^\/(?:(?:ar|es)\/)?(?:about|contact)$/.test(url);

test("the sweep list: publicDocuments() less the blog, About and Contact and the localePath construction agree, and each is an assembled file", () => {
  const computed = computedDocuments().map(outToUrl).filter((u) => !isBlog(u) && !isSlice3(u));
  expect(computed).toHaveLength(LOCALES.length * PAGES.length);
  expect(DOCUMENTS).toHaveLength(LOCALES.length * PAGES.length);
  expect(new Set(DOCUMENTS.map((d) => d.url)).size).toBe(DOCUMENTS.length);
  expect([...computed].sort()).toEqual(DOCUMENTS.map((d) => d.url).sort());
  for (const doc of DOCUMENTS) {
    const file = doc.url.endsWith("/") ? `${doc.url.slice(1)}index.html` : `${doc.url.slice(1)}.html`;
    expect(fs.existsSync(path.join("out", file)), `out/${file}`).toBe(true);
  }
});

// ---- helpers ---------------------------------------------------------------------------------------------------------

const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag)?.[1] ?? null;

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

/** Scroll through by viewport steps so a lazy picture is requested and the enter animations ran, then back to the top. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => window.innerHeight);
  for (let y = 0; y < height; y += step) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(60);
  }
  await page.evaluate((to) => window.scrollTo(0, to), height);
  await page.waitForTimeout(150);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

type Surface = { names: string[]; text: string; submits: number; emailInputs: number; forms: number; comboboxes: string[] };

/** What a visitor can reach and read inside `root` (the whole page when absent): accessible names, text, submit buttons, forms. */
function surfaceOf(root: Locator | Page): Promise<Surface> {
  const run = (el: Element | null): Surface => {
    const scope: ParentNode = el ?? document;
    const collapse = (s: string | null | undefined) => (s ?? "").replace(/\s+/g, " ").trim();
    const nameOf = (n: Element) => collapse(n.getAttribute("aria-label")) || collapse(n.textContent) || collapse(n.querySelector("img")?.getAttribute("alt"));
    const controls = Array.from(scope.querySelectorAll('button, a, [role="button"], [role="link"], input[type="button"], input[type="submit"]'));
    return {
      names: controls.map(nameOf).filter((n) => n.length > 0),
      text: el instanceof HTMLElement ? el.innerText : document.body.innerText,
      submits: scope.querySelectorAll('button[type="submit"], input[type="submit"]').length,
      emailInputs: scope.querySelectorAll('input[type="email"]').length,
      forms: scope.querySelectorAll("form").length,
      comboboxes: Array.from(scope.querySelectorAll('[role="combobox"]')).map((n) => collapse(n.getAttribute("aria-label"))),
    };
  };
  // A Page evaluates over the whole document; a Locator over its own element.
  if ("goto" in root) return root.evaluate(run, null);
  return root.evaluate(run);
}

type HeldCtx = { locale: Locale; itemNames: string[]; where: string };

/** Every held control of design 4.3, absent by exact name and by text; returns what is wrong, as sentences. */
function heldProblems(s: Surface, ctx: HeldCtx, opts: { homeSearch: boolean; submitsAllowed?: number; currencyAllowed?: boolean; noMoney?: boolean }): string[] {
  const journey = JOURNEY_COPY[ctx.locale];
  const home = HOME_COPY[ctx.locale];
  const bad: string[] = [];
  const say = (what: string) => bad.push(`${ctx.where}: ${what}`);
  const exact = new Set(s.names);
  const has = (name: string) => exact.has(name);

  if (opts.homeSearch) {
    if (s.submits !== 1) say(`${s.submits} submit buttons on the home (expected exactly 1: Search)`);
    if (!has(journey.bar.search)) say(`the home has no control named "${journey.bar.search}"`);
  } else {
    if (s.submits !== 0) say(`${s.submits} submit buttons (expected 0)`);
    if (s.forms !== 0) say(`${s.forms} forms (expected 0)`);
    if (has(journey.bar.search)) say(`a control named "${journey.bar.search}"`);
  }
  if (s.emailInputs !== 0) say(`${s.emailInputs} email inputs`);

  const held = [journey.addons.add, journey.cart.continue, journey.addons.continue, home.nav.login, home.subscribe];
  for (const name of held) if (has(name)) say(`a control named "${name}"`);
  for (const name of ctx.itemNames) {
    const add = fill(journey.addons.addName, { name });
    if (has(add)) say(`a control named "${add}"`);
  }
  for (const n of s.names) {
    if (CART.test(n)) say(`a control named like a cart: "${n}"`);
    if (PACKAGES.test(n)) say(`a control named like Packages: "${n}"`);
  }
  if (s.text.includes(home.listTitle) || /list with us/i.test(s.text)) say("List with us in the text");
  for (const marker of ["AED [", "[PRICE]", "[AMOUNT]", "[RATE]"]) if (s.text.includes(marker)) say(`"${marker}" in the visible text`);
  if (!opts.currencyAllowed) {
    const prefix = journey.locale.currency.split("{")[0].trim();
    const currencies = s.comboboxes.filter((c) => c.startsWith(prefix));
    if (currencies.length) say(`a currency select (${currencies.join(", ")})`);
  }
  if (opts.noMoney) {
    const money = s.text.match(CURRENCY)?.[0];
    if (money) say(`a currency code or sign in the text: ${money}`);
    if (s.text.includes(journey.addons.unit.person)) say(`"${journey.addons.unit.person}" in the text`);
  }
  return bad;
}

const itemNamesOf = async (locale: Locale) => (await catalogData(locale)).items.map((i) => i.name);

// ---- B + C. every document x 3 widths -------------------------------------------------------------------------------------

test.describe("sweep", () => {
  test.setTimeout(120_000);

  for (const doc of DOCUMENTS) {
    for (const viewport of WIDTHS) {
      test(`${doc.locale} ${doc.url} @${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const watched = await watch(page);

        const response = await page.goto(doc.url, { waitUntil: "domcontentloaded" });
        expect(response?.status(), "status").toBe(200);
        expect(response?.request().redirectedFrom(), "no redirect").toBeNull();

        // lang and dir in the bytes the server sent, before any script could change them.
        const raw = (await response?.text()) ?? "";
        const tag = /<html\b[^>]*>/i.exec(raw)?.[0] ?? "";
        expect(attr(tag, "lang"), "served lang").toBe(doc.locale);
        expect(attr(tag, "dir"), "served dir").toBe(localeDir(doc.locale));

        await settle(page);
        expect(await page.evaluate(() => document.documentElement.lang), "DOM lang").toBe(doc.locale);
        expect(await page.evaluate(() => document.documentElement.dir), "DOM dir").toBe(localeDir(doc.locale));
        await expect(page.locator("h1"), "exactly one h1").toHaveCount(1);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "horizontal overflow in px").toBeLessThanOrEqual(0);

        const alternates = await page
          .locator('link[rel="alternate"][hreflang]')
          .evaluateAll((nodes) => nodes.map((node) => [node.getAttribute("hreflang"), node.getAttribute("href")]));
        expect(alternates, "four hreflang links").toHaveLength(4);
        expect(Object.fromEntries(alternates), "hreflang links").toEqual(localeAlternates(doc.locale, doc.base).languages);
        const canonical = await page.locator('link[rel="canonical"]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")));
        expect(canonical, "one canonical").toEqual([SITE_ORIGIN + doc.url]);

        await scrollThrough(page);
        // Every picture the browser was asked for has painted (a picture with no box, and a lazy slide it has not requested, are not "unpainted").
        await expect
          .poll(
            () =>
              page.locator("img").evaluateAll((nodes) =>
                (nodes as HTMLImageElement[])
                  .filter((n) => n.getClientRects().length > 0 && !(n.loading === "lazy" && !n.currentSrc))
                  .filter((n) => !n.complete || n.naturalWidth === 0)
                  .map((n) => n.src),
              ),
            { message: "images that did not paint", timeout: 3 * AUTOPLAY_MS, intervals: [200] },
          )
          .toEqual([]);
        expect(watched.media.missing, "image keys the manifest does not know").toEqual([]);

        // Back at the top; on the home the docked bar mounts a second search form while the hero bar is out of view.
        await page.evaluate(() => window.scrollTo(0, 0));
        if (doc.kind === "home") await expect(page.locator('form[role="search"]'), "one search form at the top").toHaveCount(1);

        // WhatsApp (SITE-03): the link exists everywhere; a stay page has the request link and no float (job 11 plan 45).
        expect(await page.locator(`a[href^="${WA}"]`).count(), "a WhatsApp link").toBeGreaterThanOrEqual(1);
        if (doc.kind === "stay") {
          await expect(page.getByRole("link", { name: "WhatsApp", exact: true }), "no float on a stay page").toHaveCount(0);
          expect(await page.locator(`a[href^="${WA}?text="]`).count(), "the request link").toBeGreaterThanOrEqual(1);
        }

        // Footer (SITE-13): contact unchanged, no newsletter, no bare social link, one Instagram link.
        const footerText = (await page.locator("footer").innerText()).replace(/\s+/g, " ");
        expect(footerText, "footer mail").toContain("inquiries@almarprivatejourney.com");
        expect(footerText, "footer phone").toContain("+971 56 388 3302");
        await expect(page.locator("footer form"), "no footer form").toHaveCount(0);
        await expect(page.locator('input[type="email"]'), "no email field").toHaveCount(0);
        const allHrefs = await page.locator("a[href]").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? ""));
        for (const href of allHrefs) expect(href, "a bare social link").not.toMatch(/^https?:\/\/(www\.)?(facebook|youtube|tiktok)\.com\/?$/i);
        if (JOB11_FOOTER) {
          const social = await page
            .locator("footer a[href]")
            .evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? "").filter((h) => /(instagram|facebook|youtube|tiktok|twitter|linkedin)\.com|\/\/(www\.)?x\.com/i.test(h)));
          expect(social, "exactly one social link: Instagram").toEqual([INSTAGRAM]);
        }
        expect(watched.problems, "console errors, page errors, hydration, forbidden hosts").toEqual([]);
        for (const host of FORBIDDEN_HOSTS) expect([...watched.hosts], `a request went to ${host}`).not.toContain(host);

        // The two new pages: every control and link sits inside the viewport (design 1.4 #6 and 7.7: the phone toolbar wraps).
        if (doc.kind === "destinations" || doc.kind === "experiences") {
          const outside = await page.evaluate(() => {
            const w = window.innerWidth;
            return Array.from(document.querySelectorAll("main button, main a, main input"))
              .map((el) => ({ el, r: el.getBoundingClientRect(), s: getComputedStyle(el) }))
              .filter(({ r, s }) => r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none")
              .filter(({ r }) => r.left < -1 || r.right > w + 1)
              .map(({ el, r }) => `${el.tagName} ${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim().slice(0, 40)} ${Math.round(r.left)}..${Math.round(r.right)}`);
          });
          expect(outside, "controls outside 0..innerWidth").toEqual([]);
        }

        await page.screenshot({ path: path.join(SHOTS, doc.locale, `${doc.name}-${viewport.width}.png`), fullPage: true, animations: "disabled" });

        // C: held controls, Menu closed.
        const itemNames = await itemNamesOf(doc.locale);
        const ctx: HeldCtx = { locale: doc.locale, itemNames, where: `${doc.url} @${viewport.width} (Menu closed)` };
        const homeOpts = { homeSearch: doc.kind === "home", currencyAllowed: doc.kind === "home", noMoney: doc.kind === "destinations" || doc.kind === "experiences" };
        expect(heldProblems(await surfaceOf(page), ctx, homeOpts), "held controls").toEqual([]);

        // Below the nav row, Login, the cart and the currency would hide inside the Menu: open it and look again.
        if (viewport.width < NAV_ROW_MIN) {
          await page.getByRole("button", { name: HOME_COPY[doc.locale].nav.menu, exact: true }).click();
          expect(heldProblems(await surfaceOf(page), { ...ctx, where: `${doc.url} @${viewport.width} (Menu open)` }, homeOpts), "held controls, Menu open").toEqual([]);
        }
        // SITE-01: on the two new pages the nav marks its own page, and every current-page link is this document.
        if (doc.kind === "destinations" || doc.kind === "experiences") {
          const marked = await page.locator('header a[aria-current="page"]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")));
          expect(marked.length, "a header link is marked current").toBeGreaterThanOrEqual(1);
          const everywhere = await page.locator('a[aria-current="page"]').evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")));
          for (const href of everywhere) expect(href, "every current-page link is this document").toBe(doc.url);
        }
        expect(watched.problems, "console errors after the Menu opened").toEqual([]);
      });
    }
  }
});

// ---- D. /experiences: the overlay and the Filters sheet -----------------------------------------------------------------------

test.describe("experiences overlay and Filters sheet", () => {
  test.setTimeout(120_000);

  for (const locale of LOCALES) {
    for (const viewport of WIDTHS) {
      test(`${locale} /experiences overlay @${viewport.width}: opened from a card, held controls absent, Escape returns to the card`, async ({ page }) => {
        const d = await catalogData(locale);
        await page.setViewportSize(viewport);
        const watched = await watch(page);
        await visitExperiences(page, d.path);

        const first = d.items.find((i) => i.kind === "experience")!;
        const card = catalogCards(page).filter({ hasText: first.name }).first();
        await card.scrollIntoViewIfNeeded();
        await card.click();
        const box = catalogDialog(page, first.name);
        await expect(box).toBeVisible();
        expect(new URL(page.url()).searchParams.get("item"), "?item= is the card's slug").toBe(first.slug);
        await page.waitForTimeout(500);

        const s = await surfaceOf(box);
        const bad = heldProblems(s, { locale, itemNames: d.items.map((i) => i.name), where: `${d.path} overlay @${viewport.width}` }, { homeSearch: false, noMoney: true });
        expect(bad, "held controls inside the overlay").toEqual([]);
        await expect(box.getByRole("link", { name: d.copy.overlay.requestInquiry, exact: true }), "the footer holds Request Inquiry").toHaveCount(1);
        await page.screenshot({ path: path.join(SHOTS, locale, `experiences-overlay-${viewport.width}.png`), fullPage: false, animations: "disabled" });

        await page.keyboard.press("Escape");
        await expect(box).toHaveCount(0);
        expect(new URL(page.url()).searchParams.has("item"), "?item= removed").toBe(false);
        await expect(card.first(), "focus is back on the card").toBeFocused();
        expect(watched.problems).toEqual([]);
        expect(watched.media.missing).toEqual([]);
      });
    }
  }

  for (const locale of LOCALES) {
    for (const viewport of WIDTHS.filter((w) => w.width < 1024)) {
      test(`${locale} /experiences Filters sheet @${viewport.width}: held controls absent, Escape closes it`, async ({ page }) => {
        const d = await catalogData(locale);
        await page.setViewportSize(viewport);
        const watched = await watch(page);
        await visitExperiences(page, d.path);

        await filtersButton(page, d).click();
        const sheet = catalogDialog(page, d.copy.filters.title);
        await expect(sheet).toBeVisible();
        await page.waitForTimeout(500);
        const s = await surfaceOf(sheet);
        expect(heldProblems(s, { locale, itemNames: d.items.map((i) => i.name), where: `${d.path} Filters sheet @${viewport.width}` }, { homeSearch: false, noMoney: true }), "held controls inside the sheet").toEqual([]);
        await page.screenshot({ path: path.join(SHOTS, locale, `experiences-filters-${viewport.width}.png`), fullPage: false, animations: "disabled" });

        await page.keyboard.press("Escape");
        await expect(sheet).toHaveCount(0);
        expect(watched.problems).toEqual([]);
      });
    }
  }
});

// ---- E. /services redirects on local wrangler dev (the Worker of job 10 is in front of the assets) -------------------------------

test.describe("services redirects", () => {
  test.setTimeout(90_000);

  const SERVICES = "/experiences?type=service";
  const DETAILS = ["24-7-private-concierge", "luxury-ground-transport", "vip-airport-meet-greet"];
  const cases: Array<{ source: string; to: string; slug?: string }> = [
    { source: "/services", to: SERVICES },
    { source: "/services/", to: SERVICES },
    ...DETAILS.flatMap((slug) => [
      { source: `/services/${slug}`, to: `${SERVICES}&item=${slug}`, slug },
      { source: `/services/${slug}/`, to: `${SERVICES}&item=${slug}`, slug },
    ]),
    { source: "/services/helicopter-transfers", to: SERVICES },
    { source: "/services/helicopter-transfers/", to: SERVICES },
  ];

  for (const { source, to, slug } of cases) {
    test(`301 ${source} to ${to}, and the landing page shows Services${slug ? " with that service's overlay open" : ""}`, async ({ page, request, baseURL }) => {
      const first = await request.get(source, { maxRedirects: 0 });
      expect(first.status(), `${source} status`).toBe(301);
      const location = new URL(first.headers()["location"], baseURL);
      const want = new URL(to, SITE_ORIGIN);
      expect(location.pathname + location.search, "Location").toBe(want.pathname + want.search);

      const d = await catalogData("en");
      const watched = await watch(page);
      await page.goto(source, { waitUntil: "load" });
      await page.waitForSelector('[data-catalog-ready="true"]', { state: "attached" });
      await page.waitForTimeout(300);
      const landed = new URL(page.url());
      expect(landed.pathname + landed.search, "landing address").toBe(want.pathname + want.search);

      const heads = (await groupHeads(page)).map((h) => h.name);
      expect(heads, "only the Services group is shown").toEqual([d.copy.groups.services]);
      await expect(catalogCards(page), "10 service cards").toHaveCount(10);
      if (slug) {
        const item = await getCatalogItem("en", slug);
        const box = catalogDialog(page, item!.name);
        await expect(box, "the service's overlay is open").toBeVisible();
        await expect(box.locator("h2")).toHaveText(item!.name);
      } else {
        await expect(page.getByRole("dialog"), "no overlay").toHaveCount(0);
      }
      expect(watched.problems).toEqual([]);
    });
  }

  test("/ar/services and /es/services never existed and answer 404", async ({ request }) => {
    for (const source of ["/ar/services", "/es/services"]) {
      expect((await request.get(source, { maxRedirects: 0 })).status(), source).toBe(404);
    }
  });
  test("/ar/services/ and /es/services/ answer 404 too (no rule, design 5.2)", async ({ request }) => {
    for (const source of ["/ar/services/", "/es/services/"]) {
      expect((await request.get(source, { maxRedirects: 0 })).status(), source).toBe(404);
    }
  });
});

// ---- F. JavaScript off ------------------------------------------------------------------------------------------------------------

test.describe("JavaScript off", () => {
  test.setTimeout(90_000);

  for (const locale of LOCALES) {
    test(`${locale} /destinations with JavaScript off: five cards in order, no link in the list, nothing hidden, no intro sentence`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const media = await routeMedia(page);
      const rows = await getDestinations(locale, { includeEmpty: true });
      await page.goto(localePath(locale, "/destinations"), { waitUntil: "load" });
      await page.waitForTimeout(250);
      const cards = page.locator("main ul[role='list'] > li > article");
      await expect(cards).toHaveCount(5);
      expect(await cards.locator("span.font-display").allTextContents(), "names in order").toEqual(rows.map((r) => r.name));
      await expect(page.locator("main ul[role='list'] a"), "no link in the card list").toHaveCount(0);
      // The first hero photo is visible, and every [data-reveal] ancestor (row li, hero overlay) is fully shown.
      await expect(page.locator(`${REGION} img`).first()).toBeVisible();
      const states = await page.locator("[data-reveal]").evaluateAll((els) =>
        els.map((el) => ({ kind: el.getAttribute("data-reveal"), opacity: getComputedStyle(el).opacity, translate: getComputedStyle(el).translate })),
      );
      expect(states.length, "reveal wrappers exist").toBeGreaterThanOrEqual(7);
      for (const s of states) expect(s, `reveal ${s.kind}`).toMatchObject({ opacity: "1", translate: "none" });
      const between = await page.evaluate((region) => {
        const section = document.querySelector(region)!;
        const ul = document.querySelector("main ul[role='list']")!;
        const found: string[] = [];
        for (let n = section.nextElementSibling; n && !n.contains(ul); n = n.nextElementSibling) found.push(n.tagName);
        for (const el of Array.from(ul.parentElement!.children)) if (el !== ul) found.push(el.tagName);
        return found;
      }, REGION);
      expect(between, "no intro sentence between the hero and the cards").toEqual([]);
      expect(media.missing).toEqual([]);
      await context.close();
    });

    test(`${locale} /experiences with JavaScript off: 45 card buttons, no filter control shown`, async ({ browser }) => {
      const context = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      const media = await routeMedia(page);
      const d = await catalogData(locale);
      await page.goto(d.path, { waitUntil: "load" });
      await page.waitForTimeout(250);
      await expect(catalogCards(page)).toHaveCount(45);
      await expect(page.getByRole("searchbox"), "no search field").toBeHidden();
      await expect(page.getByRole("checkbox"), "no checkbox").toBeHidden();
      await expect(page.getByRole("group", { name: d.copy.type.label, exact: true }), "no Type control").toBeHidden();
      await expect(filtersButton(page, d), "no Filters button").toBeHidden();
      expect(media.missing).toEqual([]);
      await context.close();
    });
  }
});

// ---- G. /destinations matched to Framer ------------------------------------------------------------------------------------------------

const tokenSize = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.fontSize = `var(--text-${n})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).fontSize;
    probe.remove();
    return value;
  }, name);

const revealOf = (loc: Locator) =>
  loc.evaluate((el) => {
    const r = el.closest("[data-reveal]")!;
    const s = getComputedStyle(r);
    return { opacity: s.opacity, translate: s.translate };
  });

/** The 1-based number of the dot marked current. */
const shown = (page: Page, prefix: string) =>
  page.evaluate(
    ([region, label]) => {
      const dots = Array.from(document.querySelectorAll(`${region} button[aria-label^="${label}"]`));
      return dots.findIndex((x) => x.getAttribute("aria-current") === "true") + 1;
    },
    [REGION, prefix] as const,
  );

/** A fresh hero page with its clock under the test's control: nothing moves until runFor. Pointer off the slider, nothing focused. */
async function freshHero(context: BrowserContext, locale: Locale, reduced = false, size?: { width: number; height: number }): Promise<Page> {
  const p = await context.newPage();
  if (size) await p.setViewportSize(size);
  await routeMedia(p);
  if (reduced) await p.emulateMedia({ reducedMotion: "reduce" });
  await p.clock.install();
  await p.goto(localePath(locale, "/destinations"), { waitUntil: "load" });
  const copy = DESTINATIONS_PAGE_COPY[locale].slider;
  await expect(p.getByRole("button", { name: fill(copy.goTo, { n: 1 }), exact: true })).toBeVisible();
  await pointerOff(p);
  await p.waitForTimeout(200);
  await p.clock.pauseAt(Date.now() + 2000);
  return p;
}

test.describe("destinations matched to Framer", () => {
  test.setTimeout(240_000);

  for (const locale of LOCALES) {
    for (const viewport of WIDTHS) {
      test(`${locale} /destinations @${viewport.width}: layout, signed sizes, enter animations, hero slideshow`, async ({ page, context }) => {
        const md = viewport.width >= MD;
        const copy = DESTINATIONS_PAGE_COPY[locale];
        const rows = await getDestinations(locale, { includeEmpty: true });
        const dotLabel = (n: number) => fill(copy.slider.goTo, { n });
        const dotPrefix = fill(copy.slider.goTo, { n: 0 }).replace("0", "").trim();
        const interval = AUTOPLAY_MS + 100;

        // -- the test's own page, no fake clock: layout, sizes and the enter animations
        await page.setViewportSize(viewport);
        await routeMedia(page);
        await page.goto(localePath(locale, "/destinations"), { waitUntil: "load" });
        await expect(page.getByRole("button", { name: dotLabel(1), exact: true })).toBeVisible();
        await page.waitForTimeout(300);

        const between = await page.evaluate((region) => {
          const section = document.querySelector(region)!;
          const ul = document.querySelector("main ul[role='list']")!;
          const found: string[] = [];
          for (let n = section.nextElementSibling; n && !n.contains(ul); n = n.nextElementSibling) found.push(n.tagName);
          for (const el of Array.from(ul.parentElement!.children)) if (el !== ul) found.push(el.tagName);
          return found;
        }, REGION);
        expect(between, "no paragraph between the hero and the first card").toEqual([]);

        const items = page.locator("main ul[role='list'] > li");
        const cards = page.locator("main ul[role='list'] > li > article");
        await expect(cards).toHaveCount(5);
        // Enter animations: the fifth card waits below the fold, then rises when scrolled in.
        const before = await revealOf(items.last());
        expect(before.opacity !== "1" || before.translate !== "none", `card 5 starts hidden or offset (${JSON.stringify(before)})`).toBe(true);
        await items.last().scrollIntoViewIfNeeded();
        await expect.poll(() => revealOf(items.last()), { timeout: 3000, intervals: [100] }).toEqual({ opacity: "1", translate: "none" });
        for (let i = 0; i < 4; i += 1) {
          await items.nth(i).scrollIntoViewIfNeeded();
          await expect.poll(() => revealOf(items.nth(i)), { timeout: 3000, intervals: [100] }).toEqual({ opacity: "1", translate: "none" });
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(200);

        // Layout as relationships (S2-23), measured at rest.
        const geo = await page.evaluate(() => {
          const ul = document.querySelector("main ul[role='list']") as HTMLElement;
          const us = getComputedStyle(ul);
          const box = (el: Element) => {
            const r = el.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          };
          const padding = parseFloat(us.paddingLeft) + parseFloat(us.paddingRight);
          return {
            list: box(ul),
            contentWidth: ul.clientWidth - padding,
            column: parseFloat(us.columnGap),
            row: parseFloat(us.rowGap),
            cards: Array.from(document.querySelectorAll("main ul[role='list'] > li > article")).map((a) => ({
              card: box(a),
              photo: box(a.querySelector("img")!),
              name: box(a.querySelector("span.font-display")!),
            })),
          };
        });
        const near = (a: number, b: number, tolerance: number, message: string) => expect(Math.abs(a - b), `${message}: ${a} vs ${b}`).toBeLessThanOrEqual(tolerance);
        const boxes = geo.cards.map((c) => c.card);
        if (md) {
          for (const b of boxes) near(b.width, b.height, 2, "square card");
          near(boxes[0].y, boxes[1].y, 1, "cards 1 and 2 share a row");
          near(boxes[2].y, boxes[3].y, 1, "cards 3 and 4 share a row");
          expect(boxes[4].y, "card 5 is on its own, last row").toBeGreaterThan(boxes[2].y + boxes[2].height - 1);
          const [left, right] = locale === "ar" ? [boxes[1], boxes[0]] : [boxes[0], boxes[1]];
          expect(right.x, "two columns").toBeGreaterThan(left.x);
          near(right.x - (left.x + left.width), geo.column, 1, "column gap equals the list's column-gap");
          near(boxes[2].y - (boxes[0].y + boxes[0].height), geo.row, 1, "row gap equals the list's row-gap");
          near(boxes[4].y - (boxes[2].y + boxes[2].height), geo.row, 1, "row gap before the last row");
          near(boxes[4].x + boxes[4].width / 2, geo.list.x + geo.list.width / 2, 2, "Cocora Valley is centred");
        } else {
          for (const b of boxes) {
            near(b.x, boxes[0].x, 1, "one left edge");
            near(b.width, geo.contentWidth, 1, "as wide as the list's content box");
            expect(Math.abs(b.width / b.height - 7 / 12), `aspect 7:12 (${b.width}x${b.height})`).toBeLessThanOrEqual(0.01);
          }
          for (let i = 1; i < boxes.length; i += 1) near(boxes[i].y - (boxes[i - 1].y + boxes[i - 1].height), geo.row, 1, "row gap");
        }
        for (const c of geo.cards) {
          expect(c.name.x, "the name is inside the photo").toBeGreaterThanOrEqual(c.photo.x - 1);
          expect(c.name.x + c.name.width, "the name is inside the photo").toBeLessThanOrEqual(c.photo.x + c.photo.width + 1);
          expect(c.name.y, "the name is inside the photo").toBeGreaterThanOrEqual(c.photo.y - 1);
          expect(c.name.y + c.name.height, "the name is inside the photo").toBeLessThanOrEqual(c.photo.y + c.photo.height + 1);
        }
        // Sizes are the computed signed tokens at this width (S2-20 corrected), never literals.
        await expect(page.getByRole("heading", { level: 1 })).toHaveCSS("font-size", await tokenSize(page, "hero"));
        const heading = await tokenSize(page, "heading");
        const label = await tokenSize(page, "label");
        for (const [i, row] of rows.entries()) {
          const card = cards.nth(i);
          await expect(card.locator("span.font-display"), `card ${i + 1} name`).toHaveText(row.name);
          await expect(card.locator("span.font-display")).toHaveCSS("font-size", heading);
          await expect(card.getByText(row.region!, { exact: true })).toHaveCSS("font-size", label);
        }

        // -- the hero slideshow, each load a new page on its own clock (S2-24, S2-26)
        const hold = 2 * AUTOPLAY_MS + 200;
        // Load 1: three slides, three dots, a pause control, no arrows; Pause stops it, Play restarts it.
        const one = await freshHero(context, locale);
        await expect(one.locator(`${REGION} [aria-roledescription="slide"]`)).toHaveCount(3);
        await expect(one.locator(`${REGION} button[aria-label^="${dotPrefix}"]`)).toHaveCount(3);
        await expect(one.getByRole("button", { name: copy.slider.pause, exact: true })).toHaveCount(1);
        await expect(one.getByRole("button", { name: copy.slider.previous, exact: true })).toHaveCount(0);
        await expect(one.getByRole("button", { name: copy.slider.next, exact: true })).toHaveCount(0);
        const first = await shown(one, dotPrefix);
        await one.clock.runFor(interval);
        expect(await shown(one, dotPrefix), "the slide changes after one interval").not.toBe(first);
        await one.getByRole("button", { name: copy.slider.pause, exact: true }).click();
        await pointerOff(one);
        await one.waitForTimeout(150);
        const held = await shown(one, dotPrefix);
        await one.clock.runFor(hold);
        expect(await shown(one, dotPrefix), "Pause: no change after two intervals").toBe(held);
        await one.getByRole("button", { name: copy.slider.play, exact: true }).click();
        await pointerOff(one);
        await one.waitForTimeout(150);
        await one.clock.runFor(interval);
        expect(await shown(one, dotPrefix), "Play: a change after one interval").not.toBe(held);
        await one.close();

        // Load 2: hovering the hero holds it.
        const two = await freshHero(context, locale);
        await two.locator(REGION).hover();
        await two.waitForTimeout(150);
        const hovered = await shown(two, dotPrefix);
        await two.clock.runFor(hold);
        expect(await shown(two, dotPrefix), "hover holds the slide").toBe(hovered);
        await pointerOff(two);
        await two.waitForTimeout(150);
        await two.clock.runFor(interval);
        expect(await shown(two, dotPrefix), "it runs again once the pointer is off").not.toBe(hovered);
        await two.close();

        // Load 3: focusing a dot (no click) holds it; blur lets it run.
        const three = await freshHero(context, locale);
        await three.getByRole("button", { name: dotLabel(1), exact: true }).focus();
        await three.waitForTimeout(150);
        const focused = await shown(three, dotPrefix);
        await three.clock.runFor(hold);
        expect(await shown(three, dotPrefix), "focus holds the slide").toBe(focused);
        await pointerOff(three);
        await three.waitForTimeout(150);
        await three.clock.runFor(interval);
        expect(await shown(three, dotPrefix), "it runs again after blur").not.toBe(focused);
        await three.close();

        // Load 4: a dot shows its photo.
        const four = await freshHero(context, locale);
        await four.getByRole("button", { name: dotLabel(3), exact: true }).click();
        await pointerOff(four);
        await four.waitForTimeout(150);
        expect(await shown(four, dotPrefix), "dot 3 shows photo 3").toBe(3);
        await expect(four.getByRole("button", { name: dotLabel(3), exact: true })).toHaveAttribute("aria-current", "true");
        await four.close();
      });
    }

    test(`${locale} /destinations @1440 reduced motion: the slideshow stands still and nothing is hidden`, async ({ context }) => {
      const p = await freshHero(context, locale, true, { width: 1440, height: 900 });
      const prefix = fill(DESTINATIONS_PAGE_COPY[locale].slider.goTo, { n: 0 }).replace("0", "").trim();
      const start = await shown(p, prefix);
      await p.clock.runFor(2 * AUTOPLAY_MS + 200);
      expect(await shown(p, prefix), "no slide change after two intervals").toBe(start);
      const states = await p.locator("[data-reveal]").evaluateAll((els) =>
        els.map((el) => ({ opacity: getComputedStyle(el).opacity, translate: getComputedStyle(el).translate })),
      );
      expect(states.length).toBeGreaterThanOrEqual(7);
      for (const s of states) expect(s).toEqual({ opacity: "1", translate: "none" });
      await p.close();
    });
  }
});
