import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { contactLinks } from "../../components/pages/contact/contact-links";
import { CONTACT_PAGE_COPY } from "../../lib/copy/contact-page";
import { HOME_COPY } from "../../lib/copy/home";
import { HOME_PAGE_COPY } from "../../lib/copy/home-page";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getContactDetails } from "../../lib/data/contact";
import { LOCALES, localePath, siteHref, type Locale } from "../../lib/locale-path";
import { VIEWPORTS, type Viewport } from "../journey/matrix";
import { style, token } from "./_helpers";

// Plan 03.3-24, Task 3: the Contact page in a browser, on the dev server (playwright.config.ts; the built-site specs
// are plan 25's). 9 tests x 3 locales x 3 widths. Every expected string comes from lib/copy and lib/data; the one
// literal is the live English WhatsApp address, pinned once. Every click that would leave the machine is routed to a
// stub first. No test reads a source file: every assertion is on the rendered page.
//   PW_PORT=<free 3041-3049> npx playwright test tests/ui/contact-page.spec.ts --workers=1

const CONTACT = "/contact";
const LIVE_WA =
  "https://wa.me/971563883302?text=Hello%20ALMAR%2C%20I%20would%20like%20to%20plan%20a%20private%20journey.";
const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };
const DIR: Record<Locale, string> = { en: "ltr", ar: "rtl", es: "ltr" };
const VIEWS = Object.keys(VIEWPORTS) as Viewport[];
/** The nav is inline from the 72rem container (@6xl); below it the Menu holds the links. */
const NAV_INLINE_FROM = 1152;

const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page, context }, use) => {
      // Nothing leaves the machine: both third-party targets of a click answer a stub.
      await context.route(/^https:\/\/(wa\.me|www\.google\.com)\//, (route) =>
        route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title>" }),
      );
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

async function visit(page: Page, locale: Locale, viewport: Viewport) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(localePath(locale, CONTACT), { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
  // The dev server's own indicator can sit over a control at the page corner and swallow the click.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
}

async function details(locale: Locale) {
  const d = await getContactDetails(locale);
  return { d, links: contactLinks(d), copy: CONTACT_PAGE_COPY[locale] };
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const num = (px: string) => Number.parseFloat(px);
const box = async (l: Locator) => {
  const b = await l.boundingBox();
  if (!b) throw new Error("no box");
  return b;
};

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

const htmlAttr = (page: Page, name: string) => page.evaluate((n) => document.documentElement.getAttribute(n), name);
const motionReady = (page: Page) => page.waitForFunction(() => document.documentElement.hasAttribute("data-motion-ready"));
const DIVIDER = 'main div[aria-hidden="true"]:has(> span.border-gold)';

async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => window.innerHeight / 2);
  for (let y = 0; y <= height; y += step) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(80);
  }
}

for (const locale of LOCALES) {
  for (const viewport of VIEWS) {
    const where = `${locale} ${VIEWPORTS[viewport].width}`;

    test.describe(`Contact ${where}`, () => {
      test(`1 document: lang and dir, and with JavaScript off the same page, every block visible (${where})`, async ({ page, browser, errors }) => {
        const { d, links, copy } = await details(locale);
        await visit(page, locale, viewport);
        expect(await htmlAttr(page, "lang")).toBe(locale);
        expect(await htmlAttr(page, "dir")).toBe(DIR[locale]);
        expect(errors).toEqual([]);

        const off = await browser.newContext({
          javaScriptEnabled: false,
          reducedMotion: "reduce",
          viewport: VIEWPORTS[viewport],
        });
        try {
          const p = await off.newPage();
          await p.goto(localePath(locale, CONTACT), { waitUntil: "load" });
          expect(await htmlAttr(p, "lang")).toBe(locale);
          expect(await htmlAttr(p, "dir")).toBe(DIR[locale]);
          await expect(p.locator("main h1")).toBeVisible();
          await expect(p.locator("main h1")).toHaveText(copy.title.heading);
          const hrefs = await p.locator("main a").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
          expect(hrefs).toEqual([links.location, links.tel, links.whatsapp, links.mailto, links.whatsappMessage]);
          expect(await p.locator("main [data-reveal]").count()).toBeGreaterThan(0);
          expect(await hiddenOrMoved(p), "hidden or moved with JavaScript off").toEqual([]);
          expect(d.email).toBe("inquiries@almarprivatejourney.com");
        } finally {
          await off.close();
        }
      });

      test(`2 structure: one h1 at the signed scale, centred, dividers, two h2 (${where})`, async ({ page, errors }) => {
        const { d, copy } = await details(locale);
        await visit(page, locale, viewport);
        const h1 = page.locator("main h1");
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveText(copy.title.heading);

        // S3-29: Framer's 88 and 56 are the signed tokens hero (64, 40 on a phone) and display (48, 32).
        const vars = await page.evaluate(() => {
          const s = getComputedStyle(document.documentElement);
          return { hero: s.getPropertyValue("--text-hero").trim(), display: s.getPropertyValue("--text-display").trim() };
        });
        expect(await style(h1, "font-size")).toBe(vars.hero);
        const wide = VIEWPORTS[viewport].width >= 768;
        expect(vars.hero).toBe(wide ? "64px" : "40px");
        expect(vars.display).toBe(wide ? "48px" : "32px");

        const block = h1.locator("xpath=..");
        for (const el of [block.locator("p").first(), h1, block.locator("p").last()]) {
          expect(await style(el, "text-align")).toBe("center");
        }
        await expect(block.locator("p").first()).toHaveText(copy.title.kicker);
        await expect(block.locator("p").last()).toHaveText(copy.title.intro);
        expect(num(await style(block, "border-top-width")), "no gold rule on the title block").toBe(0);

        const dividers = page.locator(DIVIDER);
        await expect(dividers).toHaveCount(2);
        const columns = await box(page.locator("[data-contact-columns]"));
        const title = await box(block);
        const d1 = await box(dividers.nth(0));
        const d2 = await box(dividers.nth(1));
        expect(d1.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
        expect(d1.y).toBeLessThanOrEqual(columns.y);
        expect(d2.y).toBeGreaterThanOrEqual(columns.y + columns.height - 1);

        const h2s = page.locator("main h2");
        expect(await h2s.allTextContents()).toEqual([d.business_name, copy.confidence.heading]);
        for (let i = 0; i < 2; i++) expect(await style(h2s.nth(i), "font-size")).toBe(vars.display);
        await expect(page.getByText(copy.team.title)).toHaveCount(0);
        expect(errors).toEqual([]);
      });

      test(`3 columns: two equal from 1024 px, details at the start, Travel With Confidence at the end (${where})`, async ({ page, errors }) => {
        const { d, copy } = await details(locale);
        await visit(page, locale, viewport);
        const grid = page.locator("[data-contact-columns]");
        const tracks = (await style(grid, "grid-template-columns")).split(" ").map(num);
        const first = grid.locator("> *").nth(0);
        const second = grid.locator("> *").nth(1);
        await expect(grid.locator("> *")).toHaveCount(2);
        await expect(first.locator("h2")).toHaveText(d.business_name);
        await expect(second.locator("h2")).toHaveText(copy.confidence.heading);
        await expect(second.getByText(copy.confidence.body)).toHaveCount(1);

        const g = await box(grid);
        const a = await box(first);
        const b = await box(second);
        if (VIEWPORTS[viewport].width >= 1024) {
          expect(tracks).toHaveLength(2);
          expect(Math.abs(tracks[0] - tracks[1])).toBeLessThanOrEqual(1);
          expect(Math.abs(a.y - b.y)).toBeLessThanOrEqual(1);
          expect(a.width).toBeGreaterThan(0);
          expect(b.width).toBeGreaterThan(0);
          if (locale === "ar") {
            expect(Math.abs(a.x + a.width - (g.x + g.width))).toBeLessThanOrEqual(1);
            expect(Math.abs(b.x - g.x)).toBeLessThanOrEqual(1);
          } else {
            expect(Math.abs(a.x - g.x)).toBeLessThanOrEqual(1);
            expect(Math.abs(b.x + b.width - (g.x + g.width))).toBeLessThanOrEqual(1);
          }
        } else {
          expect(tracks).toHaveLength(1);
          expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
        }
        expect(errors).toEqual([]);
      });

      test(`4 details: three icon groups, four arrow links, each result asserted (${where})`, async ({ page, context, errors }) => {
        const { d, links, copy } = await details(locale);
        await visit(page, locale, viewport);
        const dl = page.locator("main dl");
        await expect(dl).toHaveCount(1);
        const groups = dl.locator("> div");
        await expect(groups).toHaveCount(3);
        expect(await dl.locator("dt").allTextContents()).toEqual([
          copy.details.location,
          copy.details.phone,
          copy.details.email,
        ]);
        for (let i = 0; i < 3; i++) await expect(groups.nth(i).locator("dt svg[aria-hidden='true']")).toHaveCount(1);
        expect(await groups.nth(1).locator("small").allTextContents()).toEqual([
          copy.details.inquiryLine,
          copy.details.whatsapp,
        ]);
        await expect(groups.nth(2).locator("a")).toHaveCount(1);
        await expect(groups.nth(2).locator("small")).toHaveCount(0);

        const anchors = dl.locator("a");
        await expect(anchors).toHaveCount(4);
        expect(await anchors.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual([
          links.location,
          links.tel,
          links.whatsapp,
          links.mailto,
        ]);
        expect(links.tel).toBe("tel:+971563883302");
        expect(links.mailto).toBe("mailto:inquiries@almarprivatejourney.com");
        for (let i = 0; i < 4; i++) {
          await expect(anchors.nth(i).locator("svg")).toHaveCount(1);
          await expect(anchors.nth(i).locator("svg")).toHaveAttribute("aria-hidden", "true");
        }
        expect(await anchors.nth(1).locator("bdi").textContent()).toBe(d.phone_display);
        expect(await anchors.nth(2).locator("bdi").textContent()).toBe(d.phone_display);
        expect(await anchors.nth(3).locator("bdi").textContent()).toBe(d.email);
        expect((await anchors.nth(0).textContent())?.trim()).toBe(`${d.location_label} ${copy.newTab}`);

        for (const i of [0, 2]) {
          await expect(anchors.nth(i)).toHaveAttribute("target", "_blank");
          const rel = (await anchors.nth(i).getAttribute("rel")) ?? "";
          expect(rel).toContain("noopener");
          expect(rel).toContain("noreferrer");
          await expect(anchors.nth(i)).toHaveAccessibleName(new RegExp(`${escapeRe(copy.newTab)}$`));
        }
        for (const i of [1, 3]) await expect(anchors.nth(i)).not.toHaveAttribute("target", /.*/);

        // The two links that open a page open it in a new tab, at the right address.
        for (const [i, want] of [
          [0, new URL(links.location).href],
          [2, links.whatsapp],
        ] as const) {
          const [popup] = await Promise.all([context.waitForEvent("page"), anchors.nth(i).click()]);
          await popup.waitForURL(want);
          await popup.close();
        }
        expect(errors).toEqual([]);
      });

      test(`5 Message on WhatsApp: the outlined button, the prefilled sentence in this language (${where})`, async ({ page, context, errors }) => {
        const { d, links, copy } = await details(locale);
        await visit(page, locale, viewport);
        const button = page.locator('main a[href^="https://wa.me/971563883302?text="]');
        await expect(button).toHaveCount(1);
        await expect(button).toHaveAttribute("href", links.whatsappMessage);
        await expect(button).toHaveAccessibleName(`${copy.whatsappCta} ${copy.newTab}`);
        if (locale === "en") expect(links.whatsappMessage).toBe(LIVE_WA);
        else {
          const text = new URL(links.whatsappMessage).searchParams.get("text");
          expect(text).toBe(d.whatsapp_message);
          expect(decodeURIComponent(links.whatsappMessage.split("?text=")[1])).toBe(d.whatsapp_message);
        }
        await expect(button).toHaveAttribute("target", "_blank");
        const rel = (await button.getAttribute("rel")) ?? "";
        expect(rel).toContain("noopener");
        expect(rel).toContain("noreferrer");

        const firstColumn = page.locator("[data-contact-columns] > *").first();
        await expect(firstColumn.locator('a[href^="https://wa.me/971563883302?text="]')).toHaveCount(1);
        const list = await box(page.locator("main dl"));
        const bt = await box(button);
        expect(bt.y).toBeGreaterThan(list.y + list.height - 1);

        const gold = await token(page, "gold");
        expect(await style(button, "border-top-width")).toBe("1px");
        expect(await style(button, "border-top-style")).toBe("solid");
        expect(await style(button, "border-top-color")).toBe(gold);
        expect(await style(button, "background-color")).not.toBe(gold);
        expect(await style(button, "border-top-left-radius")).toBe("0px");

        const [popup] = await Promise.all([context.waitForEvent("page"), button.click()]);
        await popup.waitForURL(links.whatsappMessage);
        await popup.close();
        expect(errors).toEqual([]);
      });

      test(`6 frame: current nav link, language select, footer language row, logo, floating WhatsApp (${where})`, async ({ page, errors }) => {
        const nav = HOME_COPY[locale].nav;
        const openMenu = async () => {
          if (VIEWPORTS[viewport].width < NAV_INLINE_FROM) await page.getByRole("button", { name: nav.menu }).click();
        };
        await visit(page, locale, viewport);
        await openMenu();
        const current = page.locator('header a[aria-current="page"]');
        await expect(current).toHaveCount(1);
        await expect(current).toHaveText(nav.contact);
        await expect(current).toHaveAttribute("href", siteHref(locale, CONTACT));
        await expect(page.locator('a[aria-label="WhatsApp"]')).toHaveCount(1);

        const row = page.getByRole("navigation", { name: SITE_FOOTER_COPY[locale].language });
        expect(await row.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(
          LOCALES.map((l) => localePath(l, CONTACT)),
        );

        // en -> ar -> es -> en: the header select lands on this page in the next language, in its language and direction.
        const next = LOCALES[(LOCALES.indexOf(locale) + 1) % LOCALES.length];
        await page.getByRole("combobox", { name: /^(Language|اللغة|Idioma):/ }).click();
        await page.getByRole("option", { name: LANGUAGE_NAMES[next] }).click();
        await page.waitForURL((u) => u.pathname === localePath(next, CONTACT));
        expect(await htmlAttr(page, "lang")).toBe(next);
        expect(await htmlAttr(page, "dir")).toBe(DIR[next]);

        // The footer language row brings it back.
        await page
          .getByRole("navigation", { name: SITE_FOOTER_COPY[next].language })
          .locator(`a[hreflang="${locale}"]`)
          .click();
        await page.waitForURL((u) => u.pathname === localePath(locale, CONTACT));
        expect(await htmlAttr(page, "lang")).toBe(locale);
        expect(await htmlAttr(page, "dir")).toBe(DIR[locale]);
        expect(errors).toEqual([]);

        // The logo goes to this language's home (slice 1's default).
        // The dev server answers /ar/ with a redirect to /ar (the Cloudflare build keeps the slash), so the path is
        // compared without its trailing slash and the link's own href is pinned exactly.
        const logo = page.getByRole("link", { name: "ALMAR Private Journeys home" });
        await expect(logo).toHaveAttribute("href", localePath(locale, "/"));
        await logo.click();
        const bare = (path: string) => (path.length > 1 ? path.replace(/\/$/, "") : path);
        await page.waitForURL((u) => bare(u.pathname) === bare(localePath(locale, "/")));
      });

      test(`7 held until plan 26: no form, no Start Your Inquiry (${where})`, async ({ page, errors }) => {
        const nav = HOME_COPY[locale].nav;
        await visit(page, locale, viewport);
        for (const selector of [
          "form",
          "input",
          "textarea",
          "select",
          'button[type="submit"]',
          "[id=inquiry]",
          'a[href="#inquiry"]',
          "main form",
          "main input",
          'footer input[type="email"]',
        ]) {
          await expect(page.locator(selector), selector).toHaveCount(0);
        }
        await expect(page.locator("main a[href^='mailto:']")).toHaveCount(1);
        await expect(page.getByText(/partnerships/i)).toHaveCount(0);
        await expect(page.getByText(/start your inquiry/i)).toHaveCount(0);
        await expect(page.getByRole("link", { name: nav.login })).toHaveCount(0);
        await expect(page.getByRole("link", { name: /cart/i })).toHaveCount(0);
        await expect(page.getByRole("combobox", { name: /^(Currency|العملة|Moneda)/ })).toHaveCount(0);
        await expect(page.getByRole("group", { name: HOME_PAGE_COPY[locale].hero.barLabel })).toHaveCount(0);
        await expect(page.getByRole("search")).toHaveCount(0);
        expect(errors).toEqual([]);
      });

      test(`8 layout: no horizontal overflow, square links, no inline style in the served HTML (${where})`, async ({ page, browser, errors }) => {
        await visit(page, locale, viewport);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);
        const radii = await page.locator("main a").evaluateAll((as) => as.map((a) => getComputedStyle(a).borderTopLeftRadius));
        expect(radii.length).toBeGreaterThan(0);
        expect(radii.every((r) => r === "0px")).toBe(true);

        const off = await browser.newContext({
          javaScriptEnabled: false,
          reducedMotion: "reduce",
          viewport: VIEWPORTS[viewport],
        });
        try {
          const p = await off.newPage();
          await p.goto(localePath(locale, CONTACT), { waitUntil: "load" });
          expect(await p.locator("main [style]").count(), "an inline style in the served HTML").toBe(0);
        } finally {
          await off.close();
        }
        expect(errors).toEqual([]);
      });

      test(`9 motion: nothing moves when reduced; blocks below the fold wait, play once on entering, and end in place (${where})`, async ({ page, browser, errors }) => {
        // (a) reduced motion (this describe's context): everything at once, nothing animates.
        await visit(page, locale, viewport);
        await motionReady(page);
        const marked = page.locator("main [data-reveal]");
        expect(await marked.count()).toBe(7);
        const animating = () =>
          page.evaluate(() => [...document.querySelectorAll<HTMLElement>("main [data-reveal]")].filter((el) => el.getAnimations().length > 0).length);
        expect(await hiddenOrMoved(page)).toEqual([]);
        expect(await animating()).toBe(0);
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
        await page.waitForTimeout(150);
        expect(await hiddenOrMoved(page)).toEqual([]);
        expect(await animating()).toBe(0);
        // (c) The marks: the title block, both section heading blocks, the button and the three detail groups (job 11's kinds).
        const kinds = await marked.evaluateAll((els) => els.map((el) => el.getAttribute("data-reveal")).sort());
        expect(kinds).toEqual(["button", "heading", "heading", "headline", "row", "row", "row"]);
        expect(errors).toEqual([]);

        // (b) no preference: the same page in a context that allows motion.
        const live = await browser.newContext({ reducedMotion: "no-preference", viewport: VIEWPORTS[viewport] });
        try {
          const p = await live.newPage();
          const liveErrors: string[] = [];
          p.on("pageerror", (e) => liveErrors.push(`pageerror: ${e.message}`));
          p.on("console", (m) => {
            if (m.type() === "error") liveErrors.push(`console: ${m.text()}`);
          });
          await p.goto(localePath(locale, CONTACT), { waitUntil: "load" });
          await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await motionReady(p);
          expect(await htmlAttr(p, "data-motion")).toBe("on");
          const groups = p.locator("main dl > [data-reveal='row']");
          await expect(groups).toHaveCount(3);

          // A group that has not entered the screen has not played: it is still hidden. (The engine reveals a block once
          // its top is above the bottom tenth of the screen, so a group just inside the fold can still be waiting.)
          const waiting = await groups.evaluateAll((els) => els.map((el) => !el.hasAttribute("data-revealed")));
          if (VIEWPORTS[viewport].width === 390) {
            expect(waiting.filter(Boolean).length, "at 390 the lowest detail group is still waiting").toBeGreaterThan(0);
          }
          for (let i = 0; i < waiting.length; i++) {
            if (waiting[i]) expect(await groups.nth(i).evaluate((el) => getComputedStyle(el).opacity)).not.toBe("1");
          }

          await scrollThrough(p);
          // The longest one-shot is 1.18 s (A7); wait it out.
          await p.waitForTimeout(1600);
          expect(await hiddenOrMoved(p)).toEqual([]);

          // Played once: scrolling back to the top does not hide anything again.
          await p.evaluate(() => window.scrollTo(0, 0));
          await p.waitForTimeout(300);
          expect(await hiddenOrMoved(p)).toEqual([]);
          expect(liveErrors).toEqual([]);
        } finally {
          await live.close();
        }
      });
    });
  }
}
