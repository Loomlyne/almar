import { expect, test, type Page } from "@playwright/test";
import { BLOG_COPY } from "../../../lib/copy/blog";
import { HOME_COPY } from "../../../lib/copy/home";
import { HOME_PAGE_COPY } from "../../../lib/copy/home-page";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { STAYS_LIST_COPY } from "../../../lib/copy/stays-list";
import { getDestinations } from "../../../lib/data/destinations";
import { getCatalogItem } from "../../../lib/data/experiences";
import { getPost, getPosts } from "../../../lib/data/posts";
import { filterStays, toStayQuery } from "../../../lib/data/stay-filter";
import { getStay, getStays } from "../../../lib/data/stays";
import { formatPlural } from "../../../lib/journey-format";
import { absoluteLocaleUrl, localeDir, localePath, siteHref, type Locale } from "../../../lib/locale-path";
import { NOT_FOUND_COPY } from "../../../lib/not-found-document";
import {
  BLOG_DOCUMENTS,
  CARTAGENA_POST,
  COFFEE_POST,
  LANGUAGE_NAMES,
  LOCALE_LIST,
  MEDELLIN_POST,
  NEXT,
  POST_SLUGS,
  SEARCH_FROM,
  SEARCH_GUESTS,
  SEARCH_TO,
  VIEWPORTS,
  cartagenaOf,
  fillPlanner,
  hydrated,
  isPhone,
  isoDmy,
  region,
  searchButton,
  visit,
} from "./_helpers";
import { formatRange } from "../../../lib/format";
import { fill } from "../../../lib/journey-format";

// Plan 03.3-33 Task 2: every control of the blog list and the post page, clicked in a browser on the assembled out/,
// served by local wrangler with the Cloudflare asset rules. Run, after `node scripts/assemble-cloudflare.mjs`:
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/blog --workers=1
// One block per locale and width. Every expected string is read from the copy tables of that locale or from the data
// modules, never typed in English. The routing and 404 rules (12 URLs, 307, Arabic 404) run once at the end.

const attrOf = (raw: string, name: string) => new RegExp(`<html\\b[^>]*\\s${name}="([^"]*)"`, "i").exec(raw)?.[1] ?? null;
const countLine = (page: Page) => page.locator("main p[aria-live='polite']");
const group = (page: Page, name: string) => page.getByRole("group", { name, exact: true });

for (const locale of LOCALE_LIST) {
  for (const vp of VIEWPORTS) {
    const where = `${locale} at ${vp.width}`;
    const copy = BLOG_COPY[locale];
    const j = JOURNEY_COPY[locale];

    test.describe(`blog ${where}`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      test(`1 served bytes: lang, dir, the h1 and the plain links with JavaScript off; sessionStorage untouched by opening a post (${where})`, async ({
        browser,
        request,
        baseURL,
      }) => {
        const url = localePath(locale, `/blog/${CARTAGENA_POST}`);
        const raw = await (await request.get(url)).text();
        expect(attrOf(raw, "lang")).toBe(locale);
        expect(attrOf(raw, "dir")).toBe(localeDir(locale));

        const context = await browser.newContext({ baseURL, viewport: { width: vp.width, height: vp.height }, javaScriptEnabled: false });
        try {
          const bare = await context.newPage();
          await bare.route("**/*", (route) => route.continue());
          await bare.goto(url);
          const post = (await getPost(locale, CARTAGENA_POST))!;
          await expect(bare.getByRole("heading", { level: 1 })).toHaveText(post.title);
          expect(await bare.evaluate(() => document.documentElement.dir)).toBe(localeDir(locale));
          await expect(bare.getByRole("link", { name: copy.post.cta, exact: true })).toHaveAttribute("href", siteHref(locale, "/contact"));
          await expect(bare.locator("a[hreflang]")).toHaveCount(3);
        } finally {
          await context.close();
        }

        // With JavaScript on: opening the post writes nothing to sessionStorage (the bar is pre-filled in memory only).
        const page = await browser.newPage({ baseURL, viewport: { width: vp.width, height: vp.height } });
        try {
          const { media } = await visit(page, url);
          await hydrated(page);
          expect(await page.evaluate(() => window.sessionStorage.length)).toBe(0);
          expect(media.missing).toEqual([]);
        } finally {
          await page.close();
        }
      });

      test(`2 list card to post: the whole card is the link, same language, newest first (${where})`, async ({ page }) => {
        const { media } = await visit(page, localePath(locale, "/blog"));
        const posts = await getPosts(locale);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.list.heading);
        const cards = page.locator("main ul > li > a");
        await expect(cards).toHaveCount(posts.length);
        for (const [i, post] of posts.entries()) {
          await expect(cards.nth(i), `card ${i + 1}`).toHaveAttribute("href", localePath(locale, `/blog/${post.slug}`));
          await expect(cards.nth(i)).toContainText(post.title);
          await expect(cards.nth(i)).toContainText(post.date_label);
        }
        for (const post of posts) {
          await page.goto(localePath(locale, "/blog"));
          await page.locator(`main ul > li > a[href="${localePath(locale, `/blog/${post.slug}`)}"]`).click();
          await page.waitForURL((url) => url.pathname === localePath(locale, `/blog/${post.slug}`));
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(post.title);
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
        }
        expect(media.missing).toEqual([]);
      });

      test(`3 language switch on a post: the select and the footer links land on the same post in the served lang and dir (${where})`, async ({ page, context }) => {
        test.slow();
        const { media } = await visit(page, localePath(locale, `/blog/${CARTAGENA_POST}`));
        await hydrated(page);
        const target = NEXT[locale];
        const expected = localePath(target, `/blog/${CARTAGENA_POST}`);

        // The header select (below the 6xl container the nav sits behind Menu).
        if (vp.width < 1152) await page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true }).click();
        await page.getByRole("combobox", { name: /^(Language|اللغة|Idioma):/ }).click();
        const landed = page.waitForResponse((r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === expected);
        await page.getByRole("option", { name: LANGUAGE_NAMES[target], exact: true }).click();
        const response = await landed;
        expect(response.status()).toBe(200);
        expect(new URL(page.url()).pathname).toBe(expected);
        const raw = await response.text();
        expect(attrOf(raw, "lang")).toBe(target);
        expect(attrOf(raw, "dir")).toBe(localeDir(target));
        expect((await context.cookies()).find((c) => c.name === "almar-locale")?.value).toBe(target);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText((await getPost(target, CARTAGENA_POST))!.title);

        // The footer language row: the same post in each of the other languages.
        for (const other of LOCALE_LIST.filter((l) => l !== target)) {
          await page.goto(expected);
          const link = page.locator(`a[hreflang="${other}"]`);
          await expect(link).toHaveAttribute("href", localePath(other, `/blog/${CARTAGENA_POST}`));
          await link.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await link.click();
          await page.waitForURL((url) => url.pathname === localePath(other, `/blog/${CARTAGENA_POST}`));
          await expect(page.locator("html")).toHaveAttribute("lang", other);
          await expect(page.locator("html")).toHaveAttribute("dir", localeDir(other));
        }
        expect(media.missing).toEqual([]);
      });

      test(`4 featured stay card opens the stay page; the experience card is not a link; the coffee post has neither (${where})`, async ({ page }) => {
        const post = (await getPost(locale, CARTAGENA_POST))!;
        const stay = (await getStay(locale, post.featured_stay_slug!))!;
        const experience = (await getCatalogItem(locale, post.featured_experience_slug!))!;
        const { media } = await visit(page, localePath(locale, `/blog/${CARTAGENA_POST}`));

        await expect(page.getByRole("heading", { level: 2, name: copy.post.pairHeading })).toBeVisible();
        const stayCard = page.locator("main li").filter({ hasText: copy.post.featuredStay });
        await expect(stayCard).toHaveCount(1);
        await expect(stayCard).toContainText(stay.title);
        const expCard = page.locator("main li").filter({ hasText: copy.post.featuredExperience });
        await expect(expCard).toHaveCount(1);
        await expect(expCard).toContainText(experience.name);
        await expect(expCard.locator("a")).toHaveCount(0);
        await stayCard.locator("a").click();
        await page.waitForURL((url) => url.pathname === localePath(locale, `/private-stays/${stay.slug}`));
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("heading", { level: 1 })).toContainText(stay.title);

        // The coffee post: no pair head, no featured card.
        await page.goto(localePath(locale, `/blog/${COFFEE_POST}`));
        await expect(page.getByText(copy.post.pairHeading, { exact: true })).toHaveCount(0);
        await expect(page.getByText(copy.post.featuredStay, { exact: true })).toHaveCount(0);
        await expect(page.getByText(copy.post.featuredExperience, { exact: true })).toHaveCount(0);
        expect(media.missing).toEqual([]);
      });

      test(`5 related stories are links to the other posts in this language (${where})`, async ({ page }) => {
        const { media } = await visit(page, localePath(locale, `/blog/${CARTAGENA_POST}`));
        const related = await getPosts(locale);
        const others = related.filter((p) => p.slug !== CARTAGENA_POST);
        await expect(page.getByRole("heading", { level: 2, name: copy.post.related })).toBeVisible();
        for (const other of others) {
          await expect(page.locator(`main li a[href="${localePath(locale, `/blog/${other.slug}`)}"]`)).toHaveCount(1);
        }
        const first = page.locator(`main li a[href="${localePath(locale, `/blog/${others[0].slug}`)}"]`);
        await first.click();
        await page.waitForURL((url) => url.pathname === localePath(locale, `/blog/${others[0].slug}`));
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(others[0].title);
        expect(media.missing).toEqual([]);
      });

      test(`6 Copy link: the clipboard holds the canonical absolute URL and the toast shows (${where})`, async ({ page, context, baseURL }) => {
        await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: baseURL! });
        const { media } = await visit(page, localePath(locale, `/blog/${CARTAGENA_POST}`));
        await hydrated(page);
        const button = page.getByRole("button", { name: copy.post.copyLink, exact: true });
        await button.scrollIntoViewIfNeeded();
        await button.click();
        const canonical = absoluteLocaleUrl(locale, `/blog/${CARTAGENA_POST}`);
        await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(canonical);
        expect(canonical.startsWith("https://almarprivatejourney.com/")).toBe(true);
        expect(canonical.endsWith("/")).toBe(false);
        // The visible toast card and the polite live region both carry the text.
        await expect(page.getByText(copy.post.copied, { exact: true }).first()).toBeVisible();
        await expect(page.getByRole("status").filter({ hasText: copy.post.copied }).first()).toHaveText(copy.post.copied);
        expect(media.missing).toEqual([]);
      });

      test(`7 hero Search: destination, dates and guests open /private-stays filtered, the chip pressed, the dates set, the count changed (${where})`, async ({ page }) => {
        const { media } = await visit(page, localePath(locale, `/blog/${CARTAGENA_POST}`));
        await hydrated(page);
        const cartagena = await cartagenaOf(locale);
        const list = STAYS_LIST_COPY[locale];
        // The post's own destination is already in the bar.
        if (isPhone(vp)) await expect(region(page, locale).getByRole("button")).toContainText(cartagena.name);
        else await expect(region(page, locale).getByRole("button", { name: j.bar.destination.label })).toContainText(cartagena.name);

        await fillPlanner(page, locale, vp, "all");
        await searchButton(page, locale, vp).click();
        const target = `${localePath(locale, "/private-stays")}?${toStayQuery({ destination: "cartagena", from: SEARCH_FROM, to: SEARCH_TO, guests: SEARCH_GUESTS })}`;
        await page.waitForURL((url) => url.pathname + url.search === target);

        const all = await getStays(locale);
        const want = filterStays(all, { destination: "cartagena", from: SEARCH_FROM, to: SEARCH_TO, guests: SEARCH_GUESTS });
        expect(want.length).toBeGreaterThan(0);
        expect(want.length, "the count changed").toBeLessThan(all.length);
        const chips = group(page, list.destination.label).getByRole("button");
        await expect(chips.filter({ hasText: new RegExp(`^${cartagena.name}$`) })).toHaveAttribute("aria-pressed", "true");
        const pressed = await chips.evaluateAll((nodes) => nodes.filter((n) => n.getAttribute("aria-pressed") === "true").map((n) => n.textContent?.trim()));
        expect(pressed).toEqual([cartagena.name]);
        const nights = Math.round((Date.parse(`${SEARCH_TO}T00:00:00Z`) - Date.parse(`${SEARCH_FROM}T00:00:00Z`)) / 86_400_000);
        await expect(group(page, j.bar.dates.label).getByRole("button").first()).toHaveText(
          `${formatRange(isoDmy(SEARCH_FROM), isoDmy(SEARCH_TO))} · ${formatPlural(j.dates.nights, nights, locale)}`,
        );
        await expect(group(page, list.guests.label).locator("span[aria-live]")).toHaveText(String(SEARCH_GUESTS));
        await expect(countLine(page)).toHaveText(formatPlural(list.count, want.length, locale));
        expect(media.missing).toEqual([]);
      });

      test(`7b hero Search on the coffee post (no destination): choose Where, When, Who, Search (${where})`, async ({ page }) => {
        const { media } = await visit(page, localePath(locale, `/blog/${COFFEE_POST}`));
        await hydrated(page);
        const cartagena = await cartagenaOf(locale);
        // Where is empty.
        if (isPhone(vp)) await expect(region(page, locale).getByRole("button")).not.toContainText(cartagena.name);
        else await expect(region(page, locale).getByRole("button", { name: j.bar.destination.label })).not.toContainText(cartagena.name);
        await fillPlanner(page, locale, vp, "all");
        await searchButton(page, locale, vp).click();
        const target = `${localePath(locale, "/private-stays")}?${toStayQuery({ destination: "cartagena", from: SEARCH_FROM, to: SEARCH_TO, guests: SEARCH_GUESTS })}`;
        await page.waitForURL((url) => url.pathname + url.search === target);
        const want = filterStays(await getStays(locale), { destination: "cartagena", from: SEARCH_FROM, to: SEARCH_TO, guests: SEARCH_GUESTS });
        await expect(countLine(page)).toHaveText(formatPlural(STAYS_LIST_COPY[locale].count, want.length, locale));
        expect(media.missing).toEqual([]);
      });

      test(`8 missing step: Search with nothing chosen shows the missing-step message and goes nowhere (${where})`, async ({ page }) => {
        const post = localePath(locale, `/blog/${COFFEE_POST}`);
        const { media } = await visit(page, post);
        await hydrated(page);
        const stay = () => expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe(post);
        if (!isPhone(vp)) {
          const alert = region(page, locale).getByRole("alert");
          await searchButton(page, locale, vp).click();
          await expect(alert).toHaveText(j.bar.error.both);
          stay();
          await fillPlanner(page, locale, vp, "destination");
          await searchButton(page, locale, vp).click();
          await expect(alert).toHaveText(j.bar.error.dates);
          stay();
        } else {
          await fillPlanner(page, locale, vp, "nothing");
          const sheet = page.getByRole("dialog", { name: j.sheet.label });
          await sheet.getByRole("button", { name: j.sheet.next, exact: true }).click();
          await expect(sheet.getByRole("alert")).toHaveText(j.sheet.warn.where);
          await sheet.getByRole("option", { name: new RegExp((await cartagenaOf(locale)).name) }).click();
          await expect(sheet.getByText(fill(j.sheet.progress, { n: 2 }), { exact: true })).toBeVisible();
          await sheet.getByRole("button", { name: j.sheet.next, exact: true }).click();
          await expect(sheet.getByRole("alert")).toHaveText(j.sheet.warn.when);
          await expect(sheet.getByRole("button", { name: j.bar.search, exact: true })).toHaveCount(0);
          stay();
        }
        expect(media.missing).toEqual([]);
      });

      test(`9 the contact button and the three links go where they say (${where})`, async ({ page, request }) => {
        const post = localePath(locale, `/blog/${CARTAGENA_POST}`);
        const { media } = await visit(page, post);
        const cases: Array<[string, string, string]> = [
          ["contact button", copy.post.cta, siteHref(locale, "/contact")],
          ["back link", copy.post.links.back, localePath(locale, "/blog")],
          ["Home", copy.post.links.home, localePath(locale, "/")],
          ["Destinations", copy.post.links.destinations, siteHref(locale, "/destinations")],
        ];
        for (const [label, name, path] of cases) {
          await page.goto(post);
          // The nav also has Home and Destinations links: the body's own are the ones after the hero.
          const link = page.locator("main").getByRole("link", { name, exact: true });
          await expect(link, label).toHaveCount(1);
          await link.scrollIntoViewIfNeeded();
          await link.click();
          await page.waitForURL((url) => url.pathname === path, { timeout: 15_000 });
          expect(new URL(page.url()).pathname, label).toBe(path);
          expect((await request.get(path)).status(), `${label} answers 200`).toBe(200);
        }
        expect(media.missing).toEqual([]);
      });

      test(`10 home: Read All opens the localised blog list and a story card opens its post (${where})`, async ({ page }) => {
        const { media } = await visit(page, localePath(locale, "/"));
        await hydrated(page);
        const readAll = page.getByRole("link", { name: HOME_PAGE_COPY[locale].stories.readAll });
        await readAll.scrollIntoViewIfNeeded();
        await expect(readAll).toHaveAttribute("href", localePath(locale, "/blog"));
        await readAll.click();
        await page.waitForURL((url) => url.pathname === localePath(locale, "/blog"));
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(copy.list.heading);
        await expect(page.locator("html")).toHaveAttribute("lang", locale);

        await page.goto(localePath(locale, "/"));
        const first = (await getPosts(locale))[0];
        const card = page.locator(`#stories ul a[href="${localePath(locale, `/blog/${first.slug}`)}"]`);
        await card.scrollIntoViewIfNeeded();
        await card.click();
        await page.waitForURL((url) => url.pathname === localePath(locale, `/blog/${first.slug}`));
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(first.title);
        expect(media.missing).toEqual([]);
      });

      test(`11 post content by case: tag, cards, Where and On this page (${where})`, async ({ page }) => {
        const cartagena = await cartagenaOf(locale);
        const medellin = (await getDestinations(locale)).find((d) => d.slug === "medellin")!;
        const { media } = await visit(page, localePath(locale, `/blog/${CARTAGENA_POST}`));
        const tag = (name: string) => page.locator("main section h1 ~ p > span").filter({ hasText: new RegExp(`^${name}$`) });
        await expect(tag(cartagena.name)).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 2, name: copy.post.pairHeading })).toBeVisible();
        await expect(page.getByRole("navigation", { name: copy.post.onThisPage })).toHaveCount(0);

        await page.goto(localePath(locale, `/blog/${MEDELLIN_POST}`));
        await expect(tag(medellin.name)).toHaveCount(1);
        await expect(page.getByRole("heading", { level: 2, name: copy.post.pairHeading })).toBeVisible();
        await expect(page.getByRole("navigation", { name: copy.post.onThisPage })).toHaveCount(0);

        await page.goto(localePath(locale, `/blog/${COFFEE_POST}`));
        await expect(tag(cartagena.name)).toHaveCount(0);
        await expect(tag(medellin.name)).toHaveCount(0);
        await expect(page.getByRole("heading", { level: 2, name: copy.post.pairHeading })).toHaveCount(0);
        await expect(page.getByRole("navigation", { name: copy.post.onThisPage })).toHaveCount(0);
        expect(media.missing).toEqual([]);
      });
    });
  }
}

// ---- routing and the 404, once (the shared routing matrix has no blog paths: plan 32 notes) ---------------------------

test.describe("blog routing and 404", () => {
  test("the 12 documents answer 200 with no redirect, in their own lang and dir", async ({ request }) => {
    expect(BLOG_DOCUMENTS).toHaveLength(12);
    for (const doc of BLOG_DOCUMENTS) {
      const response = await request.get(doc.url, { maxRedirects: 0 });
      expect(response.status(), doc.url).toBe(200);
      const raw = await response.text();
      expect(attrOf(raw, "lang"), doc.url).toBe(doc.locale);
      expect(attrOf(raw, "dir"), doc.url).toBe(localeDir(doc.locale));
    }
  });

  test("a trailing slash costs one 307 to the form without it", async ({ request }) => {
    const slashed = ["/blog/", "/ar/blog/", "/es/blog/", ...POST_SLUGS.flatMap((s) => [`/blog/${s}/`, `/ar/blog/${s}/`, `/es/blog/${s}/`])];
    for (const url of slashed) {
      const response = await request.get(url, { maxRedirects: 0 });
      expect(response.status(), url).toBe(307);
      expect(new URL(response.headers()["location"], "http://x").pathname, url).toBe(url.slice(0, -1));
    }
  });

  for (const locale of LOCALE_LIST) {
    test(`an unknown post under ${locale === "en" ? "/blog" : `/${locale}/blog`} serves that language's 404`, async ({ page }) => {
      const url = `${localePath(locale, "/blog")}/nope`;
      const response = await page.goto(url);
      expect(response?.status()).toBe(404);
      expect(response?.request().redirectedFrom()).toBeNull();
      const raw = (await response?.text()) ?? "";
      expect(raw).toContain(`<html lang="${locale}" dir="${localeDir(locale)}">`);
      await expect(page.locator("h1")).toHaveText(NOT_FOUND_COPY[locale].heading);
      expect(await page.locator("h1").evaluate((el) => getComputedStyle(el).direction)).toBe(localeDir(locale));
    });
  }

  test("Framer's four old blog documents are gone: no English-only copy of an Arabic or Spanish post", async ({ request }) => {
    // The old Framer routes served /blog and the three posts in English only; /ar/blog and /es/blog did not exist.
    for (const locale of ["ar", "es"] as Locale[]) {
      const raw = await (await request.get(localePath(locale, "/blog"))).text();
      expect(attrOf(raw, "lang")).toBe(locale);
      expect(raw).not.toContain("framerusercontent");
    }
  });
});
