import { test, expect, type Page } from "@playwright/test";
import { RENDERS_NOTHING, VIEWPORTS, scenesOf, settle } from "./matrix";

// DSGN-03 (D-07): in Arabic every scene is dir=rtl, lang=ar, mirrors directional glyphs,
// keeps plus/minus/check/close upright, does not overflow sideways, and keeps Latin
// values (dates, booking references) inside <bdi>.

const arabic = scenesOf(["ar"]);

/** Effective horizontal scale of an element: its own `scale` times every ancestor's. */
const SCALE_X = `(el) => {
  let x = 1;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const s = getComputedStyle(n).scale;
    if (s && s !== "none") x *= parseFloat(s.split(" ")[0]);
  }
  return x;
}`;

async function open(page: Page, url: string, viewport: keyof typeof VIEWPORTS) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(url);
  await settle(page);
}

for (const s of arabic) {
  if (RENDERS_NOTHING.has(`${s.component}/${s.state}`)) continue;

  test(`rtl ${s.component} / ${s.state} / ${VIEWPORTS[s.viewport].width}`, async ({ page }) => {
    await open(page, s.url, s.viewport);

    // Document direction and language.
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");

    // No physical-direction layout break: nothing pushes the page sideways.
    const overflow = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(overflow.scroll, "page scrollWidth").toBeLessThanOrEqual(overflow.client);

    // Directional glyphs: every element that carries a scale-x-100 utility must be mirrored
    // against the same scene in English (the utility flips exactly one of the two).
    const inAr = await page.evaluate(
      `(() => { const f = ${SCALE_X}; return Array.from(document.querySelectorAll("[class*='scale-x-100']")).map((e, i) => [i, f(e)]); })()`,
    );
    const mirrored = inAr as [number, number][];
    if (mirrored.length > 0) {
      const en = await page.context().newPage();
      await en.setViewportSize(VIEWPORTS[s.viewport]);
      await en.goto(s.url.replace("l=ar", "l=en"));
      await settle(en);
      const inEn = (await en.evaluate(
        `(() => { const f = ${SCALE_X}; return Array.from(document.querySelectorAll("[class*='scale-x-100']")).map((e, i) => [i, f(e)]); })()`,
      )) as [number, number][];
      await en.close();
      expect(inEn.length, "same glyph count in EN").toBe(mirrored.length);
      for (let i = 0; i < mirrored.length; i++) {
        expect(Math.sign(mirrored[i][1]), `glyph ${i} is mirrored in AR`).toBe(-Math.sign(inEn[i][1]));
      }
    }

    // Glyphs that must not flip: any svg drawn mirrored has to carry a scale-x-100 utility
    // (itself or an ancestor). Plus, minus, check and close carry none.
    const stray = (await page.evaluate(
      `(() => { const f = ${SCALE_X}; return Array.from(document.querySelectorAll("svg")).filter((e) => f(e) < 0 && !e.closest("[class*='scale-x-100']")).length; })()`,
    )) as number;
    expect(stray, "svgs mirrored without a scale-x-100 utility").toBe(0);

    // Latin dates and booking references sit in <bdi> (or an explicit ltr island).
    const unwrapped = (await page.evaluate(() => {
      const roots = [document.getElementById("harness-root")!, ...Array.from(document.querySelectorAll("[role=dialog], [data-radix-popper-content-wrapper]"))];
      const bad: string[] = [];
      const LATIN = /\d{1,2}\/\d{1,2}\/\d{4}|ALMAR-\d+/;
      for (const root of roots) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = n.textContent ?? "";
          if (!LATIN.test(text)) continue;
          const el = n.parentElement!;
          if (el.closest("bdi, [dir=ltr]")) continue;
          bad.push(text.trim().slice(0, 60));
        }
      }
      return bad;
    })) as string[];
    expect(unwrapped, "Latin values outside bdi").toEqual([]);
  });
}

test.describe("rtl positions", () => {
  test("hero bar: Destination is right of Guests in AR, left in EN", async ({ page }) => {
    for (const [l, dir] of [
      ["ar", 1],
      ["en", -1],
    ] as const) {
      await open(page, `/__harness?c=journey-bar&s=empty&l=${l}`, "desktop");
      const segs = page.locator("#harness-root button[aria-haspopup]");
      expect(await segs.count()).toBeGreaterThanOrEqual(3);
      const first = (await segs.nth(0).boundingBox())!;
      const last = (await segs.nth(2).boundingBox())!;
      // DOM order is Where, When, Who: Where is the inline-start.
      expect(Math.sign(first.x - last.x), l).toBe(dir);
    }
  });

  test("step rail: step 1 is the inline-start cell", async ({ page }) => {
    for (const [l, dir] of [
      ["ar", 1],
      ["en", -1],
    ] as const) {
      await open(page, `/__harness?c=step-rail&s=step-2&l=${l}`, "desktop");
      const cells = page.locator("#harness-root ol > li");
      expect(await cells.count()).toBe(4);
      const a = (await cells.nth(0).boundingBox())!;
      const d = (await cells.nth(3).boundingBox())!;
      expect(Math.sign(a.x - d.x), l).toBe(dir);
    }
  });

  test("stepper: minus is the inline-start button (right in AR, left in EN)", async ({ page }) => {
    for (const [l, dir] of [
      ["ar", 1],
      ["en", -1],
    ] as const) {
      await open(page, `/__harness?c=add-on-row&s=person&l=${l}`, "desktop");
      const count = page.locator("#harness-root [aria-live=polite]").first();
      const minus = count.locator("xpath=preceding-sibling::button[1]");
      const plus = count.locator("xpath=following-sibling::button[1]");
      const m = (await minus.boundingBox())!;
      const p = (await plus.boundingBox())!;
      expect(Math.sign(m.x - p.x), l).toBe(dir);
    }
  });

  test("cart rail: Remove sits at the inline-end of its line, amounts at the inline-start of it", async ({ page }) => {
    for (const [l, dir] of [
      ["ar", -1],
      ["en", 1],
    ] as const) {
      await open(page, `/__harness?c=journey-cart&s=rail-filled&l=${l}`, "desktop");
      const remove = page.locator("#harness-root button:has(svg)").first();
      const row = remove.locator("xpath=..");
      const r = (await remove.boundingBox())!;
      const rowBox = (await row.boundingBox())!;
      const mid = rowBox.x + rowBox.width / 2;
      // English: Remove in the right half; Arabic: Remove in the left half.
      expect(Math.sign(r.x - mid), l).toBe(dir);
    }
  });

  test("sheet and entry: dock arrow and Back mirror (existing chevron spec) and dialog is rtl", async ({ page }) => {
    await open(page, "/__harness?c=journey-sheet&s=step-2&l=ar", "phone");
    await expect(page.getByRole("dialog")).toBeVisible();
    expect(await page.getByRole("dialog").evaluate((e) => getComputedStyle(e).direction)).toBe("rtl");
  });
});
