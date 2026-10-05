import { expect, type Page } from "@playwright/test";
import { BLOG_COPY } from "../../../lib/copy/blog";
import { HOME_COPY } from "../../../lib/copy/home";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { getDestinations } from "../../../lib/data/destinations";
import { formatDate, formatRange } from "../../../lib/format";
import { fill } from "../../../lib/journey-format";
import { localePath, type Locale } from "../../../lib/locale-path";
import { routeMedia } from "../../helpers/media-route";

// Shared by the blog build specs (plan 03.3-33). Same conventions as tests/build/home/home.spec.ts: expected strings are
// read from the copy tables of that locale, never typed in English; images go through routeMedia; "today" is fixed.

export const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "tablet", width: 834, height: 1194 },
  { name: "desktop", width: 1440, height: 900 },
] as const;
export type Viewport = (typeof VIEWPORTS)[number];

/** Tailwind `md` (48rem): the phone entry and sheet below it, the full bar from it up. */
export const isPhone = (vp: Viewport) => vp.width < 768;

export const LOCALE_LIST: Locale[] = ["en", "ar", "es"];
export const FORBIDDEN_HOSTS = /framerusercontent\.com|files\.catbox\.moe|videos\.pexels\.com/;
export const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };
export const NEXT: Record<Locale, Locale> = { en: "ar", ar: "es", es: "en" };

export const CARTAGENA_POST = "discovering-cartagenas-hidden-colonial-courtyards";
export const MEDELLIN_POST = "why-medellin-is-redefining-luxury-travel";
export const COFFEE_POST = "colombias-coffee-triangle-eje-cafetero";
export const POST_SLUGS = [CARTAGENA_POST, MEDELLIN_POST, COFFEE_POST];

/** Every blog document: [locale, english path, served path]. */
export const BLOG_DOCUMENTS: Array<{ locale: Locale; path: string; url: string; slug: string | null }> = LOCALE_LIST.flatMap((locale) =>
  [null, ...POST_SLUGS].map((slug) => {
    const path = slug === null ? "/blog" : `/blog/${slug}`;
    return { locale, path, url: localePath(locale, path), slug };
  }),
);

/** "Today" for every test: the dates the journey picks are in the future of it. */
export const FIXED_NOW = "2026-10-04T09:00:00+04:00";
export const SEARCH_FROM = "2026-10-12";
export const SEARCH_TO = "2026-10-15";
export const SEARCH_GUESTS = 2;

export type Visit = { media: Awaited<ReturnType<typeof routeMedia>>; requests: string[] };

/** Open a page with images routed and every request recorded. Network idle capped at 10 s, then a settle. */
export async function visit(page: Page, path: string): Promise<Visit> {
  await page.clock.setFixedTime(FIXED_NOW);
  const media = await routeMedia(page);
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(path);
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(200);
  return { media, requests };
}

/** React puts __reactProps on a node when it hydrates it: wait for the planner's own button. */
export async function hydrated(page: Page) {
  await page.waitForFunction(() => {
    const button = document.querySelector('[role="region"] button');
    return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
  });
}

export const region = (page: Page, locale: Locale) => page.getByRole("region", { name: BLOG_COPY[locale].post.barLabel });
export const dayButton = (page: Page, isoDate: string) => page.locator(`[data-date="${isoDate}"]`);
export const guestName = (locale: Locale, unit: "adult" | "child" | "infant") =>
  fill(JOURNEY_COPY[locale].guests.add, { group: JOURNEY_COPY[locale].guests.group[unit] });
export const nameOfCurrency = (locale: Locale, code: string) => JOURNEY_COPY[locale].locale.currency.replace("{code}", code);

/** DD/MM/YYYY from an ISO day, through the shared formatter. */
export function isoDmy(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return formatDate(d, m, y);
}

export const cartagenaOf = async (locale: Locale) => (await getDestinations(locale)).find((d) => d.slug === "cartagena")!;

/** How much of the journey a test fills in before it presses Search. */
export type Fill = "nothing" | "destination" | "all";

/**
 * Fill the post hero's planner as far as `how` says, without pressing Search. From md up it drives the bar; below it the
 * entry row and the sheet. A destination already chosen (the post's own) is left alone on the sheet, which opens at When.
 */
export async function fillPlanner(page: Page, locale: Locale, vp: Viewport, how: Fill) {
  const copy = JOURNEY_COPY[locale];
  const cartagena = await cartagenaOf(locale);
  const root = region(page, locale);

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
    await page.getByRole("group", { name: copy.guests.label }).getByRole("button", { name: copy.done, exact: true }).click();
    await expect(page.getByRole("group", { name: copy.guests.label })).toHaveCount(0);
    return;
  }

  // Phone: the entry row opens the three-step sheet.
  await root.getByRole("button").click();
  const sheet = page.getByRole("dialog", { name: copy.sheet.label });
  await expect(sheet).toBeVisible();
  if (how === "nothing") return;
  const options = sheet.getByRole("option", { name: new RegExp(cartagena.name) });
  if ((await options.count()) > 0) await options.click();
  await expect(sheet.getByText(fill(copy.sheet.progress, { n: 2 }), { exact: true })).toBeVisible();
  if (how === "destination") return;
  await dayButton(page, SEARCH_FROM).click();
  await dayButton(page, SEARCH_TO).click();
  await sheet.getByRole("button", { name: copy.sheet.next, exact: true }).click();
  await expect(sheet.getByText(fill(copy.sheet.progress, { n: 3 }), { exact: true })).toBeVisible();
  await sheet.getByRole("button", { name: guestName(locale, "adult"), exact: true }).click();
}

/** The Search control of the planner just filled: the bar's submit button, or the sheet's last-step button. */
export const searchButton = (page: Page, locale: Locale, vp: Viewport) =>
  isPhone(vp)
    ? page.getByRole("dialog", { name: JOURNEY_COPY[locale].sheet.label }).getByRole("button", { name: JOURNEY_COPY[locale].bar.search, exact: true })
    : region(page, locale).getByRole("button", { name: JOURNEY_COPY[locale].bar.search, exact: true });

/** Names of every control the slice holds back, in this language, for the absent-by-name assertions. */
export function heldNames(locale: Locale): string[] {
  const copy = JOURNEY_COPY[locale];
  return [
    HOME_COPY[locale].nav.login,
    HOME_COPY[locale].subscribe,
    HOME_COPY[locale].listTitle,
    HOME_COPY[locale].newsletter,
    copy.addons.add,
    copy.addons.continue,
    "Continue",
    "Add",
    "Cart",
    "السلة",
    "Carrito",
    "Login",
  ].filter((name): name is string => typeof name === "string" && name.length > 0);
}
