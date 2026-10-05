import { expect, test, type Locator, type Page } from "@playwright/test";
import { getCatalogForStay } from "../../../lib/data/experiences";
import { MEDIA_BASE_URL } from "../../../lib/data/media";
import { getBlockedDates, getRelatedStays, getStay } from "../../../lib/data/stays";
import { HOME_COPY } from "../../../lib/copy/home";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { SITE_FOOTER_COPY } from "../../../lib/copy/site-footer";
import { STAY_DETAIL_COPY } from "../../../lib/copy/stay-detail";
import { formatDate } from "../../../lib/format";
import { JOURNEY_CHOICE_KEY, parseJourneyChoice, serializeJourneyChoice } from "../../../lib/journey-choice";
import { fill, formatGuestSummary } from "../../../lib/journey-format";
import { absoluteLocaleUrl, localeDir, localePath, type Locale } from "../../../lib/locale-path";
import { buildStayRequestMessage, stayRequestHref } from "../../../lib/whatsapp-request";
import { clickClearOfDock } from "../../helpers/click-clear-of-dock";
import { FIXED_NOW, FOCUS, LOCALES, WIDTHS, openStay, stayUrl, watch } from "./_helpers";

// Plan 03.3-06 task 4, rebuilt by plan 03.3-45. Behaviour of the stay page on the real build: Request on WhatsApp,
// slideshow, facts, policies, amenities, locked segments, calendar with blocked days, guests, phone sheet, pinned
// dock, pre-fill, related stays, Request Inquiry, language, RTL from first paint, no JavaScript, media host, sample
// note. wa.me is answered by the test (route), so nothing leaves the Mac.
//
// Matrix: 3 stays x en, ar, es x the widths each behaviour applies to. Every expected value comes from lib/data,
// lib/copy, lib/journey-format and lib/format inside this file, never typed by hand. The clock is fixed so past days
// and the sample blocked dates (Oct-Dec 2026) are deterministic.
//
// Not asserted, by design (plan 02's JourneySegment): the locked Destination segment is an aria-disabled <button>,
// so it is focusable; the Stay segment is not. "Locked" here means: shows its value with a lock, opens nothing.

test.use({ timezoneId: "Asia/Dubai" });
test.setTimeout(90_000);

const MD = 768; // Tailwind md, where the page switches from the entry row to the four-segment bar
const today = { y: 2026, m: 10, d: 3 };

type Size = (typeof WIDTHS)[number];
const sizes = (...widths: number[]) => WIDTHS.filter((s) => widths.includes(s.width));
const ALL = sizes(390, 834, 1440);
const BAR_SIZES = sizes(834, 1440);
const PHONE = sizes(390);

const NATIVE: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };

// ---- date helpers ----------------------------------------------------------------------------------------------

const parts = (iso: string) => iso.split("-").map(Number) as [number, number, number];
const fmtIso = (iso: string) => {
  const [y, m, d] = parts(iso);
  return formatDate(d, m, y);
};
const addDays = (iso: string, n: number) => {
  const [y, m, d] = parts(iso);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};
const TODAY_ISO = `${today.y}-${String(today.m).padStart(2, "0")}-${String(today.d).padStart(2, "0")}`;

/** The first run of `nights` free nights that starts after today and stays inside the month of `monthOf`. */
function freeWindow(blocked: string[], monthOf: string, nights: number): { from: string; to: string } {
  const month = monthOf.slice(0, 7);
  for (let day = 1; day <= 28; day++) {
    const from = `${month}-${String(day).padStart(2, "0")}`;
    const to = addDays(from, nights);
    if (from <= TODAY_ISO || to.slice(0, 7) !== month) continue;
    const taken = Array.from({ length: nights }, (_, i) => addDays(from, i)).some((night) => blocked.includes(night));
    if (!taken) return { from, to };
  }
  throw new Error(`no free window of ${nights} nights in ${month}`);
}

const cellOf = (page: Page, iso: string) => {
  const [y, m, d] = parts(iso);
  return page.locator(`[data-date="${y}-${m}-${d}"]`);
};

/** Click Next month until the day is on screen. */
async function showDay(page: Page, iso: string, nextMonth: string) {
  for (let i = 0; i < 6; i++) {
    if (await cellOf(page, iso).isVisible()) return;
    await page.getByRole("button", { name: nextMonth }).click();
  }
  await expect(cellOf(page, iso)).toBeVisible();
}

// ---- page helpers ----------------------------------------------------------------------------------------------

type Ctx = {
  locale: Locale;
  slug: string;
  stay: NonNullable<Awaited<ReturnType<typeof getStay>>>;
  copy: (typeof STAY_DETAIL_COPY)[Locale];
  journey: (typeof JOURNEY_COPY)[Locale];
  blocked: string[];
};

async function context(locale: Locale, slug: string): Promise<Ctx> {
  const stay = await getStay(locale, slug);
  if (!stay) throw new Error(`${slug} is not published`);
  return {
    locale,
    slug,
    stay,
    copy: STAY_DETAIL_COPY[locale],
    journey: JOURNEY_COPY[locale],
    blocked: await getBlockedDates(slug),
  };
}

const guests = (adults: number, children = 0, infants = 0, c: Ctx) =>
  formatGuestSummary({ adults, children, infants }, c.locale, c.journey.guests.summary);

const comma = (locale: Locale) => (locale === "ar" ? "، " : ", ");
const line1Of = (c: Ctx) => `${c.stay.destination_name}${comma(c.locale)}${c.stay.title}`;
const rangeOf = (from: string, to: string) => `${fmtIso(from)} – ${fmtIso(to)}`;

/** The bar's four segments (md and up). */
const barOf = (page: Page, c: Ctx) => page.getByRole("group", { name: c.journey.bar.label });
const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const segment = (bar: Locator, label: string) => bar.getByRole("button", { name: new RegExp(`^${escape(label)}`) });
const dockOf = (page: Page) => page.locator("div.fixed.bottom-0");
const dockLines = async (page: Page) => {
  const dock = dockOf(page);
  await expect(dock).toHaveCount(1);
  return [await dock.locator("span").nth(0).innerText(), await dock.locator("span").nth(1).innerText()];
};

async function load(page: Page, c: Ctx, size: Size, query = "") {
  await page.clock.setFixedTime(FIXED_NOW);
  const watched = await watch(page);
  await page.setViewportSize(size);
  await openStay(page, c.locale, c.slug, query);
  return watched;
}

async function noProblems(watched: Awaited<ReturnType<typeof watch>>) {
  expect(watched.problems, "console errors, page errors, hydration messages, forbidden hosts").toEqual([]);
  expect(watched.media.missing, "every image key is in the media manifest").toEqual([]);
}

// ---- request on WhatsApp ----------------------------------------------------------------------------------------

type Pick = { from: string; to: string } | null;

/** The link the page must carry for these dates and guests: the same builder, fed from the data and the copy. */
function expectedRequest(c: Ctx, dates: Pick, adults: number, children = 0, infants = 0) {
  const day = (iso: string) => {
    const [year, month, d] = parts(iso);
    return { year, month, day: d };
  };
  const message = buildStayRequestMessage(
    {
      locale: c.locale,
      title: c.stay.title,
      destinationName: c.stay.destination_name,
      start: dates ? day(dates.from) : null,
      end: dates ? day(dates.to) : null,
      adults,
      children,
      infants,
      pageUrl: absoluteLocaleUrl(c.locale, `/private-stays/${c.slug}`),
    },
    c.copy.whatsapp,
    { nights: c.journey.dates.nights, guests: c.journey.guests.summary },
  );
  return { message, href: stayRequestHref(message) };
}

const requestLinks = (scope: Locator | Page, c: Ctx) => scope.getByRole("link", { name: new RegExp(`^${escape(c.copy.whatsapp.button)}`) });

/** wa.me is answered here: a popup to it must never leave the Mac. */
async function answerWhatsApp(page: Page) {
  await page.context().route("https://wa.me/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<title>wa</title>" }));
}

const carousel = (page: Page) => page.locator('section[aria-roledescription="carousel"]');
const dotsOf = (page: Page, c: Ctx) => carousel(page).getByRole("button", { name: new RegExp(`^${escape(c.copy.gallery.goTo.split("{")[0])}`) });
/** The 0-based number of the photo whose dot is current. */
async function currentDot(page: Page, c: Ctx) {
  const dots = dotsOf(page, c);
  const flags = await dots.evaluateAll((els) => els.map((el) => el.getAttribute("aria-current") === "true"));
  expect(flags.filter(Boolean), "exactly one dot is current").toHaveLength(1);
  return flags.indexOf(true);
}

/** A load whose clock is installed first and paused once the page has settled; reveals need real frames, so nothing here reads opacity. */
async function loadWithClock(page: Page, c: Ctx, size: Size, reducedMotion: "reduce" | "no-preference" = "no-preference") {
  await page.emulateMedia({ reducedMotion });
  const watched = await watch(page);
  await page.setViewportSize(size);
  await page.clock.install({ time: new Date(FIXED_NOW) });
  await openStay(page, c.locale, c.slug);
  await carousel(page).scrollIntoViewIfNeeded();
  await page.clock.pauseAt(new Date("2026-10-03T09:10:00+04:00"));
  return watched;
}

// ---- the matrix ------------------------------------------------------------------------------------------------

for (const slug of FOCUS) {
  for (const locale of LOCALES) {
    test.describe(`${locale} ${slug}`, () => {
      // ---- request on WhatsApp -------------------------------------------------------------------------------
      for (const size of ALL) {
        test(`request @${size.width}: one WhatsApp request, the exact message with and without dates, a new tab, never blocked`, async ({ page }) => {
          const c = await context(locale, slug);
          await answerWhatsApp(page);
          const watched = await load(page, c, size);
          const phone = size.width < MD;
          await expect(page.locator('a[aria-label="WhatsApp"]'), "the green float is not drawn on a stay page").toHaveCount(0);

          const base = expectedRequest(c, null, 1);
          const dockLink = requestLinks(dockOf(page), c);
          const barLink = phone ? null : requestLinks(barOf(page, c), c);
          await expect(dockLink).toHaveCount(1);
          await expect(dockLink).toHaveAttribute("href", base.href);
          expect(base.href.startsWith("https://wa.me/971563883302?text=")).toBe(true);
          if (barLink) {
            await expect(barLink).toHaveCount(1);
            await expect(barLink).toHaveAttribute("href", base.href);
          }
          for (const link of barLink ? [dockLink, barLink] : [dockLink]) {
            await expect(link).toHaveAttribute("target", "_blank");
            await expect(link).toHaveAttribute("rel", /noopener/);
            await expect(link).not.toHaveAttribute("aria-disabled", /.+/);
            await expect(link).toBeEnabled();
          }

          const { from, to } = freeWindow(c.blocked, c.blocked[0], 3);
          const win = { from, to };
          let live: Locator;
          if (!phone) {
            const bar = barOf(page, c);
            await segment(bar, c.journey.bar.dates.label).click();
            await showDay(page, from, c.journey.dates.nextMonth);
            await cellOf(page, from).click();
            await cellOf(page, to).click();
            await page.getByRole("button", { name: c.journey.done }).click();
            await expect(page.getByRole("group", { name: c.journey.guests.label })).toBeVisible();
            await page.getByRole("button", { name: fill(c.journey.guests.add, { group: c.journey.guests.group.adult }) }).click();
            await page.getByRole("button", { name: fill(c.journey.guests.add, { group: c.journey.guests.group.child }) }).click();
            await page.keyboard.press("Escape");
            live = barLink!;
          } else {
            await page.getByRole("button", { name: line1Of(c) }).click();
            const sheet = page.getByRole("dialog", { name: c.journey.sheet.label });
            await expect(sheet).toBeVisible();
            await showDay(page, from, c.journey.dates.nextMonth);
            await cellOf(page, from).click();
            await cellOf(page, to).click();
            await sheet.getByRole("button", { name: c.journey.sheet.next, exact: true }).click();
            await expect(sheet.getByRole("heading", { name: c.journey.sheet.who })).toBeVisible();
            await sheet.getByRole("button", { name: fill(c.journey.guests.add, { group: c.journey.guests.group.adult }) }).click();
            await sheet.getByRole("button", { name: fill(c.journey.guests.add, { group: c.journey.guests.group.child }) }).click();
            live = requestLinks(sheet, c);
            // The label is printed once, in at most two lines, and the button sits inside the phone's width.
            await expect(live).toHaveCount(1);
            expect(((await live.textContent()) ?? "").split(c.copy.whatsapp.button).length - 1, "the label is printed once").toBe(1);
            const fit = await live.evaluate((el) => {
              const box = el.getBoundingClientRect();
              const span = el.querySelector("span")!;
              const line = parseFloat(getComputedStyle(span).lineHeight);
              return { left: box.left, right: box.right, lines: Math.round(span.getBoundingClientRect().height / line), overflow: el.scrollHeight > el.clientHeight + 1 };
            });
            expect(fit.left).toBeGreaterThanOrEqual(0);
            expect(fit.right).toBeLessThanOrEqual(size.width);
            expect(fit.lines).toBeLessThanOrEqual(2);
            expect(fit.overflow, "the label does not overflow its button").toBe(false);
            await expect(sheet.getByRole("button", { name: c.journey.done })).toHaveCount(0);
            await expect(sheet.getByRole("button", { name: c.journey.bar.search })).toHaveCount(0);
          }

          const full = expectedRequest(c, win, 2, 1);
          expect(full.message).toContain(rangeOf(from, to).split(" – ")[0]);
          await expect(live).toHaveAttribute("href", full.href);
          // (by CSS, not by role: while the phone sheet is open the page behind it is aria-hidden)
          await expect(dockOf(page).locator("a"), "the dock follows the bar and the sheet").toHaveAttribute("href", full.href);

          // Clicking opens a new tab at wa.me whose text is the message; the page itself stays.
          const pageUrl = page.url();
          const [popup] = await Promise.all([page.waitForEvent("popup"), live.click()]);
          await popup.waitForURL(/wa\.me/);
          const opened = new URL(popup.url());
          expect(opened.hostname).toBe("wa.me");
          expect(opened.pathname).toBe("/971563883302");
          expect(opened.searchParams.get("text")).toBe(full.message);
          expect(page.url()).toBe(pageUrl);
          await popup.close();
          await noProblems(watched);
        });
      }

      // ---- slideshow -----------------------------------------------------------------------------------------
      for (const size of ALL) {
        test(`slideshow @${size.width}: peeks the neighbours, arrows wrap, a dot per photo, swipe goes next`, async ({ page }) => {
          const c = await context(locale, slug);
          await page.emulateMedia({ reducedMotion: "reduce" }); // no autoplay here: the timers have their own tests
          const watched = await load(page, c, size);
          const region = carousel(page);
          const total = c.stay.gallery.length;
          await region.scrollIntoViewIfNeeded();
          await expect(region).toHaveAttribute("aria-label", fill(c.copy.gallery.region, { title: c.stay.title }));
          await expect(dotsOf(page, c)).toHaveCount(total);
          expect(await currentDot(page, c)).toBe(0);
          const slides = region.locator('[aria-roledescription="slide"]');
          await expect(slides).toHaveCount(total);
          for (let i = 0; i < total; i++) await expect(slides.nth(i).locator("img")).toHaveAttribute("src", c.stay.gallery[i].url);

          // peek: the next photo shows at the inline end (the left edge in Arabic), and the side padding is kept at the start
          const first = (await slides.nth(0).boundingBox())!;
          const second = (await slides.nth(1).boundingBox())!;
          const side = size.width >= MD ? 64 : 16;
          if (locale === "ar") {
            expect(size.width - (first.x + first.width), "start padding").toBeCloseTo(side, 0);
            expect(second.x + second.width, "the next photo peeks in at the left edge").toBeGreaterThan(0);
          } else {
            expect(first.x, "start padding").toBeCloseTo(side, 0);
            expect(second.x, "the next photo peeks in at the right edge").toBeLessThan(size.width);
          }

          const previous = region.getByRole("button", { name: c.copy.gallery.previous, exact: true });
          const next = region.getByRole("button", { name: c.copy.gallery.next, exact: true });
          await previous.click();
          expect(await currentDot(page, c), "previous wraps to the last photo").toBe(total - 1);
          await next.click();
          expect(await currentDot(page, c), "next wraps to the first").toBe(0);
          await next.click();
          expect(await currentDot(page, c)).toBe(1);
          await clickClearOfDock(dotsOf(page, c).nth(2)); // the dots sit at the photo's foot, where the pinned dock can cover them
          expect(await currentDot(page, c), "a dot goes to its photo").toBe(2);

          // swipe toward the inline start goes next (mirrored in Arabic); 220px in from the edge so the pointer is on a photo
          const box = (await region.boundingBox())!;
          const y = box.y + box.height / 2;
          const dx = locale === "ar" ? 160 : -160;
          const startX = box.x + box.width / 2 - dx / 2;
          await page.mouse.move(startX, y);
          await page.mouse.down();
          await page.mouse.move(startX + dx / 2, y, { steps: 5 });
          await page.mouse.move(startX + dx, y, { steps: 5 });
          await page.mouse.up();
          expect(await currentDot(page, c), "a swipe toward the start goes to the next photo").toBe(3);
          await noProblems(watched);
        });
      }

      for (const size of sizes(390, 1440)) {
        test(`slideshow timers @${size.width}: moves every 2 s, stops on hover, on Pause and on reduced motion`, async ({ page }) => {
          const c = await context(locale, slug);
          const total = c.stay.gallery.length;
          const watched = await loadWithClock(page, c, size);
          const region = carousel(page);
          const settle = () => page.waitForTimeout(150); // real time: React flushes its effects, the paused clock does not
          const pause = region.getByRole("button", { name: c.copy.gallery.pause, exact: true });
          const play = region.getByRole("button", { name: c.copy.gallery.play, exact: true });
          await expect(pause, "a real Pause button").toBeVisible();

          let at = await currentDot(page, c);
          await page.clock.runFor(2000);
          await settle();
          expect(await currentDot(page, c), "after 2 s the next photo").toBe((at + 1) % total);

          // hover stops it
          await region.hover({ position: { x: 200, y: 100 } });
          await settle();
          at = await currentDot(page, c);
          await page.clock.runFor(4000);
          await settle();
          expect(await currentDot(page, c), "hover: unchanged after 4 s").toBe(at);

          // Pause: the name becomes Play, and with the pointer away it stays still
          await pause.click();
          await expect(play).toBeVisible();
          await expect(pause).toHaveCount(0);
          await page.mouse.move(2, 2);
          await settle();
          at = await currentDot(page, c);
          await page.clock.runFor(4000);
          await settle();
          expect(await currentDot(page, c), "paused: unchanged after 4 s").toBe(at);

          // Play moves it again
          await play.click();
          await page.mouse.move(2, 2);
          await settle();
          at = await currentDot(page, c);
          await page.clock.runFor(2000);
          await settle();
          expect(await currentDot(page, c), "played: moves again").toBe((at + 1) % total);
          await noProblems(watched);
        });

        test(`slideshow reduced motion @${size.width}: no Pause button and it never moves`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await loadWithClock(page, c, size, "reduce");
          const region = carousel(page);
          await expect(region.getByRole("button", { name: c.copy.gallery.pause, exact: true })).toHaveCount(0);
          await expect(region.getByRole("button", { name: c.copy.gallery.play, exact: true })).toHaveCount(0);
          await page.clock.runFor(6000);
          await page.waitForTimeout(150);
          expect(await currentDot(page, c), "still on photo 1").toBe(0);
          await noProblems(watched);
        });
      }

      // ---- policies: headings only ---------------------------------------------------------------------------
      for (const size of ALL) {
        test(`policies @${size.width}: the four headings in this language, nothing opens`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const rows = page.locator("#policies li");
          await expect(rows).toHaveCount(4);
          expect(await rows.evaluateAll((els) => els.map((el) => el.textContent?.trim()))).toEqual(c.stay.policy_headings);
          await expect(page.locator("#policies").locator("details, summary, button, a, [aria-expanded], [role=button]")).toHaveCount(0);
          const before = await page.locator("#policies").innerText();
          await rows.nth(1).click();
          await page.keyboard.press("Enter");
          expect(await page.locator("#policies").innerText(), "a click and Enter change nothing").toBe(before);
          expect(/PRIVADA|CAMARERA/.test(await page.content()), "no placeholder text in the document").toBe(false);
          // Framer's layout: heading on one side, rows on the other, thin lines between
          const layout = await page.evaluate(() => {
            const h = document.querySelector("#policies h2")!.getBoundingClientRect();
            const li = document.querySelector("#policies li")!.getBoundingClientRect();
            return { hRight: h.right, hLeft: h.left, hBottom: h.bottom, liLeft: li.left, liRight: li.right, liTop: li.top };
          });
          if (size.width >= MD) {
            if (locale === "ar") expect(layout.liRight).toBeLessThan(layout.hLeft + 1);
            else expect(layout.liLeft).toBeGreaterThan(layout.hRight - 1);
          } else {
            expect(layout.liTop, "stacked under the heading").toBeGreaterThanOrEqual(layout.hBottom);
          }
          await noProblems(watched);
        });
      }

      // ---- amenities -----------------------------------------------------------------------------------------
      for (const size of ALL) {
        test(`amenities @${size.width}: one row per amenity with an icon, in two columns`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const rows = page.locator("#amenities li");
          await expect(rows).toHaveCount(c.stay.amenities.length);
          expect(await rows.evaluateAll((els) => els.map((el) => el.textContent?.trim()))).toEqual(c.stay.amenities);
          for (let i = 0; i < c.stay.amenities.length; i++) await expect(rows.nth(i).locator("svg")).toHaveCount(1);
          const columns = await rows.evaluateAll((els) => new Set(els.map((el) => Math.round(el.getBoundingClientRect().left))).size);
          // Framer shows two columns at 390 as well as at 1440
          expect(columns).toBe(Math.min(2, c.stay.amenities.length));
          await expect(page.locator("#amenities")).toContainText(c.copy.amenitiesIntro);
          await noProblems(watched);
        });
      }

      // ---- fact strip ----------------------------------------------------------------------------------------
      for (const size of ALL) {
        test(`facts @${size.width}: the non-null published fields, in Framer's order, each label above its value`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const expected = [
            [c.copy.facts.guests, c.stay.guests_label],
            [c.copy.facts.bathrooms, c.stay.bathrooms_label],
            [c.copy.facts.bedrooms, c.stay.bedrooms === null ? null : String(c.stay.bedrooms)],
            [c.copy.facts.beds, c.stay.beds_label],
            [c.copy.facts.neighborhood, c.stay.neighborhood],
          ].filter(([, value]) => value !== null && value !== "") as string[][];

          const list = page.locator("main dl").first();
          const rows = await list.evaluate((dl) =>
            [...dl.children].map((row) => {
              const dt = row.querySelector("dt")!;
              const dd = row.querySelector("dd")!;
              return {
                label: dt.textContent?.trim(),
                value: dd.textContent?.trim(),
                height: row.getBoundingClientRect().height,
                labelY: dt.getBoundingClientRect().y,
                valueY: dd.getBoundingClientRect().y,
              };
            }),
          );
          expect(rows.map((r) => [r.label, r.value])).toEqual(expected);
          expect(await list.evaluate((dl) => dl.closest("#about") !== null), "the facts sit in About").toBe(true);
          for (const row of rows) {
            // Framer's facts row: the small label sits above its value
            expect(row.labelY).toBeLessThan(row.valueY);
          }
          await noProblems(watched);
        });
      }

      // ---- locked segments, and the phone entry row ----------------------------------------------------------
      for (const size of BAR_SIZES) {
        test(`locked segments @${size.width}: shown with a lock, open nothing, Tab goes on to Dates`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const bar = barOf(page, c);
          await expect(bar).toBeVisible();
          const destination = segment(bar, c.journey.bar.destination.label);
          const stayBox = bar.locator('[data-bar-segment="stay"]');
          await expect(destination).toContainText(c.stay.destination_name);
          await expect(destination).toHaveAttribute("aria-disabled", "true");
          await expect(destination).not.toHaveAttribute("aria-haspopup", /.+/);
          await expect(destination.locator("svg")).toHaveCount(1);
          await expect(stayBox).toContainText(c.journey.steps.stay);
          await expect(stayBox).toContainText(c.stay.title);
          await expect(stayBox.locator("svg")).toHaveCount(1);

          const opened = page.locator('[role="dialog"], [role="listbox"], [data-radix-popper-content-wrapper]');
          // Playwright treats an aria-disabled button as not enabled, so the click is forced: the point is that it does nothing.
          await destination.click({ force: true });
          await stayBox.click();
          await page.keyboard.press("Enter");
          await expect(opened).toHaveCount(0);
          await expect(destination).not.toHaveAttribute("aria-expanded", /.+/);

          // the Stay segment is not a control at all; Tab from Destination lands on Dates
          expect(await stayBox.evaluate((el) => el.tabIndex)).toBe(-1);
          await destination.focus();
          await page.keyboard.press("Tab");
          await expect(segment(bar, c.journey.bar.dates.label)).toBeFocused();
          await noProblems(watched);
        });
      }

      for (const size of PHONE) {
        test(`entry row @${size.width}: one row naming the stay, no four-segment bar`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          await expect(barOf(page, c)).toHaveCount(0);
          const entry = page.getByRole("button", { name: line1Of(c) });
          await expect(entry).toBeVisible();
          await expect(entry).toContainText(`${c.journey.bar.dates.empty} · ${guests(1, 0, 0, c)}`);
          await noProblems(watched);
        });
      }

      // ---- When: calendar, blocked days, a range -------------------------------------------------------------
      for (const size of BAR_SIZES) {
        test(`dates @${size.width}: blocked day struck and unpickable, a 3-night range picks, dock follows`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const bar = barOf(page, c);
          const dates = segment(bar, c.journey.bar.dates.label);
          await dates.click();
          const grids = page.getByRole("grid");
          await expect(grids).toHaveCount(size.width >= 1024 ? 2 : 1);

          const firstBlocked = c.blocked[0];
          await showDay(page, firstBlocked, c.journey.dates.nextMonth);
          const day = cellOf(page, firstBlocked);
          await expect(day).toHaveAttribute("aria-disabled", "true");
          await expect(day).toHaveAttribute("aria-label", new RegExp(c.journey.dates.day.unavailable));
          expect(await day.evaluate((el) => getComputedStyle(el).textDecorationLine)).toContain("line-through");
          await day.click({ force: true });
          await expect(dates, "a click on a blocked day leaves the segment as it was").toContainText(c.journey.bar.dates.empty);

          const { from, to } = freeWindow(c.blocked, firstBlocked, 3);
          await showDay(page, from, c.journey.dates.nextMonth);
          await cellOf(page, from).click();
          await cellOf(page, to).click();
          const range = rangeOf(from, to);
          await expect(dates).toContainText(range);

          // Done moves on to Guests (the bar's own order); the dates stay
          await page.getByRole("button", { name: c.journey.done }).click();
          await expect(page.getByRole("group", { name: c.journey.guests.label })).toBeVisible();
          await expect(dates).toContainText(range);
          await expect(dockOf(page).locator("span").nth(1)).toHaveText(`${range} · ${guests(1, 0, 0, c)}`);
          await noProblems(watched);
        });
      }

      // ---- Who -----------------------------------------------------------------------------------------------
      for (const size of BAR_SIZES) {
        test(`guests @${size.width}: adults +1 reads the summary in the segment and the dock`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const bar = barOf(page, c);
          const segmentGuests = segment(bar, c.journey.bar.guests.label);
          await expect(segmentGuests).toContainText(guests(1, 0, 0, c));
          await segmentGuests.click();
          await page
            .getByRole("button", { name: fill(c.journey.guests.add, { group: c.journey.guests.group.adult }) })
            .click();
          await expect(segmentGuests).toContainText(guests(2, 0, 0, c));
          await expect(dockOf(page).locator("span").nth(1)).toHaveText(`${c.journey.bar.dates.empty} · ${guests(2, 0, 0, c)}`);
          await noProblems(watched);
        });
      }

      // ---- phone sheet ---------------------------------------------------------------------------------------
      for (const size of PHONE) {
        test(`sheet @${size.width}: opens at When with the stay locked, a range, Who, ends with the request link; no Done, no Search`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const entry = page.getByRole("button", { name: line1Of(c) });
          await entry.click();
          const sheet = page.getByRole("dialog", { name: c.journey.sheet.label });
          await expect(sheet).toBeVisible();
          await expect(sheet.getByRole("heading", { name: c.journey.sheet.when })).toBeVisible();
          await expect(sheet.getByText(fill(c.journey.sheet.progress, { n: 2 }))).toBeVisible();
          await expect(sheet.getByRole("button", { name: c.journey.bar.search })).toHaveCount(0);
          await expect(sheet.locator("form")).toHaveCount(0);

          // The destination is answered, so Back from When closes the sheet (there is no Where step to go back to).
          await sheet.getByRole("button", { name: c.journey.sheet.back }).click();
          await expect(sheet).toHaveCount(0);

          await entry.click();
          await expect(sheet).toBeVisible();
          const { from, to } = freeWindow(c.blocked, c.blocked[0], 3);
          await showDay(page, c.blocked[0], c.journey.dates.nextMonth);
          const struck = cellOf(page, c.blocked[0]);
          await expect(struck).toHaveAttribute("aria-disabled", "true");
          await showDay(page, from, c.journey.dates.nextMonth);
          await cellOf(page, from).click();
          await cellOf(page, to).click();
          await sheet.getByRole("button", { name: c.journey.sheet.next, exact: true }).click();
          await expect(sheet.getByRole("heading", { name: c.journey.sheet.who })).toBeVisible();
          await expect(sheet.getByText(fill(c.journey.sheet.progress, { n: 3 }))).toBeVisible();
          await sheet.getByRole("button", { name: fill(c.journey.guests.add, { group: c.journey.guests.group.adult }) }).click();
          await expect(sheet.getByRole("button", { name: c.journey.bar.search })).toHaveCount(0);
          // The last step ends with the request link: no Done, no Search, no Next.
          await expect(sheet.getByRole("button", { name: c.journey.done })).toHaveCount(0);
          await expect(sheet.getByRole("button", { name: c.journey.sheet.next, exact: true })).toHaveCount(0);
          const last = requestLinks(sheet, c);
          await expect(last).toHaveCount(1);
          await expect(last).toHaveAttribute("href", expectedRequest(c, { from, to }, 2).href);
          await page.keyboard.press("Escape");
          await expect(sheet).toHaveCount(0);

          const line2 = `${rangeOf(from, to)} · ${guests(2, 0, 0, c)}`;
          await expect(entry).toContainText(line2);
          await expect(dockOf(page).locator("span").nth(1)).toHaveText(line2);
          await noProblems(watched);
        });
      }

      // ---- the pinned dock -----------------------------------------------------------------------------------
      for (const size of ALL) {
        test(`dock @${size.width}: pinned, 88px, clears the footer, its one control is the request link`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const dock = dockOf(page);
          await expect(dock).toHaveCount(1);
          const token = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--spacing-dock")));
          const box = async () => (await dock.boundingBox())!;
          let b = await box();
          expect(Math.abs(b.y + b.height - size.height)).toBeLessThanOrEqual(1);
          expect(b.height).toBe(token);
          expect(token).toBe(88);

          const [first, second] = await dockLines(page);
          expect(first).toBe(line1Of(c));
          expect(second).toBe(`${c.journey.bar.dates.empty} · ${guests(1, 0, 0, c)}`);
          await expect(dock.locator("button, [role=button]"), "no button in the dock").toHaveCount(0);
          await expect(dock.locator("a, [role=link]"), "exactly one link: the request").toHaveCount(1);
          await expect(requestLinks(dock, c)).toHaveCount(1);

          await page.mouse.wheel(0, 100_000);
          await page.waitForTimeout(400);
          b = await box();
          expect(Math.abs(b.y + b.height - size.height), "still pinned at the end of the page").toBeLessThanOrEqual(1);
          const lastLink = (await page.locator("footer a").last().boundingBox())!;
          expect(lastLink.y + lastLink.height, "the last footer link is fully above the dock").toBeLessThanOrEqual(b.y);
          await expect(page.locator('a[aria-label="WhatsApp"]'), "no green float on a stay page").toHaveCount(0);
          await noProblems(watched);
        });
      }

      // ---- pre-fill from the journey store -------------------------------------------------------------------
      for (const size of sizes(390, 1440)) {
        test(`pre-fill @${size.width}: a stored choice fills dates and guests, the destination is the stay's, the store follows`, async ({ page }) => {
          const c = await context(locale, slug);
          const otherDestination = c.stay.destination_slug === "medellin" ? "cartagena" : "medellin";
          const valid = { from: "2026-12-01", to: "2026-12-04" };
          for (const night of [valid.from, addDays(valid.from, 1), addDays(valid.from, 2)]) expect(c.blocked).not.toContain(night);
          await page.addInitScript(
            ([key, value]) => window.sessionStorage.setItem(key, value),
            [
              JOURNEY_CHOICE_KEY,
              serializeJourneyChoice({ destination_id: otherDestination, ...valid, adults: 2, children: 0, infants: 0, guests_set: true }),
            ],
          );
          const watched = await load(page, c, size);
          const filled = `${rangeOf(valid.from, valid.to)} · ${guests(2, 0, 0, c)}`;
          await expect(dockOf(page).locator("span").nth(1)).toHaveText(filled);
          await expect(dockOf(page).locator("span").nth(0)).toHaveText(line1Of(c));
          if (size.width >= MD) {
            const bar = barOf(page, c);
            await expect(segment(bar, c.journey.bar.destination.label)).toContainText(c.stay.destination_name);
            await expect(segment(bar, c.journey.bar.dates.label)).toContainText(rangeOf(valid.from, valid.to));
            await expect(segment(bar, c.journey.bar.guests.label)).toContainText(guests(2, 0, 0, c));
            // a change on the stay page is written back
            await segment(bar, c.journey.bar.guests.label).click();
            await page
              .getByRole("button", { name: fill(c.journey.guests.add, { group: c.journey.guests.group.adult }) })
              .click();
            const stored = await page.evaluate((key) => window.sessionStorage.getItem(key), JOURNEY_CHOICE_KEY);
            const parsed = parseJourneyChoice(stored);
            expect(parsed).not.toBeNull();
            expect(parsed).toMatchObject({ from: valid.from, to: valid.to, adults: 3, guests_set: true, destination_id: c.stay.destination_slug });
          }
          await noProblems(watched);
        });

        test(`pre-fill @${size.width}: a stored range with a blocked night drops the dates and keeps the guests`, async ({ page }) => {
          const c = await context(locale, slug);
          const through = { from: addDays(c.blocked[0], -1), to: addDays(c.blocked[0], 2) };
          await page.addInitScript(
            ([key, value]) => window.sessionStorage.setItem(key, value),
            [
              JOURNEY_CHOICE_KEY,
              serializeJourneyChoice({ destination_id: "cartagena", ...through, adults: 2, children: 1, infants: 0, guests_set: true }),
            ],
          );
          const watched = await load(page, c, size);
          await expect(dockOf(page).locator("span").nth(1)).toHaveText(`${c.journey.bar.dates.empty} · ${guests(2, 1, 0, c)}`);
          if (size.width >= MD) {
            await expect(segment(barOf(page, c), c.journey.bar.dates.label)).toContainText(c.journey.bar.dates.empty);
          }
          await noProblems(watched);
        });
      }

      // ---- related stays -------------------------------------------------------------------------------------
      for (const size of ALL) {
        test(`related @${size.width}: three cards from md and two below, never this stay, same destination first, each one link, click goes there`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const related = await getRelatedStays(locale, slug, { limit: 3 });
          const cards = page.locator("#related ul a");
          await expect(cards).toHaveCount(related.length);
          expect(related.length).toBe(3);
          const shown = await cards.evaluateAll((els) => els.filter((el) => el.getClientRects().length > 0).length);
          expect(shown, "three cards from md, two below").toBe(size.width >= MD ? 3 : 2);
          // View All Private Stays goes to the list in this language
          const all = page.locator("#related").getByRole("link", { name: c.copy.relatedViewAll, exact: true });
          await expect(all).toHaveCount(1);
          await expect(all).toHaveAttribute("href", localePath(locale, "/private-stays"));
          const hrefs = await cards.evaluateAll((els) => els.map((el) => el.getAttribute("href")));
          expect(hrefs).toEqual(related.map((r) => localePath(locale, `/private-stays/${r.slug}`)));
          for (const href of hrefs) expect(href!.endsWith(`/${slug}`)).toBe(false);
          if (slug === "santa-fe-farm-antioquia") expect(related[0].slug).toBe("sopetran-country-estate");
          for (let i = 0; i < related.length; i++) {
            await expect(cards.nth(i)).toContainText(related[i].title);
            await expect(cards.nth(i).locator("img")).toHaveAttribute("src", related[i].hero_image!.url);
          }
          await Promise.all([page.waitForURL(`**${hrefs[0]}`), cards.first().click()]);
          await expect(page.getByRole("heading", { level: 1 })).toHaveText(related[0].title);
          await noProblems(watched);
        });
      }

      // ---- services and experiences: content cards, the data's counts -----------------------------------------
      for (const size of ALL) {
        test(`catalogue @${size.width}: services and experiences are links to their overlay, three from md and two below`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const catalog = await getCatalogForStay(locale, slug);
          const experiencesPath = localePath(locale, "/experiences");
          for (const [id, items] of [
            ["services", catalog.services],
            ["experiences", catalog.experiences],
          ] as const) {
            const section = page.locator(`#${id}`);
            const listed = items.filter((item) => item.image).slice(0, 3);
            await expect(section.locator("a")).toHaveCount(listed.length);
            await expect(section.locator("article")).toHaveCount(0);
            await expect(section.locator("button")).toHaveCount(0);
            // The hrefs are spelled out here, not built with the page's own helper.
            expect(await section.locator("a").evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual(
              listed.map((item) => experiencesPath + "?item=" + item.slug),
            );
            for (const [index, item] of listed.entries()) {
              const link = section.locator("a").nth(index);
              await expect(link).toContainText(item.name);
              await expect(link.locator("img")).toHaveAttribute("src", item.image!.url);
            }
            const shown = await section.locator("a").evaluateAll((els) => els.filter((el) => el.getClientRects().length > 0).length);
            expect(shown, `${id} cards shown`).toBe(Math.min(listed.length, size.width >= MD ? 3 : 2));
          }
          expect(catalog.experiences.length).toBeGreaterThan(0);
          await noProblems(watched);
        });
      }

      for (const size of sizes(390, 1440)) {
        test(`catalogue click @${size.width}: an experience card opens its overlay on /experiences in this language`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const catalog = await getCatalogForStay(locale, slug);
          const item = catalog.experiences.filter((i) => i.image).slice(0, 3)[0];
          const experiencesPath = localePath(locale, "/experiences");
          const link = page.locator("#experiences a").first();
          // Centre it, so the 88px dock cannot cover it at 390.
          await link.evaluate((el) => el.scrollIntoView({ block: "center" }));
          await link.click();
          await page.waitForURL((url) => url.pathname === experiencesPath, { timeout: 15_000 });
          expect(new URL(page.url()).searchParams.get("item")).toBe(item.slug);
          await expect(page.locator("html")).toHaveAttribute("lang", locale);
          const dialog = page.getByRole("dialog");
          await expect(dialog).toBeVisible({ timeout: 15_000 });
          await expect(dialog.getByRole("heading", { level: 2, name: item.name, exact: true })).toBeVisible();
          await page.waitForTimeout(500);
          await page.keyboard.press("Escape");
          await expect(page.getByRole("dialog")).toHaveCount(0);
          expect(new URL(page.url()).searchParams.has("item")).toBe(false);
          await noProblems(watched);
        });
      }

      // ---- Request Inquiry -----------------------------------------------------------------------------------
      for (const size of PHONE) {
        test(`Request Inquiry @${size.width}: one link to this language's /contact`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const link = page.getByRole("link", { name: c.copy.requestInquiry });
          const target = localePath(locale, "/contact");
          await expect(link).toHaveCount(1);
          await expect(link).toHaveAttribute("href", target);
          const [response] = await Promise.all([
            page.waitForResponse((r) => new URL(r.url()).pathname === target && r.request().resourceType() === "document"),
            link.click(),
          ]);
          expect(response.status()).toBe(200);
          await expect(page).toHaveURL(new RegExp(`${target}$`));
          const tag = /<html\b[^>]*>/i.exec(await response.text())?.[0] ?? "";
          expect(/\blang="([^"]*)"/.exec(tag)?.[1]).toBe(locale);
          expect(/\bdir="([^"]*)"/.exec(tag)?.[1]).toBe(localeDir(locale));
          expect(watched.problems).toEqual([]);
          expect(watched.media.missing).toEqual([]);
        });
      }

      // ---- language ------------------------------------------------------------------------------------------
      for (const size of sizes(390, 1440)) {
        test(`language @${size.width}: footer row holds this stay's three URLs, the header select goes to Arabic without a redirect`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const row = page.getByRole("navigation", { name: SITE_FOOTER_COPY[locale].language });
          const links = row.getByRole("link");
          await expect(links).toHaveCount(3);
          const expected = LOCALES.map((l) => stayUrl(l, slug));
          expect(await links.evaluateAll((els) => els.map((el) => el.getAttribute("href")))).toEqual(expected);
          expect(await links.evaluateAll((els) => els.map((el) => el.getAttribute("lang")))).toEqual(["en", "ar", "es"]);
          await expect(links.nth(LOCALES.indexOf(locale))).toHaveAttribute("aria-current", "true");

          if (locale !== "ar") {
            const select = page.getByRole("combobox", { name: c.journey.locale.language.replace("{name}", NATIVE[locale]) });
            // Below the nav row's width the select sits inside the Menu.
            if (!(await select.isVisible())) await page.getByRole("button", { name: HOME_COPY[locale].nav.menu, exact: true }).click();
            await select.click();
            const [response] = await Promise.all([
              page.waitForResponse((r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === stayUrl("ar", slug)),
              page.getByRole("option", { name: NATIVE.ar }).click(),
            ]);
            expect(response.status()).toBe(200);
            expect(response.request().redirectedFrom(), "reached with no redirect").toBeNull();
            await expect(page).toHaveURL(new RegExp(`${stayUrl("ar", slug)}$`));
            const arabic = await getStay("ar", slug);
            await expect(page.getByRole("heading", { level: 1 })).toHaveText(arabic!.title);
            await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
          }
          expect(watched.media.missing).toEqual([]);
        });
      }

      // ---- the media host and the share image ----------------------------------------------------------------
      for (const size of sizes(390, 1440)) {
        test(`media @${size.width}: every content image is on the media host, og:image too, no forbidden host`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const sources = await page.locator("main img").evaluateAll((els) => els.map((el) => el.getAttribute("src")));
          expect(sources.length).toBeGreaterThanOrEqual(10);
          for (const src of sources) expect(src!.startsWith(`${MEDIA_BASE_URL}/`), `<img src="${src}">`).toBe(true);
          await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", new RegExp(`^${MEDIA_BASE_URL}/`));
          await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", c.stay.hero_image!.url);
          await expect(page.locator('img[fetchpriority="high"]')).toHaveCount(1);
          const forbidden = [...watched.hosts].filter((h) => /framerusercontent|framer\.com|catbox|pexels/.test(h));
          expect(forbidden).toEqual([]);
          await noProblems(watched);
        });
      }

      // ---- the sample note -----------------------------------------------------------------------------------
      for (const size of sizes(390, 1440)) {
        test(`sample note @${size.width}: shown while the blocked dates are examples`, async ({ page }) => {
          const c = await context(locale, slug);
          const watched = await load(page, c, size);
          const shown = c.stay.sample_fields.includes("blocked_dates");
          await expect(page.getByText(c.copy.sampleDatesNote, { exact: true })).toHaveCount(shown ? 1 : 0);
          await noProblems(watched);
        });
      }

      // ---- first paint and no JavaScript ---------------------------------------------------------------------
      test(`first paint: lang and dir are in the served bytes, and the content reads with JavaScript off`, async ({ browser, baseURL }) => {
        const c = await context(locale, slug);
        const dir = locale === "ar" ? "rtl" : "ltr";
        const served = await (await browser.newContext({ baseURL: baseURL! })).request.get(stayUrl(locale, slug));
        expect(served.status()).toBe(200);
        const html = await served.text();
        expect(html).toMatch(new RegExp(`<html lang="${locale}" dir="${dir}"`));

        const context0 = await browser.newContext({ baseURL: baseURL!, javaScriptEnabled: false, viewport: { width: 834, height: 1194 } });
        const page = await context0.newPage();
        const media = await watch(page);
        await page.goto(stayUrl(locale, slug));
        await expect(page.locator("html")).toHaveAttribute("lang", locale);
        const h1 = page.getByRole("heading", { level: 1 });
        await expect(h1).toHaveText(c.stay.title);
        expect(await h1.evaluate((el) => getComputedStyle(el).direction)).toBe(dir);
        const list = page.locator("main dl").first();
        await expect(list.locator("dt")).not.toHaveCount(0);
        for (const paragraph of c.stay.description) await expect(page.locator("#about")).toContainText(paragraph);
        for (const amenity of c.stay.amenities) await expect(page.locator("#amenities")).toContainText(amenity);
        await expect(page.locator("#policies li")).toHaveCount(c.stay.policy_headings.length);
        expect(c.stay.policy_headings.length).toBe(4);
        for (const heading of c.stay.policy_headings) await expect(page.locator("#policies")).toContainText(heading);
        await expect(carousel(page).locator("img")).toHaveCount(c.stay.gallery.length);
        expect(media.media.missing).toEqual([]);
        await context0.close();
      });
    });
  }
}
