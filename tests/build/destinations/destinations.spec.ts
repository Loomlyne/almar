import fs from "node:fs";
import path from "node:path";
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { DESTINATIONS_PAGE_COPY } from "../../../lib/copy/destinations-page";
import { HOME_COPY } from "../../../lib/copy/home";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { getDestinations, getDestinationsPageHero } from "../../../lib/data/destinations";
import { MEDIA_BASE_URL } from "../../../lib/data/media";
import { SITE_ORIGIN, localePath, type Locale } from "../../../lib/locale-path";
import { pointerOff } from "../../helpers/pointer-off";
import { routeMedia, type MediaRoute } from "../../helpers/media-route";

// Phase 3.3 plan 13. The React /destinations page in EN, AR and ES, proven in a browser on the assembled out/ (plan 03's build
// config, local wrangler dev): the Framer layout, the hero controls, job 11's animations, the held controls. Expected values come
// from the copy file, the data layer, the board dictionary, job 11's AUTOPLAY_MS and the tokens computed in the page, never typed.
//   node scripts/assemble-cloudflare.mjs --target=local
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/destinations --workers=1

const LOCALES: Locale[] = ["en", "ar", "es"];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 834, height: 1194 },
  { width: 1440, height: 900 },
];
const PATH = "/destinations";
const FORBIDDEN_HOSTS = ["framerusercontent.com", "files.catbox.moe", "videos.pexels.com"];
const NEXT_LOCALE: Record<Locale, Locale> = { en: "ar", ar: "es", es: "en" };
const NATIVE_NAME: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };
const AUTOPLAY_MS = Number(/export const AUTOPLAY_MS = (\d+)/.exec(fs.readFileSync("components/ui/slider.tsx", "utf8"))![1]);
const WAIT = AUTOPLAY_MS + 1000;
const REGION = '[aria-roledescription="carousel"]';
const MD = 768;

type Data = Awaited<ReturnType<typeof load>>;
const cache = new Map<Locale, Promise<Data>>();
async function load(locale: Locale) {
  return {
    locale,
    path: localePath(locale, PATH),
    hero: await getDestinationsPageHero(locale),
    rows: await getDestinations(locale, { includeEmpty: true }),
    copy: DESTINATIONS_PAGE_COPY[locale],
    nav: HOME_COPY[locale].nav,
    journey: JOURNEY_COPY[locale],
  };
}
const data = (locale: Locale): Promise<Data> => {
  if (!cache.has(locale)) cache.set(locale, load(locale));
  return cache.get(locale)!;
};

const BOARD = fs.readFileSync(path.join(process.cwd(), ".planning/design/2026-10-01-canvas/boards/PublicDestinations.dc.html"), "utf8");
/** The board word whose English value is `en` (Cart, Login), in `locale`. */
function boardWordByEn(en: string, locale: Locale): string {
  const m = [...BOARD.matchAll(/"k\d+":(\{[^}]*\})/g)].map((x) => JSON.parse(x[1]) as Record<Locale, string>).find((w) => w.en === en);
  if (!m) throw new Error(`board word ${en} not found`);
  return m[locale];
}
const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const fill = (template: string, n: number) => template.replace("{n}", String(n));

type Watch = { media: MediaRoute; hosts: Set<string>; errors: string[]; mediaRequests: string[] };

const test = base.extend<{ watch: Watch }>({
  watch: [
    async ({ page }, use) => {
      const media = await routeMedia(page);
      const watch: Watch = { media, hosts: new Set(), errors: [], mediaRequests: [] };
      page.on("request", (request) => {
        watch.hosts.add(new URL(request.url()).host);
        if (request.url().startsWith(`${MEDIA_BASE_URL}/`)) watch.mediaRequests.push(request.url());
      });
      page.on("pageerror", (error) => watch.errors.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") watch.errors.push(`console: ${message.text()}`);
      });
      await use(watch);
      expect(watch.media.missing, "image keys the manifest does not know").toEqual([]);
      expect(watch.errors, "page errors and console errors (a hydration mismatch shows up here)").toEqual([]);
      for (const host of FORBIDDEN_HOSTS) expect([...watch.hosts], `a request went to ${host}`).not.toContain(host);
    },
    { auto: true },
  ],
});

// ---- helpers ----------------------------------------------------------------------------------------------------

const dot = (page: Page, d: Data, n: number) => page.getByRole("button", { name: fill(d.copy.slider.goTo, n), exact: true });
const cards = (page: Page) => page.locator("main ul[role='list'] > li > article");
const items = (page: Page) => page.locator("main ul[role='list'] > li");
const list = (page: Page) => page.locator("main ul[role='list']");

/** goto, network idle capped at 10 s, hydration (the dots only exist once the slider is enhanced), a short settle, then the pointer off the slider. */
async function visit(page: Page, d: Data) {
  await page.goto(d.path, { waitUntil: "load" });
  try {
    await page.waitForLoadState("networkidle", { timeout: 10_000 });
  } catch {
    // A cold run can keep a connection open; the hydration wait below is the real gate.
  }
  await expect(dot(page, d, 1)).toBeVisible();
  await page.waitForTimeout(250);
  await pointerOff(page);
}

/** The 1-based number of the dot marked current. */
const shown = (page: Page, d: Data) =>
  page.evaluate(
    ([region, label]) => {
      const dots = Array.from(document.querySelectorAll(`${region} button[aria-label^="${label}"]`));
      return dots.findIndex((x) => x.getAttribute("aria-current") === "true") + 1;
    },
    [REGION, fill(d.copy.slider.goTo, 0).replace("0", "").trim()] as const,
  );

/** The pixel size a type token computes to at the current width (the tokens move below 48rem). */
const tokenSize = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.fontSize = `var(--text-${n})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).fontSize;
    probe.remove();
    return value;
  }, name);

const colorToken = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--color-${n})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);

const revealState = (loc: Locator) =>
  loc.evaluate((el) => {
    const r = el.closest("[data-reveal]")!;
    const s = getComputedStyle(r);
    return { opacity: s.opacity, translate: s.translate };
  });

async function openMenuIfCollapsed(page: Page, d: Data): Promise<boolean> {
  const menu = page.getByRole("button", { name: d.nav.menu, exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    return true;
  }
  return false;
}

// ---- 1. the served document, once per locale ----------------------------------------------------------------------

for (const locale of LOCALES) {
  test(`served document ${locale}: first-byte lang and dir, four hreflang links, canonical`, async ({ request }) => {
    const d = await data(locale);
    const response = await request.get(d.path);
    expect(response.status()).toBe(200);
    const html = await response.text();
    expect(html).toMatch(new RegExp(`^<!DOCTYPE html>(?:<!--[^>]*-->)?<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"[ >]`));
    const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>/gi)].map((m) => [m[1], m[2]]);
    const origin = (l: Locale) => `${SITE_ORIGIN}${localePath(l, PATH)}`;
    expect(Object.fromEntries(alternates)).toEqual({ en: origin("en"), ar: origin("ar"), es: origin("es"), "x-default": origin("en") });
    expect(alternates).toHaveLength(4);
    expect(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]).toBe(origin(locale));
  });
}

// ---- 2. per locale and width ----------------------------------------------------------------------------------------

for (const locale of LOCALES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${locale} ${viewport.width}`, () => {
      test.use({ viewport });
      const md = viewport.width >= MD;

      test("1. hero: full width, three slides, kicker and h1 centred in ivory at the --text-hero size, no sentence, no arrows", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d);
        const slider = (await page.locator(REGION).boundingBox())!;
        expect(Math.round(slider.width)).toBe(viewport.width);
        await expect(page.locator(`${REGION} [aria-roledescription="slide"]`)).toHaveCount(3);
        const visible = await page.locator(`${REGION} [aria-roledescription="slide"]`).evaluateAll(
          (slides, w) =>
            slides.filter((s) => {
              const r = s.getBoundingClientRect();
              return r.left + r.width / 2 >= 0 && r.left + r.width / 2 < w;
            }).length,
          viewport.width,
        );
        expect(visible).toBe(1);
        const h1 = page.getByRole("heading", { level: 1 });
        await expect(h1).toHaveText(d.copy.heading);
        const kicker = page.locator(REGION).getByText(d.copy.kicker, { exact: true });
        for (const box of [(await h1.boundingBox())!, (await kicker.boundingBox())!]) {
          expect(Math.abs(box.x + box.width / 2 - viewport.width / 2)).toBeLessThanOrEqual(2);
        }
        await expect(h1).toHaveCSS("font-size", await tokenSize(page, "hero"));
        await expect(h1).toHaveCSS("color", await colorToken(page, "ivory"));
        const between = await page.evaluate((region) => {
          const section = document.querySelector(region)!;
          const ul = document.querySelector("main ul[role='list']")!;
          const found: string[] = [];
          for (let n = section.nextElementSibling; n && !n.contains(ul); n = n.nextElementSibling) found.push(n.tagName);
          const wrap = ul.parentElement!;
          for (const el of Array.from(wrap.children)) if (el !== ul) found.push(el.tagName);
          return found;
        }, REGION);
        expect(between, "elements between the hero and the card list").toEqual([]);
        await expect(page.getByRole("button", { name: d.copy.slider.previous, exact: true })).toHaveCount(0);
        await expect(page.getByRole("button", { name: d.copy.slider.next, exact: true })).toHaveCount(0);
      });

      test("2a. Pause holds the slide and its name becomes Play; Play runs it again", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d);
        await page.getByRole("button", { name: d.copy.slider.pause, exact: true }).click();
        await pointerOff(page);
        const held = await shown(page, d);
        await page.waitForTimeout(WAIT);
        expect(await shown(page, d)).toBe(held);
        await expect(page.getByRole("button", { name: d.copy.slider.play, exact: true })).toBeVisible();
        await page.getByRole("button", { name: d.copy.slider.play, exact: true }).click();
        await pointerOff(page);
        await expect.poll(() => shown(page, d), { timeout: WAIT }).not.toBe(held);
      });

      test("2b. hovering the slider holds it; moving the pointer off runs it again", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d);
        await page.locator(REGION).hover();
        const held = await shown(page, d);
        await page.waitForTimeout(WAIT);
        expect(await shown(page, d)).toBe(held);
        await pointerOff(page);
        await expect.poll(() => shown(page, d), { timeout: WAIT }).not.toBe(held);
      });

      test("2c. keyboard focus on a dot (no click) holds it; blur runs it again", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d);
        // A keyboard arrival: Tab into the first control of the page's slider (focus-visible), no pointer involved.
        await dot(page, d, 1).focus();
        await page.keyboard.press("Shift+Tab");
        await page.keyboard.press("Tab");
        const held = await shown(page, d);
        await page.waitForTimeout(WAIT);
        expect(await shown(page, d)).toBe(held);
        await pointerOff(page);
        await expect.poll(() => shown(page, d), { timeout: WAIT }).not.toBe(held);
      });

      test("2d. a dot shows that photo, marks it current and stops the slideshow for good", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d);
        await dot(page, d, 2).click();
        await pointerOff(page);
        expect(await shown(page, d)).toBe(2);
        await expect(dot(page, d, 2)).toHaveAttribute("aria-current", "true");
        await page.waitForTimeout(WAIT);
        expect(await shown(page, d)).toBe(2);
      });

      test("3. cards: five articles in data order, name on the photo, pin and region, the Framer grid and the tokens", async ({ page }) => {
        const d = await data(locale);
        // Reduced motion: no card is shifted by its entry offset, so the boxes below are the resting layout.
        await page.emulateMedia({ reducedMotion: "reduce" });
        await visit(page, d);
        await expect(cards(page)).toHaveCount(5);
        const heading = await tokenSize(page, "heading");
        const label = await tokenSize(page, "label");
        const boxes: { x: number; y: number; width: number; height: number }[] = [];
        for (const [i, row] of d.rows.entries()) {
          const card = cards(page).nth(i);
          await expect(card.locator("span.font-display")).toHaveText(row.name);
          await expect(card.locator("span.font-display")).toHaveCSS("font-size", heading);
          await expect(card.locator("span.font-display")).toHaveCSS("text-transform", locale === "ar" ? "none" : "uppercase");
          await expect(card.locator("svg")).toHaveCount(1);
          await expect(card.getByText(row.region!, { exact: true })).toBeVisible();
          await expect(card.getByText(row.region!, { exact: true })).toHaveCSS("font-size", label);
          await expect(card.locator("img")).toHaveAttribute("src", row.hero_image!.url);
          await expect(card.locator("img")).toHaveAttribute("alt", row.hero_image!.alt);
          boxes.push((await card.boundingBox())!);
        }
        const ul = list(page);
        const ulBox = (await ul.boundingBox())!;
        const gaps = await ul.evaluate((el) => {
          const s = getComputedStyle(el);
          return { column: parseFloat(s.columnGap), row: parseFloat(s.rowGap), width: el.clientWidth };
        });
        // A bottom shade over every photo.
        await expect(cards(page).first().locator("span[aria-hidden='true']")).toHaveCount(1);
        if (md) {
          for (const box of boxes) expect(Math.abs(box.width - box.height)).toBeLessThanOrEqual(2);
          expect(boxes[0].x).not.toBe(boxes[1].x);
          const [near, far] = locale === "ar" ? [boxes[1], boxes[0]] : [boxes[0], boxes[1]];
          expect(far.x).toBeGreaterThan(near.x);
          expect(Math.abs(far.x - (near.x + near.width) - gaps.column)).toBeLessThanOrEqual(1);
          expect(Math.abs(boxes[0].width - (gaps.width - gaps.column) / 2)).toBeLessThanOrEqual(2);
          expect(Math.abs(boxes[1].y - boxes[0].y)).toBeLessThanOrEqual(1);
          expect(Math.abs(boxes[4].x + boxes[4].width / 2 - (ulBox.x + ulBox.width / 2))).toBeLessThanOrEqual(2);
          expect(boxes[4].y).toBeGreaterThan(boxes[2].y);
        } else {
          for (const box of boxes) {
            expect(Math.abs(box.x - boxes[0].x)).toBeLessThanOrEqual(1);
            expect(Math.abs(box.width - gaps.width)).toBeLessThanOrEqual(1);
            expect(Math.abs(box.height / box.width - 12 / 7) / (12 / 7)).toBeLessThanOrEqual(0.01);
          }
          for (let i = 1; i < boxes.length; i += 1) {
            expect(Math.abs(boxes[i].y - (boxes[i - 1].y + boxes[i - 1].height) - gaps.row)).toBeLessThanOrEqual(1);
          }
        }
        // 4. Arabic reads right to left.
        const direction = await page.getByRole("heading", { level: 1 }).evaluate((el) => getComputedStyle(el).direction);
        expect(direction).toBe(locale === "ar" ? "rtl" : "ltr");
        await expect(cards(page).first().locator("span.font-display")).toHaveCSS("direction", locale === "ar" ? "rtl" : "ltr");
      });

      test("5. no link or button in the list; clicking a card changes nothing", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d);
        await expect(list(page).locator("a, button, [tabindex], [role='link'], [role='button']")).toHaveCount(0);
        const before = page.url();
        await cards(page).first().scrollIntoViewIfNeeded();
        await cards(page).first().click();
        expect(page.url()).toBe(before);
      });

      test("6. motion allowed: a card below the fold waits at opacity 0 and 40 px down, then rises; the hero text rises on load", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d);
        const last = items(page).last();
        expect(await revealState(last)).toEqual({ opacity: "0", translate: "0px 40px" });
        await last.scrollIntoViewIfNeeded();
        await expect.poll(() => revealState(last), { timeout: 3000 }).toEqual({ opacity: "1", translate: "none" });
        await expect
          .poll(() => revealState(page.getByRole("heading", { level: 1 })), { timeout: 3000 })
          .toEqual({ opacity: "1", translate: "none" });
      });

      test("7. reduced motion: nothing is hidden, nothing moves, the hero stays still and draws no Pause button", async ({ page }) => {
        const d = await data(locale);
        await page.emulateMedia({ reducedMotion: "reduce" });
        await visit(page, d);
        const states = await page.locator("[data-reveal]").evaluateAll((els) =>
          els.map((el) => ({ opacity: getComputedStyle(el).opacity, translate: getComputedStyle(el).translate })),
        );
        expect(states.length).toBeGreaterThanOrEqual(7);
        for (const s of states) expect(s).toEqual({ opacity: "1", translate: "none" });
        await expect(page.getByRole("button", { name: d.copy.slider.pause, exact: true })).toHaveCount(0);
        const first = await shown(page, d);
        await page.waitForTimeout(WAIT);
        expect(await shown(page, d)).toBe(first);
      });

      test("8. JavaScript off: the heading, the kicker, the first photo and five cards show, nothing is hidden, no link in the list", async ({ browser }) => {
        const d = await data(locale);
        const context = await browser.newContext({ javaScriptEnabled: false, viewport });
        const page = await context.newPage();
        const media = await routeMedia(page);
        await page.goto(d.path, { waitUntil: "load" });
        await page.waitForTimeout(250);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
        await expect(page.locator(REGION).getByText(d.copy.kicker, { exact: true })).toBeVisible();
        await expect(page.locator(`${REGION} img`).first()).toBeVisible();
        await expect(cards(page)).toHaveCount(5);
        for (let i = 0; i < 5; i += 1) await expect(cards(page).nth(i)).toBeVisible();
        const states = await page.locator("[data-reveal]").evaluateAll((els) =>
          els.map((el) => ({ opacity: getComputedStyle(el).opacity, translate: getComputedStyle(el).translate })),
        );
        for (const s of states) expect(s).toEqual({ opacity: "1", translate: "none" });
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        await expect(list(page).locator("a")).toHaveCount(0);
        expect(media.missing).toEqual([]);
        await context.close();
      });

      test("9. the Destinations nav link goes to this page and is the only one marked current", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d);
        await openMenuIfCollapsed(page, d);
        const nav = page.getByRole("navigation", { name: "Primary" });
        const link = nav.getByRole("link", { name: d.nav.destinations, exact: true });
        await expect(link).toHaveAttribute("href", d.path);
        await expect(link).toHaveAttribute("aria-current", "page");
        await expect(nav.locator("a[aria-current='page']")).toHaveCount(1);
      });

      test("10. language: the header select and the footer row go to this page in the other language", async ({ page }) => {
        const d = await data(locale);
        const next = NEXT_LOCALE[locale];
        const nd = await data(next);
        await visit(page, d);
        await openMenuIfCollapsed(page, d);
        const prefix = d.journey.locale.language.split("{name}")[0].trim();
        await page.getByRole("combobox", { name: new RegExp(`^${escapeRegExp(prefix)}`) }).click();
        await page.getByRole("option", { name: NATIVE_NAME[next] }).click();
        await page.waitForURL((url) => url.pathname === nd.path && url.search === "");
        await expect(page.locator("html")).toHaveAttribute("lang", next);
        await expect(page.locator("html")).toHaveAttribute("dir", next === "ar" ? "rtl" : "ltr");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(nd.copy.heading);
        await expect(cards(page)).toHaveCount(5);
        await page.locator(`footer a[hreflang="${locale}"]`).click();
        await page.waitForURL((url) => url.pathname === d.path && url.search === "");
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
      });

      test("11. held controls are absent, with the Menu closed and open", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d);
        const absent = async (where: string) => {
          const named = (role: "button" | "link", name: string) => page.getByRole(role, { name, exact: true });
          for (const role of ["link", "button"] as const) {
            await expect(named(role, boardWordByEn("Cart", locale)), `cart ${role} (${where})`).toHaveCount(0);
            await expect(named(role, boardWordByEn("Login", locale)), `Login ${role} (${where})`).toHaveCount(0);
            await expect(named(role, d.nav.login), `Login by nav string ${role} (${where})`).toHaveCount(0);
          }
          await expect(page.locator("form"), `a form (${where})`).toHaveCount(0);
          await expect(page.getByRole("textbox"), `a textbox (${where})`).toHaveCount(0);
          await expect(page.locator('input[type="email"]'), `an email input (${where})`).toHaveCount(0);
          await expect(named("button", HOME_COPY[locale].subscribe), `Subscribe (${where})`).toHaveCount(0);
          await expect(page.getByText(HOME_COPY[locale].listTitle, { exact: true }), `List with us (${where})`).toHaveCount(0);
          await expect(page.locator('button[type="submit"], input[type="submit"]'), `a submit (${where})`).toHaveCount(0);
          const currencyPrefix = d.journey.locale.currency.split("{code}")[0].trim();
          await expect(page.getByRole("combobox", { name: new RegExp(`^${escapeRegExp(currencyPrefix)}`) }), `currency (${where})`).toHaveCount(0);
          await expect(page.locator('[aria-disabled="true"], button:disabled'), `a dead control (${where})`).toHaveCount(0);
        };
        await absent("closed");
        if (await openMenuIfCollapsed(page, d)) {
          await expect(page.getByRole("combobox")).toHaveCount(1);
          await absent("menu open");
        } else {
          await expect(page.getByRole("combobox")).toHaveCount(1);
        }
      });

      test("12. no horizontal overflow, square corners, every photo from the media host and loaded, hero and card keys requested", async ({ page, watch }) => {
        const d = await data(locale);
        await visit(page, d);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        const radii = await page.locator("main img, main button").evaluateAll((els) => els.map((el) => getComputedStyle(el).borderRadius));
        for (const r of radii) expect(r).toBe("0px");
        const imgs = page.locator("main img");
        const count = await imgs.count();
        expect(count).toBe(d.hero.length + d.rows.length);
        for (let i = 0; i < count; i += 1) {
          await expect
            .poll(() => imgs.nth(i).evaluate((el) => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0), {
              timeout: 3 * AUTOPLAY_MS,
            })
            .toBe(true);
          expect(await imgs.nth(i).evaluate((el) => (el as HTMLImageElement).currentSrc)).toMatch(new RegExp(`^${escapeRegExp(MEDIA_BASE_URL)}/`));
        }
        const wanted = [...d.hero.map((h) => h.url), ...d.rows.map((r) => r.hero_image!.url)];
        for (const url of wanted) expect(watch.mediaRequests, url).toContain(url);
      });
    });
  }
}

// ---- 2e. a touch screen: a tap does not pause the slideshow --------------------------------------------------------------
// A tap fires an emulated mouseenter and no mouseleave until the next tap elsewhere. The slider (shared with the home page and the
// stay page) pauses for a mouse only, so a tap on the hero leaves it running and its button still reads Pause.
// A phone has no mouse, so these tests never move one: `visit` and `pointerOff` do, and once the browser has a resting mouse
// position elsewhere it sends a mouseleave after the tap, which hides the bug (the old slider passed with `visit`).

/** `visit` without the pointer: goto, network idle capped at 10 s, hydration (the dots), a short settle. */
async function visitTouch(page: Page, d: Data) {
  await page.goto(d.path, { waitUntil: "load" });
  try {
    await page.waitForLoadState("networkidle", { timeout: 10_000 });
  } catch {
    // As in `visit`: the hydration wait below is the real gate.
  }
  await expect(dot(page, d, 1)).toBeVisible();
  await page.waitForTimeout(250);
}

for (const locale of LOCALES) {
  for (const viewport of VIEWPORTS.filter((v) => v.width < 1440)) {
    test.describe(`touch ${locale} ${viewport.width}`, () => {
      test.use({ viewport, hasTouch: true, isMobile: true });

      test("2e. a tap on the hero photo does not pause it: the button still reads Pause and the slides keep changing", async ({ page }) => {
        const d = await data(locale);
        await visitTouch(page, d);
        // Away from the on-image header, the dots (bottom centre) and the Pause button (bottom end).
        await page.locator(REGION).tap({ position: { x: 60, y: 200 } });
        await expect(page.getByRole("button", { name: d.copy.slider.pause, exact: true })).toHaveCount(1);
        await expect(page.getByRole("button", { name: d.copy.slider.play, exact: true })).toHaveCount(0);
        const afterTap = await shown(page, d);
        await expect.poll(() => shown(page, d), { timeout: 2 * WAIT }).not.toBe(afterTap);
        await expect(page.getByRole("button", { name: d.copy.slider.pause, exact: true })).toHaveCount(1);
      });
    });
  }
}
