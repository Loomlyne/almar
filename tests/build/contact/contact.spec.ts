import { expect, test } from "@playwright/test";
import { contactLinks } from "../../../components/pages/contact/contact-links";
import { CONTACT_PAGE_COPY } from "../../../lib/copy/contact-page";
import { getContactDetails } from "../../../lib/data/contact";
import { MEDIA_BASE_URL } from "../../../lib/data/media";
import { localeAlternates, localeDir, localePath, type Locale } from "../../../lib/locale-path";
import {
  DIR,
  DIVIDER,
  FOREIGN_HOSTS,
  LOCALES,
  MD,
  WIDTHS,
  box,
  checkFooterAndFloat,
  checkFrameLinks,
  checkLanguage,
  checkSkipLink,
  hiddenOrMoved,
  homeFooterBackground,
  htmlAttr,
  htmlTag,
  motionReady,
  num,
  open,
  rootVar,
  runningAnimations,
  scrollThrough,
  scrollTo,
  served,
  stubExternal,
  style,
  tagAttr,
  token,
  watch,
} from "../slice3-pages";

// Plan 03.3-25 Task 3: Contact on the assembled out/, served by local wrangler. 10 tests x 3 locales x 3 widths = 90
// (test 10 is the slice 3 review's: a longer Settings address wraps inside the column).
// The byte layer is built-documents.test.mjs; the held controls are contact-held.spec.ts.
//   node scripts/assemble-cloudflare.mjs
//   PW_PORT=<free 3041-3049> npx playwright test -c playwright.build.config.ts tests/build/contact/contact.spec.ts --workers=1
// Expected strings come from lib/copy and lib/data, addresses from lib/locale-path; colours from the page's own tokens.
// Literals: the live English WhatsApp link (design 1.2) and the WhatsApp float's fixed address. Sizes are job 11's tokens
// (S3-29): h1 64 / 40, h2 48 / 32 (Framer's 88 and 56 on the signed scale).

const PATH = "/contact";
const LIVE_WA =
  "https://wa.me/971563883302?text=Hello%20ALMAR%2C%20I%20would%20like%20to%20plan%20a%20private%20journey.";
const LG = 1024;

test.setTimeout(150_000);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

for (const locale of LOCALES) {
  for (const size of WIDTHS) {
    const { width, height } = size;
    const where = `${locale} ${width}`;
    const url = localePath(locale, PATH);

    test.describe(`Contact built ${where}`, () => {
      test.use({ viewport: { width, height }, reducedMotion: "reduce" });

      test(`1 served bytes and JavaScript off: lang, dir, h1 visible, no redirect (${where})`, async ({ page, browser }) => {
        const copy = CONTACT_PAGE_COPY[locale];
        const html = await served(page, url);
        const tag = htmlTag(html);
        expect(tagAttr(tag, "lang")).toBe(locale);
        expect(tagAttr(tag, "dir")).toBe(localeDir(locale));
        expect(html).toContain(`<link rel="canonical" href="${localeAlternates(locale, PATH).canonical}"`);

        const off = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference", viewport: { width, height } });
        try {
          const p = await off.newPage();
          const res = await p.goto(url, { waitUntil: "load" });
          expect(res?.status()).toBe(200);
          expect(res?.request().redirectedFrom()).toBeNull();
          expect(await htmlAttr(p, "lang")).toBe(locale);
          expect(await htmlAttr(p, "dir")).toBe(DIR[locale]);
          await expect(p.locator("main h1")).toBeVisible();
          await expect(p.locator("main h1")).toHaveText(copy.title.heading);
        } finally {
          await off.close();
        }
      });

      test(`2 layout (design 12.2 part A): title block, divider, h2s, icon groups, two columns (${where})`, async ({ page }) => {
        const watched = await watch(page);
        const d = await getContactDetails(locale);
        const copy = CONTACT_PAGE_COPY[locale];
        await open(page, url);

        // Title block: kicker, the one h1 at the hero token, the intro line, all centred.
        const h1 = page.locator("main h1");
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveText(copy.title.heading);
        const hero = await rootVar(page, "--text-hero");
        const display = await rootVar(page, "--text-display");
        expect(hero).toBe(width >= MD ? "64px" : "40px");
        expect(display).toBe(width >= MD ? "48px" : "32px");
        expect(await style(h1, "font-size")).toBe(hero);
        const block = h1.locator("xpath=..");
        const centre = await page.evaluate(() => document.documentElement.clientWidth / 2);
        const kicker = block.locator("p").first();
        const intro = block.locator("p").last();
        await expect(kicker).toHaveText(copy.title.kicker);
        await expect(intro).toHaveText(copy.title.intro);
        for (const el of [kicker, h1, intro]) {
          expect(await style(el, "text-align")).toBe("center");
          const b = await box(el);
          expect(Math.abs(b.x + b.width / 2 - centre)).toBeLessThanOrEqual(2);
        }
        const kb = await box(kicker);
        const hb = await box(h1);
        const ib = await box(intro);
        expect(hb.y).toBeGreaterThanOrEqual(kb.y + kb.height - 1);
        expect(ib.y).toBeGreaterThanOrEqual(hb.y + hb.height - 1);

        // Job 11's divider follows the title block: teal-tint line, gold diamond outline.
        const dividers = page.locator(DIVIDER);
        expect(await dividers.count()).toBeGreaterThanOrEqual(1);
        const columns = page.locator("[data-contact-columns]");
        const cb = await box(columns);
        const title = await box(block);
        const first = await box(dividers.first());
        expect(first.y).toBeGreaterThanOrEqual(title.y + title.height - 1);
        expect(first.y).toBeLessThanOrEqual(cb.y);
        const gold = await token(page, "gold");
        const diamond = dividers.first().locator("span.border-gold");
        expect(await style(diamond, "border-top-color")).toBe(gold);
        expect(await style(diamond, "background-color")).not.toBe(gold);
        expect(await style(dividers.first().locator("span.bg-teal-tint").first(), "background-color")).toBe(await token(page, "teal-tint"));

        // h2s in DOM order, 48 / 32; no h3; no team heading.
        const h2s = page.locator("main h2");
        expect(await h2s.allTextContents()).toEqual([d.business_name, copy.confidence.heading]);
        for (let i = 0; i < 2; i++) expect(await style(h2s.nth(i), "font-size")).toBe(display);
        await expect(page.locator("main h3")).toHaveCount(0);
        await expect(page.getByText(copy.team.title)).toHaveCount(0);

        // Details: three groups, in order; each label from the copy with an aria-hidden icon and no heading role.
        const dl = page.locator("main dl");
        await expect(dl).toHaveCount(1);
        const groups = dl.locator("> div");
        await expect(groups).toHaveCount(3);
        expect(await dl.locator("dt").allTextContents()).toEqual([copy.details.location, copy.details.phone, copy.details.email]);
        for (let i = 0; i < 3; i++) await expect(groups.nth(i).locator("dt svg[aria-hidden='true']")).toHaveCount(1);
        await expect(dl.locator("dt h1, dt h2, dt h3, dt h4, dt [role=heading]")).toHaveCount(0);
        expect(await groups.nth(1).locator("small").allTextContents()).toEqual([copy.details.inquiryLine, copy.details.whatsapp]);
        await expect(groups.nth(2).locator("a")).toHaveCount(1);

        // Message on WhatsApp sits under the details, inside the start column.
        const wa = page.locator('main a[href^="https://wa.me/971563883302?text="]');
        await expect(wa).toHaveCount(1);
        const col1 = columns.locator("> *").nth(0);
        const col2 = columns.locator("> *").nth(1);
        await expect(columns.locator("> *")).toHaveCount(2);
        await expect(col1.locator('a[href^="https://wa.me/971563883302?text="]')).toHaveCount(1);
        const dlb = await box(dl);
        expect((await box(wa)).y).toBeGreaterThan(dlb.y + dlb.height - 1);

        // Columns: two equal ones from 1024 px, details at the start and Travel With Confidence at the end, never empty;
        // stacked below, details first.
        await expect(col1.locator("h2")).toHaveText(d.business_name);
        await expect(col2.locator("h2")).toHaveText(copy.confidence.heading);
        await expect(col2.getByText(copy.confidence.body)).toHaveCount(1);
        const tracks = (await style(columns, "grid-template-columns")).split(" ").map(num);
        const a = await box(col1);
        const b = await box(col2);
        if (width >= LG) {
          expect(tracks).toHaveLength(2);
          expect(Math.abs(tracks[0] - tracks[1])).toBeLessThanOrEqual(1);
          expect(Math.abs(a.width - b.width)).toBeLessThanOrEqual(1);
          expect(Math.min(a.y + a.height, b.y + b.height)).toBeGreaterThan(Math.max(a.y, b.y));
          if (locale === "ar") expect(b.x + b.width).toBeLessThanOrEqual(a.x + 1);
          else expect(b.x).toBeGreaterThanOrEqual(a.x + a.width - 1);
          expect(b.height).toBeGreaterThan(0);
        } else {
          expect(tracks).toHaveLength(1);
          expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
        }

        // The header is solid (not over an image).
        expect(await style(page.locator("header").first(), "position")).not.toBe("absolute");
        expect(watched.problems).toEqual([]);
      });

      test(`3 details: each link reaches its exact address (${where})`, async ({ page }) => {
        const watched = await watch(page);
        await stubExternal(page);
        const d = await getContactDetails(locale);
        const links = contactLinks(d);
        const copy = CONTACT_PAGE_COPY[locale];
        await open(page, url);
        const anchors = page.locator("main dl a");
        await expect(anchors).toHaveCount(4);
        expect(await anchors.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual([
          links.location,
          links.tel,
          links.whatsapp,
          links.mailto,
        ]);
        // The live tel: bug stays fixed: the Inquiry Line is tel:, the WhatsApp row is wa.me without the plus.
        expect(links.tel).toBe(`tel:${d.phone_e164}`);
        expect(links.whatsapp).toBe(`https://wa.me/${d.phone_e164.slice(1)}`);
        expect(links.mailto).toBe(`mailto:${d.email}`);
        expect(await anchors.nth(1).locator("bdi").textContent()).toBe(d.phone_display);
        expect(await anchors.nth(2).locator("bdi").textContent()).toBe(d.phone_display);
        expect(await anchors.nth(3).locator("bdi").textContent()).toBe(d.email);
        // The email is shown once in main.
        expect(((await page.locator("main").innerText()).match(new RegExp(escapeRe(d.email), "g")) ?? []).length).toBe(1);

        for (const i of [0, 2]) {
          await expect(anchors.nth(i)).toHaveAttribute("target", "_blank");
          expect((await anchors.nth(i).getAttribute("rel")) ?? "").toContain("noopener");
          await expect(anchors.nth(i)).toHaveAccessibleName(new RegExp(`${escapeRe(copy.newTab)}$`));
        }
        for (const i of [1, 3]) await expect(anchors.nth(i)).not.toHaveAttribute("target", /.*/);

        for (const [i, want] of [
          [0, new URL(links.location).href],
          [2, links.whatsapp],
        ] as const) {
          const [popup] = await Promise.all([page.context().waitForEvent("page"), anchors.nth(i).click()]);
          await popup.waitForURL(want);
          await popup.close();
        }
        // tel: and mailto: are asserted by href above; a click must leave this page where it is.
        for (const i of [1, 3]) {
          await anchors.nth(i).evaluate((el) => el.addEventListener("click", (e) => e.preventDefault(), { once: true }));
          await anchors.nth(i).click();
          expect(new URL(page.url()).pathname).toBe(url);
        }
        expect(watched.problems).toEqual([]);
      });

      test(`4 Message on WhatsApp: the live link in English, this language's sentence otherwise (${where})`, async ({ page }) => {
        const watched = await watch(page);
        await stubExternal(page);
        const d = await getContactDetails(locale);
        const links = contactLinks(d);
        const copy = CONTACT_PAGE_COPY[locale];
        await open(page, url);
        const button = page.locator('main a[href^="https://wa.me/971563883302?text="]');
        await expect(button).toHaveCount(1);
        await expect(button).toHaveAttribute("href", `https://wa.me/971563883302?text=${encodeURIComponent(d.whatsapp_message)}`);
        await expect(button).toHaveAttribute("href", links.whatsappMessage);
        if (locale === "en") expect(await button.getAttribute("href")).toBe(LIVE_WA);
        else {
          const text = new URL((await button.getAttribute("href"))!).searchParams.get("text");
          expect(text).toBe(d.whatsapp_message);
          expect(text).not.toBe((await getContactDetails("en")).whatsapp_message);
        }
        await expect(button).toHaveAccessibleName(`${copy.whatsappCta} ${copy.newTab}`);
        await expect(button).toHaveAttribute("target", "_blank");
        const gold = await token(page, "gold");
        expect(await style(button, "border-top-width")).toBe("1px");
        expect(await style(button, "border-top-color")).toBe(gold);
        expect(await style(button, "background-color")).not.toBe(gold);
        expect(await style(button, "border-top-left-radius")).toBe("0px");
        const [popup] = await Promise.all([page.context().waitForEvent("page"), button.click()]);
        await popup.waitForURL(links.whatsappMessage);
        await popup.close();
        expect(watched.problems).toEqual([]);
      });

      test(`5 one address and one number: page and footer agree (${where})`, async ({ page }) => {
        const watched = await watch(page);
        const d = await getContactDetails(locale);
        await open(page, url);
        const hrefs = (selector: string) => page.locator(selector).evaluateAll((as) => as.map((a) => a.getAttribute("href")));
        expect(await hrefs('main a[href^="mailto:"], footer a[href^="mailto:"]')).toEqual([`mailto:${d.email}`, `mailto:${d.email}`]);
        expect(await hrefs('main a[href^="tel:"], footer a[href^="tel:"]')).toEqual([`tel:${d.phone_e164}`, `tel:${d.phone_e164}`]);
        expect(await page.locator("main").innerText()).not.toContain("partnerships");
        expect(watched.problems).toEqual([]);
      });

      test(`6 frame: wordmark, nav and footer Pages (${where})`, async ({ page }) => {
        const watched = await watch(page);
        await checkFrameLinks(page, locale, PATH, width, watched);
      });

      test(`7 frame: language row and select, skip link, footer links, WhatsApp float (${where})`, async ({ page }) => {
        const watched = await watch(page);
        await checkLanguage(page, locale, PATH, width, watched);
        await checkSkipLink(page, locale, PATH);
        await checkFooterAndFloat(page, locale, PATH);
        expect(watched.problems).toEqual([]);
      });

      test(`8 hosts and look: no image in main, no foreign host, no overflow, square, light footer (${where})`, async ({ page }) => {
        const watched = await watch(page);
        const seen: string[] = [];
        page.on("request", (r) => seen.push(r.url()));
        await open(page, url);
        await expect(page.locator("main img")).toHaveCount(0);
        const outside = await page.locator("header img, footer img").evaluateAll((els) => els.map((el) => el.getAttribute("src") ?? ""));
        for (const src of outside) {
          expect(src.startsWith(`${MEDIA_BASE_URL}/`) || /^\/_next\/static\/media\//.test(src) || src.startsWith("data:image/svg+xml"), src.slice(0, 60)).toBe(true);
        }
        await scrollThrough(page);
        expect(watched.media.missing).toEqual([]);
        expect(seen.filter((u) => FOREIGN_HOSTS.test(u))).toEqual([]);
        expect(watched.problems).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        const radii = await page.locator("main a").evaluateAll((as) => as.map((a) => getComputedStyle(a).borderTopLeftRadius));
        expect(radii.length).toBeGreaterThan(0);
        expect(radii.every((r) => r === "0px")).toBe(true);
        const here = await style(page.locator("footer"), "background-color");
        expect(await homeFooterBackground(page, locale)).toBe(here);
      });

      test(`9 animations: visible with JavaScript off, still under reduced motion, A5/A7 with motion (${where})`, async ({ page, browser }) => {
        // (a) JavaScript off: the title block, both h2 blocks, the three detail groups, the button, everything in place.
        const off = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference", viewport: { width, height } });
        try {
          const p = await off.newPage();
          await p.goto(url, { waitUntil: "load" });
          expect(await p.locator("main [data-reveal]").count()).toBeGreaterThan(0);
          expect(await hiddenOrMoved(p), "hidden or moved with JavaScript off").toEqual([]);
          for (const el of await p.locator("main h1, main h2, main dl > div, main a").all()) await expect(el).toBeVisible();
        } finally {
          await off.close();
        }

        // (b) reduced motion: nothing runs and nothing moves at four scroll steps.
        await watch(page);
        await open(page, url);
        await motionReady(page);
        const total = await page.evaluate(() => document.documentElement.scrollHeight);
        for (const y of [0, total / 3, (2 * total) / 3, total]) {
          await scrollTo(page, y);
          expect(await runningAnimations(page), `running animations at ${y}`).toBe(0);
          expect(await hiddenOrMoved(page)).toEqual([]);
        }

        // (c) motion allowed: the detail groups (A7) and the Travel With Confidence heading block (A5) are hidden while
        // they are below the fold and reach 1 within 2 s of entering; at 1440 they may already be in view on load, then
        // they reach 1 within 2 s of load.
        const live = await browser.newContext({ reducedMotion: "no-preference", viewport: { width, height } });
        try {
          const p = await live.newPage();
          const liveWatch = await watch(p);
          await p.goto(url, { waitUntil: "load" });
          await p.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await motionReady(p);
          expect(await htmlAttr(p, "data-motion")).toBe("on");
          const targets = [...(await p.locator("main dl > [data-reveal='row']").all()), p.locator("#contact-confidence-heading").locator("xpath=ancestor::*[@data-reveal][1]")];
          expect(targets).toHaveLength(4);
          // First, before any scrolling: what is not on the screen has not played yet.
          const intersecting = async (target: (typeof targets)[number]) =>
            target.evaluate((el) => {
              const r = el.getBoundingClientRect();
              return r.top < window.innerHeight * 0.9 && r.bottom > 0;
            });
          const waiting: boolean[] = [];
          for (const target of targets) {
            const visible = await intersecting(target);
            waiting.push(!visible);
            if (!visible) expect(await style(target, "opacity"), "below the fold waits").not.toBe("1");
          }
          // Then each one, scrolled into view in turn, reaches 1 within 2 s (the ones in view on load play at load).
          for (const [i, target] of targets.entries()) {
            // Centre it: a block in the bottom tenth of the screen is "visible" to Playwright but not yet to the engine.
            if (waiting[i]) await target.evaluate((el) => el.scrollIntoView({ block: "center" }));
            await expect.poll(() => style(target, "opacity"), { timeout: 2_000, intervals: [100] }).toBe("1");
          }
          await scrollThrough(p);
          await p.waitForTimeout(1600);
          expect(await hiddenOrMoved(p)).toEqual([]);
          expect(liveWatch.problems).toEqual([]);
        } finally {
          await live.close();
        }
      });

      test(`10 a longer Settings address wraps inside its column and the screen (${where})`, async ({ page }) => {
        const watched = await watch(page);
        await open(page, url);
        const link = page.locator('main dl a[href^="mailto:"]');
        await expect(link).toHaveCount(1);
        const before = await box(link);
        const dl = await box(page.locator("main dl"));
        // The address comes from Dashboard > Settings and can be any length: put 170 characters in the shown text.
        const long = `${"private.journeys.concierge.team-".repeat(3)}reservations@${"subdomain-".repeat(6)}almarprivatejourney.com`;
        await link.locator("bdi").evaluate((el, text) => { el.textContent = text; }, long);
        const after = await box(link);
        const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), "horizontal overflow").toBeLessThanOrEqual(0);
        expect(after.x, "starts inside the column").toBeGreaterThanOrEqual(dl.x - 1);
        expect(after.x + after.width, "ends inside the column").toBeLessThanOrEqual(dl.x + dl.width + 1);
        expect(after.x + after.width, "ends inside the screen").toBeLessThanOrEqual(clientWidth);
        expect(after.height, "the address wrapped onto more lines").toBeGreaterThan(before.height);
        expect(watched.problems).toEqual([]);
      });
    });
  }
}

export type { Locale };
