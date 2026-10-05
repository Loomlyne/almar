import type { Locator, Page } from "@playwright/test";
import { localePath } from "../../../lib/locale-path";
import {
  LOCALES,
  MD,
  VIEWPORTS,
  boardWord,
  cardButton,
  cards,
  data,
  dialog,
  escapeRegExp,
  expect,
  groupHeads,
  search,
  searchBox,
  test,
  typeButton,
  visit,
  type Data,
} from "./_helpers";

// Phase 3.3 plan 14, task 8 (part 1). The card overlay of the React /experiences page clicked on the assembled out/, in EN, AR
// and ES at 390, 834 and 1440: what it shows, the three ways to close it with focus back on the card, the ?item= address and
// its deep links (the /services/<slug> redirects land here), the stay links and Request Inquiry. Expected values come from the
// data layer and the copy file, never from the page.
//   node scripts/assemble-cloudflare.mjs --target=local
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/experiences --workers=1

const HERITAGE = "cartagena-heritage-tours";
const VIP = "vip-airport-meet-greet";
const AMAZON = "amazon-rainforest-expedition";
const JOINER = " · ";

const item = (d: Data, slug: string) => {
  const found = d.items.find((i) => i.slug === slug);
  if (!found) throw new Error(`${slug} is not in the catalogue`);
  return found;
};
/** The kicker as the design words it: the type word, then each place in order, joined with a middle dot. */
const kickerOf = (d: Data, slug: string) => {
  const i = item(d, slug);
  const type = i.kind === "service" ? d.copy.overlay.service : d.copy.overlay.experience;
  return [type, ...i.destination_slugs.map((s) => d.destinationNames[s])].join(JOINER);
};
const overlayOf = (page: Page, d: Data, slug: string) => dialog(page, item(d, slug).name);
const kicker = (page: Page, d: Data, slug: string) => overlayOf(page, d, slug).locator("h2").locator("xpath=preceding-sibling::p");
const row = (page: Page, d: Data, slug: string, label: string) => overlayOf(page, d, slug).locator("dt", { hasText: new RegExp(`^${escapeRegExp(label)}$`) });
const stayLinks = (page: Page, d: Data, slug: string) => overlayOf(page, d, slug).locator("dd a");
const inquiry = (page: Page, d: Data, slug: string) =>
  overlayOf(page, d, slug).getByRole("link", { name: d.copy.overlay.requestInquiry, exact: true });

/** The box once the entry animation (a slide on a phone, a fade from md) has stopped moving: the same box twice, 100 ms apart. */
async function settledBox(page: Page, locator: Locator) {
  let previous = await locator.boundingBox();
  for (let i = 0; i < 30; i += 1) {
    await page.waitForTimeout(100);
    const next = await locator.boundingBox();
    if (previous && next && previous.x === next.x && previous.y === next.y && previous.width === next.width && previous.height === next.height) return next;
    previous = next;
  }
  throw new Error("the overlay never stopped moving");
}

async function open(page: Page, d: Data, slug: string) {
  await cardButton(page, item(d, slug).name).click();
  await expect(overlayOf(page, d, slug)).toBeVisible();
}

for (const locale of LOCALES) {
  for (const viewport of VIEWPORTS) {
    const W = viewport.width;
    test.describe(`${locale} ${W}`, () => {
      test.use({ viewport });

      test("1. a card opens its overlay: name, kicker, full text, Duration, stay links, Request Inquiry, ?item=, size", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const heritage = item(d, HERITAGE);
        await open(page, d, HERITAGE);
        const box = overlayOf(page, d, HERITAGE);

        await expect(box.locator("h2")).toHaveText(heritage.name);
        await expect(kicker(page, d, HERITAGE)).toHaveText(kickerOf(d, HERITAGE));
        await expect(box.getByText(heritage.summary!, { exact: true }), "the full published paragraph").toBeVisible();
        await expect(row(page, d, HERITAGE, d.copy.overlay.duration)).toHaveCount(1);
        await expect(row(page, d, HERITAGE, d.copy.overlay.duration).locator("xpath=following-sibling::dd")).toHaveText(heritage.duration_label!);
        await expect(row(page, d, HERITAGE, d.copy.overlay.stays)).toHaveCount(1);
        const links = stayLinks(page, d, HERITAGE);
        await expect(links).toHaveCount(heritage.stay_slugs.length);
        expect(await links.evaluateAll((nodes) => nodes.map((n) => n.getAttribute("href")))).toEqual(
          heritage.stay_slugs.map((s) => localePath(locale, `/private-stays/${s}`)),
        );
        expect(await links.allTextContents()).toEqual(heritage.stay_slugs.map((s) => d.stayNames[s]));
        await expect(inquiry(page, d, HERITAGE)).toHaveAttribute("href", "/contact");
        expect(search(page)).toBe(`?item=${HERITAGE}`);

        // Held controls and prices are not in the overlay (design 4.3; board 5f k9, k11, k13).
        for (const role of ["button", "link"] as const) {
          for (const key of ["k9", "k13"]) {
            await expect(box.getByRole(role, { name: boardWord("overlay", key, locale), exact: true }), `${key} ${role}`).toHaveCount(0);
          }
        }
        const text = (await box.textContent()) ?? "";
        expect(text.includes(boardWord("overlay", "k11", locale)), "per person").toBe(false);
        expect(/\b(AED|USD|EUR|COP)\b|[$€£]/.test(text), "a currency").toBe(false);
        await expect(box.locator("img")).toHaveAttribute("src", heritage.image!.url);

        // Size: a 760px panel centred from md up, the whole screen below.
        const b = await settledBox(page, box);
        if (W >= MD) {
          expect(Math.abs(b.width - 760)).toBeLessThanOrEqual(1);
          expect(Math.abs(b.x + b.width / 2 - W / 2)).toBeLessThanOrEqual(1);
        } else {
          expect(Math.abs(b.width - W)).toBeLessThanOrEqual(1);
          expect(Math.abs(b.height - viewport.height)).toBeLessThanOrEqual(1);
          expect(b.x).toBeLessThanOrEqual(1);
          expect(b.y).toBeLessThanOrEqual(1);
        }

        // The address keeps any filter and closing puts it back.
        await page.keyboard.press("Escape");
        await expect(box).toHaveCount(0);
        expect(search(page)).toBe("");
        await typeButton(page, d, "experience").click();
        await open(page, d, HERITAGE);
        expect(search(page)).toBe(`?type=experience&item=${HERITAGE}`);
        await page.keyboard.press("Escape");
        await expect(box).toHaveCount(0);
        expect(search(page)).toBe("?type=experience");
      });

      test("2. close by Escape, by the close square and, from md, by the scrim: the dialog goes, ?item= goes, focus is on the card", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        const name = item(d, HERITAGE).name;
        const closers: Array<[string, () => Promise<void>]> = [
          ["Escape", () => page.keyboard.press("Escape")],
          ["the close square", () => overlayOf(page, d, HERITAGE).getByRole("button", { name: d.copy.overlay.close, exact: true }).click()],
        ];
        if (W >= MD) {
          closers.push([
            "the scrim",
            async () => {
              // Radix attaches its outside-pointer listener a tick after mount: let the panel finish arriving before the click.
              await settledBox(page, overlayOf(page, d, HERITAGE));
              await page.mouse.click(5, 5);
            },
          ]);
        }
        for (const [how, close] of closers) {
          await open(page, d, HERITAGE);
          await close();
          await expect(overlayOf(page, d, HERITAGE), `closed by ${how}`).toHaveCount(0);
          expect(search(page), `the address after ${how}`).toBe("");
          await expect(cardButton(page, name), `focus after ${how}`).toBeFocused();
        }
      });

      test("3. a service: kicker with two places, no Duration, 12 stay links, the bar stays at the bottom while the body scrolls", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        await typeButton(page, d, "service").click();
        await open(page, d, VIP);
        const vip = item(d, VIP);
        await expect(kicker(page, d, VIP)).toHaveText(kickerOf(d, VIP));
        expect(kickerOf(d, VIP).split(JOINER)).toHaveLength(3);
        await expect(row(page, d, VIP, d.copy.overlay.duration), "services publish no duration").toHaveCount(0);
        await expect(stayLinks(page, d, VIP)).toHaveCount(12);
        expect(vip.stay_slugs).toHaveLength(12);
        expect(search(page)).toBe(`?type=service&item=${VIP}`);

        const box = overlayOf(page, d, VIP);
        const bar = inquiry(page, d, VIP).locator("xpath=..");
        const dialogBox = await settledBox(page, box);
        const dialogBottom = dialogBox.y + dialogBox.height;
        const bottomOf = async (locator: typeof bar) => {
          const b = (await locator.boundingBox())!;
          return b.y + b.height;
        };
        expect(Math.abs((await bottomOf(bar)) - dialogBottom), "the bar is the dialog's bottom edge").toBeLessThanOrEqual(1);
        const scroller = box.locator("div.overflow-y-auto");
        const overflowing = await scroller.evaluate((el) => el.scrollHeight > el.clientHeight);
        if (W < MD) expect(overflowing, "the body scrolls on a phone").toBe(true);
        await scroller.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        });
        expect(Math.abs((await bottomOf(bar)) - dialogBottom), "the bar did not move with the scroll").toBeLessThanOrEqual(1);
        await expect(inquiry(page, d, VIP)).toBeVisible();
      });

      test("4. an item with no place and no stay: the type word alone, no Private stays row", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        await open(page, d, AMAZON);
        await expect(kicker(page, d, AMAZON)).toHaveText(d.copy.overlay.experience);
        expect(kickerOf(d, AMAZON)).toBe(d.copy.overlay.experience);
        await expect(row(page, d, AMAZON, d.copy.overlay.stays)).toHaveCount(0);
        await expect(row(page, d, AMAZON, d.copy.overlay.duration)).toHaveCount(1);
        await expect(stayLinks(page, d, AMAZON)).toHaveCount(0);
      });

      test("5. deep links: the service redirect landing, an unknown slug, and an item the filters hide", async ({ page }) => {
        const d = await data(locale);

        // /services/vip-airport-meet-greet lands here (design 5.3; the redirect hop itself is plan 12's test).
        await visit(page, `${d.path}?type=service&item=${VIP}`);
        await expect(overlayOf(page, d, VIP)).toBeVisible();
        await expect(cards(page)).toHaveCount(10);
        expect(await groupHeads(page)).toEqual([{ name: d.copy.groups.services, count: "10" }]);
        await page.keyboard.press("Escape");
        await expect(overlayOf(page, d, VIP)).toHaveCount(0);
        // (An open modal hides the page from role queries, so the pressed type is read after it closes.)
        await expect(typeButton(page, d, "service")).toHaveAttribute("aria-pressed", "true");
        await expect(cardButton(page, item(d, VIP).name), "focus on the VIP card").toBeFocused();
        expect(search(page)).toBe("?type=service");

        // An unknown slug opens nothing.
        await visit(page, `${d.path}?item=unknown-slug`);
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(cards(page)).toHaveCount(45);

        // The VIP card is hidden by type=experience, so the overlay opens and focus returns to the search box.
        await visit(page, `${d.path}?type=experience&item=${VIP}`);
        await expect(overlayOf(page, d, VIP)).toBeVisible();
        await expect(cardButton(page, item(d, VIP).name)).toHaveCount(0);
        await page.keyboard.press("Escape");
        await expect(overlayOf(page, d, VIP)).toHaveCount(0);
        await expect(searchBox(page, d), "focus on the visible search box").toBeFocused();
      });

      test("6. a stay link in the overlay goes to that stay's page, which answers 200", async ({ page }) => {
        const d = await data(locale);
        await visit(page, d.path);
        await open(page, d, VIP);
        const slug = item(d, VIP).stay_slugs[0];
        const href = localePath(locale, `/private-stays/${slug}`);
        await expect(stayLinks(page, d, VIP).first()).toHaveAttribute("href", href);
        const [response] = await Promise.all([
          page.waitForResponse((r) => new URL(r.url()).pathname === href && r.request().resourceType() === "document"),
          stayLinks(page, d, VIP).first().click(),
        ]);
        expect(response.status()).toBe(200);
        await page.waitForURL((url) => url.pathname === href);
        expect(new URL(page.url()).pathname).toBe(href);
      });

      test("7. Request Inquiry goes to /contact, which answers 200", async ({ page, watch }) => {
        const d = await data(locale);
        await visit(page, d.path);
        await open(page, d, HERITAGE);
        // The contact page is still a Framer document: stop watching its requests and console.
        watch.freeze();
        const [response] = await Promise.all([
          page.waitForResponse((r) => new URL(r.url()).pathname === "/contact" && r.request().resourceType() === "document"),
          inquiry(page, d, HERITAGE).click(),
        ]);
        expect(response.status()).toBe(200);
        await page.waitForURL((url) => url.pathname === "/contact");
      });
    });
  }
}
