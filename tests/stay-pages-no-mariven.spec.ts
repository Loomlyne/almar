import { expect, test, type Page } from "@playwright/test";
import { readdirSync } from "node:fs";
import path from "node:path";

// Job 05. "Mariven" is another property; the sentence "From cozy beachfront rooms
// to luxurious oceanfront suites, each space at Mariven is thoughtfully designed..."
// is leftover Framer template text. Framer's own runtime re-creates it from its
// CDN code after hydration, so the file text proves nothing (job 04's footer fix
// passed file-text tests and was still broken live). This guard drives a real
// browser on all 12 stay pages, waits for hydration, and asserts what a visitor
// and a screen reader get, at three widths and across breakpoint switches.
//
// The sentence is hidden with one CSS rule, not removed: taking it out of the
// server HTML makes React replace the whole page on the client (measured: h1,
// nav and footer nodes all replaced, "recoverable error" in the console). The
// last test fails if that happens, so the fix cannot be "improved" into it.

const STAYS_DIR = path.join(process.cwd(), "app", "private-stays");
const SLUGS = readdirSync(STAYS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const WIDTHS = [390, 834, 1440] as const;

async function load(page: Page, slug: string) {
  await page.goto(`/private-stays/${slug}`, { waitUntil: "domcontentloaded" });
  // Hydration is done when React has mounted its root on Framer's #main container.
  await page.waitForFunction(
    () => {
      const main = document.getElementById("main");
      return !!main && Object.keys(main).some((k) => k.startsWith("__reactContainer"));
    },
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForLoadState("networkidle");
  // Let Framer's post-hydration passes (appear effects, variant swaps) finish.
  await page.waitForTimeout(1500);
}

/** Everything a visitor can read or a screen reader announces, plus layout facts. */
async function visitorView(page: Page) {
  return page.evaluate(() => {
    const hasWord = (t: string | null) => /mariven/i.test(t ?? "");
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && cs.display !== "none" && cs.visibility !== "hidden";
    };
    const carriers = [...document.querySelectorAll("body *")].filter(
      (el) => hasWord(el.textContent) && ![...el.children].some((c) => hasWord(c.textContent)),
    );
    const attr = [...document.querySelectorAll("body *")].filter((el) =>
      [...el.attributes].some((a) => hasWord(a.value)),
    );
    return {
      innerText: hasWord(document.body.innerText),
      visibleCarriers: carriers.filter((el) => {
        for (let n: Element | null = el; n; n = n.parentElement) if (!visible(n)) return false;
        return true;
      }).length,
      visibleAttributes: attr.filter(visible).length,
      title: hasWord(document.title),
    };
  });
}

test.describe("stay pages carry no Mariven text after hydration", () => {
  test("the 12 stay pages are all covered", () => {
    expect(SLUGS).toHaveLength(12);
    expect(SLUGS).toContain("casa-mariana-historic-center");
  });

  for (const slug of SLUGS) {
    test(`/private-stays/${slug}`, async ({ page }) => {
      await page.setViewportSize({ width: WIDTHS[2], height: 900 });
      await load(page, slug);

      // The About block is still there, and only its template sentence is gone:
      // the other three headings keep their own ALMAR subtitles.
      await expect(page.locator("#about h3")).toHaveText("About");
      const kept = await page.evaluate(
        () =>
          [...document.querySelectorAll(".framer-1sl02v6")].filter(
            (el) => el.getBoundingClientRect().height > 0,
          ).length,
      );
      expect(kept, "Amenities, Services and Experiences subtitles stay visible").toBeGreaterThanOrEqual(3);

      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForTimeout(800); // Framer re-mounts parts of the page at a breakpoint
        const view = await visitorView(page);
        expect(view, `${slug} at ${width}`).toEqual({
          innerText: false,
          visibleCarriers: 0,
          visibleAttributes: 0,
          title: false,
        });
      }
      // And once more after going back up, the order that re-mounts the footer links.
      await page.setViewportSize({ width: WIDTHS[2], height: 900 });
      await page.waitForTimeout(800);
      expect((await visitorView(page)).innerText).toBe(false);
    });
  }

  test("the fix does not make React replace the page on the client", async ({ page }) => {
    // Removing the sentence from the server HTML (instead of hiding it) makes
    // hydration fail and React rebuild every node: slower first paint, flicker.
    await page.addInitScript(() => {
      const w = window as unknown as { __first: Record<string, Element> };
      w.__first = {};
      const pick = () => {
        for (const [k, sel] of Object.entries({ h1: "h1", footer: "footer", nav: "nav a" })) {
          if (!w.__first[k]) {
            const el = document.querySelector(sel);
            if (el) w.__first[k] = el;
          }
        }
        requestAnimationFrame(pick);
      };
      pick();
    });
    // 1440 is the width the server HTML is rendered for; at others Framer swaps variants on its own.
    await page.setViewportSize({ width: 1440, height: 900 });
    await load(page, "baru-island-private-villa");
    const same = await page.evaluate(() => {
      const w = window as unknown as { __first: Record<string, Element> };
      const sel: Record<string, string> = { h1: "h1", footer: "footer", nav: "nav a" };
      return Object.fromEntries(
        Object.entries(sel).map(([k, s]) => [k, w.__first[k] === document.querySelector(s)]),
      );
    });
    expect(same).toEqual({ h1: true, footer: true, nav: true });
  });
});
