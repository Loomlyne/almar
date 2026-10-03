import { existsSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { HOME_COPY } from "../../../lib/copy/home";
import { HOME_PAGE_COPY } from "../../../lib/copy/home-page";
import { FRAMER_SOURCE_COPY } from "../../../lib/copy/framer-source";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { getDestinations } from "../../../lib/data/destinations";
import { getCatalogItems } from "../../../lib/data/experiences";
import { getHomeBlocks } from "../../../lib/data/home";
import { getStays } from "../../../lib/data/stays";
import { MEDIA_BASE_URL } from "../../../lib/data/media";
import { formatDate, formatRange } from "../../../lib/format";
import { rewriteHomeAmounts, type SelectedCurrency } from "../../../lib/fx/rates";
import { fill, formatGuestSummary, formatPlural } from "../../../lib/journey-format";
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

// ---- dates -------------------------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
const inDays = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};
const dmy = (d: Date) => formatDate(d.getDate(), d.getMonth() + 1, d.getFullYear());
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// ---- page helpers ------------------------------------------------------------------------------------

type Visit = { media: Awaited<ReturnType<typeof routeMedia>>; requests: string[] };

/** Open a home page with images routed and every request recorded. Network idle capped at 10 s, then a settle. */
async function visit(page: Page, locale: Locale, path = home(locale)): Promise<Visit> {
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

/** The submit-like controls the held list forbids: none may exist, at any moment, anywhere on the page. */
async function expectNoSubmit(page: Page, locale: Locale) {
  await expect(page.locator("button[type=submit], input[type=submit], form, [role=search]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: JOURNEY_COPY[locale].bar.search, exact: true })).toHaveCount(0);
  await expect(page.getByRole("search")).toHaveCount(0);
}

/** The currency or language control: from the 1152px container up the nav is a row, below it a Menu. */
async function navControl(page: Page, locale: Locale, name: string) {
  const control = page.getByRole("combobox", { name });
  if (!(await control.isVisible())) {
    await page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true }).click();
  }
  return control;
}

async function clickDay(page: Page, locale: Locale, date: Date) {
  const day = page.locator(`button[aria-label^="${dmy(date)}"]`);
  for (let tries = 0; tries < 3 && !(await day.isVisible()); tries += 1) {
    await page.getByRole("button", { name: JOURNEY_COPY[locale].dates.nextMonth }).click();
  }
  await day.click();
}

const guestName = (locale: Locale, unit: "adult" | "child" | "infant") =>
  fill(JOURNEY_COPY[locale].guests.add, { group: JOURNEY_COPY[locale].guests.group[unit] });

type Journey = { from: Date; to: Date; destinationName: string; destinationSlug: string };

/**
 * Where -> When -> Who with nothing submitted: Medellin, today+9 to today+14, one more adult. Works through
 * the bar from md up and through the entry row and sheet below it. `onStep` runs between steps.
 */
async function planJourney(page: Page, locale: Locale, vp: Viewport, onStep: () => Promise<void>): Promise<Journey> {
  const copy = JOURNEY_COPY[locale];
  const destinations = await getDestinations(locale);
  const medellin = destinations.find((d) => d.slug === "medellin")!;
  const names = destinations.map((d) => d.name);
  const from = inDays(9);
  const to = inDays(14);
  const twoAdults = formatGuestSummary({ adults: 2, children: 0, infants: 0 }, locale, copy.guests.summary);
  const range = formatRange(dmy(from), dmy(to));

  if (!isPhone(vp)) {
    const bar = region(page, locale).getByRole("group", { name: copy.bar.label });
    const segment = (label: string) => bar.getByRole("button", { name: label });
    await onStep();

    // Where lists exactly the destinations of the data layer, in the owner's order.
    await segment(copy.bar.destination.label).click();
    const options = page.getByRole("listbox", { name: copy.menu.label }).getByRole("option");
    await expect(options).toHaveCount(names.length);
    for (const [i, name] of names.entries()) await expect(options.nth(i)).toContainText(name);
    await onStep();

    // Picking a destination opens When by itself (D-39).
    await options.filter({ hasText: medellin.name }).click();
    await expect(segment(copy.bar.destination.label)).toContainText(medellin.name);
    await expect(page.getByRole("group", { name: copy.dates.label })).toBeVisible();
    await expect(page.getByRole("grid")).toHaveCount(vp.width >= 1024 ? 2 : 1);
    await onStep();

    await clickDay(page, locale, from);
    await clickDay(page, locale, to);
    await page.getByRole("group", { name: copy.dates.label }).getByRole("button", { name: copy.done, exact: true }).click();
    await expect(segment(copy.bar.dates.label)).toContainText(range);
    await onStep();

    // Done moves on to Who.
    await expect(page.getByRole("group", { name: copy.guests.label })).toBeVisible();
    await page.getByRole("button", { name: guestName(locale, "adult"), exact: true }).click();
    await expect(segment(copy.bar.guests.label)).toContainText(twoAdults);
    await page.getByRole("group", { name: copy.guests.label }).getByRole("button", { name: copy.done, exact: true }).click();
    await expect(page.getByRole("group", { name: copy.guests.label })).toHaveCount(0);
    await onStep();
  } else {
    // The region's only visible button: its name changes once the journey is filled in.
    const entry = region(page, locale).getByRole("button");
    await expect(entry).toHaveCount(1);
    const sheet = page.getByRole("dialog", { name: copy.sheet.label });
    const progress = (n: number) => sheet.getByText(fill(copy.sheet.progress, { n }), { exact: true });
    await onStep();
    await entry.click();
    await expect(sheet).toBeVisible();
    await expect(progress(1)).toBeVisible();
    await onStep();

    await sheet.getByRole("option", { name: new RegExp(medellin.name) }).click();
    await expect(progress(2)).toBeVisible();
    await onStep();

    await clickDay(page, locale, from);
    await clickDay(page, locale, to);
    await sheet.getByRole("button", { name: copy.sheet.next, exact: true }).click();
    await expect(progress(3)).toBeVisible();
    await onStep();

    await sheet.getByRole("button", { name: guestName(locale, "adult"), exact: true }).click();
    // The last step ends in Done, never Search.
    await expect(sheet.getByRole("button", { name: copy.bar.search, exact: true })).toHaveCount(0);
    await sheet.getByRole("button", { name: copy.done, exact: true }).click();
    await expect(sheet).toHaveCount(0);
    await expect(entry).toContainText(medellin.name);
    await expect(entry).toContainText(range);
    await expect(entry).toContainText(twoAdults);
    await onStep();
  }
  return { from, to, destinationName: medellin.name, destinationSlug: medellin.slug };
}

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
          // The heading sits at the inline start: left edge in left-to-right, right edge in Arabic.
          const box = (await h1.boundingBox())!;
          if (locale === "ar") expect(box.x + box.width).toBeGreaterThanOrEqual(vp.width - 110);
          else expect(box.x).toBeLessThanOrEqual(110);
          expect(await priceTexts(bare)).toEqual(published);
          expect(media.missing).toEqual([]);
        } finally {
          await context.close();
        }
      });

      test(`2 section order, one h1, no team block, no video (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        await expect(page.locator("h1")).toHaveCount(1);
        await expect(page.locator("h1")).toHaveText(HOME_COPY[locale].heroTitle);
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
        // Zero published members: neither the kicker nor the heading exists anywhere.
        await expect(page.getByText(copy.team.kicker)).toHaveCount(0);
        await expect(page.getByText(copy.team.heading)).toHaveCount(0);
        await expect(page.locator("video")).toHaveCount(0);
        expect(media.missing).toEqual([]);
      });

      test(`3 Where, When, Who with no submit anywhere (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        await expectNoSubmit(page, locale);
        await planJourney(page, locale, vp, () => expectNoSubmit(page, locale));
        await expectNoSubmit(page, locale);
        expect(media.missing).toEqual([]);
      });

      test(`4 the choice has a visible result: live stays, the carried query, survives a reload (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const stays = page.locator("#stays");
        const all = await getStays(locale);
        await expect(stays.getByRole("link")).toHaveCount(4); // three cards and View All
        await expect(stays.locator("p[aria-live=polite]")).toHaveText(formatPlural(copy.stays.count, all.length, locale));

        const journey = await planJourney(page, locale, vp, async () => undefined);
        const expected = all.filter((s) => s.destination_slug === "medellin" && (s.max_guests ?? 0) >= 2);
        expect(expected.map((s) => s.slug).sort()).toEqual(["santa-fe-farm-antioquia", "sopetran-country-estate"]);

        const cards = stays.locator("ul a");
        await expect(cards).toHaveCount(2);
        const hrefs = await cards.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href")));
        expect(hrefs.sort()).toEqual(expected.map((s) => localePath(locale, `/private-stays/${s.slug}`)).sort());
        await expect(stays.locator("p[aria-live=polite]")).toHaveText(formatPlural(copy.stays.count, 2, locale));

        const viewAll = stays.getByRole("link", { name: copy.stays.viewAll });
        const target = `${localePath(locale, "/private-stays")}?destination=medellin&from=${iso(journey.from)}&to=${iso(journey.to)}&guests=2`;
        await expect(viewAll).toHaveAttribute("href", target);

        // Back on the home page after a reload, the bar still shows the choice.
        await page.reload();
        await hydrated(page);
        await page.waitForTimeout(200);
        await expect(stays.locator("ul a")).toHaveCount(2);
        const c = JOURNEY_COPY[locale];
        if (!isPhone(vp)) {
          const bar = region(page, locale).getByRole("group", { name: c.bar.label });
          await expect(bar.getByRole("button", { name: c.bar.destination.label })).toContainText(journey.destinationName);
          await expect(bar.getByRole("button", { name: c.bar.dates.label })).toContainText(formatRange(dmy(journey.from), dmy(journey.to)));
        } else {
          const entry = region(page, locale).getByRole("button", { name: new RegExp(journey.destinationName) });
          await expect(entry).toContainText(formatRange(dmy(journey.from), dmy(journey.to)));
        }

        // The click lands on exactly the carried address.
        await viewAll.click();
        await page.waitForURL((url) => url.pathname + url.search === target);
        expect(media.missing).toEqual([]);
      });

      test(`5 docked: the planner follows the page once the hero has scrolled away (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const c = JOURNEY_COPY[locale];
        await page.evaluate(() => window.scrollTo(0, document.querySelector("#welcome")!.getBoundingClientRect().top + window.scrollY));
        const docked = page.locator("div.fixed");
        await expectNoSubmit(page, locale);
        if (!isPhone(vp)) {
          const bar = docked.getByRole("group", { name: c.bar.label });
          await expect(bar).toBeVisible();
          await bar.getByRole("button", { name: c.bar.dates.label }).click();
          await expect(page.getByRole("group", { name: c.dates.label })).toBeVisible();
        } else {
          const row = docked.getByRole("button", { name: new RegExp(c.entry.title) });
          await expect(row).toBeVisible();
          await row.click();
          await expect(page.getByRole("dialog", { name: c.sheet.label })).toBeVisible();
        }
        await expectNoSubmit(page, locale);
        // Back at the top the docked planner is gone again.
        await page.keyboard.press("Escape");
        await page.evaluate(() => window.scrollTo(0, 0));
        const dockedAgain = page.locator("div.fixed");
        if (!isPhone(vp)) await expect(dockedAgain.getByRole("group", { name: c.bar.label })).toHaveCount(0);
        else await expect(dockedAgain.getByRole("button", { name: new RegExp(c.entry.title) })).toHaveCount(0);
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

      test(`7 gallery lightbox: open, step, Escape returns focus (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const tile = page.locator("#gallery button").first();
        await tile.click();
        const dialog = page.getByRole("dialog");
        await expect(dialog).toBeVisible();
        const count = (n: number) => fill(copy.gallery.count, { n, total: 15 });
        await expect(dialog.locator("[aria-live=polite]")).toHaveText(count(1));
        await page.keyboard.press(locale === "ar" ? "ArrowLeft" : "ArrowRight");
        await expect(dialog.locator("[aria-live=polite]")).toHaveText(count(2));
        await page.keyboard.press("Escape");
        await expect(dialog).toHaveCount(0);
        await expect(tile).toBeFocused();
        expect(media.missing).toEqual([]);
      });

      test(`8 every link goes where it says (${where})`, async ({ page, request }) => {
        const { media } = await visit(page, locale);
        const stays = await getStays(locale);
        const blocks = await getHomeBlocks(locale);
        const services = await getCatalogItems(locale, { kind: "service" });
        const cases: Array<[string, () => ReturnType<Page["locator"]>, string]> = [
          ["a stay card", () => page.locator("#stays ul a").first(), localePath(locale, `/private-stays/${stays[0].slug}`)],
          ["View All Services", () => page.getByRole("link", { name: copy.services.viewAll }), "/experiences"],
          ["Read All", () => page.getByRole("link", { name: copy.stories.readAll }), "/blog"],
          ["Request Consultation (curated)", () => page.locator("#experiences").getByRole("link", { name: copy.moments.cta }), "/contact"],
          ["Request Consultation (begin)", () => page.locator("#begin").getByRole("link", { name: copy.begin.cta }), "/contact"],
          ["a service card", () => page.locator("#services ul a").first(), `/services/${services[0].slug}`],
          ["a story card", () => page.locator("#stories ul a").first(), `/blog/${blocks.stories[0].slug}`],
          ["the wordmark", () => page.getByRole("link", { name: "ALMAR Private Journeys home" }), home(locale)],
        ];
        for (const [label, locate, path] of cases) {
          await page.goto(home(locale));
          await hydrated(page);
          const link = locate();
          await expect(link, label).toBeVisible();
          await link.click();
          await page.waitForURL((url) => url.pathname === path, { timeout: 15_000 });
          expect(new URL(page.url()).pathname, label).toBe(path);
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

      test(`9 the held controls are absent (${where})`, async ({ page }) => {
        const { media } = await visit(page, locale);
        const names = [
          JOURNEY_COPY[locale].bar.search,
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
        // The nav menu is closed below 1152px: open it so its controls are on the page too.
        if (vp.width < 1152) await page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true }).click();
        for (const name of names) {
          await expect(page.getByRole("button", { name, exact: true }), `button ${name}`).toHaveCount(0);
          await expect(page.getByRole("link", { name, exact: true }), `link ${name}`).toHaveCount(0);
        }
        await expect(page.locator("footer form")).toHaveCount(0);
        await expect(page.getByRole("textbox")).toHaveCount(0);
        await expect(page.locator("input[type=email]")).toHaveCount(0);
        await expectNoSubmit(page, locale);
        // The sheet and the docked planner are the other places a Search would hide.
        if (isPhone(vp)) {
          await page.keyboard.press("Escape");
          await region(page, locale).getByRole("button", { name: new RegExp(JOURNEY_COPY[locale].entry.title) }).click();
          await expectNoSubmit(page, locale);
        }
        expect(media.missing).toEqual([]);
      });

      test(`10 images, hosts, overflow, gold line, square corners (${where})`, async ({ page }) => {
        const { media, requests } = await visit(page, locale);
        const srcs = await page.locator("img").evaluateAll((nodes) => nodes.map((node) => (node as HTMLImageElement).currentSrc));
        const outside = srcs.filter((src) => !src.startsWith(`${MEDIA_BASE_URL}/`));
        expect(outside.length, outside.join(", ")).toBe(1);
        expect(outside[0]).toMatch(/\/_next\/static\/media\/Poly_White\.[0-9a-f]+\.svg$/);
        const broken = await page.locator("img").evaluateAll((nodes) =>
          nodes.filter((node) => !(node as HTMLImageElement).complete || (node as HTMLImageElement).naturalWidth === 0).map((node) => (node as HTMLImageElement).src),
        );
        expect(broken).toEqual([]);
        expect(requests.filter((url) => FORBIDDEN_HOSTS.test(url))).toEqual([]);
        expect(media.missing).toEqual([]);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        // A section head's rule is the gold token, as a line.
        const rule = await page.locator("#stays > div").first().evaluate((node) => {
          const probe = document.createElement("span");
          probe.style.color = "var(--color-gold)";
          document.body.appendChild(probe);
          const gold = getComputedStyle(probe).color;
          probe.remove();
          return { border: getComputedStyle(node).borderTopColor, width: getComputedStyle(node).borderTopWidth, gold };
        });
        expect(rule.border).toBe(rule.gold);
        expect(rule.width).toBe("2px");

        // Square corners on a card picture, a select, the planner and a Button.
        const radius = (locator: ReturnType<Page["locator"]>) => locator.evaluate((node) => getComputedStyle(node).borderRadius);
        expect(await radius(page.locator("#stays ul img").first())).toBe("0px");
        expect(await radius(page.getByRole("combobox").first().or(page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true })).first())).toBe("0px");
        const c = JOURNEY_COPY[locale];
        if (!isPhone(vp)) {
          const bar = region(page, locale).getByRole("group", { name: c.bar.label });
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
    });
  }
}
