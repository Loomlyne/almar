import { expect, test, type Page } from "@playwright/test";
import { getCatalogForStay } from "../../../lib/data/experiences";
import { getBlockedDates, getStay } from "../../../lib/data/stays";
import { HOME_COPY } from "../../../lib/copy/home";
import { OUTSIDE_FOOTER, expectFooterNewsletter } from "../newsletter/_footer";
import { JOURNEY_COPY } from "../../../lib/copy/journey";
import { formatDate } from "../../../lib/format";
import { fill } from "../../../lib/journey-format";
import type { Locale } from "../../../lib/locale-path";
import { FIXED_NOW, FOCUS, LOCALES, WIDTHS, openStay, stayUrl, watch } from "./_helpers";

// A text field as expectFooterNewsletter counts one (tests/build/newsletter/_footer.ts): a hidden, submit, button,
// checkbox or radio input is not a text box (follow-up 8, PR #16 review round 3).
const TEXT_FIELD = 'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"])';

// Plan 03.3-06 task 5. Every held control is absent, and no amount or minimum stay is shown, on the stay page
// (design 4.3 rows 1-8, 3.9). The byte layer is built-documents.test.mjs (36 documents, money fields, currency
// codes, forbidden hosts, <form>). This is the browser layer: 3 stays x en, ar, es x 390, 834, 1440 = 27 contexts,
// each checked after hydration and again after opening every panel the page has, because a held control must not
// appear later either.
//
// Strings come from lib/copy (journey: Search, Continue, Add, Add {name}; home: Login, Subscribe, List with us). The
// one string no copy file holds is "See Packages", which Phase 6 will own: it is asserted as the English published
// word from the design's 4.3 table, plus its Arabic and Spanish forms.

test.use({ timezoneId: "Asia/Dubai" });
test.setTimeout(90_000);

const PACKAGES = /packages|paquetes|الباقات|باقات/i;
const CART = /\bcart\b|carrito|عربة|سلة/i;
const CURRENCY = /\b(AED|USD|EUR|COP)\b|\$|€/;
const PER_NIGHT = /per night|\/ ?night\b|nightly|por noches?\b|لكل ليلة/i;
const MINIMUM = /minimum (?:stay|nights?)|min\.? nights?|at least \d+ nights?|estancia m[ií]nima|m[ií]nimo de noches|noches m[ií]nimas|الحد الأدنى (?:للإقامة|لعدد الليالي|لليالي)|ليالي كحد أدنى/i;

const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
};
const cell = (page: Page, iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return page.locator(`[data-date="${y}-${m}-${d}"]`);
};

/** A 1-night run of free nights after today, in October 2026 (the clock is fixed on 2026-10-03). */
function oneNight(blocked: string[]): { from: string; to: string } {
  for (let day = 4; day <= 30; day++) {
    const from = `2026-10-${String(day).padStart(2, "0")}`;
    if (!blocked.includes(from) && !blocked.includes(addDays(from, 1))) return { from, to: addDays(from, 1) };
  }
  throw new Error("no free night in October");
}

type Setup = {
  locale: Locale;
  journey: (typeof JOURNEY_COPY)[Locale];
  home: (typeof HOME_COPY)[Locale];
  itemNames: string[];
  priceNote: string;
};

/** Every held control of design 4.3, absent by role and exact name, plus the money and minimum-stay rules. */
async function assertHeld(page: Page, s: Setup, where: string, { modal = false } = {}) {
  const say = (what: string) => `${where}: ${what}`;
  const named = (role: "button" | "link", name: string) => page.getByRole(role, { name, exact: true });

  // 4.3 row 1: no submit. design 11.2: the newsletter is live in the footer, so these count outside it.
  await expect(page.locator(`form${OUTSIDE_FOOTER}`), say("no <form> outside the footer")).toHaveCount(0);
  await expect(page.locator(`button[type="submit"]${OUTSIDE_FOOTER}, input[type="submit"]${OUTSIDE_FOOTER}`), say("no submit button outside the footer")).toHaveCount(0);
  await expect(named("button", s.journey.bar.search), say("no Search button")).toHaveCount(0);

  // 4.3 row 6: no Add, neither "Add" nor "Add {name}" (exact: "Add dates" and the steppers' "Add adult" are real controls)
  for (const role of ["button", "link"] as const) {
    await expect(named(role, s.journey.addons.add), say(`no ${role} named "Add"`)).toHaveCount(0);
    for (const name of s.itemNames) {
      await expect(named(role, fill(s.journey.addons.addName, { name })), say(`no Add ${name}`)).toHaveCount(0);
    }
  }

  // 4.3 row 7: no Continue, in the dock or anywhere
  for (const role of ["button", "link"] as const) {
    await expect(named(role, s.journey.cart.continue), say("no Continue")).toHaveCount(0);
    await expect(named(role, s.journey.addons.continue), say("no Continue to travelers")).toHaveCount(0);
  }
  // The dock's one control is Request on WhatsApp (plan 45): a link to wa.me, never a button.
  await expect(page.locator("div.fixed.bottom-0").locator("button"), say("the dock has no button")).toHaveCount(0);
  await expect(page.locator("div.fixed.bottom-0").locator("a"), say("the dock has exactly one link")).toHaveCount(1);
  await expect(page.locator("div.fixed.bottom-0").locator("a"), say("and it is the request")).toHaveAttribute(
    "href",
    /^https:\/\/wa\.me\/971563883302\?text=/,
  );

  // 4.3 rows 2-3 and 4.1 row 6: no cart, no currency; the one combobox is the language (Login is live since job 21)
  await expect(page.getByRole("button", { name: CART }), say("no cart button")).toHaveCount(0);
  await expect(page.getByRole("link", { name: CART }), say("no cart link")).toHaveCount(0);
  const combos = page.locator('[role="combobox"]');
  await expect(combos, say("exactly one select in the header")).toHaveCount(1);
  await expect(combos.first(), say("and it is the language")).toHaveAttribute("aria-label", new RegExp(`^${s.journey.locale.language.split("{")[0]}`));
  await expect(page.getByRole("combobox", { name: new RegExp(s.journey.locale.currency.split("{")[0]) }), say("no currency select")).toHaveCount(0);

  // 4.3 row 4. design 11.2: the newsletter is live in the footer: one form, box and Join the List there, no text box
  // outside it; the held "Subscribe" stays absent. Row 5: no "List with us".
  // With the phone sheet open (a modal) the page behind it, footer included, leaves the accessibility tree: the footer
  // is checked by element, and "no text box outside the footer" is counted by element too, so it cannot pass by being
  // hidden; the sheet itself holds no text box.
  await expectFooterNewsletter(page, s.locale, where, { behindModal: modal });
  if (modal) {
    await expect(page.locator(`${TEXT_FIELD}${OUTSIDE_FOOTER}, textarea${OUTSIDE_FOOTER}`), say("no text box outside the footer")).toHaveCount(0);
    expect(await page.getByRole("textbox").count(), say("no text box in the sheet")).toBe(0);
  } else {
    expect(await page.getByRole("textbox").count(), say("no text box outside the footer")).toBe(1);
  }
  await expect(named("button", s.home.subscribe), say("no Subscribe")).toHaveCount(0);

  // text rules, on what a visitor can read
  const text = await page.evaluate(() => document.body.innerText);
  expect(text.includes(s.home.listTitle), say("no List with us")).toBe(false);
  expect(/list with us/i.test(text), say("no List with us (English)")).toBe(false);
  expect(PACKAGES.test(text), say("no See Packages")).toBe(false);
  // 3.9: no amount, no per-night wording, no minimum stay
  expect(CURRENCY.test(text), say(`a currency code or sign in the visible text: ${text.match(CURRENCY)?.[0]}`)).toBe(false);
  expect(PER_NIGHT.test(text), say(`per-night wording: ${text.match(PER_NIGHT)?.[0]}`)).toBe(false);
  expect(MINIMUM.test(text), say(`minimum-stay wording: ${text.match(MINIMUM)?.[0]}`)).toBe(false);

  // Nothing is drawn disabled as a stand-in. The allowed cases are controls with a real state: the locked Destination
  // segment (a lock, by design), and what lives inside the Dates and Guests panels (days that are past or blocked,
  // the first month's Previous, a stepper at its floor).
  const stray = await page.evaluate(
    ([dates, guests]) => {
      const inside = (el: Element) => !!el.closest(`[role="group"][aria-label="${dates}"], [role="group"][aria-label="${guests}"]`);
      return [...document.querySelectorAll('button[disabled], [aria-disabled="true"], input[disabled]')]
        .filter((el) => !inside(el))
        .filter((el) => !(el.getAttribute("aria-disabled") === "true" && el.querySelector("svg") && /^button$/i.test(el.tagName)))
        .map((el) => `${el.tagName} ${el.textContent?.trim().slice(0, 40)}`);
    },
    [s.journey.dates.label, s.journey.guests.label],
  );
  expect(stray, say("disabled stand-ins outside the panels")).toEqual([]);
}

for (const slug of FOCUS) {
  for (const locale of LOCALES) {
    for (const size of WIDTHS) {
      test(`${locale} ${slug} @${size.width}: no held control, no amount, no minimum stay, before and after opening every panel`, async ({ page }) => {
        const stay = await getStay(locale, slug);
        const blocked = await getBlockedDates(slug);
        const catalog = await getCatalogForStay(locale, slug);
        const s: Setup = {
          locale,
          journey: JOURNEY_COPY[locale],
          home: HOME_COPY[locale],
          itemNames: [...catalog.services, ...catalog.experiences].map((item) => item.name),
          priceNote: stay!.price_note ?? "",
        };
        expect(s.itemNames.length, "the stay lists services and experiences").toBeGreaterThanOrEqual(6);

        await page.clock.setFixedTime(FIXED_NOW);
        const watched = await watch(page);
        await page.setViewportSize(size);
        await openStay(page, locale, slug);
        await assertHeld(page, s, "after load");

        // the published sentence is the only money text, and it appears exactly once
        expect(s.priceNote.length).toBeGreaterThan(0);
        const visible = await page.evaluate(() => document.body.innerText);
        expect(visible.split(s.priceNote).length - 1, "the price sentence appears once").toBe(1);

        const night = oneNight(blocked);
        if (size.width >= 768) {
          const bar = page.getByRole("group", { name: s.journey.bar.label });
          await bar.getByRole("button", { name: new RegExp(`^${s.journey.bar.dates.label}`) }).click();
          await expect(page.getByRole("group", { name: s.journey.dates.label })).toBeVisible();
          await assertHeld(page, s, "with the Dates panel open");
          // no minimum stay: a 1-night range is accepted
          await cell(page, night.from).click();
          await cell(page, night.to).click();
          const [fy, fm, fd] = night.from.split("-").map(Number);
          const [ty, tm, td] = night.to.split("-").map(Number);
          await expect(bar).toContainText(`${formatDate(fd, fm, fy)} – ${formatDate(td, tm, ty)}`);
          await page.getByRole("button", { name: s.journey.done }).click();
          await expect(page.getByRole("group", { name: s.journey.guests.label })).toBeVisible();
          await assertHeld(page, s, "with the Guests panel open");
          await page.keyboard.press("Escape");
        } else {
          await page.getByRole("button", { name: `${stay!.destination_name}${locale === "ar" ? "، " : ", "}${stay!.title}` }).click();
          const sheet = page.getByRole("dialog", { name: s.journey.sheet.label });
          await expect(sheet).toBeVisible();
          await assertHeld(page, s, "with the sheet open at When", { modal: true });
          await cell(page, night.from).click();
          await cell(page, night.to).click();
          await sheet.getByRole("button", { name: s.journey.sheet.next, exact: true }).click();
          await expect(sheet.getByRole("heading", { name: s.journey.sheet.who })).toBeVisible();
          await expect(sheet.getByText(fill(s.journey.sheet.progress, { n: 3 }))).toBeVisible();
          await assertHeld(page, s, "with the sheet open at Who", { modal: true });
          // The last step ends with the request link, not Done (plan 45): the sheet closes with Escape.
          await expect(sheet.getByRole("button", { name: s.journey.done })).toHaveCount(0);
          await page.keyboard.press("Escape");
          await expect(sheet).toHaveCount(0);
        }
        await assertHeld(page, s, "after the panels closed");

        // the bytes the server sent, payload included
        const raw = await (await page.request.get(stayUrl(locale, slug))).text();
        for (const field of ["nightly_rate_aed", "min_nights", "price_aed"]) expect(raw.includes(field), field).toBe(false);
        expect(/\b(?:AED|USD|EUR|COP)\b/.test(raw), "a currency code in the served bytes").toBe(false);
        for (const host of ["framerusercontent", "files.catbox.moe", "videos.pexels.com"]) expect(raw.includes(host), host).toBe(false);
        expect(MINIMUM.test(raw), "minimum-stay wording in the served bytes").toBe(false);

        expect(watched.problems).toEqual([]);
        expect(watched.media.missing).toEqual([]);
      });
    }
  }
}

test.describe("unknown and hidden slugs answer 404", () => {
  const cases: Array<[Locale, string]> = [
    ["en", "baru-house"],
    ["ar", "corona-island"],
    ["es", "yury-house-cartagena"],
    ["en", "no-such-stay"],
  ];
  for (const [locale, slug] of cases) {
    test(`${stayUrl(locale, slug)}`, async ({ request }) => {
      const response = await request.get(stayUrl(locale, slug), { maxRedirects: 0 });
      expect(response.status()).toBe(404);
    });
  }
});
