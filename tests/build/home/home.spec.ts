import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { HOME_COPY } from "../../../lib/copy/home";
import { HOME_PAGE_COPY } from "../../../lib/copy/home-page";
import { FRAMER_SOURCE_COPY } from "../../../lib/copy/framer-source";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { getDestinations } from "../../../lib/data/destinations";
import { getCatalogItems } from "../../../lib/data/experiences";
import { EXPERIENCES_PAGE_COPY } from "../../../lib/copy/experiences-page";
import { getHomeBlocks, getJourneyTiers } from "../../../lib/data/home";
import { getStays } from "../../../lib/data/stays";
import { MEDIA_BASE_URL } from "../../../lib/data/media";
import { formatDate, formatRange } from "../../../lib/format";
import { filterStays, toStayQuery } from "../../../lib/data/stay-filter";
import { rewriteHomeAmounts, type SelectedCurrency } from "../../../lib/fx/rates";
import { fill, formatGuestSummary } from "../../../lib/journey-format";
import { LOCALES, localeDir, localePath, type Locale } from "../../../lib/locale-path";
import { routeMedia } from "../../helpers/media-route";

// Plan 03.3-04 Task 5: the React home on the assembled out/, served by local wrangler with the Cloudflare
// asset rules (plan 03's playwright.build.config.ts). Every control that is rendered is clicked and its
// result asserted; every held control is shown absent. Run, after `node scripts/assemble-cloudflare.mjs`:
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/home/home.spec.ts --workers=1
// Every expected string is read from the copy tables of that locale, never typed in English. Images come
// through routeMedia (plan 07): until the media host is live the pages point at a placeholder host.

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "desktop", width: 1440, height: 900 },
] as const;
type Viewport = (typeof VIEWPORTS)[number];

/** Tailwind `md` (48rem): the phone entry and sheet below it, the full bar from it up. */
const isPhone = (vp: Viewport) => vp.width < 768;

const FORBIDDEN_HOSTS = /framerusercontent\.com|files\.catbox\.moe|videos\.pexels\.com/;
const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };
const NEXT: Record<Locale, Locale> = { en: "ar", ar: "es", es: "en" };

const home = (locale: Locale) => localePath(locale, "/");
const nameOfCurrency = (locale: Locale, code: string) => JOURNEY_COPY[locale].locale.currency.replace("{code}", code);
const nameOfLanguage = (locale: Locale) => JOURNEY_COPY[locale].locale.language.replace("{name}", LANGUAGE_NAMES[locale]);

/** The three services the signed home shows, by slug and in this order. Pinned on purpose: it is the live home's trio. */
const HOME_SERVICE_SLUGS = ["24-7-private-concierge", "luxury-ground-transport", "vip-airport-meet-greet"] as const;

/** "Today" for every test: the dates the journey picks are in the future of it and the past days stay unpickable. */
const FIXED_NOW = "2026-10-04T09:00:00+04:00";

// ---- page helpers ------------------------------------------------------------------------------------

type Visit = { media: Awaited<ReturnType<typeof routeMedia>>; requests: string[] };

/** Open a home page with images routed and every request recorded. Network idle capped at 10 s, then a settle. */
async function visit(page: Page, locale: Locale, path = home(locale), clock: "fixed" | "install" = "fixed"): Promise<Visit> {
  // "fixed": only Date.now stands still, timers run. "install": the page's timers are Playwright's too (the strip test).
  if (clock === "install") await page.clock.install({ time: new Date(FIXED_NOW) });
  else await page.clock.setFixedTime(FIXED_NOW);
  const media = await routeMedia(page);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(path);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await hydrated(page);
  await page.waitForTimeout(200);
  return { media, requests };
}

/** React puts __reactProps on a node when it hydrates it: wait for the planner's own button. */
async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector('[role="region"] button');
    return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
  });
}

const region = (page: Page, locale: Locale) => page.getByRole("region", { name: HOME_PAGE_COPY[locale].hero.barLabel });

/** The currency or language control: from the 1152px container up the nav is a row, below it a Menu. */
async function navControl(page: Page, locale: Locale, name: string) {
  const control = page.getByRole("combobox", { name });
  if (!(await control.isVisible())) {
    await page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true }).click();
  }
  return control;
}

const guestName = (locale: Locale, unit: "adult" | "child" | "infant") =>
  fill(JOURNEY_COPY[locale].guests.add, { group: JOURNEY_COPY[locale].guests.group[unit] });

// ---- the journey bar: Where -> When -> Who -> Search --------------------------------------------------

/** Where the planner is driven from: the hero's, or the docked one that follows the page. */
type Scope = "hero" | "docked";
/** How much of the journey a test fills in before it presses Search. */
type Fill = "nothing" | "destination" | "all";

const SEARCH_FROM = "2026-10-12";
const SEARCH_TO = "2026-10-15";
/** Two guests: the bar starts at one adult, the journey adds one. */
const SEARCH_GUESTS = 2;

const cartagenaOf = async (locale: Locale) => (await getDestinations(locale)).find((d) => d.slug === "cartagena")!;
const dayButton = (page: Page, isoDate: string) => page.locator(`[data-date="${isoDate}"]`);
const planner = (page: Page, locale: Locale, scope: Scope) => (scope === "hero" ? region(page, locale) : page.locator("div.fixed"));
const searchTarget = (locale: Locale) =>
  `${localePath(locale, "/private-stays")}?${toStayQuery({ destination: "cartagena", from: SEARCH_FROM, to: SEARCH_TO, guests: SEARCH_GUESTS })}`;

/**
 * Fill the planner as far as `how` says, without pressing Search. From md up it drives the bar; below it the entry row and the
 * sheet. Returns the Search button (the bar's, or the sheet's step 3) when everything is filled in, else null. For "destination"
 * on a phone the sheet is left open on step 2.
 */
async function fillPlanner(page: Page, locale: Locale, vp: Viewport, scope: Scope, how: Fill) {
  const copy = JOURNEY_COPY[locale];
  const cartagena = await cartagenaOf(locale);
  const root = planner(page, locale, scope);

  if (!isPhone(vp)) {
    const bar = root.getByRole("search", { name: copy.bar.label });
    if (how === "nothing") return;
    await bar.getByRole("button", { name: copy.bar.destination.label }).click();
    await page.getByRole("listbox", { name: copy.menu.label }).getByRole("option").filter({ hasText: cartagena.name }).click();
    await expect(bar.getByRole("button", { name: copy.bar.destination.label })).toContainText(cartagena.name);
    // Picking a destination opens When by itself (D-39).
    await expect(page.getByRole("group", { name: copy.dates.label })).toBeVisible();
    if (how === "destination") {
      await page.keyboard.press("Escape");
      await expect(page.getByRole("group", { name: copy.dates.label })).toHaveCount(0);
      return;
    }
    await dayButton(page, SEARCH_FROM).click();
    await dayButton(page, SEARCH_TO).click();
    await page.getByRole("group", { name: copy.dates.label }).getByRole("button", { name: copy.done, exact: true }).click();
    await expect(bar.getByRole("button", { name: copy.bar.dates.label })).toContainText(formatRange(isoDmy(SEARCH_FROM), isoDmy(SEARCH_TO)));
    // Done moves on to Who.
    await page.getByRole("button", { name: guestName(locale, "adult"), exact: true }).click();
    await expect(bar.getByRole("button", { name: copy.bar.guests.label })).toContainText(
      formatGuestSummary({ adults: 2, children: 0, infants: 0 }, locale, copy.guests.summary),
    );
    await page.getByRole("group", { name: copy.guests.label }).getByRole("button", { name: copy.done, exact: true }).click();
    await expect(page.getByRole("group", { name: copy.guests.label })).toHaveCount(0);
    return;
  }

  // Phone: the entry row (hero) or the docked row opens the three-step sheet.
  const entry = scope === "hero" ? root.getByRole("button") : root.getByRole("button", { name: new RegExp(copy.entry.title) });
  await entry.click();
  const sheet = page.getByRole("dialog", { name: copy.sheet.label });
  await expect(sheet).toBeVisible();
  if (how === "nothing") return;
  await sheet.getByRole("option", { name: new RegExp(cartagena.name) }).click();
  await expect(sheet.getByText(fill(copy.sheet.progress, { n: 2 }), { exact: true })).toBeVisible();
  if (how === "destination") return;
  await dayButton(page, SEARCH_FROM).click();
  await dayButton(page, SEARCH_TO).click();
  await sheet.getByRole("button", { name: copy.sheet.next, exact: true }).click();
  await expect(sheet.getByText(fill(copy.sheet.progress, { n: 3 }), { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: guestName(locale, "adult"), exact: true }).click();
}

/** The Search control of the planner just filled: the bar's submit button, or the sheet's last-step button. */
const searchButton = (page: Page, locale: Locale, vp: Viewport, scope: Scope) =>
  isPhone(vp)
    ? page.getByRole("dialog", { name: JOURNEY_COPY[locale].sheet.label }).getByRole("button", { name: JOURNEY_COPY[locale].bar.search, exact: true })
    : planner(page, locale, scope).getByRole("button", { name: JOURNEY_COPY[locale].bar.search, exact: true });

/** DD/MM/YYYY from an ISO day, through the shared formatter. */
function isoDmy(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return formatDate(d, m, y);
}

/** The card titles of the stays list, in order (plan 05's own locator). */
const listTitles = (page: Page) => page.locator("main ul[role='list'] > li > a > span > span:first-child").allTextContents();

/** The product of an element's opacity and every ancestor's: 1 means it can be seen. */
const effectiveOpacity = (locator: ReturnType<Page["locator"]>) =>
  locator.first().evaluate((node) => {
    let opacity = 1;
    for (let el: Element | null = node; el; el = el.parentElement) opacity *= Number(getComputedStyle(el).opacity);
    return opacity;
  });

/** The home's three published cards with a photo, as the page builds them (first three with a hero image). */
async function homeStayTitles(locale: Locale): Promise<string[]> {
  return (await getStays(locale)).filter((stay) => stay.hero_image).map((stay) => stay.title).slice(0, 3);
}

/** How many of those cards show: three from md, two below it. */
const shownCards = (vp: Viewport) => (isPhone(vp) ? 2 : 3);

/** The visible card titles of the home's Private Stays section, in order. */
const homeCardTitles = (page: Page) => page.locator("#stays ul li:visible a > span:last-child > span:first-child").allTextContents();

const sectionText = (page: Page) =>
  page.locator("main").evaluate((root) => {
    const copy = root.cloneNode(true) as HTMLElement;
    copy.querySelectorAll("[data-price], [data-testid=rates-line]").forEach((node) => node.remove());
    return copy.textContent;
  });
const priceTexts = (page: Page) => page.locator("[data-price]").evaluateAll((nodes) => nodes.map((node) => node.textContent));

// ---- the matrix --------------------------------------------------------------------------------------

for (const vp of VIEWPORTS) {
  for (const locale of LOCALES) {
    const where = `${locale} at ${vp.width}`;
    const copy = HOME_PAGE_COPY[locale];
    const published = HOME_COPY[locale].journeys.map((tier) => tier.price);

    test.describe(`home ${where}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test(`1 served bytes: lang, dir and the content with JavaScript off (${where})`, async ({ browser, request, baseURL }) => {
        const raw = await (await request.get(home(locale))).text();
        const tag = /<html\b[^>]*>/i.exec(raw)?.[0] ?? "";
        expect(tag).toMatch(new RegExp(`\\slang="${locale}"`));
        expect(tag).toMatch(new RegExp(`\\sdir="${localeDir(locale)}"`));

        const context = await browser.newContext({ baseURL, viewport: { width: vp.width, height: vp.height }, javaScriptEnabled: false });
        try {
          const bare = await context.newPage();
          const media = await routeMedia(bare);
          await bare.goto(home(locale));
          const h1 = bare.getByRole("heading", { level: 1 });
          await expect(h1).toBeVisible();
          await expect(h1).toHaveText(HOME_COPY[locale].heroTitle);
          expect(await bare.evaluate(() => document.documentElement.dir)).toBe(localeDir(locale));
          expect(await bare.evaluate(() => document.documentElement.lang)).toBe(locale);
          // The hero headline is centred on the page.
          const box = (await h1.boundingBox())!;
          expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThanOrEqual(2);
          // Nothing is hidden by the reveal system without the script: the headline, the Welcome letter, both section heads
          // and every visible card title are at full opacity.
          expect(await effectiveOpacity(h1), "h1").toBe(1);
          expect(await effectiveOpacity(bare.locator("#welcome [data-reveal=letter]")), "Welcome letter").toBe(1);
          expect(await effectiveOpacity(bare.locator("#gallery h2")), "gallery head").toBe(1);
          expect(await effectiveOpacity(bare.locator("#stays h2")), "stays head").toBe(1);
          const titles = bare.locator("#stays ul li:visible a > span:last-child > span:first-child");
          await expect(titles).toHaveCount(shownCards(vp));
          for (let i = 0; i < shownCards(vp); i += 1) expect(await effectiveOpacity(titles.nth(i)), `card ${i}`).toBe(1);
          // The planner is shown as served: the bar from md, the entry row below it.
          const planner = region(bare, locale);
          if (isPhone(vp)) await expect(planner.getByRole("button")).toBeVisible();
          else await expect(planner.getByRole("search", { name: JOURNEY_COPY[locale].bar.label })).toBeVisible();
          expect(await priceTexts(bare)).toEqual(published);
          expect(media.missing).toEqual([]);
        } finally {
          await context.close();
        }
      });

      test(`2 section order, one h1, Welcome photos and letter apart, the strip, no team block, no video (${where})`, async ({ page }, testInfo) => {
        const { media } = await visit(page, locale);
        const blocks = await getHomeBlocks(locale);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("h1")).toHaveText(HOME_COPY[locale].heroTitle);
        // The computed size of the headline, recorded for the hand-over (owner answer 2; asserted nowhere).
        const h1Size = await page.locator("h1").evaluate((node) => getComputedStyle(node).fontSize);
        testInfo.annotations.push({ type: "h1 font-size", description: `${h1Size} at ${vp.width}` });
        const headings = (await page.locator("main h2").allTextContents()).map((text) => text.trim());
        expect(headings).toEqual([
          HOME_COPY[locale].welcomeTitle,
          HOME_COPY[locale].galleryTitle,
          copy.stays.heading,
          copy.services.heading,
          copy.moments.heading,
          copy.journeys.heading,
          copy.stories.heading,
          copy.begin.heading,
        ]);
        for (const [id, text] of [
          ["welcome", HOME_COPY[locale].welcomeTitle],
          ["gallery", HOME_COPY[locale].galleryTitle],
          ["stays", copy.stays.heading],
        ]) {
          await expect(page.locator(`#${id}`), `section id ${id}`).toHaveCount(1);
          await expect(page.locator(`#${id} h2`)).toHaveText(text);
        }

        // Welcome: five photos from the data, shown from md and not drawn below it (as on the live phone page).
        expect(blocks.welcome.images).toHaveLength(5);
        const photos = page.locator("#welcome img[data-scroll=drop]");
        await expect(photos).toHaveCount(blocks.welcome.images.length);
        for (let i = 0; i < blocks.welcome.images.length; i += 1) {
          if (isPhone(vp)) {
            // The photo layer is display none below md, so no photo is drawn (and none is fetched).
            expect(await photos.nth(i).evaluate((node) => getComputedStyle(node.parentElement!).display), `photo ${i} layer`).toBe("none");
            await expect(photos.nth(i), `photo ${i}`).toBeHidden();
          } else await expect(photos.nth(i), `photo ${i}`).toBeVisible();
        }
        if (!isPhone(vp)) {
          // Scroll through the section in steps: no photo's box ever meets the letter's box (the photos slide with the scroll).
          const meets = await page.evaluate(async () => {
            const section = document.querySelector("#welcome") as HTMLElement;
            const letter = section.querySelector("[data-reveal=letter]") as HTMLElement;
            const imgs = [...section.querySelectorAll("img[data-scroll=drop]")] as HTMLElement[];
            const top = section.getBoundingClientRect().top + window.scrollY;
            const found: string[] = [];
            const frame = () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
            for (let y = Math.max(0, top - window.innerHeight); y <= top + section.offsetHeight; y += 200) {
              window.scrollTo(0, y);
              await frame();
              const a = letter.getBoundingClientRect();
              imgs.forEach((img, i) => {
                const b = img.getBoundingClientRect();
                if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) found.push(`photo ${i + 1} at scroll ${y}`);
              });
            }
            return found;
          });
          expect(meets, "a Welcome photo met the letter").toEqual([]);
        }

        // Gallery: one slide per photo of the data, inside the strip.
        await expect(page.locator("#gallery [aria-roledescription=slide]")).toHaveCount(blocks.gallery.images.length);
        // Zero published members: neither the kicker nor the heading exists anywhere.
        await expect(page.getByText(copy.team.kicker)).toHaveCount(0);
        await expect(page.getByText(copy.team.heading)).toHaveCount(0);
        await expect(page.locator("video")).toHaveCount(0);

        // The second half: card counts and Begin's box (plan 44). Begin is the viewport's full width.
        await expect(page.locator("#services ul li:visible")).toHaveCount(shownCards(vp));
        await expect(page.locator("#stories ul li:visible")).toHaveCount(blocks.stories.length);
        expect(blocks.stories).toHaveLength(3);
        const begin = await page.locator("#begin").boundingBox();
        expect(begin!.x).toBe(0);
        expect(Math.round(begin!.width)).toBe(vp.width);
        expect(begin!.height).toBeGreaterThanOrEqual(isPhone(vp) ? 360 : 600);
        expect(media.missing).toEqual([]);
      });

      test(`3 Search: Where, When, Who, then Search opens the list with the query and the matching stays (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const all = await getStays(locale);
        const filter = { destination: "cartagena", from: SEARCH_FROM, to: SEARCH_TO, guests: SEARCH_GUESTS };
        const want = filterStays(all, filter);
        // Availability is really applied: the sample blocked days take a Cartagena stay out of this set.
        const withoutDates = filterStays(all, { destination: "cartagena", guests: SEARCH_GUESTS });
        expect(withoutDates.map((s) => s.slug)).toContain("casa-jardin-san-diego");
        expect(want.map((s) => s.slug)).not.toContain("casa-jardin-san-diego");
        expect(want.length).toBeGreaterThan(0);

        await fillPlanner(page, locale, vp, "hero", "all");
        await searchButton(page, locale, vp, "hero").click();
        const target = searchTarget(locale);
        await page.waitForURL((url) => url.pathname + url.search === target);
        expect(new URL(page.url()).pathname).toBe(localePath(locale, "/private-stays"));
        expect(new URL(page.url()).search).toBe(`?${toStayQuery({ destination: "cartagena", from: SEARCH_FROM, to: SEARCH_TO, guests: SEARCH_GUESTS })}`);
        await expect.poll(() => listTitles(page), { message: "the list shows the stays the filter computes" }).toEqual(want.map((s) => s.title));
        expect(media.missing).toEqual([]);
      });

      test(`3b missing step: Search with a step missing shows the bar's error and goes nowhere (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const copyJ = JOURNEY_COPY[locale];
        const stay = () => expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(home(locale));
        if (!isPhone(vp)) {
          const root = planner(page, locale, "hero");
          const alert = root.getByRole("alert");
          await searchButton(page, locale, vp, "hero").click();
          await expect(alert).toHaveText(copyJ.bar.error.both);
          stay();
          await fillPlanner(page, locale, vp, "hero", "destination");
          await searchButton(page, locale, vp, "hero").click();
          await expect(alert).toHaveText(copyJ.bar.error.dates);
          stay();
        } else {
          // The sheet checks each step before it goes on: Where, then When; Search itself is on step 3 and needs both.
          await fillPlanner(page, locale, vp, "hero", "nothing");
          const sheet = page.getByRole("dialog", { name: copyJ.sheet.label });
          await sheet.getByRole("button", { name: copyJ.sheet.next, exact: true }).click();
          await expect(sheet.getByRole("alert")).toHaveText(copyJ.sheet.warn.where);
          await sheet.getByRole("option", { name: new RegExp((await cartagenaOf(locale)).name) }).click();
          await expect(sheet.getByText(fill(copyJ.sheet.progress, { n: 2 }), { exact: true })).toBeVisible();
          await sheet.getByRole("button", { name: copyJ.sheet.next, exact: true }).click();
          await expect(sheet.getByRole("alert")).toHaveText(copyJ.sheet.warn.when);
          await expect(sheet.getByRole("button", { name: copyJ.bar.search, exact: true })).toHaveCount(0);
          stay();
        }
        expect(media.missing).toEqual([]);
      });

      test(`4 the stay cards are the first ones, fixed: the bar does not filter them (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const stays = page.locator("#stays");
        const first = await homeStayTitles(locale);
        expect(first).toHaveLength(3);
        const expectFixed = async (why: string) => {
          expect(await homeCardTitles(page), why).toEqual(first.slice(0, shownCards(vp)));
        };
        await expectFixed("on load");
        // No count line, no live region: the bar's Search does that job on the list page.
        await expect(stays.locator("p[aria-live]")).toHaveCount(0);
        await expect(stays.locator("[aria-live]")).toHaveCount(0);

        // Picking a destination in the bar changes nothing under it.
        const medellin = (await getDestinations(locale)).find((d) => d.slug === "medellin")!;
        const c = JOURNEY_COPY[locale];
        if (!isPhone(vp)) {
          const bar = region(page, locale).getByRole("search", { name: c.bar.label });
          await bar.getByRole("button", { name: c.bar.destination.label }).click();
          await page.getByRole("listbox", { name: c.menu.label }).getByRole("option").filter({ hasText: medellin.name }).click();
          await expect(bar.getByRole("button", { name: c.bar.destination.label })).toContainText(medellin.name);
          await page.keyboard.press("Escape");
        } else {
          await region(page, locale).getByRole("button").click();
          const sheet = page.getByRole("dialog", { name: c.sheet.label });
          await sheet.getByRole("option", { name: new RegExp(medellin.name) }).click();
          await expect(sheet.getByText(fill(c.sheet.progress, { n: 2 }), { exact: true })).toBeVisible();
          await page.keyboard.press("Escape");
          await expect(sheet).toHaveCount(0);
        }
        await expectFixed("after Medellín is picked");

        // View All Private Stays is an <a> to the plain list address, never the query.
        const viewAll = stays.getByRole("link", { name: copy.stays.viewAll, exact: true });
        expect(await viewAll.evaluate((node) => node.tagName)).toBe("A");
        await expect(viewAll).toHaveAttribute("href", localePath(locale, "/private-stays"));
        // Three cards at md and up, two below it, and View All.
        await expect(stays.locator("a:visible")).toHaveCount(shownCards(vp) + 1);
        await viewAll.click();
        await page.waitForURL((url) => url.pathname + url.search === localePath(locale, "/private-stays"));
        expect(media.missing).toEqual([]);
      });

      test(`5 docked: the planner follows the page once the hero has scrolled away, and its Search goes to the list (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const c = JOURNEY_COPY[locale];
        await page.evaluate(() => window.scrollTo(0, document.querySelector("#welcome")!.getBoundingClientRect().top + window.scrollY));
        const docked = page.locator("div.fixed");
        if (!isPhone(vp)) await expect(docked.getByRole("search", { name: c.bar.label })).toBeVisible();
        else await expect(docked.getByRole("button", { name: new RegExp(c.entry.title) })).toBeVisible();
        await fillPlanner(page, locale, vp, "docked", "all");
        await searchButton(page, locale, vp, "docked").click();
        await page.waitForURL((url) => url.pathname + url.search === searchTarget(locale));
        expect(media.missing).toEqual([]);
      });

      test(`5b docked: gone again at the top of the page (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const c = JOURNEY_COPY[locale];
        await page.evaluate(() => window.scrollTo(0, document.querySelector("#welcome")!.getBoundingClientRect().top + window.scrollY));
        const docked = page.locator("div.fixed");
        if (!isPhone(vp)) await expect(docked.getByRole("search", { name: c.bar.label })).toBeVisible();
        else await expect(docked.getByRole("button", { name: new RegExp(c.entry.title) })).toBeVisible();
        await page.evaluate(() => window.scrollTo(0, 0));
        if (!isPhone(vp)) await expect(page.locator("div.fixed").getByRole("search", { name: c.bar.label })).toHaveCount(0);
        else await expect(page.locator("div.fixed").getByRole("button", { name: new RegExp(c.entry.title) })).toHaveCount(0);
        expect(media.missing).toEqual([]);
      });

      test(`6 currency: three prices move together, survive a language switch and a reload (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const journeys = page.locator("#journeys");
        const date = await journeys.getAttribute("data-fx-date");
        if (date === null) {
          // No exchange rates were read at build time: no currency control, the published strings stay.
          test.info().annotations.push({ type: "currency", description: "rates unavailable at build" });
          if (vp.width < 1152) await page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true }).click();
          await expect(page.getByRole("combobox", { name: nameOfCurrency(locale, HOME_COPY[locale].nav.currency) })).toHaveCount(0);
          expect(await priceTexts(page)).toEqual(published);
          expect(media.missing).toEqual([]);
          return;
        }
        const rates = {
          aed: Number(await journeys.getAttribute("data-fx-aed")),
          eur: Number(await journeys.getAttribute("data-fx-eur")),
          date,
        };
        const [year, month, day] = date.split("-").map(Number);
        const ratesLine = copy.journeys.ratesOf.replace("{date}", formatDate(day, month, year));
        const before = await sectionText(page);
        expect(await priceTexts(page)).toEqual(published);
        await expect(page.getByTestId("rates-line")).toHaveCount(0);

        let current = nameOfCurrency(locale, HOME_COPY[locale].nav.currency);
        for (const code of ["USD", "AED", "EUR"] as SelectedCurrency[]) {
          await (await navControl(page, locale, current)).click();
          await page.getByRole("option", { name: code, exact: true }).click();
          current = nameOfCurrency(locale, code);
          await expect(page.getByRole("combobox", { name: current })).toBeVisible();
          expect(await priceTexts(page), code).toEqual(published.map((label) => rewriteHomeAmounts(label, code, rates, locale)));
          expect(await sectionText(page), `nothing but the prices moved after ${code}`).toBe(before);
          await expect(page.getByTestId("rates-line")).toHaveText(ratesLine);
        }

        // Language switch: the next language's home, the same currency, the prices in that language.
        const target = NEXT[locale];
        await (await navControl(page, locale, nameOfLanguage(locale))).click();
        await page.getByRole("option", { name: LANGUAGE_NAMES[target], exact: true }).click();
        await page.waitForURL((url) => url.pathname === home(target));
        await hydrated(page);
        await page.waitForTimeout(200);
        const inTarget = HOME_COPY[target].journeys.map((tier) => rewriteHomeAmounts(tier.price, "EUR", rates, target));
        await expect.poll(() => priceTexts(page)).toEqual(inTarget);
        await (await navControl(page, target, nameOfCurrency(target, "EUR"))).waitFor();
        expect(await page.evaluate(() => window.localStorage.getItem("almar-currency"))).toBe("EUR");
        if (target === "ar") for (const text of await priceTexts(page)) expect(text).not.toMatch(/[٠-٩]/);

        await page.reload();
        await hydrated(page);
        await expect.poll(() => priceTexts(page)).toEqual(inTarget);
        expect(media.missing).toEqual([]);
      });

      test(`7 gallery strip: arrows, four dots, swipe, no autoplay (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale, home(locale), "install");
        const total = (await getHomeBlocks(locale)).gallery.images.length;
        const slider = page.locator("#gallery section[aria-roledescription=carousel]");
        await slider.scrollIntoViewIfNeeded();
        const dot = (n: number) => slider.getByRole("button", { name: fill(copy.gallery.goTo, { n }), exact: true });
        const line = (n: number) => fill(copy.gallery.slide, { n, total });
        const live = slider.locator("[aria-live]");
        // Four dots for eight photos (one per two), arrows, and the live line starts on photo 1.
        for (const n of [1, 2, 3, 4]) await expect(dot(n), `dot ${n}`).toHaveCount(1);
        await expect(dot(5)).toHaveCount(0);
        await expect(slider.getByRole("button", { name: copy.gallery.previous, exact: true })).toHaveCount(1);
        await expect(slider.getByRole("button", { name: copy.gallery.next, exact: true })).toHaveCount(1);
        await expect(live).toHaveText(line(1));

        // No autoplay: five seconds of the page's own clock change nothing.
        await page.clock.pauseAt(new Date("2026-10-04T09:01:00+04:00"));
        await page.clock.runFor(5000);
        await expect(live).toHaveText(line(1));
        await page.clock.resume();

        await slider.getByRole("button", { name: copy.gallery.next, exact: true }).click();
        await expect(live).toHaveText(line(2));
        await dot(4).click();
        await expect(live).toHaveText(line(7));
        await dot(1).click();
        await expect(live).toHaveText(line(1));
        await slider.getByRole("button", { name: copy.gallery.previous, exact: true }).click();
        await expect(live).toHaveText(line(total));
        // Let the slide finish moving before the swipe.
        await page.waitForTimeout(1600);

        // A 120 px swipe toward the inline start is "next": leftward in en and es, rightward in Arabic.
        const box = (await slider.boundingBox())!;
        const y = box.y + box.height / 2;
        // On the first slide's side (its photo is always there; the strip has empty room beyond the last photo).
        // The swipe starts and ends on photos: 220 px in from the edge, so a 120 px drag stays clear of the 44 px arrow.
        const x = locale === "ar" ? box.x + box.width - 220 : box.x + 220;
        const dx = locale === "ar" ? 120 : -120;
        await page.mouse.move(x, y);
        await page.mouse.down();
        await page.mouse.move(x + dx, y, { steps: 8 });
        await page.mouse.up();
        await expect(live).toHaveText(line(1));
        expect(media.missing).toEqual([]);
      });

      test(`8 every link goes where it says (${where})`, async ({ page, request }) => {
        const { media } = await visit(page, locale);
        const stays = await getStays(locale);
        const blocks = await getHomeBlocks(locale);
        const experiences = localePath(locale, "/experiences");
        // [label, locator, expected pathname, expected search]
        const cases: Array<[string, () => ReturnType<Page["locator"]>, string, string]> = [
          ["a stay card", () => page.locator("#stays ul a").first(), localePath(locale, `/private-stays/${stays[0].slug}`), ""],
          ["View All Services", () => page.getByRole("link", { name: copy.services.viewAll }), experiences, "?type=service"],
          ["Read All", () => page.getByRole("link", { name: copy.stories.readAll }), localePath(locale, "/blog"), ""],
          ["Request Consultation (curated)", () => page.locator("#experiences").getByRole("link", { name: copy.moments.cta }), localePath(locale, "/contact"), ""],
          ["Request Consultation (begin)", () => page.locator("#begin").getByRole("link", { name: copy.begin.cta }), localePath(locale, "/contact"), ""],
          ["a service card", () => page.locator("#services ul a").first(), experiences, `?type=service&item=${HOME_SERVICE_SLUGS[0]}`],
          ["a story card", () => page.locator("#stories ul a").first(), localePath(locale, `/blog/${blocks.stories[0].slug}`), ""],
          ["the wordmark", () => page.getByRole("link", { name: "ALMAR Private Journeys home" }), home(locale), ""],
        ];
        for (const [label, locate, path, search] of cases) {
          await page.goto(home(locale));
          await hydrated(page);
          const link = locate();
          await expect(link, label).toBeVisible();
          await link.click();
          await page.waitForURL((url) => url.pathname === path, { timeout: 15_000 });
          expect(new URL(page.url()).pathname, label).toBe(path);
          expect(new URL(page.url()).search, label).toBe(search);
        }

        // Every distinct same-origin address on the page answers 200. The stay list and stay pages of the
        // other two languages belong to plans 05 and 06: until those are assembled their addresses are named
        // and skipped, never silently passed.
        await page.goto(home(locale));
        const hrefs = await page.locator("a[href]").evaluateAll((nodes) =>
          [...new Set(nodes.map((node) => node.getAttribute("href") ?? ""))].filter((href) => href.startsWith("/")),
        );
        const pending: string[] = [];
        for (const href of hrefs) {
          const pathname = href.split("?")[0];
          const unbuilt = /^\/(ar|es)\/private-stays(\/|$)/.test(pathname) && !existsSync(`out${pathname}.html`);
          if (unbuilt) {
            pending.push(href);
            continue;
          }
          const response = await request.get(href);
          expect(response.status(), href).toBe(200);
        }
        if (pending.length > 0) {
          test.info().annotations.push({ type: "pending plans 05/06", description: `${pending.length} addresses not assembled: ${pending.slice(0, 3).join(", ")}...` });
        }
        // The two destination cards are articles, not links.
        const destinations = await getDestinations(locale);
        for (const destination of destinations) {
          const card = page.locator("#experiences article").filter({ hasText: destination.name });
          await expect(card).toHaveCount(1);
          await expect(card.locator("a")).toHaveCount(0);
        }
        expect(media.missing).toEqual([]);
      });

      test(`8b a service card opens its overlay on /experiences (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const services = await getCatalogItems(locale, { kind: "service" });
        const trio = HOME_SERVICE_SLUGS.map((slug) => services.find((s) => s.slug === slug)!);
        expect(trio.every(Boolean)).toBe(true);
        const experiences = localePath(locale, "/experiences");
        const links = page.locator("#services ul a");
        await expect(links).toHaveCount(3);
        expect(await links.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")))).toEqual(
          HOME_SERVICE_SLUGS.map((slug) => experiences + "?type=service&item=" + slug),
        );
        // en 0, ar 1, es 2; the phone shows two cards, so the third is only clicked from md up (all three links stay in the page).
        const index = Math.min(LOCALES.indexOf(locale), shownCards(vp) - 1);
        const service = trio[index];
        await links.nth(index).click();
        await page.waitForURL((url) => url.pathname === experiences, { timeout: 15_000 });
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible({ timeout: 15_000 });
        await expect(dialog.getByRole("heading", { level: 2, name: service.name, exact: true })).toBeVisible();
        expect(new URL(page.url()).searchParams.get("item")).toBe(service.slug);
        expect(new URL(page.url()).searchParams.get("type")).toBe("service");
        await page.waitForTimeout(500);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
        const after = new URL(page.url());
        expect(after.searchParams.has("item")).toBe(false);
        expect(after.searchParams.get("type")).toBe("service");
        const groups = EXPERIENCES_PAGE_COPY[locale].groups;
        // A group head is its name then a count in one h2, so the name is matched as a prefix.
        const head = (name: string) => page.getByRole("heading", { level: 2, name: new RegExp("^" + name) });
        await expect(head(groups.services)).toBeVisible();
        await expect(head(groups.experiences)).toHaveCount(0);
        expect(media.missing).toEqual([]);
      });

      test(`9 the held controls are absent; Search is the one submit (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const names = [
          HOME_COPY[locale].nav.login,
          HOME_COPY[locale].subscribe,
          HOME_COPY[locale].listTitle,
          JOURNEY_COPY[locale].addons.add,
          JOURNEY_COPY[locale].addons.continue,
          "Cart",
          "السلة",
          "Carrito",
          (FRAMER_SOURCE_COPY[locale] as Record<string, string>)["Design your journey"],
          (FRAMER_SOURCE_COPY[locale] as Record<string, string>)["Discover the Journey"],
          "See Packages",
        ].filter((name): name is string => typeof name === "string" && name.length > 0);
        const search = JOURNEY_COPY[locale].bar.search;
        const searchButtons = page.getByRole("button", { name: search, exact: true });

        // Search: from md up exactly one submit button, inside the hero bar's search form and named Search.
        if (!isPhone(vp)) {
          await expect(page.locator("button[type=submit]")).toHaveCount(1);
          await expect(region(page, locale).locator("button[type=submit]")).toHaveCount(1);
          await expect(searchButtons).toHaveCount(1);
          await expect(searchButtons).toHaveAttribute("type", "submit");
          await expect(page.locator("form")).toHaveCount(1);
          await expect(region(page, locale).getByRole("search")).toHaveCount(1);
        } else {
          // Below md the bar is not drawn: Search lives only on the sheet's last step, a plain button.
          await expect(searchButtons).toHaveCount(0);
          await fillPlanner(page, locale, vp, "hero", "all");
          const sheet = page.getByRole("dialog", { name: JOURNEY_COPY[locale].sheet.label });
          await expect(sheet.getByRole("button", { name: search, exact: true })).toHaveCount(1);
          await expect(searchButtons).toHaveCount(1);
          await expect(searchButtons).toHaveAttribute("type", "button");
          await page.keyboard.press("Escape");
          await expect(sheet).toHaveCount(0);
        }

        // The nav menu is closed below 1152px: open it so its controls are on the page too.
        if (vp.width < 1152) await page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true }).click();
        for (const name of names) {
          await expect(page.getByRole("button", { name, exact: true }), `button ${name}`).toHaveCount(0);
          await expect(page.getByRole("link", { name, exact: true }), `link ${name}`).toHaveCount(0);
        }
        await expect(page.locator("footer form")).toHaveCount(0);
        await expect(page.getByRole("textbox")).toHaveCount(0);
        await expect(page.locator("input[type=email]")).toHaveCount(0);
        expect(media.missing).toEqual([]);
      });

      test(`10 images, hosts, overflow, gold line, square corners (${where})`, async ({ page }) => {
        const { media, requests } = await visit(page, locale);
        // Scroll through the page once so the lazy pictures on the page are fetched. A picture that is not drawn (the Welcome
        // photos below md) or that has not been asked for yet (a strip slide far from the visible ones: currentSrc is empty
        // until the browser starts the fetch) is not checked; one that was asked for and arrived empty is "broken".
        await page.evaluate(async () => {
          for (let y = 0; y < document.documentElement.scrollHeight; y += 500) {
            window.scrollTo(0, y);
            await new Promise((resolve) => setTimeout(resolve, 60));
          }
          window.scrollTo(0, 0);
        });
        await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
        const drawn = await page.locator("img").evaluateAll((nodes) =>
          nodes
            .filter((node) => (node as HTMLElement).checkVisibility() && (node as HTMLImageElement).currentSrc !== "")
            .map((node) => (node as HTMLImageElement).currentSrc),
        );
        // Every drawn picture is on the media host, except the nav wordmark (a repo file) and the footer wordmark (a data: URI, plan 41).
        const outside = drawn.filter((src) => !src.startsWith(`${MEDIA_BASE_URL}/`));
        expect(outside.length, outside.map((src) => src.slice(0, 80)).join(", ")).toBe(2);
        expect(outside.filter((src) => /\/_next\/static\/media\/Poly_White\.[0-9a-f]+\.svg$/.test(src))).toHaveLength(1);
        expect(outside.filter((src) => src.startsWith("data:image/svg+xml"))).toHaveLength(1);
        const broken = await page.locator("img").evaluateAll((nodes) =>
          nodes
            .filter((node) => (node as HTMLElement).checkVisibility() && (node as HTMLImageElement).currentSrc !== "")
            .filter((node) => !(node as HTMLImageElement).complete || (node as HTMLImageElement).naturalWidth === 0)
            .map((node) => (node as HTMLImageElement).src),
        );
        expect(broken).toEqual([]);
        expect(requests.filter((url) => FORBIDDEN_HOSTS.test(url))).toEqual([]);
        expect(media.missing).toEqual([]);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        // Gold is a line only: the View All Private Stays outline button's border is the gold token, 1px.
        const rule = await page.getByRole("link", { name: copy.stays.viewAll, exact: true }).evaluate((node) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--color-gold)";
          document.body.appendChild(probe);
          const gold = getComputedStyle(probe).color;
          probe.remove();
          const style = getComputedStyle(node);
          return { border: style.borderTopColor, width: style.borderTopWidth, text: style.color, background: style.backgroundColor, gold };
        });
        expect(rule.border).toBe(rule.gold);
        expect(rule.width).toBe("1px");
        expect(rule.text).not.toBe(rule.gold);
        expect(rule.background).not.toBe(rule.gold);

        // Square corners on a card picture, a select, the planner and a Button.
        const radius = (locator: ReturnType<Page["locator"]>) => locator.evaluate((node) => getComputedStyle(node).borderRadius);
        expect(await radius(page.locator("#stays ul img").first())).toBe("0px");
        expect(await radius(page.getByRole("combobox").first().or(page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true })).first())).toBe("0px");
        const c = JOURNEY_COPY[locale];
        if (!isPhone(vp)) {
          const bar = region(page, locale).getByRole("search", { name: c.bar.label });
          expect(await radius(bar)).toBe("0px");
          await bar.getByRole("button", { name: c.bar.dates.label }).click();
          expect(await radius(page.getByRole("button", { name: c.done, exact: true }))).toBe("0px");
        } else {
          const entry = region(page, locale).getByRole("button", { name: new RegExp(c.entry.title) });
          expect(await radius(entry)).toBe("0px");
          await entry.click();
          expect(await radius(page.getByRole("button", { name: c.sheet.next, exact: true }))).toBe("0px");
        }
      });

      test(`12 Moments: photo and panel alternate and mirror in Arabic; the inset photo shows from md; nights in grey; no link (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const destinations = await getDestinations(locale);
        const articles = page.locator("#experiences article");
        await expect(articles).toHaveCount(destinations.length);
        const muted = await page.evaluate(() => {
          const probe = document.createElement("span");
          probe.style.color = "var(--color-muted)";
          document.body.appendChild(probe);
          const color = getComputedStyle(probe).color;
          probe.remove();
          return color;
        });
        for (let i = 0; i < destinations.length; i += 1) {
          const article = articles.nth(i);
          const destination = destinations[i];
          await expect(article.locator("a")).toHaveCount(0);
          const inset = article.locator("img").nth(1);
          if (destination.inset_image) {
            expect(await inset.getAttribute("src")).toBe(destination.inset_image.url);
            if (isPhone(vp)) await expect(inset).toBeHidden();
            else await expect(inset).toBeVisible();
          }
          if (destination.nights_label) {
            const nights = article.getByText(destination.nights_label, { exact: true });
            expect(await nights.evaluate((node) => getComputedStyle(node).color)).toBe(muted);
          }
          if (!isPhone(vp)) {
            const photo = (await article.locator("> img").boundingBox())!;
            const panel = (await article.locator("> div").boundingBox())!;
            const photoFirst = i % 2 === 0;
            const startsLeft = locale !== "ar";
            const photoIsLeft = photo.x < panel.x;
            expect(photoIsLeft, `row ${i + 1}`).toBe(photoFirst === startsLeft);
          }
        }
        expect(media.missing).toEqual([]);
      });

      test(`13 Choose Your Journey: three cards, published prices, badge on the featured tier, dividers, no Discover the Journey (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const tiers = await getJourneyTiers(locale);
        const cards = page.locator("#journeys article");
        await expect(cards).toHaveCount(3);
        expect(await priceTexts(page)).toEqual(tiers.map((tier) => tier.price_label));
        const featured = tiers.filter((tier) => tier.is_featured).length;
        await expect(page.locator("#journeys article", { hasText: copy.journeys.featured })).toHaveCount(featured);
        for (let i = 0; i < tiers.length; i += 1) {
          expect(await cards.nth(i).getByText(copy.journeys.featured, { exact: true }).count(), tiers[i].slug).toBe(tiers[i].is_featured ? 1 : 0);
        }
        await expect(page.locator("#journeys > div[aria-hidden=true]")).toHaveCount(2);
        const body = (await page.locator("body").textContent()) ?? "";
        expect(body).not.toContain("Discover the Journey");
        expect(media.missing).toEqual([]);
      });

      test(`14 Begin: full-bleed band on its still photo, centred heading, the ivory Request Consultation to /contact (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const blocks = await getHomeBlocks(locale);
        const begin = page.locator("#begin");
        expect(blocks.begin.video_url).toBeNull();
        expect(await begin.locator("img").first().getAttribute("src")).toBe(blocks.begin.poster!.url);
        await expect(begin.locator("video")).toHaveCount(0);
        const box = (await begin.locator("h2").boundingBox())!;
        expect(Math.abs(box.x + box.width / 2 - vp.width / 2)).toBeLessThanOrEqual(1);
        const link = begin.getByRole("link", { name: copy.begin.cta });
        expect(await link.getAttribute("href")).toBe(localePath(locale, "/contact"));
        const colors = await link.evaluate((node) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--color-ivory)";
          document.body.appendChild(probe);
          const ivory = getComputedStyle(probe).color;
          probe.remove();
          return { background: getComputedStyle(node).backgroundColor, ivory };
        });
        expect(colors.background).toBe(colors.ivory);
        expect(media.missing).toEqual([]);
      });
    });
  }
}
