import { join } from "node:path";
import { test, expect, type Page } from "@playwright/test";
import { RENDERS_NOTHING, VIEWPORTS, matrix, scenesOf, settle } from "./matrix";

// D-32: every component, every non-N/A state, EN/AR/ES, at the widths where it exists.
// Baselines: tests/journey/__screenshots__/<scene>-<state>-<locale>-<width>.png (committed).

const scenes = scenesOf();

/**
 * Root plus every portalled surface (dialog, popover) as one page-coordinate rectangle,
 * so open panels and sheets are inside the image.
 */
async function captureRect(page: Page) {
  return page.evaluate(() => {
    const root = document.getElementById("harness-root")!;
    const els = [
      root,
      ...Array.from(document.querySelectorAll("[role=dialog], [data-radix-popper-content-wrapper]")),
      // Fixed children (the phone cart dock) leave the root with no height of its own.
      ...Array.from(root.querySelectorAll("*")).filter((e) => getComputedStyle(e).position === "fixed"),
    ];
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = 0;
    let y1 = 0;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      x0 = Math.min(x0, r.left);
      y0 = Math.min(y0, r.top);
      x1 = Math.max(x1, r.right);
      y1 = Math.max(y1, r.bottom);
    }
    x0 = Math.max(0, Math.floor(x0 + window.scrollX));
    y0 = Math.max(0, Math.floor(y0 + window.scrollY));
    return { x: x0, y: y0, width: Math.ceil(x1 + window.scrollX) - x0, height: Math.ceil(y1 + window.scrollY) - y0 };
  });
}

// The first request compiles the harness chunks on the dev server; warm each component
// once so no baseline is captured from a half-compiled page.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(600_000);
  const page = await browser.newPage();
  for (const m of matrix) {
    await page.goto(`/__harness?c=${m.component}&s=${m.states[0]}&l=en`, { timeout: 120_000 });
    await settle(page);
  }
  await page.close();
});

for (const s of scenes) {
  test(`${s.component} / ${s.state} / ${s.locale} / ${VIEWPORTS[s.viewport].width}`, async ({ page }) => {
    await page.setViewportSize(VIEWPORTS[s.viewport]);
    await page.goto(s.url);
    await settle(page);
    if (RENDERS_NOTHING.has(`${s.component}/${s.state}`)) {
      // Contract is "renders nothing": nothing visible, no baseline image.
      const box = await page.locator("#harness-root").boundingBox();
      expect(box?.height ?? 0).toBeLessThan(2);
      expect((await page.locator("#harness-root").innerText()).trim()).toBe("");
      return;
    }
    // Blank-page guard, part 2: something must be laid out and drawn before a baseline can exist.
    const clip = await captureRect(page);
    expect(clip.width, "scene has width").toBeGreaterThan(8);
    expect(clip.height, "scene has height").toBeGreaterThan(8);
    const drawn = await page.evaluate(
      () => (document.getElementById("harness-root")!.innerText.trim().length > 0 ||
        document.querySelector("#harness-root svg, #harness-root img, [role=dialog]") !== null),
    );
    expect(drawn, "scene draws text, an svg, an image or a dialog").toBe(true);
    await expect(page).toHaveScreenshot(s.image.split("/"), {
      fullPage: true,
      clip,
      stylePath: join(__dirname, "visual.css"),
    });
  });
}
