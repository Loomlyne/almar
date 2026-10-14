// Full-page shots of states-{en,ar,es}.html at 390, 834 and 1440 (part B pictures, 2026-10-14). Throwaway.
// Run from the repo root: node .planning/phases/03.3-public-site-in-react/s3-pictures/shoot_states.mjs
import { chromium } from "@playwright/test";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch();
try {
  for (const loc of ["en", "ar", "es"]) {
    for (const width of [390, 834, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(pathToFileURL(path.join(here, `states-${loc}.html`)).href);
      await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      const text = await page.evaluate(() => document.body.innerText);
      if (text.includes("[object") || text.includes("undefined")) throw new Error(`${loc} ${width}: bad label`);
      await page.screenshot({ path: path.join(here, `states-${loc}-${width}.jpg`), fullPage: true, type: "jpeg", quality: 80 });
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log("shots ok");
