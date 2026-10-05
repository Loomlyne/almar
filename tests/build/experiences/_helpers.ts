import fs from "node:fs";
import path from "node:path";
import { expect, test as base, type Locator, type Page } from "@playwright/test";
import { EXPERIENCES_PAGE_COPY } from "../../../lib/copy/experiences-page";
import { HOME_COPY } from "../../../lib/copy/home";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { filterCatalog } from "../../../lib/data/catalog-filter";
import { getDestinations } from "../../../lib/data/destinations";
import { getCatalogItems } from "../../../lib/data/experiences";
import { MEDIA_BASE_URL } from "../../../lib/data/media";
import { getStays } from "../../../lib/data/stays";
import { fill, formatPlural } from "../../../lib/journey-format";
import { localePath, type Locale } from "../../../lib/locale-path";
import { routeMedia, type MediaRoute } from "../../helpers/media-route";

// Shared by the three /experiences browser specs (phase 3.3 plan 14). Specs under tests/build/ run on the assembled out/
// (reconcile R-4): `node scripts/assemble-cloudflare.mjs --target=local`, then
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/experiences --workers=1
// Every expected string and count comes from the copy file, the data layer, filterCatalog and formatPlural for that
// locale, never typed in English and never read from the page itself. The locked counts are asserted as literals too.

export const LOCALES: Locale[] = ["en", "ar", "es"];
export const VIEWPORTS = [
  { width: 390, height: 844 },
  { width: 834, height: 1194 },
  { width: 1440, height: 900 },
];
export const PATH = "/experiences";
export const FORBIDDEN_HOSTS = ["framerusercontent.com", "files.catbox.moe", "videos.pexels.com"];
export const NEXT_LOCALE: Record<Locale, Locale> = { en: "ar", ar: "es", es: "en" };
export const NATIVE_NAME: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };
/** The rail replaces the toolbar and the sheet from this width (Tailwind lg). */
export const LG = 1024;
/** The detail overlay is a centred panel from this width (Tailwind md). */
export const MD = 768;

/** Design 3.4: items per destination, by slug, in board order; and the type and total counts. */
export const LOCKED = { cartagena: 14, medellin: 11, bogota: 3, "san-andres": 1, "cocora-valley": 4 } as const;
export const LOCKED_SERVICES = 10;
export const LOCKED_EXPERIENCES = 35;
export const LOCKED_TOTAL = 45;
export const LOCKED_SANTA_FE = 6;

// ---- what the page is built from -------------------------------------------------------------------------------------

export type Data = Awaited<ReturnType<typeof load>>;
const cache = new Map<Locale, Promise<Data>>();
async function load(locale: Locale) {
  const [items, destinations, stays] = await Promise.all([
    getCatalogItems(locale),
    getDestinations(locale, { includeEmpty: true }),
    getStays(locale),
  ]);
  const used = new Set(items.flatMap((i) => i.stay_slugs));
  return {
    locale,
    path: localePath(locale, PATH),
    items,
    destinations,
    stays,
    offeredStays: stays.filter((s) => used.has(s.slug)),
    copy: EXPERIENCES_PAGE_COPY[locale],
    nav: HOME_COPY[locale].nav,
    journey: JOURNEY_COPY[locale],
    destinationNames: Object.fromEntries(destinations.map((d) => [d.slug, d.name])) as Record<string, string>,
    stayNames: Object.fromEntries(stays.map((s) => [s.slug, s.title])) as Record<string, string>,
  };
}
export const data = (locale: Locale): Promise<Data> => {
  if (!cache.has(locale)) cache.set(locale, load(locale));
  return cache.get(locale)!;
};

const BOARDS = {
  experiences: fs.readFileSync(path.join(process.cwd(), ".planning/design/2026-10-01-canvas/boards/PublicExperiences.dc.html"), "utf8"),
  overlay: fs.readFileSync(path.join(process.cwd(), ".planning/design/2026-10-01-canvas/boards/PublicOverlay.dc.html"), "utf8"),
};
/** A board dictionary word, for the names of held controls (design 4.3). */
export function boardWord(board: keyof typeof BOARDS, key: string, locale: Locale): string {
  const m = BOARDS[board].match(new RegExp(`"${key}":(\\{[^}]*\\})`));
  if (!m) throw new Error(`board key ${key} not found`);
  return (JSON.parse(m[1]) as Record<Locale, string>)[locale];
}

export const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** The names of the cards a filter leaves, from the one rule and the data layer, in page order: Experiences, then Services. */
export function expectedNames(d: Data, filter: Parameters<typeof filterCatalog>[1]): string[] {
  const left = filterCatalog(d.items, filter);
  return [...left.filter((i) => i.kind === "experience"), ...left.filter((i) => i.kind === "service")].map((i) => i.name);
}

// ---- every test watches the same things ------------------------------------------------------------------------------

export type Watch = { media: MediaRoute; hosts: Set<string>; errors: string[]; mediaRequests: string[]; freeze: () => void };

export const test = base.extend<{ watch: Watch }>({
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

export { expect };

/** goto, network idle capped at 10 s, the page's own ready mark (the address was read), a short settle (00-common-rules.md). */
export async function visit(page: Page, url: string) {
  await page.goto(url, { waitUntil: "load" });
  try {
    await page.waitForLoadState("networkidle", { timeout: 10_000 });
  } catch {
    // A cold run can keep a connection open; the ready mark below is the real gate.
  }
  await page.waitForSelector('[data-catalog-ready="true"]', { state: "attached" });
  await page.waitForTimeout(250);
}

/** The header Menu button exists below the nav breakpoint; open it so the nav and language select are reachable. */
export async function openMenuIfCollapsed(page: Page, d: Data): Promise<boolean> {
  const menu = page.getByRole("button", { name: d.nav.menu, exact: true });
  if (await menu.isVisible()) {
    await menu.click();
    return true;
  }
  return false;
}

/** The computed colour of a design token, so a style test never hand-types one. */
export const token = (page: Page, name: string) =>
  page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--color-${n})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);

// ---- locators ----------------------------------------------------------------------------------------------------------

/** Every card button of the catalogue (the card is one button, design 1.2). */
export const cards = (page: Page) => page.locator('main section ul[role="list"] button[aria-haspopup="dialog"]');
export const cardButton = (page: Page, name: string) => cards(page).filter({ hasText: new RegExp(`^${escapeRegExp(name)}$`) });
export const countLine = (page: Page) => page.locator('main p[aria-live="polite"]');
export const searchBox = (page: Page, d: Data) => page.getByRole("searchbox", { name: d.copy.search.label, exact: true });
export const clearButtons = (page: Page, d: Data) => page.getByRole("button", { name: d.copy.clear, exact: true });
export const filtersButton = (page: Page, d: Data) => page.getByRole("button", { name: new RegExp(`^${escapeRegExp(d.copy.filters.button)}`) });
export const typeGroup = (page: Page, d: Data) => page.getByRole("group", { name: d.copy.type.label, exact: true });
export const typeButton = (page: Page, d: Data, kind: "all" | "experience" | "service") => {
  const name = kind === "all" ? d.copy.type.all : kind === "experience" ? d.copy.type.experiences : d.copy.type.services;
  return typeGroup(page, d).getByRole("button", { name, exact: true });
};
export const dialog = (page: Page, name: string) => page.getByRole("dialog", { name, exact: true });
export const chipButton = (page: Page, d: Data, name: string) =>
  page.getByRole("button", { name: fill(d.copy.removeFilter, { name }), exact: true });
export const search = (page: Page) => new URL(page.url()).search;

/** The two group heads as {name, count}, in page order: the h2 text node, then its count. */
export const groupHeads = (page: Page) =>
  page.locator("main section[aria-labelledby] > h2").evaluateAll((nodes) =>
    nodes.map((node) => ({
      name: (node.firstChild?.textContent ?? "").trim(),
      count: (node.querySelector("bdi")?.textContent ?? "").trim(),
    })),
  );

export const titlesOf = (page: Page) => cards(page).allTextContents().then((all) => all.map((t) => t.trim()));

/** Where the checkboxes are: the rail from lg up, the Filters sheet (opened by `openSheet`) below. */
export function checkScope(page: Page, d: Data, width: number): Locator {
  return width >= LG ? page.getByRole("complementary", { name: d.copy.filters.label, exact: true }) : dialog(page, d.copy.filters.title);
}
export const checkbox = (page: Page, d: Data, width: number, name: string) =>
  checkScope(page, d, width).getByRole("checkbox", { name, exact: true });
export const checkboxGroup = (page: Page, d: Data, width: number, legend: string) =>
  checkScope(page, d, width).getByRole("group", { name: legend, exact: true });

export async function openSheet(page: Page, d: Data) {
  await filtersButton(page, d).click();
  await expect(dialog(page, d.copy.filters.title)).toBeVisible();
}
/** Closes the sheet with its primary button, which reads "Show N options". */
export async function closeSheet(page: Page, d: Data, n: number) {
  await dialog(page, d.copy.filters.title).getByRole("button", { name: formatPlural(d.copy.showResults, n, d.locale), exact: true }).click();
  await expect(dialog(page, d.copy.filters.title)).toHaveCount(0);
}

/**
 * Runs `act` with the checkboxes in reach: in the rail at lg and up, or inside the opened Filters sheet below, and closes
 * the sheet afterwards on `expectedCount` (the number its Show button must read).
 */
export async function withChecks(page: Page, d: Data, width: number, expectedCount: () => number, act: () => Promise<void>) {
  if (width >= LG) {
    await act();
    return;
  }
  await openSheet(page, d);
  await act();
  const n = expectedCount();
  await expect(
    dialog(page, d.copy.filters.title).getByRole("button", { name: formatPlural(d.copy.showResults, n, d.locale), exact: true }),
    "the sheet's Show button reads the filtered count",
  ).toBeVisible();
  await closeSheet(page, d, n);
}
