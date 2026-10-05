import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { ABOUT_PAGE_COPY } from "../../lib/copy/about-page";
import { HOME_COPY } from "../../lib/copy/home";
import { JOURNEY_COPY } from "../../lib/copy/journey";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getAboutBlocks } from "../../lib/data/about";
import { MEDIA_BASE_URL } from "../../lib/data/media";
import { getTeam } from "../../lib/data/team";
import { LOCALES, localeAlternates, localeHrefs, localePath, matchPublicPage, siteHref, type Locale } from "../../lib/locale-path";
import { routeMedia } from "../helpers/media-route";
import { VIEWPORTS, type Viewport } from "../journey/matrix";
import { style, token } from "./_helpers";

// Plan 03.3-23, Task 3: the About page in a browser, on the dev server (playwright.config.ts; the built-site specs are
// plan 25's). 12 tests x 3 locales x 3 widths. Every expected string comes from lib/copy and lib/data, every address
// from lib/locale-path; the only literals are the measures of design 12.1 / mock2.py, written once below.
// The spec reads matchPublicPage and siteHref at run time, so it passes before and after plan 25's PUBLIC_PAGES line.
//   PW_PORT=<free 3041-3049> npx playwright test tests/ui/about-page.spec.ts --workers=1

const ABOUT = "/about";
const CONTACT = "/contact";
const DIR: Record<Locale, string> = { en: "ltr", ar: "rtl", es: "ltr" };
const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };
const VIEWS = Object.keys(VIEWPORTS) as Viewport[];
/** The nav is inline from the 72rem container (@6xl); below it the Menu holds the links. */
const NAV_INLINE_FROM = 1152;
const MD = 768;

// Design 12.1 and s3-pictures/mock2.py about(): [phone, from 768 px]. Type sizes follow S3-29 (hero 64/40, display 48/32),
// read from the page's own tokens below, never typed.
const HERO_H = [640, 900] as const; // .hero
const STILL_H = [420, 900] as const; // .still
const BAND_H = [560, 900] as const; // .band
const COLLAGE_H = [1500, 2300] as const; // .collage
const PHOTO_W = [170, 300] as const; // .collage img
const PHOTO_RATIO = 6 / 5; // aspect-ratio 5/6 -> height / width
const CARD_RATIO = 1.08; // .cards img aspect-ratio 1/1.08
const pick = (pair: readonly [number, number], width: number) => (width >= MD ? pair[1] : pair[0]);

const FOREIGN_HOSTS = /framerusercontent\.com|files\.catbox\.moe|videos\.pexels\.com/;

const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(`console: ${m.text()}`);
      });
      await use(errors);
    },
    { auto: true },
  ],
});

// Layout assertions read final positions: nothing is mid-animation. Tests that need motion say so.
test.use({ reducedMotion: "reduce" });
test.setTimeout(120_000);

async function settle(page: Page) {
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
  // The dev server's own indicator can sit over a control at the page corner and swallow the click.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function visit(page: Page, locale: Locale, viewport: Viewport) {
  const media = await routeMedia(page);
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(localePath(locale, ABOUT), { waitUntil: "load" });
  await settle(page);
  return media;
}

async function data(locale: Locale) {
  const [blocks, team] = await Promise.all([getAboutBlocks(locale), getTeam(locale)]);
  return { blocks, team, copy: ABOUT_PAGE_COPY[locale] };
}

const num = (px: string) => Number.parseFloat(px);
const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error("no box");
  return b;
};
const htmlAttr = (page: Page, name: string) => page.evaluate((n) => document.documentElement.getAttribute(n), name);
const motionReady = (page: Page) => page.waitForFunction(() => document.documentElement.hasAttribute("data-motion-ready"));
const DIVIDER = 'main div[aria-hidden="true"]:has(> span.border-gold)';
const lines = (l: Locator) =>
  l.evaluate((el) =>
    (el as HTMLElement).innerText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );

/** Every [data-reveal] block in main that is not visible-and-plain: the list of offenders. */
async function hiddenOrMoved(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main [data-reveal]")].flatMap((el) => {
      const s = getComputedStyle(el);
      const bad: string[] = [];
      if (s.opacity !== "1") bad.push(`opacity ${s.opacity}`);
      if (s.translate !== "none") bad.push(`translate ${s.translate}`);
      if (s.scale !== "none") bad.push(`scale ${s.scale}`);
      if (s.transform !== "none") bad.push(`transform ${s.transform}`);
      return bad.length ? [`${el.getAttribute("data-reveal")}: ${bad.join(", ")}`] : [];
    }),
  );
}

/** True when the element is not moved or scaled: the individual `translate` property (job 11's engine) and `transform`. */
const atRest = (el: Locator) =>
  el.evaluate((node) => {
    const cs = getComputedStyle(node);
    const zero = (v: string) => v === "none" || v.split(/\s+/).every((part) => parseFloat(part) === 0);
    const t = cs.transform;
    return zero(cs.translate) && (t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)");
  });

const shift = (el: Locator) =>
  el.evaluate((node) => {
    const v = getComputedStyle(node).translate;
    return v === "none" ? 0 : parseFloat(v.split(/\s+/)[1] ?? v.split(/\s+/)[0]);
  });

const scrollTo = async (page: Page, y: number) => {
  await page.evaluate((to) => window.scrollTo(0, to), y);
  // The engine writes the offset on the next animation frame.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))));
};

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => window.innerHeight / 2);
  for (let y = 0; y <= height; y += step) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(80);
  }
}

const docTop = (l: Locator) => l.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

for (const locale of LOCALES) {
  for (const viewport of VIEWS) {
    const { width, height } = VIEWPORTS[viewport];
    const where = `${locale} ${width}`;
    const wide = width >= MD;

    test.describe(`About ${where}`, () => {
      test(`1 served HTML: lang and dir, title, description, og:image, JSON-LD, canonical and hreflang only once public (${where})`, async ({ page }) => {
        const { blocks, copy } = await data(locale);
        const res = await page.request.get(localePath(locale, ABOUT));
        expect(res.status()).toBe(200);
        const html = await res.text();
        expect(html).toMatch(new RegExp(`<html[^>]*\\blang="${locale}"`));
        expect(html).toMatch(new RegExp(`<html[^>]*\\bdir="${DIR[locale]}"`));
        expect(html).toContain(`<title>${copy.meta.title}</title>`);
        expect(html).toMatch(new RegExp(`<meta name="description" content="${copy.meta.description}"`));
        expect(blocks.hero.image).not.toBeNull();
        expect(html).toContain(`<meta property="og:image" content="${blocks.hero.image!.url}"`);
        expect(html).toMatch(/<script id="almar-organization-schema" type="application\/ld\+json"/);

        // Switched on by plan 25's one PUBLIC_PAGES line: absent before it, the four links after it.
        const canonical = html.match(/<link rel="canonical"/g)?.length ?? 0;
        const alternates = html.match(/<link rel="alternate" hrefLang=|<link rel="alternate" hreflang=/gi)?.length ?? 0;
        if (matchPublicPage(ABOUT)) {
          const want = localeAlternates(locale, ABOUT);
          expect(canonical).toBe(1);
          expect(alternates).toBe(Object.keys(want.languages).length);
          expect(html).toContain(`<link rel="canonical" href="${want.canonical}"`);
        } else {
          expect(canonical).toBe(0);
          expect(alternates).toBe(0);
        }
      });

      test(`2 order: one h1 after its kicker, the h2s in order, sections in design 12.1's order (${where})`, async ({ page }) => {
        const { blocks, team, copy } = await data(locale);
        const media = await visit(page, locale, viewport);
        expect(media.missing).toEqual([]);

        await expect(page.locator("main h1")).toHaveCount(1);
        const hero = page.locator("main > section").first();
        await expect(hero.locator("h1")).toHaveText(blocks.hero.headline);
        await expect(hero.locator("h1").locator("xpath=preceding-sibling::p")).toHaveText(blocks.hero.kicker);

        const h2s = [copy.story.heading, copy.values.heading, ...(team.length ? [copy.team.heading] : []), copy.getInTouch.heading];
        expect(await page.locator("main h2").allTextContents()).toEqual(h2s);
        if (team.length === 0) {
          await expect(page.locator("main").getByText(copy.team.kicker, { exact: true })).toHaveCount(0);
          await expect(page.locator("main").getByText(copy.team.heading, { exact: true })).toHaveCount(0);
        }

        const order = [
          hero,
          page.locator("[data-about-intro]"),
          page.locator("[data-about-still]"),
          page.locator("#story"),
          page.locator(DIVIDER),
          page.locator("#values"),
          page.locator("#get-in-touch"),
        ];
        await expect(page.locator(DIVIDER)).toHaveCount(1);
        let previous = -Infinity;
        for (const section of order) {
          const top = await docTop(section);
          expect(top).toBeGreaterThanOrEqual(previous);
          previous = top;
        }
      });

      test(`3 hero: size, one photo, headline at the signed scale, centred, the header over it (${where})`, async ({ page }) => {
        const { blocks } = await data(locale);
        await visit(page, locale, viewport);
        const hero = page.locator("main > section").first();
        const b = await box(hero);
        expect(Math.abs(b.height - pick(HERO_H, width))).toBeLessThanOrEqual(1);

        const imgs = hero.locator("img");
        await expect(imgs).toHaveCount(1);
        await expect(imgs).toHaveAttribute("src", blocks.hero.image!.url);
        await expect(imgs).toHaveAttribute("alt", blocks.hero.image!.alt);
        await expect(hero.locator("video, button")).toHaveCount(0);

        const hero64 = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--text-hero").trim());
        const h1 = hero.locator("h1");
        expect(await style(h1, "font-size")).toBe(hero64);
        expect(hero64).toBe(wide ? "64px" : "40px");

        const centre = await page.evaluate(() => document.documentElement.clientWidth / 2);
        for (const el of [hero.locator("p").first(), h1]) {
          expect(await style(el, "text-align")).toBe("center");
          const e = await box(el);
          expect(Math.abs(e.x + e.width / 2 - centre)).toBeLessThanOrEqual(2);
        }
        // Both are in the vertical middle of the hero.
        const h = await box(h1);
        expect(Math.abs(h.y + h.height / 2 - (b.y + b.height / 2))).toBeLessThanOrEqual(b.height * 0.1);

        const header = page.locator("header").first();
        expect(await style(header, "position")).toBe("absolute");
        const hb = await box(header);
        expect(hb.y).toBeLessThanOrEqual(1);
        expect(hb.y + hb.height).toBeGreaterThan(b.y);
        expect(hb.y).toBeLessThan(b.y + b.height);
      });

      test(`4 intro collage: five empty-alt photos in order, the statement centred, sizes, nothing to click (${where})`, async ({ page }) => {
        const { blocks } = await data(locale);
        await visit(page, locale, viewport);
        const intro = page.locator("[data-about-intro]");
        const photos = intro.locator("img");
        await expect(photos).toHaveCount(5);
        expect(await photos.evaluateAll((els) => els.map((el) => el.getAttribute("src")))).toEqual(
          blocks.intro.images.map((i) => i.url),
        );
        for (let i = 0; i < 5; i++) await expect(photos.nth(i)).toHaveAttribute("alt", "");
        await expect(intro.locator("svg, button, a, video, [role=dialog]")).toHaveCount(0);
        await photos.first().click({ force: true });
        await expect(page.locator("[role=dialog], dialog")).toHaveCount(0);

        const statement = intro.locator("p");
        await expect(statement).toHaveText(blocks.intro.statement);
        expect(await style(statement, "text-align")).toBe("center");
        const centre = await page.evaluate(() => document.documentElement.clientWidth / 2);
        const s = await box(statement);
        expect(s.width).toBeLessThanOrEqual(400);
        expect(Math.abs(s.x + s.width / 2 - centre)).toBeLessThanOrEqual(2);

        for (let i = 0; i < 5; i++) {
          const p = await box(photos.nth(i));
          expect(Math.abs(p.width - pick(PHOTO_W, width))).toBeLessThanOrEqual(4);
          expect(Math.abs(p.height / p.width - PHOTO_RATIO)).toBeLessThan(0.02);
          expect(await style(photos.nth(i), "border-radius")).toBe("0px");
        }
        const collage = await box(page.locator("[data-scroll-collage]"));
        expect(Math.abs(collage.height - pick(COLLAGE_H, width))).toBeLessThanOrEqual(8);

        // Photo 1 sits at the inline end (right in en and es, left in ar); photo 2 at the inline start.
        const first = await box(photos.nth(0));
        const second = await box(photos.nth(1));
        const endIsRight = locale !== "ar";
        expect(first.x + first.width / 2 > collage.x + collage.width / 2).toBe(endIsRight);
        expect(second.x + second.width / 2 > collage.x + collage.width / 2).toBe(!endIsRight);
      });

      test(`5 wide still: full width, ${wide ? 900 : 420} px tall, the published photo (${where})`, async ({ page }) => {
        const { blocks } = await data(locale);
        await visit(page, locale, viewport);
        const still = page.locator("[data-about-still]");
        await expect(still).toHaveCount(1);
        await expect(still).toHaveAttribute("src", blocks.intro.still!.url);
        await expect(still).toHaveAttribute("alt", blocks.intro.still!.alt);
        const b = await box(still);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(Math.abs(b.width - clientWidth)).toBeLessThanOrEqual(1);
        expect(Math.abs(b.height - pick(STILL_H, width))).toBeLessThanOrEqual(1);
      });

      test(`6 Our Story and Our Values: centred headings, cards, rows at the inline start with the photo at the end (${where})`, async ({ page }) => {
        const { blocks } = await data(locale);
        await visit(page, locale, viewport);
        const display = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--text-display").trim());
        expect(display).toBe(wide ? "48px" : "32px");
        for (const id of ["#story", "#values"]) {
          const h2 = page.locator(`${id} h2`);
          await expect(h2).toHaveCount(1);
          expect(await style(h2, "text-align")).toBe("center");
          expect(await style(h2, "font-size")).toBe(display);
        }

        // Story: three cards, in order, title then body; photo 1 : 1.08; 1 / 3 / 3 columns; no link.
        const cards = page.locator("#story ul > li");
        await expect(cards).toHaveCount(blocks.story.length);
        for (let i = 0; i < blocks.story.length; i++) {
          expect(await lines(cards.nth(i))).toEqual([blocks.story[i].title, blocks.story[i].body]);
          const img = cards.nth(i).locator("img");
          await expect(img).toHaveAttribute("src", blocks.story[i].image!.url);
          const p = await box(img);
          expect(Math.abs(p.height / p.width - CARD_RATIO)).toBeLessThan(0.02);
          expect(await style(cards.nth(i), "text-align")).not.toBe("center");
        }
        const tracks = (await style(page.locator("#story ul"), "grid-template-columns")).split(" ").length;
        expect(tracks).toBe(wide ? 3 : 1);
        await expect(page.locator("#story a")).toHaveCount(0);

        // Values: three rows in order; at 768 and up the text is at the inline start and the photo at the inline end.
        const rows = page.locator('#values [data-reveal="row"]');
        await expect(rows).toHaveCount(blocks.values.length);
        for (let i = 0; i < blocks.values.length; i++) {
          const row = rows.nth(i);
          const text = row.locator("> div > div").first();
          expect(await lines(text)).toEqual([blocks.values[i].title, blocks.values[i].body]);
          const img = row.locator("img");
          await expect(img).toHaveAttribute("src", blocks.values[i].image!.url);
          const t = await box(text);
          const p = await box(img);
          if (wide) {
            if (locale === "ar") expect(p.x + p.width).toBeLessThanOrEqual(t.x + 1);
            else expect(p.x).toBeGreaterThanOrEqual(t.x + t.width - 1);
          } else {
            expect(p.y).toBeGreaterThanOrEqual(t.y + t.height - 1);
          }
        }
      });

      test(`7 Get In Touch: the band, the heading, the outlined link and its result (${where})`, async ({ page }) => {
        const { blocks, copy } = await data(locale);
        await visit(page, locale, viewport);
        const band = page.locator("#get-in-touch");
        const b = await box(band);
        expect(Math.abs(b.height - pick(BAND_H, width))).toBeLessThanOrEqual(1);
        const img = band.locator("img");
        await expect(img).toHaveCount(1);
        await expect(img).toHaveAttribute("src", blocks.cta_image!.url);
        await expect(img).toHaveAttribute("alt", "");

        const vars = await page.evaluate(() => ({
          hero: getComputedStyle(document.documentElement).getPropertyValue("--text-hero").trim(),
        }));
        const h2 = band.locator("h2");
        await expect(h2).toHaveText(copy.getInTouch.heading);
        expect(await style(h2, "font-size")).toBe(vars.hero);
        expect(await style(h2, "color")).toBe(await token(page, "ivory"));
        expect(await style(h2, "text-align")).toBe("center");
        const centre = await page.evaluate(() => document.documentElement.clientWidth / 2);
        const hb = await box(h2);
        expect(Math.abs(hb.x + hb.width / 2 - centre)).toBeLessThanOrEqual(2);
        await expect(band.locator("p")).toHaveText(copy.getInTouch.intro);

        const link = page.getByRole("link", { name: copy.getInTouch.cta });
        await expect(link).toHaveCount(1);
        const href = siteHref(locale, CONTACT);
        await expect(link).toHaveAttribute("href", href);
        const gold = await token(page, "gold");
        expect(await style(link, "border-top-width")).toBe("1px");
        expect(await style(link, "border-top-color")).toBe(gold);
        expect(await style(link, "background-color")).not.toBe(gold);
        expect(await style(link, "border-top-left-radius")).toBe("0px");

        await link.scrollIntoViewIfNeeded();
        const bare = (path: string) => (path.length > 1 ? path.replace(/\/$/, "") : path);
        const [response] = await Promise.all([
          page.waitForResponse((r) => r.request().resourceType() === "document" && bare(new URL(r.url()).pathname) === bare(href)),
          link.click(),
        ]);
        expect(response.status()).toBe(200);
        await page.waitForURL((u) => bare(u.pathname) === bare(href));
      });

      test(`8 divider and lines: one divider with a gold diamond outline, no gold fill or gold text in main (${where})`, async ({ page }) => {
        await visit(page, locale, viewport);
        const gold = await token(page, "gold");
        const divider = page.locator(DIVIDER);
        await expect(divider).toHaveCount(1);
        const diamond = divider.locator("span.border-gold");
        expect(await style(diamond, "border-top-color")).toBe(gold);
        expect(await style(diamond, "background-color")).not.toBe(gold);

        const story = await docTop(page.locator("#story"));
        const values = await docTop(page.locator("#values"));
        const d = await docTop(divider);
        expect(d).toBeGreaterThan(story);
        expect(d).toBeLessThan(values);

        const offenders = await page.evaluate((g) => {
          const bad: string[] = [];
          for (const el of document.querySelectorAll<HTMLElement>("main *")) {
            const s = getComputedStyle(el);
            if (s.backgroundColor === g) bad.push(`${el.tagName} background`);
            if (s.color === g && el.textContent?.trim()) bad.push(`${el.tagName} text`);
          }
          return bad;
        }, gold);
        expect(offenders).toEqual([]);
      });

      test(`9 motion: visible with JavaScript off, still under reduced motion, played once and tied to the scroll with motion (${where})`, async ({ page, browser, errors }) => {
        const { blocks } = await data(locale);

        // (a) JavaScript off: the same page, every block and every collage photo in its final place.
        const off = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference", viewport: VIEWPORTS[viewport] });
        try {
          const p = await off.newPage();
          await routeMedia(p);
          await p.goto(localePath(locale, ABOUT), { waitUntil: "load" });
          for (const heading of await p.locator("main h1, main h2").all()) await expect(heading).toBeVisible();
          expect(await p.locator("main [data-reveal]").count()).toBeGreaterThan(0);
          expect(await hiddenOrMoved(p), "hidden or moved with JavaScript off").toEqual([]);
          const photos = p.locator("[data-about-intro] img");
          await expect(photos).toHaveCount(5);
          for (let i = 0; i < 5; i++) {
            expect(await atRest(photos.nth(i))).toBe(true);
            expect(await style(photos.nth(i), "opacity")).toBe("1");
          }
          expect(await style(p.locator("main > section").first().locator("> div").first(), "opacity")).toBe("1");
          await expect(p.getByRole("link", { name: ABOUT_PAGE_COPY[locale].getInTouch.cta })).toHaveAttribute("href", siteHref(locale, CONTACT));
        } finally {
          await off.close();
        }

        // (b) reduced motion (this describe's context): nothing moves at the top, through the collage and at the end.
        await visit(page, locale, viewport);
        await motionReady(page);
        const collage = page.locator("[data-scroll-collage]");
        const top = await docTop(collage);
        const total = pick(COLLAGE_H, width);
        for (const y of [0, top + total / 2, top + total, await page.evaluate(() => document.documentElement.scrollHeight)]) {
          await scrollTo(page, y);
          expect(await hiddenOrMoved(page)).toEqual([]);
          for (let i = 0; i < 5; i++) expect(await atRest(collage.locator("img").nth(i))).toBe(true);
          expect(await style(page.locator("main > section").first().locator("> div").first(), "opacity")).toBe("1");
        }
        const animating = await page.evaluate(
          () => [...document.querySelectorAll<HTMLElement>("main [data-reveal]")].filter((el) => el.getAnimations().length > 0).length,
        );
        expect(animating).toBe(0);
        expect(errors).toEqual([]);

        // (c) motion allowed: values rows below the fold wait, play once when they enter, and end in place;
        // the hero photo fades as the page leaves it; the collage photos follow the scroll from 768 px.
        const live = await browser.newContext({ reducedMotion: "no-preference", viewport: VIEWPORTS[viewport] });
        try {
          const p = await live.newPage();
          const liveErrors: string[] = [];
          p.on("pageerror", (e) => liveErrors.push(`pageerror: ${e.message}`));
          p.on("console", (m) => {
            if (m.type() === "error") liveErrors.push(`console: ${m.text()}`);
          });
          await routeMedia(p);
          await p.goto(localePath(locale, ABOUT), { waitUntil: "load" });
          await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await motionReady(p);
          expect(await htmlAttr(p, "data-motion")).toBe("on");

          const rows = p.locator('#values [data-reveal="row"]');
          await expect(rows).toHaveCount(blocks.values.length);
          const last = rows.last();
          expect(await last.evaluate((el) => el.hasAttribute("data-revealed"))).toBe(false);
          expect(await style(last, "opacity")).not.toBe("1");
          await last.scrollIntoViewIfNeeded();
          await expect.poll(() => style(last, "opacity"), { timeout: 2_000, intervals: [100] }).toBe("1");

          // A10: the hero photo's wrapper is full at the top and fainter once the page has scrolled away from it.
          const heroPhoto = p.locator('main > section [data-scroll="fade"]').first();
          await scrollTo(p, 0);
          expect(num(await style(heroPhoto, "opacity"))).toBeGreaterThan(0.95);
          await scrollTo(p, pick(HERO_H, width) * 0.8);
          expect(num(await style(heroPhoto, "opacity"))).toBeLessThan(0.9);

          // A13: while the statement is held its screen position stays put; from 768 px a photo's offset follows the scroll.
          const c = p.locator("[data-scroll-collage]");
          const cTop = await docTop(c);
          const statement = c.locator("p");
          const photo = c.locator("img").nth(2);
          const photoTop = cTop + (await photo.evaluate((el) => (el as HTMLElement).offsetTop));
          const ys: number[] = [];
          for (const past of [400, 700]) {
            await scrollTo(p, cTop + past);
            ys.push((await box(statement)).y);
          }
          expect(Math.abs(ys[0] - ys[1])).toBeLessThanOrEqual(2);
          if (wide) {
            await scrollTo(p, photoTop - height * 0.95);
            const a = await shift(photo);
            await scrollTo(p, photoTop - height * 0.75);
            const bShift = await shift(photo);
            expect(a).toBeLessThan(0);
            expect(bShift).toBeGreaterThan(a);
            await scrollTo(p, photoTop - height * 0.4);
            expect(await atRest(photo)).toBe(true);
          } else {
            for (const y of [photoTop - height * 0.9, photoTop - height * 0.5]) {
              await scrollTo(p, Math.max(0, y));
              for (let i = 0; i < 5; i++) expect(await atRest(c.locator("img").nth(i))).toBe(true);
            }
          }

          // Played once: after a full pass and back to the top nothing is hidden again.
          await scrollThrough(p);
          await p.waitForTimeout(1600);
          expect(await hiddenOrMoved(p)).toEqual([]);
          await scrollTo(p, 0);
          await p.waitForTimeout(300);
          expect(await hiddenOrMoved(p)).toEqual([]);
          expect(liveErrors).toEqual([]);
        } finally {
          await live.close();
        }
      });

      test(`10 frame: current nav link, language select, footer language row, logo (${where})`, async ({ page }) => {
        const nav = HOME_COPY[locale].nav;
        await visit(page, locale, viewport);
        if (width < NAV_INLINE_FROM) await page.getByRole("button", { name: nav.menu }).click();
        const current = page.locator('header a[aria-current="page"]');
        await expect(current).toHaveCount(1);
        await expect(current).toHaveText(nav.about);
        await expect(current).toHaveAttribute("href", siteHref(locale, ABOUT));

        const hrefs = localeHrefs(ABOUT);
        const row = page.getByRole("navigation", { name: SITE_FOOTER_COPY[locale].language });
        expect(await row.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(
          LOCALES.map((l) => hrefs[l]),
        );

        // en -> ar -> es -> en: the header select lands on this page in the next language, in its language and direction.
        const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];
        await page.getByRole("combobox", { name: /^(Language|اللغة|Idioma):/ }).click();
        await page.getByRole("option", { name: LANGUAGE_NAMES[next] }).click();
        await page.waitForURL((u) => u.pathname === localePath(next, ABOUT));
        expect(await htmlAttr(page, "lang")).toBe(next);
        expect(await htmlAttr(page, "dir")).toBe(DIR[next]);

        // The footer language row brings it back.
        await page
          .getByRole("navigation", { name: SITE_FOOTER_COPY[next].language })
          .locator(`a[hreflang="${locale}"]`)
          .click();
        await page.waitForURL((u) => u.pathname === localePath(locale, ABOUT));
        expect(await htmlAttr(page, "lang")).toBe(locale);

        // The logo goes to this language's home. The dev server answers /ar/ with a redirect to /ar, so the landing
        // path is compared without its trailing slash and the link's own href is pinned exactly.
        const logo = page.getByRole("link", { name: "ALMAR Private Journeys home" });
        await expect(logo).toHaveAttribute("href", localePath(locale, "/"));
        await logo.click();
        const bare = (path: string) => (path.length > 1 ? path.replace(/\/$/, "") : path);
        await page.waitForURL((u) => bare(u.pathname) === bare(localePath(locale, "/")));
      });

      test(`11 held: no form, field, submit, search, video, Login or cart in the page body (${where})`, async ({ page }) => {
        const nav = HOME_COPY[locale].nav;
        await visit(page, locale, viewport);
        for (const selector of [
          "main form",
          "main input",
          "main textarea",
          "main select",
          'main button[type="submit"]',
          "main [role=search]",
          "main video",
          "main section:first-of-type button",
        ]) {
          await expect(page.locator(selector), selector).toHaveCount(0);
        }
        await expect(page.locator("main").getByText(JOURNEY_COPY[locale].bar.search, { exact: true })).toHaveCount(0);
        await expect(page.locator("main").getByRole("button", { name: JOURNEY_COPY[locale].bar.search })).toHaveCount(0);
        await expect(page.locator("header").getByRole("link", { name: nav.login })).toHaveCount(0);
        await expect(page.locator("header").getByRole("link", { name: /cart/i })).toHaveCount(0);
        await expect(page.getByRole("combobox", { name: /^(Currency|العملة|Moneda)/ })).toHaveCount(0);
      });

      test(`12 hosts and look: every picture on the media host, no foreign request, no overflow, square (${where})`, async ({ page }) => {
        const seen: string[] = [];
        page.on("request", (r) => seen.push(r.url()));
        const media = await visit(page, locale, viewport);
        expect(media.missing).toEqual([]);
        const srcs = await page.locator("main img").evaluateAll((els) => els.map((el) => el.getAttribute("src") ?? ""));
        expect(srcs.length).toBeGreaterThan(0);
        for (const src of srcs) expect(src.startsWith(`${MEDIA_BASE_URL}/`), src).toBe(true);
        expect(seen.filter((u) => FOREIGN_HOSTS.test(u))).toEqual([]);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        const radii = await page
          .locator("main img, main a")
          .evaluateAll((els) => els.map((el) => getComputedStyle(el).borderTopLeftRadius));
        expect(radii.length).toBeGreaterThan(0);
        expect(radii.every((r) => r === "0px")).toBe(true);
      });
    });
  }
}
