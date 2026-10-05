import type { Page } from "@playwright/test";
import { HOME_COPY } from "../../../lib/copy/home";
import { MEDIA_BASE_URL } from "../../../lib/data/media";
import { fill, formatPlural } from "../../../lib/journey-format";
import { SITE_ORIGIN, localePath, type Locale } from "../../../lib/locale-path";
import {
  FORBIDDEN_HOSTS,
  LG,
  LOCALES,
  LOCKED,
  LOCKED_TOTAL,
  NATIVE_NAME,
  NEXT_LOCALE,
  VIEWPORTS,
  boardWord,
  cardButton,
  cards,
  checkbox,
  closeSheet,
  countLine,
  data,
  dialog,
  escapeRegExp,
  expect,
  expectedNames,
  filtersButton,
  openMenuIfCollapsed,
  openSheet,
  search,
  searchBox,
  test,
  titlesOf,
  token,
  typeButton,
  typeGroup,
  visit,
  type Data,
} from "./_helpers";

// Phase 3.3 plan 14, task 8 (part 2). The served document, the current-page mark, the language switch, the keyboard, the names,
// the held controls, JavaScript off and the layout of the React /experiences page on the assembled out/, in EN, AR and ES at
// 390, 834 and 1440. Expected values come from the copy file, the data layer, the board dictionaries and computed tokens.
//   node scripts/assemble-cloudflare.mjs --target=local
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/experiences --workers=1

const ORIGIN = (locale: Locale) => `${SITE_ORIGIN}${localePath(locale, "/experiences")}`;

/** Every control's name in the whole document, hidden behind a modal or not: the label, else the text. */
const controlNames = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("a, button, [role='button'], [role='link']")].map((el) =>
      (el.getAttribute("aria-label") ?? el.textContent ?? "").trim(),
    ),
  );

/** The accessible names that must never appear on this page (design 4.3), in this locale. */
function heldNames(d: Data): string[] {
  const home = HOME_COPY[d.locale];
  return [
    boardWord("experiences", "k38", d.locale), // Add
    boardWord("overlay", "k13", d.locale), // Add to cart
    boardWord("experiences", "k26", d.locale), // Cart
    boardWord("experiences", "k27", d.locale), // Login
    home.nav.login,
    boardWord("experiences", "k76", d.locale), // Continue
    boardWord("experiences", "k83", d.locale), // List with us
    boardWord("experiences", "k84", d.locale), // Newsletter
    boardWord("experiences", "k85", d.locale), // Subscribe
    home.subscribe,
    home.newsletter,
    home.listTitle,
  ];
}

async function expectHeldAbsent(page: Page, d: Data, where: string) {
  const names = await controlNames(page);
  for (const held of heldNames(d)) expect(names.includes(held), `a control named "${held}" (${where})`).toBe(false);
  const text = await page.evaluate(() => document.body.innerText);
  expect(text.includes(boardWord("experiences", "k75", d.locale)), `"2 added" (${where})`).toBe(false);
  expect(text.includes(boardWord("overlay", "k11", d.locale)), `"per person" (${where})`).toBe(false);
  expect(/\b(AED|USD|EUR|COP)\b|[$€£]/.test(text), `a currency or an amount (${where})`).toBe(false);
  await expect(page.locator("form"), `a form (${where})`).toHaveCount(0);
  await expect(page.locator('button[type="submit"], input[type="submit"]'), `a submit (${where})`).toHaveCount(0);
  await expect(page.locator('[aria-label*="pagination" i], select'), `pagination or a sort (${where})`).toHaveCount(0);
  await expect(page.locator('[aria-disabled="true"], button:disabled'), `a dead control (${where})`).toHaveCount(0);
}

// ---- 1. the served document, once per locale ------------------------------------------------------------------------------

for (const locale of LOCALES) {
  test(`served document ${locale}: first-byte lang and dir, four hreflang links, canonical, JSON-LD, 45 card buttons`, async ({ request }) => {
    const d = await data(locale);
    const response = await request.get(d.path);
    expect(response.status()).toBe(200);
    const html = await response.text();

    const dir = locale === "ar" ? "rtl" : "ltr";
    expect(html, "lang and dir on <html> in the served HTML, before any script").toMatch(
      new RegExp(`^<!DOCTYPE html>(?:<!--[^>]*-->)?<html lang="${locale}" dir="${dir}"[ >]`),
    );
    const alternates = [...html.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"\s*\/?>/gi)].map((m) => [m[1], m[2]]);
    expect(Object.fromEntries(alternates)).toEqual({ en: ORIGIN("en"), ar: ORIGIN("ar"), es: ORIGIN("es"), "x-default": ORIGIN("en") });
    expect(alternates, "exactly four hreflang links").toHaveLength(4);
    expect(html.match(/<link rel="canonical" href="([^"]+)"/)?.[1]).toBe(ORIGIN(locale));

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

    expect((html.match(/<button\b[^>]*aria-haspopup="dialog"/g) ?? []).length).toBe(LOCKED_TOTAL);
    for (const word of FORBIDDEN_HOSTS) expect(html.includes(word), word).toBe(false);
  });
}

// ---- 2 to 8, per locale and width ------------------------------------------------------------------------------------------

for (const locale of LOCALES) {
  for (const viewport of VIEWPORTS) {
    const W = viewport.width;
    test.describe(`${locale} ${W}`, () => {
      test.use({ viewport });

      test("2. the Experiences nav link marks the page; Destinations does not", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        await openMenuIfCollapsed(page, d);
        const nav = page.getByRole("navigation", { name: "Primary" });
        const link = nav.getByRole("link", { name: d.nav.experiences, exact: true });
        await expect(link).toHaveAttribute("href", d.path);
        await expect(link).toHaveAttribute("aria-current", "page");
        await expect(nav.getByRole("link", { name: d.nav.destinations, exact: true })).not.toHaveAttribute("aria-current", "page");
        await expect(nav.locator("a[aria-current='page']")).toHaveCount(1);
      });

      test("3. language: with filters set, the header select and the footer row go to this page in the other language, reset", async ({ page }) => {
        const d = await data(locale);
        const next = NEXT_LOCALE[locale];
        const nd = await data(next);
        await visit(page, d.path);
        await typeButton(page, d, "service").click();
        await searchBox(page, d).fill("a");
        expect(search(page)).toBe("?type=service");

        await openMenuIfCollapsed(page, d);
        const prefix = d.journey.locale.language.split("{name}")[0].trim();
        await page.getByRole("combobox", { name: new RegExp(`^${escapeRegExp(prefix)}`) }).click();
        await page.getByRole("option", { name: NATIVE_NAME[next] }).click();
        await page.waitForURL((url) => url.pathname === nd.path && url.search === "");
        await expect(page.locator("html")).toHaveAttribute("lang", next);
        await expect(page.locator("html")).toHaveAttribute("dir", next === "ar" ? "rtl" : "ltr");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(nd.copy.heading);
        await expect(cards(page)).toHaveCount(LOCKED_TOTAL);

        await page.locator(`footer a[hreflang="${locale}"]`).click();
        await page.waitForURL((url) => url.pathname === d.path && url.search === "");
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(d.copy.heading);
        await expect(cards(page)).toHaveCount(LOCKED_TOTAL);
      });

      test("4. keyboard: Tab reaches search, type and a checkbox; Space toggles it; Enter opens a card, Tab stays inside, Escape returns", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const active = () =>
          page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            if (!el) return null;
            const labelled = (el as HTMLInputElement).labels?.[0]?.textContent;
            return { tag: el.tagName, type: el.getAttribute("type"), name: (el.getAttribute("aria-label") ?? labelled ?? el.textContent ?? "").trim() };
          });
        const outline = () =>
          page.locator(":focus").evaluate((el) => [getComputedStyle(el).outlineWidth, getComputedStyle(el).outlineStyle]);

        await searchBox(page, d).focus();
        expect((await active())?.tag).toBe("INPUT");
        const cartagenaName = d.destinationNames.cartagena;
        const cartagenaCount = expectedNames(d, { destinations: ["cartagena"] }).length;
        expect(cartagenaCount).toBe(LOCKED.cartagena);

        if (W >= LG) {
          // search, then the three type buttons in order, then the destination checkboxes.
          for (const label of [d.copy.type.all, d.copy.type.experiences, d.copy.type.services]) {
            await page.keyboard.press("Tab");
            expect((await active())?.name).toBe(label);
          }
          await page.keyboard.press("Tab");
          const first = await active();
          expect(first?.type).toBe("checkbox");
          expect(first?.name).toBe(d.destinations[0].name);
          expect(await outline(), "a focused checkbox has a 2px solid outline").toEqual(["2px", "solid"]);
          await page.keyboard.press("Space");
          await expect(checkbox(page, d, W, cartagenaName)).toBeChecked();
          await expect(countLine(page)).toHaveText(formatPlural(d.copy.count, cartagenaCount, locale));
          await page.keyboard.press("Space");
          await expect(countLine(page)).toHaveText(formatPlural(d.copy.count, LOCKED_TOTAL, locale));
        } else {
          await page.keyboard.press("Tab");
          expect((await active())?.name.startsWith(d.copy.filters.button)).toBe(true);
          await page.keyboard.press("Enter");
          await expect(dialog(page, d.copy.filters.title)).toBeVisible();
          // Tab inside the sheet until the first destination checkbox, never leaving the dialog.
          let reached = false;
          for (let i = 0; i < 8 && !reached; i += 1) {
            await page.keyboard.press("Tab");
            const inside = await page.evaluate(() => !!document.activeElement?.closest("[role='dialog']"));
            expect(inside, "focus stays inside the sheet").toBe(true);
            const now = await active();
            reached = now?.type === "checkbox" && now.name === d.destinations[0].name;
          }
          expect(reached, "the first destination checkbox is reachable by Tab").toBe(true);
          await page.keyboard.press("Space");
          await expect(checkbox(page, d, W, cartagenaName)).toBeChecked();
          await expect(dialog(page, d.copy.filters.title).getByRole("button", { name: formatPlural(d.copy.showResults, cartagenaCount, locale), exact: true })).toBeVisible();
          await page.keyboard.press("Space");
          await page.keyboard.press("Escape");
          await expect(dialog(page, d.copy.filters.title)).toHaveCount(0);
          await expect(filtersButton(page, d)).toBeFocused();
        }

        // A card opens its overlay with Enter, Tab stays inside it, Escape closes it and focus is back on the card.
        const name = d.items.find((i) => i.slug === "cartagena-heritage-tours")!.name;
        const card = cardButton(page, name);
        await card.focus();
        expect(await outline(), "a focused card has a 2px solid outline").toEqual(["2px", "solid"]);
        await page.keyboard.press("Enter");
        await expect(dialog(page, name)).toBeVisible();
        for (let i = 0; i < 6; i += 1) {
          await page.keyboard.press("Tab");
          expect(await page.evaluate(() => !!document.activeElement?.closest("[role='dialog']")), `Tab ${i + 1} stays in the overlay`).toBe(true);
        }
        await page.keyboard.press("Escape");
        await expect(dialog(page, name)).toHaveCount(0);
        await expect(card).toBeFocused();
      });

      test("5. names: every control is named, the count is live, one h1 and two group h2s", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        await expect(searchBox(page, d)).toHaveAccessibleName(d.copy.search.label);
        await expect(typeGroup(page, d)).toHaveCount(1);
        for (const [i, name] of expectedNames(d, {}).entries()) {
          await expect(cards(page).nth(i)).toHaveAccessibleName(new RegExp(`^${escapeRegExp(name)}`));
        }
        // Found by its text, not by the attribute under test, so a missing aria-live fails here.
        await expect(page.getByText(formatPlural(d.copy.count, LOCKED_TOTAL, locale), { exact: true })).toHaveAttribute("aria-live", "polite");
        const h1 = page.getByRole("heading", { level: 1 });
        await expect(h1).toHaveCount(1);
        await expect(h1).toHaveText(d.copy.heading);
        const h2 = page.getByRole("heading", { level: 2 });
        await expect(h2).toHaveCount(2);
        await expect(h2.nth(0)).toContainText(d.copy.groups.experiences);
        await expect(h2.nth(1)).toContainText(d.copy.groups.services);

        if (W >= LG) {
          await expect(page.getByRole("complementary", { name: d.copy.filters.label, exact: true })).toHaveCount(1);
          for (const legend of [d.copy.destination.label, d.copy.stay.label]) {
            await expect(page.getByRole("group", { name: legend, exact: true }), `group ${legend}`).toHaveCount(1);
          }
          await expect(page.getByRole("checkbox")).toHaveCount(d.destinations.length + d.offeredStays.length);
        } else {
          await expect(filtersButton(page, d)).toHaveCount(1);
        }

        const snapshot = await page.locator("main").ariaSnapshot();
        const unnamed = snapshot
          .split("\n")
          .filter((line) => /^\s*- (link|button|searchbox|textbox|combobox|checkbox|switch|slider|spinbutton)\b/.test(line))
          .filter((line) => !/^\s*- \w+ "[^"]+"/.test(line));
        expect(unnamed, "an interactive element in <main> has no accessible name").toEqual([]);

        // With a filter set the chip is a named button.
        const cartagena = d.destinationNames.cartagena;
        await visit(page, `${d.path}?destination=cartagena`);
        await expect(page.getByRole("button", { name: fill(d.copy.removeFilter, { name: cartagena }), exact: true })).toBeVisible();

        // With the overlay open it is a named dialog with a named close button.
        const name = d.items[0].name;
        await cardButton(page, name).click();
        await expect(dialog(page, name).getByRole("button", { name: d.copy.overlay.close, exact: true })).toBeVisible();
      });

      test("6. held controls are absent: menu closed and open, overlay open, Filters sheet open", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        await expectHeldAbsent(page, d, "menu closed");
        if (await openMenuIfCollapsed(page, d)) {
          await expect(page.getByRole("combobox"), "only the language select").toHaveCount(1);
          await expectHeldAbsent(page, d, "menu open");
          await page.keyboard.press("Escape");
        } else {
          await expect(page.getByRole("combobox"), "only the language select").toHaveCount(1);
        }

        await visit(page, d.path);
        await cardButton(page, d.items[0].name).click();
        await expect(dialog(page, d.items[0].name)).toBeVisible();
        await expectHeldAbsent(page, d, "overlay open");
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);

        if (W < LG) {
          await openSheet(page, d);
          await expectHeldAbsent(page, d, "sheet open");
          await closeSheet(page, d, LOCKED_TOTAL);
        }
      });

      test("7. JavaScript off: 45 cards in two groups with full text, no filter control shows, Arabic runs right to left", async ({ browser }) => {
        const d = await data(locale);
        const context = await browser.newContext({ javaScriptEnabled: false, viewport });
        const page = await context.newPage();
        const { routeMedia } = await import("../../helpers/media-route");
        const media = await routeMedia(page);
        await page.goto(d.path, { waitUntil: "load" });
        await page.waitForTimeout(250);

        await expect(cards(page)).toHaveCount(LOCKED_TOTAL);
        await expect(page.locator("main section[aria-labelledby]")).toHaveCount(2);
        await expect(cards(page).first()).toBeVisible();
        await expect(cards(page).last()).toBeVisible();
        await expect(page.locator("[data-catalog-filters]"), "the filters, the Filters button and the type chips").toBeHidden();
        await expect(page.getByRole("searchbox")).toHaveCount(0);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");

        const clamps = page.locator("[data-clamp]");
        await expect(clamps).toHaveCount(LOCKED_TOTAL);
        const summaries = expectedNames(d, {}).map((name) => d.items.find((i) => i.name === name)!.summary);
        expect((await clamps.allTextContents()).map((t) => t.trim())).toEqual(summaries);
        // Nothing is clipped: the clamp is lifted (no line cap, visible overflow, a block box) and the paragraphs run past two
        // lines. (scrollHeight is not used: with overflow visible, Arabic glyph ink taller than its line box counts as overflow.)
        const state = await clamps.evaluateAll((els) =>
          els.map((el) => {
            const style = getComputedStyle(el);
            return {
              clamp: style.webkitLineClamp,
              overflow: style.overflow,
              display: style.display,
              lines: el.getBoundingClientRect().height / parseFloat(style.lineHeight),
            };
          }),
        );
        for (const one of state) expect({ clamp: one.clamp, overflow: one.overflow, display: one.display }).toEqual({ clamp: "none", overflow: "visible", display: "block" });
        expect(Math.max(...state.map((one) => one.lines)), "a long paragraph shows more than two lines").toBeGreaterThan(2.5);
        expect(media.missing).toEqual([]);
        await context.close();
      });

      test("8. layout: no overflow, 1 / 2 / 3 columns, the rail 280 wide at the inline start, two-line clamp, gold rule, square corners, media host", async ({ page, watch }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(overflow).toBeLessThanOrEqual(0);

        const xs = new Set<number>();
        for (let i = 0; i < 3; i += 1) xs.add(Math.round((await cards(page).nth(i).boundingBox())!.x));
        expect(xs.size, "distinct columns among the first three cards").toBe(W === 390 ? 1 : W === 834 ? 2 : 3);

        // The catalogue's own box is the content area of the page shell: its edges are the inline start and end of the content.
        const shell = (await page.locator("[data-catalog-ready]").boundingBox())!;
        const rail = page.getByRole("complementary", { name: d.copy.filters.label, exact: true });
        if (W >= LG) {
          const box = (await rail.boundingBox())!;
          expect(Math.abs(box.width - 280)).toBeLessThanOrEqual(1);
          if (locale === "ar") expect(Math.abs(box.x + box.width - (shell.x + shell.width)), "the rail is at the right in Arabic").toBeLessThanOrEqual(1);
          else expect(Math.abs(box.x - shell.x), "the rail is at the left").toBeLessThanOrEqual(1);
          const first = (await cards(page).first().boundingBox())!;
          if (locale === "ar") expect(first.x).toBeLessThan(box.x);
          else expect(first.x).toBeGreaterThan(box.x + box.width);
        } else {
          await expect(rail).toHaveCount(0);
        }

        const lines = await page.locator("[data-clamp]").evaluateAll((els) =>
          els.map((el) => el.getBoundingClientRect().height / parseFloat(getComputedStyle(el).lineHeight)),
        );
        expect(lines).toHaveLength(LOCKED_TOTAL);
        for (const n of lines) expect(n, "a summary is more than two lines").toBeLessThanOrEqual(2.01);

        const rule = await page.getByRole("heading", { level: 1 }).evaluate((h) => {
          for (let el = h.parentElement; el && el.tagName !== "MAIN"; el = el.parentElement) {
            const style = getComputedStyle(el);
            if (parseFloat(style.borderTopWidth) > 0) return { width: style.borderTopWidth, color: style.borderTopColor };
          }
          return null;
        });
        expect(rule).toEqual({ width: "2px", color: await token(page, "gold") });

        const radii = await page.locator("main img, main button, main input").evaluateAll((els) => els.map((el) => getComputedStyle(el).borderRadius));
        expect(radii.length).toBeGreaterThan(LOCKED_TOTAL);
        for (const radius of radii) expect(radius).toBe("0px");

        for (const url of watch.mediaRequests) expect(url.startsWith(`${MEDIA_BASE_URL}/`)).toBe(true);
        for (const src of await page.locator("main img").evaluateAll((els) => els.map((el) => (el as HTMLImageElement).currentSrc))) {
          expect(src.startsWith(`${MEDIA_BASE_URL}/`), src).toBe(true);
        }

        // The open overlay has square corners too.
        const name = d.items[0].name;
        await cardButton(page, name).click();
        await expect(dialog(page, name)).toBeVisible();
        expect(await dialog(page, name).evaluate((el) => getComputedStyle(el).borderRadius)).toBe("0px");
        const overlayRadii = await dialog(page, name).locator("img, button, a").evaluateAll((els) => els.map((el) => getComputedStyle(el).borderRadius));
        for (const radius of overlayRadii) expect(radius).toBe("0px");
        for (const host of FORBIDDEN_HOSTS) expect([...watch.hosts]).not.toContain(host);
      });
    });
  }
}
