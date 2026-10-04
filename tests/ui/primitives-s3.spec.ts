import { test, type Locator, type Page } from "@playwright/test";
import { LOCALES, WIDTHS, VIEWPORTS, expect, open, style } from "./_helpers";

// Slice 3 primitives (plan 21), proven in the browser at 390, 834 and 1440 in EN, AR and ES.
// ScrollCollage: the About intro. The statement is held while five decorative photos drift into place (A13).

const MD = 768;
// Slot tops as a share of the collage height: [below md, from md].
const TOPS = [
  [0.08, 0.05],
  [0.35, 0.3],
  [0.57, 0.48],
  [0.77, 0.65],
  [0.87, 0.78],
] as const;
const END_SLOTS = [0, 2, 4]; // photos 1, 3, 5 sit in the inline-end half; 2 and 4 in the inline-start half

const reduce = (page: Page) => page.emulateMedia({ reducedMotion: "reduce" });

const collageOf = (page: Page) => page.locator("[data-scroll-collage]");
const photosOf = (page: Page) => collageOf(page).locator("img");

/** The document-space top of the collage. */
const docTop = (collage: Locator) => collage.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

const scrollTo = async (page: Page, y: number) => {
  await page.evaluate((to) => window.scrollTo(0, to), y);
  // The engine writes the offset on the next animation frame.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))));
};

/** True when the element is not moved or scaled: the individual `translate` property (job 11's engine) and `transform`. */
const atRest = (el: Locator) =>
  el.evaluate((node) => {
    const cs = getComputedStyle(node);
    const zero = (v: string) => v === "none" || v.split(/\s+/).every((part) => parseFloat(part) === 0);
    const t = cs.transform;
    return zero(cs.translate) && (t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)");
  });

const shift = (el: Locator) =>
  el.evaluate((node) => {
    const v = getComputedStyle(node).translate;
    return v === "none" ? 0 : parseFloat(v.split(/\s+/)[1] ?? v.split(/\s+/)[0]);
  });

for (const viewport of WIDTHS) {
  for (const locale of LOCALES) {
    const { width, height } = VIEWPORTS[viewport];
    const where = `${locale} ${width}`;
    const wide = width >= MD;

    test.describe(`ScrollCollage ${where}`, () => {
      test("decorative: five empty alts, nothing focusable, clicks do nothing", async ({ page }) => {
        await reduce(page);
        await open(page, "scroll-collage", "decorative", locale, viewport);
        const photos = photosOf(page);
        await expect(photos).toHaveCount(5);
        for (let i = 0; i < 5; i += 1) await expect(photos.nth(i)).toHaveAttribute("alt", "");
        await expect(
          page.getByTestId("harness-scroll-collage").locator(
            'a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
          ),
        ).toHaveCount(0);
        for (const i of [0, 4]) await photos.nth(i).click({ force: true });
        await expect(page.locator('[role="dialog"], dialog')).toHaveCount(0);
        await expect(page).toHaveURL(/c=scroll-collage/);
      });

      test("named: each photo is an image with the alt it was given", async ({ page }) => {
        await reduce(page);
        await open(page, "scroll-collage", "named", locale, viewport);
        for (const n of [1, 2, 3, 4, 5]) await expect(page.getByRole("img", { name: `[Photo ${n}]` })).toBeAttached();
      });

      test("size: collage height, photo width, 6/5 ratio, square, no outline", async ({ page }) => {
        await reduce(page);
        await open(page, "scroll-collage", "decorative", locale, viewport);
        const box = await collageOf(page).boundingBox();
        expect(Math.abs(box!.height - (wide ? 2300 : 1500))).toBeLessThanOrEqual(2);
        const photos = photosOf(page);
        for (let i = 0; i < 5; i += 1) {
          const photo = photos.nth(i);
          const b = await photo.boundingBox();
          expect(Math.abs(b!.width - (wide ? 300 : 170))).toBeLessThanOrEqual(2);
          expect(Math.abs(b!.height / b!.width - 1.2)).toBeLessThan(0.02);
          expect(await style(photo, "border-radius")).toBe("0px");
          expect(await style(photo, "outline-style")).toBe("none");
        }
      });

      test("placement: tops in order at Framer's shares, odd photos at the inline end", async ({ page }) => {
        await reduce(page);
        await open(page, "scroll-collage", "decorative", locale, viewport);
        const collage = (await collageOf(page).boundingBox())!;
        const photos = photosOf(page);
        let previous = -Infinity;
        for (let i = 0; i < 5; i += 1) {
          const b = (await photos.nth(i).boundingBox())!;
          const top = b.y - collage.y;
          expect(top).toBeGreaterThan(previous);
          previous = top;
          expect(Math.abs(top / collage.height - TOPS[i][wide ? 1 : 0])).toBeLessThanOrEqual(0.03);
          const centre = b.x + b.width / 2 - collage.x;
          const rightHalf = centre > collage.width / 2;
          const endIsRight = locale !== "ar";
          expect(rightHalf === endIsRight).toBe(END_SLOTS.includes(i));
        }
        if (width >= 1440) {
          const statement = (await collageOf(page).locator("p").boundingBox())!;
          for (let i = 0; i < 5; i += 1) {
            const b = (await photos.nth(i).boundingBox())!;
            const apart = b.x + b.width <= statement.x || b.x >= statement.x + statement.width;
            expect(apart, `photo ${i + 1} must not sit over the statement`).toBe(true);
          }
        }
      });

      test("hold: the statement stays at 42% of the screen while the collage passes", async ({ page }) => {
        await reduce(page);
        await open(page, "scroll-collage", "decorative", locale, viewport);
        const collage = collageOf(page);
        const top = await docTop(collage);
        const statement = collage.locator("p");
        for (const past of [400, 1000]) {
          await scrollTo(page, top + past);
          const s = (await statement.boundingBox())!;
          const c = (await collage.boundingBox())!;
          expect(Math.abs(s.y - 0.42 * height)).toBeLessThanOrEqual(8);
          expect(Math.abs(s.x + s.width / 2 - (c.x + c.width / 2))).toBeLessThanOrEqual(2);
          expect(s.width).toBeLessThanOrEqual(400);
          await expect(statement).toBeInViewport();
          await expect(statement).toBeVisible();
        }
      });

      test("A13 with motion: photos drift into place with the scroll, then stand still", async ({ page }) => {
        await open(page, "scroll-collage", "decorative", locale, viewport);
        await expect(page.locator("html")).toHaveAttribute("data-motion", "on");
        const collage = collageOf(page);
        const photo = photosOf(page).nth(2);
        const top = await docTop(collage);
        const photoTop = top + (await photo.evaluate((el) => (el as HTMLElement).offsetTop));

        if (!wide) {
          // Below job 11's A9 breakpoint every photo stands in its final place at every scroll position.
          for (const y of [0, photoTop - height * 0.9, photoTop - height * 0.75, photoTop - height * 0.5, top + 1200]) {
            await scrollTo(page, Math.max(0, y));
            for (let i = 0; i < 5; i += 1) expect(await atRest(photosOf(page).nth(i))).toBe(true);
          }
          return;
        }

        // Before it reaches its place the photo's offset follows the scroll.
        await scrollTo(page, photoTop - height * 0.95);
        const first = await shift(photo);
        await scrollTo(page, photoTop - height * 0.75);
        const second = await shift(photo);
        expect(first).toBeLessThan(0);
        expect(second).toBeLessThan(0);
        expect(second).toBeGreaterThan(first);
        expect(await atRest(photo)).toBe(false);

        // Once past its place (and once the collage has scrolled past) it stands in place.
        await scrollTo(page, photoTop - height * 0.4);
        expect(await atRest(photo)).toBe(true);
        await scrollTo(page, top + 2300 + 1);
        expect(await atRest(photo)).toBe(true);
      });

      test("reduced motion: nothing moves at the top, middle and end", async ({ page }) => {
        await reduce(page);
        await open(page, "scroll-collage", "decorative", locale, viewport);
        const collage = collageOf(page);
        const top = await docTop(collage);
        const total = wide ? 2300 : 1500;
        for (const y of [0, top + total / 2, top + total]) {
          await scrollTo(page, y);
          for (let i = 0; i < 5; i += 1) {
            const photo = photosOf(page).nth(i);
            expect(await atRest(photo)).toBe(true);
            expect(await style(photo, "opacity")).toBe("1");
          }
        }
      });
    });
  }
}

// MediaRow: the About Our Values row. Title and body at the inline start, the photo at the inline end from md.
// Gap G2 of plan 21: job 11 has no such row in components/ui.

/** The computed font size of a text token, so a test never hand-types a size. */
const sizeOf = (page: Page, token: string) =>
  page.evaluate((name) => {
    const probe = document.createElement("span");
    probe.style.fontSize = `var(--text-${name})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).fontSize;
    probe.remove();
    return value;
  }, token);

for (const viewport of WIDTHS) {
  for (const locale of LOCALES) {
    const { width } = VIEWPORTS[viewport];
    const wide = width >= MD;

    test.describe(`MediaRow ${locale} ${width}`, () => {
      test("layout: one column on a phone, text at the inline start and photo at the inline end from md", async ({ page }) => {
        await open(page, "media-row", "row", locale, viewport);
        const row = page.getByTestId("harness-media-row");
        const text = (await row.locator("p").locator("xpath=..").boundingBox())!;
        const photo = (await row.locator("img").boundingBox())!;
        if (!wide) {
          expect(text.y + text.height).toBeLessThanOrEqual(photo.y + 1);
        } else {
          // The row's columns sit side by side: the text block's middle is above the photo's top and bottom edges.
          expect(Math.abs(text.y + text.height / 2 - (photo.y + photo.height / 2))).toBeLessThanOrEqual(photo.height / 2);
          const textFirst = text.x < photo.x;
          expect(textFirst).toBe(locale !== "ar");
          expect(text.x + text.width <= photo.x || photo.x + photo.width <= text.x).toBe(true);
        }
      });

      test("sizes: photo 3:2 at most 480 wide, text block at most 360 wide", async ({ page }) => {
        await open(page, "media-row", "row", locale, viewport);
        const row = page.getByTestId("harness-media-row");
        const photo = (await row.locator("img").boundingBox())!;
        expect(Math.abs(photo.height / photo.width - 2 / 3)).toBeLessThan(0.02);
        expect(photo.width).toBeLessThanOrEqual(480.5);
        const text = (await row.locator("p").locator("xpath=..").boundingBox())!;
        expect(text.width).toBeLessThanOrEqual(360.5);
      });

      test("type: title at job 11's card title size, body at the body size", async ({ page }) => {
        await open(page, "media-row", "row", locale, viewport);
        const row = page.getByTestId("harness-media-row");
        const title = row.getByText("[Value]", { exact: true });
        await expect(title).toHaveCount(1);
        expect(await style(title, "font-size")).toBe(await sizeOf(page, "heading"));
        expect(await style(title, "font-size")).toBe(wide ? "32px" : "24px");
        const body = row.locator("p");
        await expect(body).toContainText("[Body paragraph of one value");
        expect(await style(body, "font-size")).toBe(await sizeOf(page, "body"));
      });

      test("plain: nothing focusable, square corners, the photo keeps its empty alt", async ({ page }) => {
        await open(page, "media-row", "row", locale, viewport);
        const row = page.getByTestId("harness-media-row");
        await expect(row.locator('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')).toHaveCount(0);
        const photo = row.locator("img");
        await expect(photo).toHaveAttribute("alt", "");
        expect(await style(photo, "border-radius")).toBe("0px");
      });
    });
  }
}
