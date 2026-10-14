// Screenshots of index.html for the owner: 4 views x EN/AR/ES x 390/834/1440. Run from the repo root:
//   node .planning/phases/02-platform-spine/pictures/02-06/shoot.mjs
import { chromium } from "playwright";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const page_url = pathToFileURL(path.join(dir, "index.html")).href;
const views = ["settings", "settings-error", "settings-saved", "maintenance"];
const browser = await chromium.launch();
for (const width of [390, 834, 1440]) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  for (const view of views) {
    for (const l of ["en", "ar", "es"]) {
      await page.goto(`${page_url}?view=${view}&l=${l}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(dir, `${view}-${width}-${l}.png`), fullPage: true });
    }
  }
  await context.close();
}
await browser.close();
console.log("done");
