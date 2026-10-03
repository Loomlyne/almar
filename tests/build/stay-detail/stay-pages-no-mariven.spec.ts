import { expect, test } from "@playwright/test";
import { getStay } from "../../../lib/data/stays";
import { LOCALES, SLUGS, WIDTHS, openStay, watch } from "./_helpers";

// Plan 03.3-06 task 3. The React-page replacement for job 05's browser guard, which drove a real browser on the 12
// Framer pages because Framer's CDN code redrew any sentence removed from a route.ts, so the sentence could only be
// hidden and the file text proved nothing. The React page has no such runtime: the sentence is deleted from the data,
// and this spec proves it on the rendered page. The byte checks (built-documents.test.mjs) cover what a hidden
// element would keep: this spec alone would pass on a <p hidden> that carried the sentence.
//
// All 36 documents (3 locales x 12 stays), each loaded once and then read at 390, 834 and 1440.

test.describe("stay pages carry no Mariven text and hydrate cleanly", () => {
  test("the 12 stays in 3 languages are all covered", () => {
    expect(SLUGS).toHaveLength(12);
    expect(SLUGS).toContain("casa-mariana-historic-center");
    expect(LOCALES).toHaveLength(3);
  });

  for (const locale of LOCALES) {
    for (const slug of SLUGS) {
      test(`${locale} /private-stays/${slug}`, async ({ page }) => {
        const watched = await watch(page);
        await page.setViewportSize(WIDTHS[2]);
        await openStay(page, locale, slug);

        // Deletion, not hiding: the About section opens with the real paragraph, first in the data and first on screen.
        const stay = await getStay(locale, slug);
        expect(stay, `${slug} is published`).not.toBeNull();
        const first = await page.locator("#about p").first().textContent();
        expect(first?.trim(), "About starts at the first real paragraph").toBe(stay!.description[0]);
        if (locale === "en") expect(stay!.description[0]).toMatch(/is a vetted ALMAR private stay in /);

        for (const size of WIDTHS) {
          await page.setViewportSize(size);
          await page.waitForTimeout(250);
          const view = await page.evaluate(() => {
            const word = /mariven/i;
            return {
              html: word.test(document.documentElement.outerHTML),
              innerText: word.test(document.body.innerText),
              title: word.test(document.title),
              attributes: [...document.querySelectorAll("*")].filter((el) =>
                [...el.attributes].some((attribute) => word.test(attribute.value)),
              ).length,
              sentence: document.documentElement.outerHTML.includes("From cozy beachfront rooms"),
            };
          });
          expect(view, `${locale} ${slug} at ${size.width}`).toEqual({
            html: false,
            innerText: false,
            title: false,
            attributes: 0,
            sentence: false,
          });
        }

        // The React counterpart of job 05's "does not make React replace the page": no error, no hydration message.
        expect(watched.problems, "console errors, page errors, hydration messages, forbidden hosts").toEqual([]);
        expect(watched.media.missing, "every image key is in the media manifest").toEqual([]);
      });
    }
  }
});
