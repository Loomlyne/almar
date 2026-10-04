import fs from "node:fs";
import path from "node:path";
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { BEDROOM_BUCKETS } from "../../../components/pages/private-stays/filter-state";
import { HOME_COPY } from "../../../lib/copy/home";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { STAY_DETAIL_COPY } from "../../../lib/copy/stay-detail";
import { STAYS_LIST_COPY } from "../../../lib/copy/stays-list";
import { getDestinations } from "../../../lib/data/destinations";
import { MEDIA_BASE_URL } from "../../../lib/data/media";
import { filterStays, toStayQuery } from "../../../lib/data/stay-filter";
import { getStays } from "../../../lib/data/stays";
import { formatDate, formatRange } from "../../../lib/format";
import { formatPlural } from "../../../lib/journey-format";
import { SITE_ORIGIN, localePath, type Locale } from "../../../lib/locale-path";
import { routeMedia, type MediaRoute } from "../../helpers/media-route";

// Phase 3.3 plan 05. The React /private-stays list in EN, AR and ES, proven in a browser on a production build:
// every control is clicked or typed into and its result is asserted on screen. Expected values come from the
// same sources the page uses (the data layer, the one filterStays, the copy file), never from the page itself.
//
// Specs under tests/build/ run on a built site (reconcile R-4); the default dev config ignores this folder.
// Run it (plan 03's build config, on the assembled out/):
//   node scripts/assemble-cloudflare.mjs
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/private-stays --workers=1
// The images are served by routeMedia (plan 07), so it needs no media download and no network.
// Plan 46 added the Dates filter (tests 8, 12, 14 updated; 16, 17, 18 new); the clock is fixed at FIXED_NOW so
// "today" and the unpickable past days are the same on every run.

const LOCALES: Locale[] = ["en", "ar", "es"];
const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 834, height: 1194 },
  { width: 1440, height: 900 },
];
const PATH = "/private-stays";
const FIXED_NOW = "2026-10-04T09:00:00+04:00";
const FORBIDDEN_HOSTS = ["framerusercontent.com", "files.catbox.moe", "videos.pexels.com"];
const HIDDEN_STAYS = ["baru-house", "corona-island", "yury-house-cartagena"];
const NEXT_LOCALE: Record<Locale, Locale> = { en: "ar", ar: "es", es: "en" };
const NATIVE_NAME: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };

// ---- what the page is built from -------------------------------------------------------------------------------------

type Data = Awaited<ReturnType<typeof load>>;
const cache = new Map<Locale, Promise<Data>>();
async function load(locale: Locale) {
  return {
    locale,
    path: localePath(locale, PATH),
    stays: await getStays(locale),
    destinations: await getDestinations(locale),
    copy: STAYS_LIST_COPY[locale],
    nav: HOME_COPY[locale].nav,
    journey: JOURNEY_COPY[locale],
    datesNote: STAY_DETAIL_COPY[locale].sampleDatesNote,
  };
}
const data = (locale: Locale): Promise<Data> => {
  if (!cache.has(locale)) cache.set(locale, load(locale));
  return cache.get(locale)!;
};

/** The board 5h dictionary, for the names of the held controls (design 4.3). */
const BOARD = fs.readFileSync(path.join(process.cwd(), ".planning/design/2026-10-01-canvas/boards/PublicStays.dc.html"), "utf8");
function boardWord(key: string, locale: Locale): string {
  const m = BOARD.match(new RegExp(`"${key}":(\\{[^}]*\\})`));
  if (!m) throw new Error(`board key ${key} not found`);
  return (JSON.parse(m[1]) as Record<Locale, string>)[locale];
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const detailOf = (s: { neighborhood: string | null; guests_label: string | null; price_label: string | null }) =>
  [s.neighborhood, s.guests_label, s.price_label].filter(Boolean).join(" · ");

// ---- every test watches the same things ------------------------------------------------------------------------------

type Watch = { media: MediaRoute; hosts: Set<string>; errors: string[]; mediaRequests: string[]; freeze: () => void };

const test = base.extend<{ watch: Watch }>({
  watch: [
    async ({ page }, use) => {
      const media = await routeMedia(page);
      const watch: Watch = { media, hosts: new Set(), errors: [], mediaRequests: [], freeze: () => void 0 };
      let frozen = false;
      watch.freeze = () => {
        frozen = true;
      };
      page.on("request", (request) => {
        if (frozen) return;
        const url = new URL(request.url());
        watch.hosts.add(url.host);
        if (request.url().startsWith(`${MEDIA_BASE_URL}/`)) watch.mediaRequests.push(request.url());
      });
      page.on("pageerror", (error) => {
        if (!frozen) watch.errors.push(`pageerror: ${error.message}`);
      });
      page.on("console", (message) => {
        if (!frozen && message.type() === "error") watch.errors.push(`console: ${message.text()}`);
      });
      await use(watch);
      expect(watch.media.missing, "image keys the manifest does not know").toEqual([]);
      expect(watch.errors, "page errors and console errors (a hydration mismatch shows up here)").toEqual([]);
      for (const host of FORBIDDEN_HOSTS) expect([...watch.hosts], `a request went to ${host}`).not.toContain(host);
    },
    { auto: true },
  ],
});

async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const el = document.getElementById("stay-search");
    return !!el && Object.keys(el).some((k) => k.startsWith("__reactProps$") || k.startsWith("__reactFiber$"));
  });
}

async function visitAt(page: Page, url: string) {
  await page.clock.setFixedTime(FIXED_NOW);
  await visit(page, url);
}

/** goto, network idle capped at 10 s, hydration, a short settle (00-common-rules.md). */
async function visit(page: Page, url: string) {
  await page.goto(url, { waitUntil: "load" });
  try {
    await page.waitForLoadState("networkidle", { timeout: 10_000 });
  } catch {
    // A cold run can keep a connection open; the hydration wait below is the real gate.
  }
  await hydrated(page);
  await page.waitForTimeout(250);
}

// ---- small locators ------------------------------------------------------------------------------------------------

const grid = (page: Page) => page.locator("main ul[role='list']");
const cardLinks = (page: Page) => page.locator("main ul[role='list'] > li > a");
const countLine = (page: Page) => page.locator("main p[aria-live='polite']");
const searchBox = (page: Page, d: Data) => page.getByRole("searchbox", { name: d.copy.search.label, exact: true });
const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });
const clearButtons = (page: Page, d: Data) => page.getByRole("button", { name: d.copy.clear, exact: true });
const datesGroup = (page: Page, d: Data) => group(page, d.journey.bar.dates.label);
const datesTrigger = (page: Page, d: Data) => datesGroup(page, d).getByRole("button").first();
const datesClear = (page: Page, d: Data) => datesGroup(page, d).getByRole("button", { name: d.journey.dates.clear, exact: true });
const panel = (page: Page, d: Data) => group(page, d.journey.dates.label);
const day = (page: Page, iso: string) => page.locator(`[data-date="${iso}"]`);
const guestsValue = (page: Page, d: Data) => group(page, d.copy.guests.label).locator("span[aria-live]");

/** DD/MM/YYYY – DD/MM/YYYY · N nights, from the shared formatters and the journey copy, never typed. */
function rangeText(d: Data, from: string, to: string): string {
  const parts = (iso: string) => {
    const [y, m, dd] = iso.split("-").map(Number);
    return formatDate(dd, m, y);
  };
  const nights = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
  return `${formatRange(parts(from), parts(to))} · ${formatPlural(d.journey.dates.nights, nights, d.locale)}`;
}

/** Opens the calendar, picks both days, and closes it with Done (focus goes back to the trigger). */
async function pickRange(page: Page, d: Data, from: string, to: string) {
  await datesTrigger(page, d).click();
  await expect(panel(page, d)).toBeVisible();
  await day(page, from).click();
  await day(page, to).click();
  await page.getByRole("button", { name: d.journey.done, exact: true }).click();
  await expect(panel(page, d)).toHaveCount(0);
}

const titlesOf = (page: Page) => page.locator("main ul[role='list'] > li > a > span > span:first-child").allTextContents();

async function expectGrid(page: Page, d: Data, filter: Parameters<typeof filterStays>[1], why = "") {
  const want = filterStays(d.stays, filter);
  await expect.poll(() => titlesOf(page), { message: `grid titles ${why}` }).toEqual(want.map((s) => s.title));
  await expect(countLine(page), `count line ${why}`).toHaveText(formatPlural(d.copy.count, want.length, d.locale));
  return want;
}

async function pressedOf(buttons: Locator): Promise<string[]> {
  const out: string[] = [];
  const n = await buttons.count();
  for (let i = 0; i < n; i += 1) {
    if ((await buttons.nth(i).getAttribute("aria-pressed")) === "true") out.push((await buttons.nth(i).textContent())?.trim() ?? "");
  }
  return out;
}

/** The header Menu button exists below the 6xl container width; open it so the nav and language select are reachable. */
async function openMenuIfCollapsed(page: Page, d: Data): Promise<boolean> {
  const menu = page.getByRole("button", { name: d.nav.menu, exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    return true;
  }
  return false;
}

/** The computed colour of a design token, so a style test never hand-types one. */
const token = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--color-${n})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);

// ---- 1. the served document, once per locale -------------------------------------------------------------------

for (const locale of LOCALES) {
  test(`served document ${locale}: first-byte lang and dir, four hreflang links, canonical, JSON-LD, no forbidden host`, async ({ request }) => {
    const d = await data(locale);
    const response = await request.get(d.path);
    expect(response.status()).toBe(200);
    const html = await response.text();

    const dir = locale === "ar" ? "rtl" : "ltr";
    expect(html, "lang and dir on <html> in the served HTML, before any script").toMatch(
      new RegExp(`^<!DOCTYPE html>(?:<!--[^>]*-->)?<html lang="${locale}" dir="${dir}"[ >]`),
    );

    const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>/gi)].map((m) => [m[1], m[2]]);
    const origin = (l: Locale) => `${SITE_ORIGIN}${localePath(l, PATH)}`;
    expect(Object.fromEntries(alternates)).toEqual({ en: origin("en"), ar: origin("ar"), es: origin("es"), "x-default": origin("en") });
    expect(alternates, "exactly four hreflang links").toHaveLength(4);

    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
    expect(canonical).toBe(origin(locale));
    expect(canonical!.endsWith("/")).toBe(false);

    const blocks = [...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)];
    expect(blocks, "one application/ld+json block").toHaveLength(1);
    const urls: string[] = [];
    const walk = (value: unknown, key = "") => {
      if (typeof value === "string") {
        if (key !== "@context" && /^https?:\/\//.test(value)) urls.push(value);
      } else if (value && typeof value === "object") for (const [k, v] of Object.entries(value)) walk(v, k);
    };
    walk(JSON.parse(blocks[0][1]));
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) expect(url.startsWith(`${SITE_ORIGIN}/`), url).toBe(true);

    for (const word of [...FORBIDDEN_HOSTS, ...HIDDEN_STAYS]) expect(html.includes(word), `${word} appears in the served HTML`).toBe(false);
    for (const stay of d.stays) expect(html.includes(`href="${localePath(locale, `${PATH}/${stay.slug}`)}"`), stay.slug).toBe(true);
  });
}

// ---- 2 to 15, per locale and width -------------------------------------------------------------------------------------

for (const locale of LOCALES) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${locale} ${viewport.width}`, () => {
      test.use({ viewport });

      test("2. initial grid: 12 cards in position order, one link each, no amount, images from the media host", async ({ page, watch }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const links = cardLinks(page);
        await expect(links).toHaveCount(12);
        expect(d.stays).toHaveLength(12);
        expect(await titlesOf(page)).toEqual(d.stays.map((s) => s.title));

        for (const [i, stay] of d.stays.entries()) {
          const href = localePath(locale, `${PATH}/${stay.slug}`);
          const card = links.nth(i);
          await expect(card, `card ${i + 1} is one link to ${href}`).toHaveAttribute("href", href);
          await expect(page.locator(`main a[href="${href}"]`), `${stay.slug}: exactly one link`).toHaveCount(1);
          await expect(card).toHaveAccessibleName(new RegExp(escapeRegExp(stay.title)));
          await expect(card.locator("span > span").nth(0)).toHaveText(stay.title);
          await expect(card.locator("span > span").nth(1)).toHaveText(detailOf(stay));
          if (stay.price_label) await expect(card).toContainText(stay.price_label);
        }
        if (locale === "en") expect(d.stays.every((s) => s.price_label === "On request")).toBe(true);

        const main = await page.locator("main").innerText();
        expect(main, "no currency code, symbol or digit-grouped number in <main>").not.toMatch(/\b(AED|USD|EUR|COP)\b|[$€£]|\d{1,3}(?:[.,]\d{3})+/);

        const imgs = page.locator("main img");
        await expect(imgs).toHaveCount(12);
        for (const [i, stay] of d.stays.entries()) {
          const src = await imgs.nth(i).getAttribute("src");
          expect(src!.startsWith(`${MEDIA_BASE_URL}/`), `image ${i + 1} starts with MEDIA_BASE_URL`).toBe(true);
          expect(src).toBe(stay.hero_image!.url);
          await expect(imgs.nth(i)).toHaveAttribute("alt", stay.hero_image!.alt);
        }

        const polite = countLine(page);
        await expect(polite).toHaveCount(1);
        await expect(polite).toHaveText(formatPlural(d.copy.count, 12, locale));
        await expect(clearButtons(page, d)).toHaveCount(0);
        await page.waitForLoadState("load");
        expect(watch.mediaRequests.length, "the page asked the media host for its pictures").toBeGreaterThanOrEqual(12);
      });

      test("3. search: title, neighbourhood and destination, accent- and case-insensitive; Clear appears", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const medellin = d.destinations.find((x) => x.slug === "medellin")!;
        const candidates = locale === "en" ? ["getsemani"] : [d.stays[0].neighborhood, d.stays[0].title, medellin.name];
        const term = candidates.find((c) => {
          if (!c) return false;
          const n = filterStays(d.stays, { query: c }).length;
          return n > 0 && n < 12;
        })!;
        expect(term, "a discriminating search term").toBeTruthy();

        await searchBox(page, d).fill(term);
        const want = await expectGrid(page, d, { query: term }, `after typing "${term}"`);
        expect(want.length).toBeGreaterThan(0);
        expect(want.length).toBeLessThan(12);
        await expect(clearButtons(page, d)).toHaveCount(1);
        await expect(clearButtons(page, d)).toBeVisible();

        if (locale === "en") {
          expect(want.map((s) => s.slug)).toEqual(["getsemani-colonial-house", "getsemani-courtyard-residence"]);
          await searchBox(page, d).fill("GETSEMANÍ");
          const again = await expectGrid(page, d, { query: "GETSEMANÍ" }, "after typing GETSEMANÍ");
          expect(again.map((s) => s.slug)).toEqual(want.map((s) => s.slug));
          await searchBox(page, d).fill("cartagena");
          await expectGrid(page, d, { query: "cartagena" }, "destination name matches");
        }
      });

      test("4. destination chips: All plus the destinations with a stay; each narrows the grid and the count", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const dest = group(page, d.copy.destination.label);
        await expect(dest).toHaveCount(1);
        const chips = dest.getByRole("button");
        await expect(chips).toHaveText([d.copy.destination.all, ...d.destinations.map((x) => x.name)]);
        expect(d.destinations.map((x) => x.slug)).toEqual(["cartagena", "medellin"]);
        expect(await pressedOf(chips)).toEqual([d.copy.destination.all]);

        for (const destination of d.destinations) {
          await chips.filter({ hasText: new RegExp(`^${escapeRegExp(destination.name)}$`) }).click();
          expect(await pressedOf(chips)).toEqual([destination.name]);
          const want = await expectGrid(page, d, { destination: destination.slug }, destination.slug);
          if (locale === "en" && destination.slug === "medellin") expect(want).toHaveLength(2);
          await expect(clearButtons(page, d)).toHaveCount(1);
        }
        await chips.first().click();
        expect(await pressedOf(chips)).toEqual([d.copy.destination.all]);
        await expectGrid(page, d, {}, "after All");
        await expect(cardLinks(page)).toHaveCount(12);
        await expect(clearButtons(page, d)).toHaveCount(0);
      });

      test("5. guests: 0 is any, the stepper narrows to stays that take the party, stops at the largest capacity", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const box = group(page, d.copy.guests.label);
        await expect(box).toHaveCount(1);
        await expect(box.getByText(d.copy.guests.any, { exact: true })).toBeVisible();
        const add = box.getByRole("button", { name: d.copy.guests.add, exact: true });
        const remove = box.getByRole("button", { name: d.copy.guests.remove, exact: true });
        const value = box.locator("span[aria-live]");
        const max = Math.max(...d.stays.map((s) => s.max_guests ?? 0));

        for (let n = 1; n <= 11; n += 1) await add.click();
        await expect(value).toHaveText("11");
        await expect(box.getByText(d.copy.guests.any, { exact: true })).toHaveCount(0);
        await expectGrid(page, d, { guests: 11 }, "11 guests");

        for (let n = 12; n <= 20; n += 1) await add.click();
        await expect(value).toHaveText("20");
        const twenty = await expectGrid(page, d, { guests: 20 }, "20 guests");
        if (locale === "en") expect(twenty.map((s) => s.slug).sort()).toEqual(["private-island-cartagena", "private-island-estate-cartagena"]);

        for (let n = 21; n <= max; n += 1) await add.click();
        await expect(value).toHaveText(String(max));
        await expect(add).toHaveAttribute("aria-disabled", "true");
        await expect(box.getByText(d.copy.guests.atMax, { exact: true })).toBeVisible();
        await add.click({ force: true }); // aria-disabled keeps focus on the button, so a click is still delivered
        await expect(value, "the stepper does not pass its maximum").toHaveText(String(max));
        await expectGrid(page, d, { guests: max }, `${max} guests`);

        for (let n = max; n >= 1; n -= 1) await remove.click();
        await expect(value).toHaveText("0");
        await expect(remove).toHaveAttribute("aria-disabled", "true");
        await expect(box.getByText(d.copy.guests.any, { exact: true })).toBeVisible();
        await expectGrid(page, d, {}, "back to 0 guests");
        await expect(cardLinks(page)).toHaveCount(12);
      });

      test("6. bedrooms: 1-4, 5-8 and 9+ narrow the grid, Any restores it", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const box = group(page, d.copy.bedrooms.label);
        await expect(box).toHaveCount(1);
        const chips = box.getByRole("button");
        const o = d.copy.bedrooms.options;
        await expect(chips).toHaveText([o.any, o["1-4"], o["5-8"], o["9+"]]);
        expect(await pressedOf(chips)).toEqual([o.any]);
        for (const bucket of ["1-4", "5-8", "9+"] as const) {
          await chips.filter({ hasText: new RegExp(`^${escapeRegExp(o[bucket])}$`) }).click();
          expect(await pressedOf(chips)).toEqual([o[bucket]]);
          await expectGrid(page, d, BEDROOM_BUCKETS[bucket], `bedrooms ${bucket}`);
        }
        await chips.first().click();
        expect(await pressedOf(chips)).toEqual([o.any]);
        await expectGrid(page, d, {}, "bedrooms Any");
        await expect(cardLinks(page)).toHaveCount(12);
      });

      test("7. empty state and Clear: one control, focus returns to search, the URL is cleaned", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        await searchBox(page, d).fill("zzzz");
        await expect(countLine(page)).toHaveText(formatPlural(d.copy.count, 0, locale));
        await expect(page.getByText(d.copy.empty, { exact: true })).toBeVisible();
        await expect(grid(page)).toHaveCount(0);
        await expect(clearButtons(page, d)).toHaveCount(1);

        await clearButtons(page, d).click();
        await expect(cardLinks(page)).toHaveCount(12);
        await expect(searchBox(page, d)).toHaveValue("");
        expect(await pressedOf(group(page, d.copy.destination.label).getByRole("button"))).toEqual([d.copy.destination.all]);
        expect(await pressedOf(group(page, d.copy.bedrooms.label).getByRole("button"))).toEqual([d.copy.bedrooms.options.any]);
        await expect(group(page, d.copy.guests.label).locator("span[aria-live]")).toHaveText("0");
        await expect(datesTrigger(page, d)).toHaveText(d.journey.bar.dates.empty);
        await expect(page.locator("#stay-search")).toBeFocused();
        expect(new URL(page.url()).pathname).toBe(d.path);
        expect(new URL(page.url()).search).toBe("");
        await expect(clearButtons(page, d)).toHaveCount(0);

        // Clear from the count line, after a destination filter and a guest count.
        await group(page, d.copy.destination.label).getByRole("button").nth(1).click();
        await group(page, d.copy.guests.label).getByRole("button", { name: d.copy.guests.add, exact: true }).click();
        await expect(clearButtons(page, d)).toHaveCount(1);
        expect(new URL(page.url()).search).not.toBe("");
        await clearButtons(page, d).click();
        await expect(cardLinks(page)).toHaveCount(12);
        await expect(countLine(page)).toHaveText(formatPlural(d.copy.count, 12, locale));
        expect(new URL(page.url()).search).toBe("");
        await expect(clearButtons(page, d)).toHaveCount(0);
        await expect(page.locator("#stay-search")).toBeFocused();
      });

      test("8. arrival from the home Search: every filter shown as set and the list already filtered", async ({ page }) => {
        const d = await data(locale);
        const [from, to] = ["2026-10-12", "2026-10-15"];
        await visitAt(page, `${d.path}?${toStayQuery({ destination: "cartagena", from, to, guests: 2 })}`);
        const chips = group(page, d.copy.destination.label).getByRole("button");
        const cartagena = d.destinations.find((x) => x.slug === "cartagena")!;
        const medellin = d.destinations.find((x) => x.slug === "medellin")!;
        await expect(chips.filter({ hasText: new RegExp(`^${escapeRegExp(cartagena.name)}$`) })).toHaveAttribute("aria-pressed", "true");
        expect(await pressedOf(chips)).toEqual([cartagena.name]);
        await expect(guestsValue(page, d)).toHaveText("2");
        await expect(datesTrigger(page, d)).toHaveText(rangeText(d, from, to));
        await expect(datesClear(page, d)).toHaveCount(1);
        const want = await expectGrid(page, d, { destination: "cartagena", guests: 2, from, to }, "after the arrival");
        expect(want.length, "the arrival leaves a real list").toBeGreaterThan(0);
        await expect(clearButtons(page, d)).toHaveCount(1);

        // Each of the four is changeable; the URL follows in toStayQuery order.
        await chips.filter({ hasText: new RegExp(`^${escapeRegExp(medellin.name)}$`) }).click();
        await expectGrid(page, d, { destination: "medellin", guests: 2, from, to }, "after choosing Medellín");
        expect(new URL(page.url()).search).toBe(`?${toStayQuery({ destination: "medellin", from, to, guests: 2 })}`);
        await group(page, d.copy.guests.label).getByRole("button", { name: d.copy.guests.add, exact: true }).click();
        await expect(guestsValue(page, d)).toHaveText("3");
        expect(new URL(page.url()).search).toBe(`?${toStayQuery({ destination: "medellin", from, to, guests: 3 })}`);
        await datesClear(page, d).click();
        await expect(datesTrigger(page, d)).toHaveText(d.journey.bar.dates.empty);
        await expectGrid(page, d, { destination: "medellin", guests: 3 }, "after clearing the dates");
        expect(new URL(page.url()).search).toBe(`?${toStayQuery({ destination: "medellin", guests: 3 })}`);

        // Bad input is ignored, never an error: unknown destination, bad guests, impossible, reversed, equal or one-sided dates.
        for (const bad of [
          "destination=bogota&guests=-1&from=2026-13-40",
          "destination=%3Cscript%3E&guests=abc",
          `from=${to}&to=${from}`,
          `from=${from}&to=${from}`,
          `from=${from}`,
          `to=${to}`,
          "guests=0",
        ]) {
          await visitAt(page, `${d.path}?${bad}`);
          await expect(cardLinks(page), bad).toHaveCount(12);
          expect(await pressedOf(group(page, d.copy.destination.label).getByRole("button")), bad).toEqual([d.copy.destination.all]);
          await expect(guestsValue(page, d), bad).toHaveText("0");
          await expect(datesTrigger(page, d), bad).toHaveText(d.journey.bar.dates.empty);
          await expect(clearButtons(page, d), bad).toHaveCount(0);
        }
      });

      test("9. language switch: header select and footer row navigate to the page in that language; filters reset", async ({ page }) => {
        const d = await data(locale);
        const next = NEXT_LOCALE[locale];
        const nd = await data(next);
        await visit(page, d.path);
        await group(page, d.copy.destination.label).getByRole("button").nth(2).click();
        await expect(cardLinks(page)).toHaveCount(2);

        await openMenuIfCollapsed(page, d);
        const prefix = d.journey.locale.language.split("{name}")[0].trim();
        await page.getByRole("combobox", { name: new RegExp(`^${escapeRegExp(prefix)}`) }).click();
        await page.getByRole("option", { name: NATIVE_NAME[next] }).click();
        await page.waitForURL((url) => url.pathname === nd.path && url.search === "");
        await hydrated(page);
        await expect(page.locator("html")).toHaveAttribute("lang", next);
        await expect(page.locator("html")).toHaveAttribute("dir", next === "ar" ? "rtl" : "ltr");
        await expect(cardLinks(page)).toHaveCount(12);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(nd.copy.heading);

        await page.locator(`footer a[hreflang="${locale}"]`).click();
        await page.waitForURL((url) => url.pathname === d.path && url.search === "");
        await hydrated(page);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(cardLinks(page)).toHaveCount(12);
      });

      test("10. card navigation: the first card goes to its stay page", async ({ page, watch }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const href = localePath(locale, `${PATH}/${d.stays[0].slug}`);
        watch.freeze(); // the English stay pages are still Framer documents: what they load is not this page's business
        const [response] = await Promise.all([
          page.waitForResponse((r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === href),
          cardLinks(page).first().click(),
        ]);
        expect(new URL(page.url()).pathname).toBe(href);
        // The AR and ES stay pages are plan 06's; its spec asserts their 200.
        if (locale === "en") expect(response.status()).toBe(200);
      });

      test("11. keyboard: the Tab order, Space on a chip, Enter on a card, 2px focus outlines, right to left in ar", async ({ page, watch }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const names = async () =>
          page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            return el ? (el.getAttribute("aria-label") ?? el.textContent ?? "").trim() : "";
          });

        await searchBox(page, d).focus();
        const destinationLabels = [d.copy.destination.all, ...d.destinations.map((x) => x.name)];
        const o = d.copy.bedrooms.options;
        const expectedBefore = [...destinationLabels, d.copy.guests.remove, d.copy.guests.add, o.any, o["1-4"], o["5-8"], o["9+"], d.journey.bar.dates.empty];
        const left: number[] = [];
        for (const [i, label] of expectedBefore.entries()) {
          await page.keyboard.press("Tab");
          expect(await names(), `Tab stop ${i + 1}`).toBe(label);
          if (i < destinationLabels.length) left.push((await page.locator(":focus").boundingBox())!.x);
        }
        // No Clear filters while nothing is set: the next stop is the first card.
        await page.keyboard.press("Tab");
        await expect(cardLinks(page).first()).toBeFocused();
        expect(await page.locator(":focus").evaluate((el) => [getComputedStyle(el).outlineWidth, getComputedStyle(el).outlineStyle])).toEqual(["2px", "solid"]);
        // DOM order is also visual order: left to right, and right to left in Arabic.
        const sorted = [...left].sort((a, b) => (locale === "ar" ? b - a : a - b));
        expect(left, "chips run in the reading direction").toEqual(sorted);

        // Space presses a chip and the grid updates; the next Tab stops include Clear filters, then the first card.
        const medellin = d.destinations.find((x) => x.slug === "medellin")!;
        const chip = group(page, d.copy.destination.label).getByRole("button", { name: medellin.name, exact: true });
        await chip.focus();
        expect(await chip.evaluate((el) => [getComputedStyle(el).outlineWidth, getComputedStyle(el).outlineStyle])).toEqual(["2px", "solid"]);
        await page.keyboard.press("Space");
        await expect(chip).toHaveAttribute("aria-pressed", "true");
        await expectGrid(page, d, { destination: "medellin" }, "after Space on the Medellín chip");
        const afterChip = [d.copy.guests.remove, d.copy.guests.add, o.any, o["1-4"], o["5-8"], o["9+"], d.journey.bar.dates.empty, d.copy.clear];
        for (const [i, label] of afterChip.entries()) {
          await page.keyboard.press("Tab");
          expect(await names(), `Tab stop after the chip ${i + 1}`).toBe(label);
        }
        await page.keyboard.press("Tab");
        const first = cardLinks(page).first();
        await expect(first).toBeFocused();
        const href = (await first.getAttribute("href"))!;
        watch.freeze();
        await Promise.all([page.waitForURL((url) => url.pathname === href), page.keyboard.press("Enter")]);
      });

      test("12. screen-reader names: every control is named, the count is live, one h1", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        await expect(searchBox(page, d)).toHaveAccessibleName(d.copy.search.label);
        for (const name of [d.copy.filtersLabel, d.copy.destination.label, d.copy.guests.label, d.copy.bedrooms.label, d.journey.bar.dates.label]) {
          await expect(group(page, name), `group ${name}`).toHaveCount(1);
        }
        const check = async (box: Locator, labels: string[]) => {
          const chips = box.getByRole("button");
          await expect(chips).toHaveCount(labels.length);
          for (const [i, label] of labels.entries()) {
            await expect(chips.nth(i)).toHaveAccessibleName(label);
            await expect(chips.nth(i)).toHaveAttribute("aria-pressed", /^(true|false)$/);
          }
        };
        await check(group(page, d.copy.destination.label), [d.copy.destination.all, ...d.destinations.map((x) => x.name)]);
        const o = d.copy.bedrooms.options;
        await check(group(page, d.copy.bedrooms.label), [o.any, o["1-4"], o["5-8"], o["9+"]]);
        const guests = group(page, d.copy.guests.label);
        await expect(guests.getByRole("button", { name: d.copy.guests.add, exact: true })).toHaveAccessibleName(d.copy.guests.add);
        await expect(guests.getByRole("button", { name: d.copy.guests.remove, exact: true })).toHaveAccessibleName(d.copy.guests.remove);
        await expect(datesTrigger(page, d)).toHaveAccessibleName(d.journey.bar.dates.empty);
        await expect(datesTrigger(page, d)).toHaveAttribute("aria-expanded", "false");
        await expect(datesClear(page, d), "no × while no dates are set").toHaveCount(0);
        for (const [i, stay] of d.stays.entries()) {
          await expect(cardLinks(page).nth(i)).toHaveAccessibleName(new RegExp(escapeRegExp(stay.title)));
        }
        // Found by its text, not by the attribute under test, so a missing aria-live fails here.
        await expect(page.getByText(formatPlural(d.copy.count, 12, locale), { exact: true })).toHaveAttribute("aria-live", "polite");
        const h1 = page.getByRole("heading", { level: 1 });
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveText(d.copy.heading);

        const snapshot = await page.locator("main").ariaSnapshot();
        const unnamed = snapshot
          .split("\n")
          .filter((line) => /^\s*- (link|button|searchbox|textbox|combobox|checkbox|switch|slider|spinbutton)\b/.test(line))
          .filter((line) => !/^\s*- \w+ "[^"]+"/.test(line));
        expect(unnamed, "an interactive element in <main> has no accessible name").toEqual([]);

        // With dates set the trigger names the range and the × is a named button.
        await visitAt(page, `${d.path}?from=2026-10-12&to=2026-10-15`);
        await expect(datesTrigger(page, d)).toHaveAccessibleName(rangeText(d, "2026-10-12", "2026-10-15"));
        await expect(datesClear(page, d)).toHaveAccessibleName(d.journey.dates.clear);
      });

      test("13. held controls (design 4.3 #1 to #8) are absent, and so are the currency select, a submit, sort and pagination", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);

        const absent = async (withMenu: boolean) => {
          const where = withMenu ? "with the Menu open" : "closed";
          const named = (role: "button" | "link", name: string) => page.getByRole(role, { name, exact: true });
          // #1 journey bar / sheet Search
          await expect(named("button", d.journey.bar.search), `#1 Search button (${where})`).toHaveCount(0);
          await expect(page.locator("form"), `#1 any form (${where})`).toHaveCount(0);
          await expect(page.locator('[role="search"]'), `#1 role=search (${where})`).toHaveCount(0);
          await expect(group(page, d.journey.bar.label), `#1 the bar's group (${where})`).toHaveCount(0);
          // #2 nav cart
          for (const role of ["link", "button"] as const) {
            await expect(named(role, boardWord("k26", locale)), `#2 cart ${role} (${where})`).toHaveCount(0);
          }
          // #3 nav Login
          for (const role of ["link", "button"] as const) {
            await expect(named(role, boardWord("k27", locale)), `#3 Login ${role} (${where})`).toHaveCount(0);
            await expect(named(role, d.nav.login), `#3 Login ${role} by the nav string (${where})`).toHaveCount(0);
          }
          // #4 footer newsletter: Email + Subscribe
          await expect(page.locator("footer form"), `#4 footer form (${where})`).toHaveCount(0);
          await expect(page.locator("footer input"), `#4 footer input (${where})`).toHaveCount(0);
          await expect(page.locator('input[type="email"]'), `#4 email input (${where})`).toHaveCount(0);
          await expect(page.getByRole("textbox"), `#4 any textbox (${where})`).toHaveCount(0);
          await expect(named("button", boardWord("k54", locale)), `#4 Subscribe (${where})`).toHaveCount(0);
          await expect(named("button", HOME_COPY[locale].subscribe), `#4 Subscribe by the home string (${where})`).toHaveCount(0);
          // #5 footer List with us
          for (const word of [boardWord("k52", locale), HOME_COPY[locale].listTitle]) {
            await expect(page.getByText(word, { exact: true }), `#5 List with us (${where})`).toHaveCount(0);
          }
          // #6 Add, #7 Continue (stay-page controls), #8 See Packages
          await expect(named("button", d.journey.addons.add), `#6 Add (${where})`).toHaveCount(0);
          for (const word of [d.journey.addons.continue, d.journey.cart.continue]) {
            await expect(named("button", word), `#7 Continue (${where})`).toHaveCount(0);
            await expect(named("link", word), `#7 Continue link (${where})`).toHaveCount(0);
          }
          await expect(page.getByText(/see packages/i), `#8 See Packages (${where})`).toHaveCount(0);

          // No currency select (design 4.1 row 6), no submit, no sort, no pagination, no dead disabled control.
          const currencyPrefix = d.journey.locale.currency.split("{code}")[0].trim();
          await expect(page.getByRole("combobox", { name: new RegExp(`^${escapeRegExp(currencyPrefix)}`) }), `currency select (${where})`).toHaveCount(0);
          await expect(page.locator('button[type="submit"], input[type="submit"]'), `a submit (${where})`).toHaveCount(0);
          await expect(page.getByRole("navigation", { name: /pagination|paginación|ترقيم/i })).toHaveCount(0);
          await expect(page.getByRole("button", { name: /^(sort|order by|ordenar|ترتيب)/i })).toHaveCount(0);
          const disabled = await page.locator('[aria-disabled="true"]').evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")));
          for (const label of disabled) expect([d.copy.guests.add, d.copy.guests.remove], "an aria-disabled control that is not the guests stepper").toContain(label);
        };

        await absent(false);
        if (await openMenuIfCollapsed(page, d)) {
          await expect(page.getByRole("combobox")).toHaveCount(1); // the language select, and nothing else
          await absent(true);
        } else {
          await expect(page.getByRole("combobox")).toHaveCount(1);
        }
      });

      test("14. JavaScript off: the 12 cards and every link work, no filter control shows, Arabic runs right to left", async ({ browser }) => {
        const d = await data(locale);
        const context = await browser.newContext({ javaScriptEnabled: false, viewport });
        const page = await context.newPage();
        const media = await routeMedia(page);
        await page.goto(d.path, { waitUntil: "load" });
        await page.waitForTimeout(250);

        const links = cardLinks(page);
        await expect(links).toHaveCount(12);
        for (const [i, stay] of d.stays.entries()) {
          await expect(links.nth(i)).toBeVisible();
          await expect(links.nth(i)).toHaveAttribute("href", localePath(locale, `${PATH}/${stay.slug}`));
        }
        await expect(page.locator("[data-stay-filters]")).toBeHidden();
        await expect(page.getByText(d.journey.bar.dates.empty, { exact: true }), "the Dates control").toBeHidden();
        await expect(page.getByText(d.datesNote, { exact: true }), "the Dates note").toBeHidden();
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");

        if (locale === "ar") {
          const a = (await links.nth(0).boundingBox())!;
          const b = (await links.nth(1).boundingBox())!;
          if (viewport.width >= 834) expect(a.x, "card 1 is right of card 2").toBeGreaterThan(b.x);
          else {
            const shell = (await page.locator("main > div > div").first().boundingBox())!;
            expect(Math.abs(a.x + a.width - (shell.x + shell.width))).toBeLessThanOrEqual(1);
          }
        }
        expect(media.missing).toEqual([]);
        await context.close();
      });

      test("15. layout and media: no overflow, 1 / 2 / 3 columns, gold rule, square corners, only the media host", async ({ page, watch }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        const xs = new Set<number>();
        for (let i = 0; i < 3; i += 1) xs.add(Math.round((await cardLinks(page).nth(i).boundingBox())!.x));
        expect(xs.size, "distinct columns among the first three cards").toBe(viewport.width === 390 ? 1 : viewport.width === 834 ? 2 : 3);

        // The h1 sits in a SectionHead: the gold rule is the border of the nearest ancestor that has a top border
        // (not necessarily its parent), and it must be inside <main>.
        const rule = await page.getByRole("heading", { level: 1 }).evaluate((h) => {
          for (let el = h.parentElement; el && el.tagName !== "MAIN"; el = el.parentElement) {
            const style = getComputedStyle(el);
            if (parseFloat(style.borderTopWidth) > 0) return { width: style.borderTopWidth, color: style.borderTopColor };
          }
          return null;
        });
        expect(rule).toEqual({ width: "2px", color: await token(page, "gold") });

        const radii = await page.locator("main img, main button").evaluateAll((els) => els.map((el) => getComputedStyle(el).borderRadius));
        expect(radii.length).toBeGreaterThan(12);
        for (const radius of radii) expect(radius).toBe("0px");

        const keys = new Set([...watch.media.served, ...watch.media.standIn]);
        for (const stay of d.stays) expect(keys.has(stay.hero_image!.url.slice(MEDIA_BASE_URL.length + 1)), `${stay.slug} hero image was requested`).toBe(true);
        for (const url of watch.mediaRequests) expect(url.startsWith(`${MEDIA_BASE_URL}/`)).toBe(true);
        for (const img of await page.locator("main img").evaluateAll((els) => els.map((el) => (el as HTMLImageElement).currentSrc))) {
          expect(img.startsWith(`${MEDIA_BASE_URL}/`), img).toBe(true);
        }
        for (const host of FORBIDDEN_HOSTS) expect([...watch.hosts]).not.toContain(host);
      });

      test("16. dates: a range picked in the calendar keeps only stays free on every night", async ({ page }) => {
        const d = await data(locale);
        const [from, to] = ["2026-10-14", "2026-10-17"];
        await visitAt(page, d.path);
        await expect(datesTrigger(page, d)).toHaveText(d.journey.bar.dates.empty);
        await datesTrigger(page, d).click();
        await expect(datesTrigger(page, d)).toHaveAttribute("aria-expanded", "true");
        await expect(panel(page, d)).toBeVisible();
        // Two months from 1024 px, one below.
        await expect(panel(page, d).locator('[role="grid"]')).toHaveCount(viewport.width >= 1024 ? 2 : 1);
        // Past days are unpickable.
        await expect(day(page, "2026-10-3")).toHaveAttribute("aria-disabled", "true");

        await day(page, from).click();
        await expectGrid(page, d, {}, "after the arrival day only: nothing filters yet");
        await day(page, to).click();
        const want = await expectGrid(page, d, { from, to }, `nights ${from} to ${to}`);
        const slugs = want.map((s) => s.slug);
        expect(want.length).toBeLessThan(12);
        expect(slugs, "booked on 14 to 16 October: out").not.toContain("casa-jardin-san-diego");
        expect(slugs, "blocked from the 17th, the departure day: still in").toContain("getsemani-colonial-house");
        expect(new URL(page.url()).search).toBe(`?${toStayQuery({ from, to })}`);
        await expect(clearButtons(page, d)).toHaveCount(1);

        await page.getByRole("button", { name: d.journey.done, exact: true }).click();
        await expect(panel(page, d)).toHaveCount(0);
        await expect(datesTrigger(page, d)).toBeFocused();
        await expect(datesTrigger(page, d)).toHaveText(rangeText(d, from, to));
        await expect(datesClear(page, d)).toHaveCount(1);

        // A later pick replaces the range.
        const [from2, to2] = ["2026-10-20", "2026-10-22"];
        await pickRange(page, d, from2, to2);
        await expectGrid(page, d, { from: from2, to: to2 }, `nights ${from2} to ${to2}`);
        expect(new URL(page.url()).search).toBe(`?${toStayQuery({ from: from2, to: to2 })}`);
      });

      test("17. dates: × clears them, Clear filters resets all five, the note is the copy's", async ({ page }) => {
        const d = await data(locale);
        await visitAt(page, d.path);
        const sample = d.stays.some((s) => s.sample_fields.includes("blocked_dates"));
        expect(sample, "the fixture's blocked dates are sample data").toBe(true);
        await expect(page.getByText(d.datesNote, { exact: true })).toHaveCount(1);
        await expect(page.getByText(d.datesNote, { exact: true })).toBeVisible();

        const [from, to] = ["2026-10-14", "2026-10-17"];
        await pickRange(page, d, from, to);
        await expectGrid(page, d, { from, to }, "dates set");
        await datesClear(page, d).click();
        await expect(datesTrigger(page, d)).toHaveText(d.journey.bar.dates.empty);
        await expect(datesClear(page, d)).toHaveCount(0);
        await expectGrid(page, d, {}, "after ×");
        await expect(cardLinks(page)).toHaveCount(12);
        expect(new URL(page.url()).search).toBe("");

        // All five set, then Clear filters.
        const medellinOrCartagena = d.destinations[0];
        await searchBox(page, d).fill("casa");
        await group(page, d.copy.destination.label).getByRole("button", { name: medellinOrCartagena.name, exact: true }).click();
        await group(page, d.copy.guests.label).getByRole("button", { name: d.copy.guests.add, exact: true }).click();
        await group(page, d.copy.bedrooms.label).getByRole("button", { name: d.copy.bedrooms.options["1-4"], exact: true }).click();
        await pickRange(page, d, from, to);
        await expect(clearButtons(page, d)).toHaveCount(1);
        await expect(datesTrigger(page, d)).toHaveText(rangeText(d, from, to));
        expect(new URL(page.url()).search).toBe(`?${toStayQuery({ destination: medellinOrCartagena.slug, from, to, guests: 1 })}`);

        await clearButtons(page, d).click();
        await expect(searchBox(page, d)).toHaveValue("");
        expect(await pressedOf(group(page, d.copy.destination.label).getByRole("button"))).toEqual([d.copy.destination.all]);
        expect(await pressedOf(group(page, d.copy.bedrooms.label).getByRole("button"))).toEqual([d.copy.bedrooms.options.any]);
        await expect(guestsValue(page, d)).toHaveText("0");
        await expect(datesTrigger(page, d)).toHaveText(d.journey.bar.dates.empty);
        await expect(datesClear(page, d)).toHaveCount(0);
        await expect(cardLinks(page)).toHaveCount(12);
        expect(new URL(page.url()).search).toBe("");
        await expect(clearButtons(page, d)).toHaveCount(0);
        await expect(page.locator("#stay-search")).toBeFocused();
        await expect(page.getByText(d.datesNote, { exact: true })).toBeVisible();
      });

      test("18. dates by keyboard and in Arabic: Enter opens, Escape closes and focus returns, digits stay Western", async ({ page }) => {
        const d = await data(locale);
        const [from, to] = ["2026-10-12", "2026-10-15"];
        await visitAt(page, `${d.path}?${toStayQuery({ from, to })}`);
        const trigger = datesTrigger(page, d);
        await trigger.focus();
        await page.keyboard.press("Enter");
        await expect(panel(page, d)).toBeVisible();
        await expect(trigger).toHaveAttribute("aria-expanded", "true");
        expect(await panel(page, d).evaluate((el) => getComputedStyle(el).direction)).toBe(locale === "ar" ? "rtl" : "ltr");
        await page.keyboard.press("Escape");
        await expect(panel(page, d)).toHaveCount(0);
        await expect(trigger).toBeFocused();
        await expect(trigger).toHaveAttribute("aria-expanded", "false");
        // Escape changes nothing.
        await expectGrid(page, d, { from, to }, "after Escape");

        // The trigger's dates are Western digits in a left-to-right run, in every language.
        const bdi = trigger.locator("bdi");
        await expect(bdi).toHaveAttribute("dir", "ltr");
        await expect(bdi).toHaveText(rangeText(d, from, to).split(" · ")[0]);
        expect(await trigger.innerText()).not.toMatch(/[\u0660-\u0669\u06F0-\u06F9]/);
        await page.keyboard.press("Space");
        await expect(panel(page, d)).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(panel(page, d)).toHaveCount(0);
        await expect(trigger).toBeFocused();
      });
    });
  }
}
