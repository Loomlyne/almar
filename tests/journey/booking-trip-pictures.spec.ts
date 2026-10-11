import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { test } from "@playwright/test";
import { sceneStates, settle, type Locale } from "./matrix";

// Plan 04-03 task 1: the pictures for the owner's signature. Runs only with ALMAR_PICTURES=1; it writes PNGs, it asserts
// nothing about them. Every scene at 390, 834 and 1440 in EN and AR, and in ES at 1440 only, full page, into
// .planning/phases/04-book-and-pay/pictures/04-03/<scene>-<locale>-<width>.png.

const OUT = join(__dirname, "..", "..", ".planning", "phases", "04-book-and-pay", "pictures", "04-03");
const WIDTHS = [390, 834, 1440] as const;
const SHOTS: { locale: Locale; width: number }[] = [
  ...WIDTHS.flatMap((width) => (["en", "ar"] as const).map((locale) => ({ locale, width }))),
  { locale: "es", width: 1440 },
];

test.skip(process.env.ALMAR_PICTURES !== "1", "pictures run only with ALMAR_PICTURES=1");

test.beforeAll(async ({ browser }) => {
  test.setTimeout(600_000);
  mkdirSync(OUT, { recursive: true });
  const page = await browser.newPage();
  for (const state of sceneStates("booking-trip")) {
    await page.goto(`/__harness?c=booking-trip&s=${state}&l=en`, { timeout: 120_000 });
    await settle(page);
  }
  await page.close();
});

for (const state of sceneStates("booking-trip")) {
  for (const { locale, width } of SHOTS) {
    test(`${state} / ${locale} / ${width}`, async ({ page }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/__harness?c=booking-trip&s=${state}&l=${locale}`);
      await settle(page);
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      // Pinned bars (the phone cart dock) sit at the bottom of the viewport: make the viewport as tall as the page
      // so they land at the bottom of the picture.
      const height = await page.evaluate(() => Math.max(900, document.documentElement.scrollHeight));
      await page.setViewportSize({ width, height });
      await page.evaluate(() => document.fonts.ready.then(() => undefined));
      await page.screenshot({
        path: join(OUT, `${state}-${locale}-${width}.png`),
        fullPage: true,
      });
    });
  }
}
