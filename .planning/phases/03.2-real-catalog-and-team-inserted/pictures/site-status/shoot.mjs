// Plan 03.2-05 Task 1: screenshots of index.html. Run from the repo root: node <this folder>/shoot.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const page_url = pathToFileURL(path.join(here, "index.html")).href;
const STATES = ["up", "updating", "failed", "unavailable", "savehint"];
const LOCALES = ["en", "ar", "es"];
const SIZES = [
  [390, 720],
  [834, 720],
  [1440, 900],
];

const browser = await chromium.launch();
let count = 0;
for (const [width, height] of SIZES) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  for (const state of STATES) {
    for (const lang of LOCALES) {
      await page.goto(`${page_url}?state=${state}&lang=${lang}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(150);
      await page.screenshot({ path: path.join(here, `${state}-${lang}-${width}.png`) });
      count += 1;
    }
  }
  await context.close();
}
await browser.close();
console.log(`shot ${count} pictures`);
