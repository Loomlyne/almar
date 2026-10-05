import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { FRAMER_SOURCE_COPY } from "../../lib/copy/framer-source";
import { HOME_COPY } from "../../lib/copy/home";
import { HOME_PAGE_COPY } from "../../lib/copy/home-page";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { STAY_DETAIL_COPY } from "../../lib/copy/stay-detail";
import { getDestinations } from "../../lib/data/destinations";
import { LOCALES, SITE_ORIGIN, localeAlternates, localeDir, localePath, siteHref, type Locale } from "../../lib/locale-path";
import { reactDocuments } from "../../scripts/media-lib.mjs";
import { clickClearOfDock } from "../helpers/click-clear-of-dock";
import { routeMedia } from "../helpers/media-route";

// Plan 03.3-08, Task 4. Run on the assembled out/ under local wrangler (playwright.build.config.ts):
//   node scripts/assemble-cloudflare.mjs
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/slice1-sweep.spec.ts --workers=1
//
// Part 1: every one of the 42 documents (3 locales x home, list, 12 stays) is opened at 390, 834 and 1440 and
//   asserted: 200, lang and dir in the SERVED bytes and in the DOM, one h1, no horizontal overflow, four hreflang
//   links that equal the locale helper, no submit and no email field, none of the held controls by name (with the
//   header Menu closed and open), no forbidden host, every image painted. Each document x width saves a full-page
//   screenshot to test-results/slice1/<locale>/<page>-<width>.png (gitignored, never committed).
// Part 2: the controls that no other build spec clicks on a real page (design 4.1 rows 1, 3, 4, 7 and 28).
// Part 3: the crawl files as the Workers rules serve them (production variant) and every sitemap address answering 200.
//
// Job 11 (plan 03.3-47) changed two held-control rows and one slice-wide row, and nothing else:
//   - the home documents carry ONE submit button, the locale's Search (the hero bar is a role=search form); list and stay
//     documents still carry none, and Search is still a held NAME on them;
//   - the stay documents carry the Request on WhatsApp link (wa.me ... ?text=) and no WhatsApp float; home and list keep the float;
//   - every document carries the one light footer (ivory, wordmark, signed content only, Made by Koussay).
//
// Every expected string comes from lib/copy, lib/locale-path or the fixtures, never typed in English for AR or ES.

const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 834, height: 1194 },
  { width: 1440, height: 900 },
] as const;

const NAV_ROW_MIN = 1152; // the nav is a Menu below this width (components/ui/nav.tsx)
const FORBIDDEN_HOSTS = ["framerusercontent.com", "files.catbox.moe", "videos.pexels.com"];
const SHOTS = path.join("test-results", "slice1");

const SLUGS: string[] = (JSON.parse(fs.readFileSync("lib/data/fixtures/stays.json", "utf8")) as Array<{ slug: string; is_published?: boolean }>)
  .filter((stay) => stay.is_published !== false)
  .map((stay) => stay.slug);

type Kind = "home" | "list" | "stay";
const kindOf = (name: string): Kind => (name === "home" ? "home" : name === "private-stays" ? "list" : "stay");

const PAGES = [
  { name: "home", path: "/" },
  { name: "private-stays", path: "/private-stays" },
  ...SLUGS.map((slug) => ({ name: slug, path: `/private-stays/${slug}` })),
];
const DOCUMENTS = LOCALES.flatMap((locale) => PAGES.map((page) => ({ locale, ...page, url: localePath(locale, page.path) })));

const attr = (tag: string, name: string) => new RegExp(`\\s${name}\\s*=\\s*"([^"]*)"`, "i").exec(tag)?.[1] ?? null;

/** React puts __reactProps on a node once it hydrates it: wait for the header Menu button. */
async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector("header button[aria-expanded]");
    return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
  });
}

/** Network idle capped at 10 s, then a short settle (00-common-rules.md). */
async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(500);
}

/** Scroll the page through once so a lazily loaded picture is requested, then back to the top. */
async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => window.innerHeight);
  for (let y = 0; y < height; y += step) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(40);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
}

// ---- the eight held controls and Discover the Journey, by name, in a locale -------------------------------------
//
// Labels come from the copy tables and from the canvas dictionary the boards were drawn from. "See Packages" has no
// translation anywhere (it was only ever drawn in English), so the English string is used in all three locales.

const BOARD = fs.readFileSync(path.join(process.cwd(), ".planning/design/2026-10-01-canvas/boards/PublicStays.dc.html"), "utf8");
function boardWord(key: string, locale: Locale): string {
  const found = BOARD.match(new RegExp(`"${key}":(\\{[^}]*\\})`));
  if (!found) throw new Error(`board key ${key} not found`);
  return (JSON.parse(found[1]) as Record<Locale, string>)[locale];
}

function heldNames(locale: Locale, kind: Kind): string[] {
  const source = FRAMER_SOURCE_COPY[locale] as Record<string, string>;
  const names = [
    ...(kind === "home" ? [] : [JOURNEY_COPY[locale].bar.search]), // 1 Search: live on the home (job 11), held on list and stay
    boardWord("k26", locale), //                   2  cart
    HOME_COPY[locale].nav.login, //                3  Login
    boardWord("k27", locale),
    HOME_COPY[locale].subscribe, //                4  Subscribe (footer newsletter)
    boardWord("k54", locale),
    HOME_COPY[locale].listTitle, //                5  List with us
    boardWord("k52", locale),
    JOURNEY_COPY[locale].addons.add, //            6  Add
    JOURNEY_COPY[locale].addons.continue, //       7  Continue
    JOURNEY_COPY[locale].cart.continue,
    "See Packages", //                             8  See Packages (English only)
    source["Discover the Journey"], //                Discover the Journey
    source["Design your journey"],
  ];
  return [...new Set(names.filter((name): name is string => typeof name === "string" && name.length > 0))];
}

async function expectNoHeldControls(page: Page, locale: Locale, when: string, kind: Kind) {
  const submits = page.locator("button[type=submit], input[type=submit]");
  if (kind === "home") {
    // Job 11: the hero bar is the one form on the home and its Search the one submit, in the locale's own word.
    await expect(submits, `exactly one submit (${when})`).toHaveCount(1);
    // (Read from the text, not the accessible name: below md the desktop bar is display:none and has no accessible name.)
    await expect(submits).toHaveText(JOURNEY_COPY[locale].bar.search);
  } else {
    await expect(submits, `button[type=submit] (${when})`).toHaveCount(0);
  }
  await expect(page.locator("input[type=email]"), `input[type=email] (${when})`).toHaveCount(0);
  for (const name of heldNames(locale, kind)) {
    await expect(page.getByRole("button", { name, exact: true }), `button "${name}" (${when})`).toHaveCount(0);
    await expect(page.getByRole("link", { name, exact: true }), `link "${name}" (${when})`).toHaveCount(0);
  }
}

// ---- job 11: the light footer and the WhatsApp surface, asserted on every document ---------------------------------------

async function expectLightFooter(page: Page, locale: Locale) {
  const copy = SITE_FOOTER_COPY[locale];
  const footer = page.locator("footer");
  await expect(footer, "one footer").toHaveCount(1);
  await expect(footer, "ivory ground").toHaveCSS("background-color", "rgb(255, 250, 240)");
  const mark = footer.getByRole("img", { name: copy.brand });
  await expect(mark, "the wordmark").toHaveCount(1);
  expect(await mark.getAttribute("src"), "Poly_Black is inlined as a data: SVG").toMatch(/^data:image\/svg\+xml/);
  await expect(footer.getByRole("navigation", { name: copy.pages }).getByRole("link"), "Pages").toHaveCount(4);
  await expect(footer.locator("address"), "Contact").toContainText(copy.contact);
  await expect(footer.getByRole("navigation", { name: copy.language }).getByRole("link"), "language links").toHaveCount(3);
  await expect(footer, "copyright").toContainText(copy.copyright);
  const made = footer.getByRole("link", { name: `Koussay ${copy.newTab}` });
  await expect(made, "Made by Koussay").toHaveCount(1);
  await expect(made).toHaveAttribute("href", "https://koussay.com");
  await expect(made).toHaveAttribute("target", "_blank");
  await expect(made).toHaveAttribute("rel", /noopener/);
  await expect(footer).toContainText(copy.madeBy);
  // The signed content only: 4 pages, mail, phone, Instagram, 3 languages, Made by.
  await expect(footer.getByRole("link"), "11 links: no legal, no social but Instagram").toHaveCount(11);
  const hrefs = await footer.locator("a").evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? ""));
  for (const href of hrefs) expect(href, "forbidden footer link").not.toMatch(/facebook|youtube|tiktok|legal|privacy|terms|newsletter/i);
  await expect(footer.locator("input, form, textarea"), "no newsletter, no email field").toHaveCount(0);
  // The phone is a left-to-right island in every language (in Arabic it used to read backwards).
  const phone = footer.locator('address a[href^="tel:"]');
  await expect(phone).toHaveAttribute("dir", "ltr");
  await expect(phone).toHaveCSS("direction", "ltr");
  await expect(phone).toHaveText("+971 56 388 3302");
}

/** Home and list: the float, nowhere a request link. Stay: the request link (never the float). */
async function expectWhatsAppSurface(page: Page, locale: Locale, kind: Kind) {
  const float = page.getByRole("link", { name: "WhatsApp", exact: true });
  // The link's name is the label plus the screen-reader "opens in a new tab" note, so match the label as a substring.
  const request = page.getByRole("link", { name: STAY_DETAIL_COPY[locale].whatsapp.button });
  if (kind === "stay") {
    await expect(float, "no float on a stay page").toHaveCount(0);
    expect(await request.count(), "the request link exists").toBeGreaterThan(0);
    for (const href of await request.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href") ?? ""))) {
      expect(href, "request href").toMatch(/^https:\/\/wa\.me\/971563883302\?text=/);
    }
  } else {
    await expect(float, "the float on home and list").toHaveCount(1);
    await expect(request, "no request link outside a stay page").toHaveCount(0);
  }
}

// ---- part 0 --------------------------------------------------------------------------------------------------------

test("the sweep list is 42 documents and each one is an assembled file", () => {
  expect(DOCUMENTS).toHaveLength(42);
  expect(PAGES).toHaveLength(14);
  expect(new Set(DOCUMENTS.map((doc) => doc.url)).size).toBe(42);
  for (const doc of DOCUMENTS) {
    const file = doc.url.endsWith("/") ? `${doc.url.slice(1)}index.html` : `${doc.url.slice(1)}.html`;
    expect(fs.existsSync(path.join("out", file)), `out/${file}`).toBe(true);
  }
});

// ---- part 1: 42 documents x 3 widths -------------------------------------------------------------------------------

test.describe("sweep", () => {
  test.setTimeout(90_000);

  for (const doc of DOCUMENTS) {
    for (const viewport of VIEWPORTS) {
      test(`${doc.locale} ${doc.url} at ${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        const problems: string[] = [];
        page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
        page.on("console", (message) => {
          if (message.type() === "error") problems.push(`console error: ${message.text()}`);
        });
        const media = await routeMedia(page);

        const response = await page.goto(doc.url, { waitUntil: "load" });
        expect(response?.status(), "status").toBe(200);
        expect(response?.request().redirectedFrom(), "no redirect").toBeNull();

        // lang, dir and the hreflang links in the bytes the server sent, before any script could change or repair them.
        const raw = (await response?.text()) ?? "";
        const tag = /<html\b[^>]*>/i.exec(raw)?.[0] ?? "";
        expect(attr(tag, "lang"), "served lang").toBe(doc.locale);
        expect(attr(tag, "dir"), "served dir").toBe(localeDir(doc.locale));
        const servedAlternates = [...raw.matchAll(/<link\b[^>]*>/gi)]
          .map((match) => match[0])
          .filter((link) => /hreflang/i.test(link))
          .map((link) => [attr(link, "hreflang"), attr(link, "href")]);
        expect(servedAlternates, "four hreflang links in the served bytes").toHaveLength(4);
        expect(Object.fromEntries(servedAlternates), "served hreflang links").toEqual(localeAlternates(doc.locale, doc.path).languages);

        await hydrated(page);
        await settle(page);
        await scrollThrough(page);

        expect(await page.evaluate(() => document.documentElement.lang), "DOM lang").toBe(doc.locale);
        expect(await page.evaluate(() => document.documentElement.dir), "DOM dir").toBe(localeDir(doc.locale));
        await expect(page.locator("h1"), "exactly one h1").toHaveCount(1);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow, "horizontal overflow in px").toBeLessThanOrEqual(0);

        const alternates = await page
          .locator('link[rel="alternate"][hreflang]')
          .evaluateAll((nodes) => nodes.map((node) => [node.getAttribute("hreflang"), node.getAttribute("href")]));
        expect(alternates, "four hreflang links").toHaveLength(4);
        expect(Object.fromEntries(alternates)).toEqual(localeAlternates(doc.locale, doc.path).languages);

        // Job 11: a picture with no box (the Welcome photos below md) and a lazy strip or slideshow photo the browser has not
        // asked for yet (off to the side of its track) cannot be "unpainted"; every other picture must have painted.
        const unpainted = await page
          .locator("img")
          .evaluateAll((nodes) =>
            (nodes as HTMLImageElement[])
              .filter((n) => n.getClientRects().length > 0 && !(n.loading === "lazy" && !n.currentSrc))
              .filter((n) => !n.complete || n.naturalWidth === 0)
              .map((n) => n.src),
          );
        expect(unpainted, "images that did not paint").toEqual([]);
        expect(media.missing, "image keys the manifest does not know").toEqual([]);

        const html = await page.content();
        for (const host of FORBIDDEN_HOSTS) expect(html.includes(host), `${host} in the DOM`).toBe(false);

        await expectNoHeldControls(page, doc.locale, "Menu closed", kindOf(doc.name));
        await expectLightFooter(page, doc.locale);
        await expectWhatsAppSurface(page, doc.locale, kindOf(doc.name));

        const file = path.join(SHOTS, doc.locale, `${doc.name}-${viewport.width}.png`);
        await page.screenshot({ path: file, fullPage: true, animations: "disabled" });

        // Below the nav row's width Login and the cart would hide inside the Menu: open it and look again.
        if (viewport.width < NAV_ROW_MIN) {
          await page.getByRole("button", { name: HOME_COPY[doc.locale].nav.menu, exact: true }).click();
          await expectNoHeldControls(page, doc.locale, "Menu open", kindOf(doc.name));
        }
        expect(problems, "page errors and console errors").toEqual([]);
      });
    }
  }
});

// ---- part 2: controls no other build spec clicks on a real page ---------------------------------------------------------
//
// Design 4.1 rows 1 (nav links), 3 (Menu), 4 (Skip to content), 7 (WhatsApp) and 28 (footer links). The pages these
// links lead to that are still Framer documents load their scripts from a CDN: the tests follow the link and read
// the document, and abort every request that is not to the local server.

const NAV = ["destinations", "experiences", "about", "contact"] as const;

/** One page of each kind: the home (nav over the hero), the list, and a stay page (pinned dock). */
const UNDER_TEST = [
  { kind: "home", path: "/" },
  { kind: "list", path: "/private-stays" },
  { kind: "stay", path: `/private-stays/${SLUGS[0]}` },
] as const;

async function offlineExceptLocal(page: Page, baseURL: string) {
  const host = new URL(baseURL).host;
  await page.route((url) => url.host !== host, (route) => route.abort());
}

/** Click a link and prove the document of its own address answers 200. */
async function followLink(page: Page, click: () => Promise<void>, expectedPath: string, label: string) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === expectedPath),
    click(),
  ]);
  expect(response.status(), `${label}: status`).toBe(200);
  expect(response.request().redirectedFrom(), `${label}: no redirect`).toBeNull();
  expect(new URL(page.url()).pathname, `${label}: address`).toBe(expectedPath);
}

for (const locale of LOCALES) {
  const nav = HOME_COPY[locale].nav;
  const footer = SITE_FOOTER_COPY[locale];

  for (const under of UNDER_TEST) {
    const here = localePath(locale, under.path);
    const where = `${locale} ${under.kind}`;

    test.describe(`controls ${where}`, () => {
      test.setTimeout(90_000);

      // Row 1: the four nav links, in the row at 1440. (Offline except the local server: the Framer pages load a CDN.)
      test(`row 1 nav links: Destinations, Experiences, About, Contact each go to their page (${where} at 1440)`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await offlineExceptLocal(page, baseURL!);
        await routeMedia(page);
        for (const key of NAV) {
          await page.goto(here);
          await hydrated(page);
          const link = page.getByRole("navigation", { name: "Primary" }).getByRole("link", { name: nav[key], exact: true });
          await expect(link, key).toHaveCount(1);
          await expect(link).toBeVisible();
          const href = siteHref(locale, `/${key}`);
          await expect(link).toHaveAttribute("href", href);
          await followLink(page, () => link.click(), href, key);
        }
      });

      // Row 1 on a phone: the links are inside the Menu.
      test(`row 1 nav link inside the Menu (${where} at 390)`, async ({ page, baseURL }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await offlineExceptLocal(page, baseURL!);
        await routeMedia(page);
        await page.goto(here);
        await hydrated(page);
        const primary = page.getByRole("navigation", { name: "Primary" });
        await expect(primary.getByRole("link", { name: nav.contact, exact: true }), "hidden until the Menu is opened").toBeHidden();
        await page.getByRole("button", { name: nav.menu, exact: true }).click();
        const link = primary.getByRole("link", { name: nav.contact, exact: true });
        await expect(link).toBeVisible();
        await followLink(page, () => link.click(), siteHref(locale, "/contact"), "Contact in the Menu");
      });

      // Row 3: the Menu on a phone and a tablet.
      for (const width of [390, 834]) {
        test(`row 3 Menu: opens, holds the page, Close and Escape close it and focus returns (${where} at ${width})`, async ({ page }) => {
          await page.setViewportSize({ width, height: width === 390 ? 844 : 1194 });
          await routeMedia(page);
          await page.goto(here);
          await hydrated(page);
          const menu = page.getByRole("button", { name: nav.menu, exact: true });
          const close = page.getByRole("button", { name: nav.close, exact: true });
          const primary = page.getByRole("navigation", { name: "Primary" });
          await expect(menu).toHaveAttribute("aria-expanded", "false");
          await expect(primary).toBeHidden();

          await menu.click();
          await expect(menu).toBeHidden();
          await expect(close).toBeVisible();
          await expect(close, "focus moves into the open menu").toBeFocused();
          await expect(primary).toBeVisible();
          await expect(primary.getByRole("link")).toHaveCount(4);
          expect(await page.evaluate(() => document.body.style.overflow), "the page behind does not scroll").toBe("hidden");

          await page.keyboard.press("Escape");
          await expect(primary).toBeHidden();
          await expect(menu).toBeVisible();
          await expect(menu, "Escape returns focus to the Menu button").toBeFocused();
          expect(await page.evaluate(() => document.body.style.overflow)).not.toBe("hidden");

          await menu.click();
          await expect(primary).toBeVisible();
          await close.click();
          await expect(primary).toBeHidden();
          await expect(menu).toBeFocused();
        });
      }

      // Row 4: Skip to content.
      test(`row 4 Skip to content: the first Tab stop, visible, and Enter lands in the content (${where} at 1440)`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await routeMedia(page);
        await page.goto(here);
        await hydrated(page);
        await page.keyboard.press("Tab");
        const skip = page.getByRole("link", { name: HOME_COPY[locale].skip, exact: true });
        await expect(skip).toBeFocused();
        await expect(skip, "visible while focused").toBeVisible();
        const box = (await skip.boundingBox())!;
        expect(box.x + box.width).toBeGreaterThan(0);
        expect(box.y).toBeGreaterThanOrEqual(0);
        await page.keyboard.press("Enter");
        await expect.poll(() => new URL(page.url()).hash).toBe("#content");
        await page.keyboard.press("Tab");
        expect(await page.evaluate(() => !!document.activeElement?.closest("main#content")), "the next Tab stop is inside <main id=content>").toBe(true);
      });

      // Row 7 on a stay page (job 11): no float; the Request on WhatsApp link opens wa.me with the page's message in a new tab.
      for (const width of under.kind === "stay" ? [390, 834, 1440] : []) {
        test(`row 7 request link: no float, wa.me ?text= in a new tab (${where} at ${width})`, async ({ page, context }) => {
          await page.setViewportSize({ width, height: 900 });
          await routeMedia(page);
          const requested: string[] = [];
          await context.route("https://wa.me/**", (route) => {
            requested.push(route.request().url());
            return route.fulfill({ status: 200, contentType: "text/html", body: "<title>wa</title>" });
          });
          await page.goto(here);
          await hydrated(page);
          await expect(page.getByRole("link", { name: "WhatsApp", exact: true }), "no float").toHaveCount(0);
          const request = page.getByRole("link", { name: STAY_DETAIL_COPY[locale].whatsapp.button }).first();
          await expect(request).toBeVisible();
          await expect(request).toHaveAttribute("href", /^https:\/\/wa\.me\/971563883302\?text=/);
          await expect(request).toHaveAttribute("target", "_blank");
          await expect(request).toHaveAttribute("rel", /noopener/);
          const [popup] = await Promise.all([page.waitForEvent("popup"), request.click()]);
          await popup.waitForLoadState("domcontentloaded");
          expect(popup.url()).toMatch(/^https:\/\/wa\.me\/971563883302\?text=/);
          expect(requested).toHaveLength(1);
          expect(new URL(page.url()).pathname, "the page itself did not navigate").toBe(here);
        });
      }

      // Row 7: the WhatsApp float (home and list).
      for (const width of under.kind === "stay" ? [] : [390, 1440]) {
        test(`row 7 WhatsApp float: one link to the owner's number, opening in a new tab (${where} at ${width})`, async ({ page, context }) => {
          await page.setViewportSize({ width, height: 900 });
          await routeMedia(page);
          const requested: string[] = [];
          await context.route("https://wa.me/**", (route) => {
            requested.push(route.request().url());
            return route.fulfill({ status: 200, contentType: "text/html", body: "<title>wa</title>" });
          });
          await page.goto(here);
          await hydrated(page);
          const float = page.getByRole("link", { name: "WhatsApp", exact: true });
          await expect(float).toHaveCount(1);
          await expect(float).toBeVisible();
          await expect(float).toHaveAttribute("href", "https://wa.me/971563883302");
          await expect(float).toHaveAttribute("target", "_blank");
          await expect(float).toHaveAttribute("rel", /noopener/);
          const [popup] = await Promise.all([page.waitForEvent("popup"), float.click()]);
          await popup.waitForLoadState("domcontentloaded");
          expect(popup.url()).toBe("https://wa.me/971563883302");
          expect(requested).toEqual(["https://wa.me/971563883302"]);
          expect(new URL(page.url()).pathname, "the page itself did not navigate").toBe(here);
        });
      }

      // Row 28: footer links. The four pages are followed; the mail, phone and Instagram links are read and clicked.
      test(`row 28 footer links: pages, mail, phone and Instagram (${where} at 1440)`, async ({ page, baseURL, context }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await offlineExceptLocal(page, baseURL!);
        await routeMedia(page);
        const instagramRequests: string[] = [];
        await context.route("https://www.instagram.com/**", (route) => {
          instagramRequests.push(route.request().url());
          return route.fulfill({ status: 200, contentType: "text/html", body: "<title>ig</title>" });
        });

        for (const key of NAV) {
          await page.goto(here);
          await hydrated(page);
          const pages = page.locator("footer").getByRole("navigation", { name: footer.pages });
          await expect(pages.getByRole("link")).toHaveCount(4);
          const link = pages.getByRole("link", { name: nav[key], exact: true });
          const href = siteHref(locale, `/${key}`);
          await expect(link).toHaveAttribute("href", href);
          await followLink(page, () => clickClearOfDock(link), href, `footer ${key}`);
        }

        await page.goto(here);
        await hydrated(page);
        const address = page.locator("footer address");
        const mail = address.locator('a[href^="mailto:"]');
        const phone = address.locator('a[href^="tel:"]');
        await expect(mail).toHaveCount(1);
        await expect(mail).toHaveAttribute("href", "mailto:inquiries@almarprivatejourney.com");
        await expect(mail).toHaveText("inquiries@almarprivatejourney.com");
        await expect(phone).toHaveCount(1);
        await expect(phone).toHaveAttribute("href", "tel:+971563883302");
        await expect(phone).toHaveText("+971 56 388 3302");
        for (const link of [mail, phone]) {
          await link.focus();
          await expect(link, "reachable by keyboard").toBeFocused();
          await clickClearOfDock(link);
          expect(new URL(page.url()).pathname, "a mail or phone link does not navigate the page").toBe(here);
        }

        const instagram = address.getByRole("link", { name: new RegExp(`^${footer.instagram}`) });
        await expect(instagram).toHaveCount(1);
        await expect(instagram).toHaveAttribute("href", "https://www.instagram.com/almarprivatejourney/");
        await expect(instagram).toHaveAttribute("target", "_blank");
        const [popup] = await Promise.all([page.waitForEvent("popup"), clickClearOfDock(instagram)]);
        await popup.waitForLoadState("domcontentloaded");
        expect(popup.url()).toBe("https://www.instagram.com/almarprivatejourney/");
        expect(instagramRequests).toEqual(["https://www.instagram.com/almarprivatejourney/"]);
      });
    });
  }
}

// Row 28b (job 11): the light footer on home, list and one stay, in each locale, at a phone and a desktop width, and the
// Made by link opened for real.
for (const locale of LOCALES) {
  for (const under of UNDER_TEST) {
    for (const width of [390, 1440]) {
      test(`row 28b footer: light, signed content only, Made by Koussay, phone left to right (${locale} ${under.kind} at ${width})`, async ({ page, context }) => {
        await page.setViewportSize({ width, height: 900 });
        await routeMedia(page);
        const requested: string[] = [];
        await context.route("https://koussay.com/**", (route) => {
          requested.push(route.request().url());
          return route.fulfill({ status: 200, contentType: "text/html", body: "<title>k</title>" });
        });
        await page.goto(localePath(locale, under.path));
        await hydrated(page);
        await expectLightFooter(page, locale);
        const made = page.locator("footer").getByRole("link", { name: `Koussay ${SITE_FOOTER_COPY[locale].newTab}` });
        const [popup] = await Promise.all([page.waitForEvent("popup"), clickClearOfDock(made)]);
        await popup.waitForLoadState("domcontentloaded");
        expect(popup.url()).toMatch(/^https:\/\/koussay\.com\/?$/);
        expect(requested).toHaveLength(1);
      });
    }
  }
}

// Row 11: the segment states on the real hero bar (the harness baselines in tests/journey cover the same states on a scene).
for (const locale of LOCALES) {
  test(`row 11 segment states: empty, hover, open and filled (${locale} home at 1440)`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await routeMedia(page);
    await page.goto(localePath(locale, "/"));
    await hydrated(page);
    const journey = JOURNEY_COPY[locale];
    // Job 11: with Search wired the hero bar is a role="search" form (plan 03.3-43), no longer a group.
    const bar = page.getByRole("region", { name: HOME_PAGE_COPY[locale].hero.barLabel }).getByRole("search", { name: journey.bar.label });
    const where = bar.getByRole("button", { name: journey.bar.destination.label });
    const first = (await getDestinations(locale))[0];

    await expect(where, "empty").toContainText(journey.bar.destination.empty);
    await expect(where).toHaveAttribute("aria-expanded", "false");
    await where.hover();
    await expect(where, "hover puts the segment on the surface colour").toHaveCSS("background-color", "rgb(255, 255, 255)");

    await where.click();
    await expect(where, "open").toHaveAttribute("aria-expanded", "true");
    expect(await where.evaluate((node) => getComputedStyle(node).boxShadow), "an open segment carries the inset rule").not.toBe("none");

    await page.getByRole("listbox", { name: journey.menu.label }).getByRole("option", { name: new RegExp(first.name) }).click();
    await expect(where, "filled").toContainText(first.name);
    await expect(where).not.toContainText(journey.bar.destination.empty);
  });
}

// ---- part 3: the crawl files as served ---------------------------------------------------------------------------------

test.describe("crawl files as the Workers rules serve them (production variant of out/)", () => {
  test("robots.txt allows and names the sitemap; no page carries X-Robots-Tag", async ({ request }) => {
    const robots = await request.get("/robots.txt");
    expect(robots.status()).toBe(200);
    const body = await robots.text();
    expect(body).toMatch(/^Allow: \/$/m);
    expect(body).not.toMatch(/^Disallow:\s*\/\s*$/m);
    expect(body.split("\n")).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);

    for (const doc of DOCUMENTS.filter((d) => d.name === "home" || d.name === "private-stays")) {
      const page = await request.get(doc.url);
      expect(page.status(), doc.url).toBe(200);
      expect(page.headers()["x-robots-tag"], `x-robots-tag on ${doc.url}`).toBeUndefined();
    }
    const missing = await request.get("/nope");
    expect(missing.status()).toBe(404);
    expect(missing.headers()["x-robots-tag"]).toBeUndefined();
  });

  test("sitemap.xml lists the React documents with alternates and every address answers 200 without a redirect", async ({ request }) => {
    test.setTimeout(120_000);
    const response = await request.get("/sitemap.xml");
    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toMatch(/xml/);
    const xml = await response.text();
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    expect(new Set(locs).size, "no address twice").toBe(locs.length);
    // Every React document (slice 1's 42 plus the blog's 12 today) carries alternates: the count is computed from the fixtures, not typed.
    expect((xml.match(/hreflang="x-default"/g) ?? []).length, "every React document carries alternates").toBe(reactDocuments().length);

    // The 42 documents of this slice are all listed, once each, at the address the locale helper builds.
    for (const doc of DOCUMENTS) expect(locs, doc.url).toContain(SITE_ORIGIN + doc.url);

    // Every listed address, fetched from the local server (the sitemap's origin is the live site's).
    for (const loc of locs) {
      const pathname = new URL(loc).pathname;
      const served = await request.get(pathname, { maxRedirects: 0 });
      expect(served.status(), `${pathname} must answer 200 itself (a 307 means the sitemap lists a non-canonical form)`).toBe(200);
    }
  });
});
