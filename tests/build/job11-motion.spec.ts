import fs from "node:fs";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { MOTION_BOOT_SRC, dropOffset, fadeOpacity } from "../../lib/motion";
import { LOCALES, localePath, type Locale } from "../../lib/locale-path";
import { routeMedia } from "../helpers/media-route";

// Plan 03.3-47, Task 1: the motion rules of 11-DESIGN section 3 proven on the assembled site (out/ under local wrangler).
//   node scripts/assemble-cloudflare.mjs
//   PW_PORT=<free> npx playwright test -c playwright.build.config.ts tests/build/job11-motion.spec.ts --workers=1
//
// Contract (plan 41): the boot script in <head> sets html[data-motion="on"] unless the visitor asked for reduced motion;
// MotionController sets html[data-motion-ready] on mount and data-revealed on each [data-reveal] once. The hidden start
// state only matches under data-motion="on" and without data-revealed, so JavaScript off or reduced motion shows everything.
// page.clock is never used: a reveal's opacity is only read while real time runs.

const FOCUS_STAY = (JSON.parse(fs.readFileSync("lib/data/fixtures/stays.json", "utf8")) as Array<{ slug: string; is_published?: boolean }>).filter(
  (stay) => stay.is_published !== false,
)[0].slug;

const KINDS = [
  { kind: "home", path: "/" },
  { kind: "list", path: "/private-stays" },
  { kind: "stay", path: `/private-stays/${FOCUS_STAY}` },
] as const;

const EASE = "cubic-bezier(0.22, 1, 0.36, 1)";

const reveals = (page: Page) => page.locator("[data-reveal]");

/** Computed style of every [data-reveal] element that is not visible-and-plain: the list of offenders. */
async function hiddenOrMoved(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("[data-reveal]")].flatMap((el) => {
      const style = getComputedStyle(el);
      const bad: string[] = [];
      if (style.opacity !== "1") bad.push(`opacity ${style.opacity}`);
      if (style.translate !== "none") bad.push(`translate ${style.translate}`);
      if (style.scale !== "none") bad.push(`scale ${style.scale}`);
      if (style.transform !== "none") bad.push(`transform ${style.transform}`);
      return bad.length ? [`${el.getAttribute("data-reveal")}: ${bad.join(", ")}`] : [];
    }),
  );
}

async function scrollThroughAndBack(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => window.innerHeight);
  for (let y = 0; y <= height; y += step) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(60);
  }
}

async function motionReady(page: Page) {
  await page.waitForFunction(() => document.documentElement.hasAttribute("data-motion-ready"));
}

/** The first number of a comma list such as "1.07s, 1.07s, 1.07s". */
const firstOf = (list: string) => list.split(",")[0].trim();

const cssOf = (locator: Locator, property: string) => locator.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);

// ---- the boot script, in the served bytes ------------------------------------------------------------------------------

test.describe("boot script", () => {
  for (const locale of LOCALES) {
    for (const under of KINDS) {
      test(`boot script: synchronous in <head> on the served bytes (${locale} ${under.kind})`, async ({ request }) => {
        const response = await request.get(localePath(locale, under.path));
        expect(response.status()).toBe(200);
        const html = await response.text();
        const head = html.slice(html.search(/<head\b/i), html.search(/<\/head>/i));
        expect(head.length, "a <head> was found").toBeGreaterThan(0);
        const tags = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]).filter((tag) => tag.includes(MOTION_BOOT_SRC));
        expect(tags, "exactly one boot script").toHaveLength(1);
        expect(head.includes(tags[0]), "the boot script is inside <head>").toBe(true);
        expect(tags[0], "not async").not.toMatch(/\sasync\b/i);
        expect(tags[0], "not defer").not.toMatch(/\sdefer\b/i);
        expect(tags[0], "not a module").not.toMatch(/type\s*=\s*"module"/i);
        const file = await request.get(MOTION_BOOT_SRC);
        expect(file.status(), "the file the page names is served").toBe(200);
      });
    }
  }
});

// ---- JavaScript off ----------------------------------------------------------------------------------------------------

test.describe("JavaScript off", () => {
  test.use({ javaScriptEnabled: false });
  for (const width of [390, 1440]) {
    for (const locale of LOCALES) {
      for (const under of KINDS) {
        test(`JavaScript off: every block visible and untransformed (${locale} ${under.kind} at ${width})`, async ({ page }) => {
          await page.setViewportSize({ width, height: 900 });
          await routeMedia(page);
          await page.goto(localePath(locale, under.path), { waitUntil: "load" });
          expect(await reveals(page).count(), "the page declares reveal blocks").toBeGreaterThan(0);
          expect(await hiddenOrMoved(page), "hidden or moved blocks").toEqual([]);
          expect(await page.evaluate(() => document.documentElement.hasAttribute("data-motion")), "no data-motion without JavaScript").toBe(false);
          const inlineDrops = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-scroll="drop"]')].map((el) => el.style.translate));
          expect(inlineDrops.filter(Boolean), "welcome photos carry no inline translate").toEqual([]);
          if (under.kind === "stay") {
            const track = page.locator('section[aria-roledescription="carousel"] > div[tabindex="0"]');
            await expect(track, "the slideshow is a focusable strip").toHaveCount(1);
            const scroll = await track.evaluate((el) => ({ overflowX: getComputedStyle(el).overflowX, scrollWidth: el.scrollWidth, clientWidth: el.clientWidth }));
            expect(scroll.overflowX).toBe("auto");
            expect(scroll.scrollWidth, "more photos than fit: it scrolls").toBeGreaterThan(scroll.clientWidth);
          }
        });
      }
    }
  }
});

// ---- reduced motion ----------------------------------------------------------------------------------------------------

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  for (const locale of LOCALES) {
    for (const under of KINDS) {
      test(`reduced motion: nothing hidden, nothing moves (${locale} ${under.kind})`, async ({ page }) => {
        await page.setViewportSize({ width: 1440, height: 900 });
        await routeMedia(page);
        await page.goto(localePath(locale, under.path));
        await motionReady(page);
        expect(await page.evaluate(() => document.documentElement.getAttribute("data-motion")), "never on").not.toBe("on");
        await scrollThroughAndBack(page);
        expect(await hiddenOrMoved(page), "hidden or moved blocks").toEqual([]);
        const running = await page.evaluate(() =>
          [...document.querySelectorAll("[data-reveal]")].filter((el) => el.getAnimations().length > 0).map((el) => el.getAttribute("data-reveal")),
        );
        expect(running, "no running transition on a reveal block").toEqual([]);
        await page.evaluate(() => window.scrollTo(0, 0));
        const fade = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-scroll="fade"]')].map((el) => el.style.opacity));
        expect(fade.filter(Boolean), "the hero fade layer has no inline opacity").toEqual([]);
        const drops = await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('[data-scroll="drop"]')].map((el) => el.style.translate));
        expect(drops.filter(Boolean), "welcome photos have no inline translate").toEqual([]);
      });
    }
  }

  test("reduced motion: a stay card image does not zoom on hover (home, en)", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await routeMedia(page);
    await page.goto("/");
    await motionReady(page);
    const card = page.locator("#stays li a").first();
    await card.scrollIntoViewIfNeeded();
    await card.hover();
    await page.waitForTimeout(600);
    expect(await cssOf(card.locator("img").first(), "scale")).toBe("none");
  });
});

// ---- motion on ---------------------------------------------------------------------------------------------------------

test.describe("motion on (en home at 1440)", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await routeMedia(page);
  });

  test("motion on: below-the-fold blocks reveal once, with the signed easing and durations", async ({ page }) => {
    await page.goto("/");
    await motionReady(page);
    expect(await page.evaluate(() => document.documentElement.getAttribute("data-motion"))).toBe("on");
    const head = page.locator('#stories [data-reveal="heading"]').first();
    const row = page.locator('#stories [data-reveal="row"]').first();
    const button = page.locator('#stories [data-reveal="button"]').first();
    await expect(head).toHaveCount(1);

    // Before scrolling: hidden, no data-revealed.
    expect(await head.getAttribute("data-revealed")).toBeNull();
    expect(await cssOf(head, "opacity"), "starts hidden").toBe("0");

    // The signed easing and durations (token values, 11-DESIGN section 3).
    expect(await cssOf(head, "transition-timing-function")).toContain(EASE);
    expect(firstOf(await cssOf(head, "transition-duration"))).toBe("1.07s");
    expect(firstOf(await cssOf(row, "transition-duration"))).toBe("1.18s");
    expect(firstOf(await cssOf(button, "transition-duration"))).toBe("0.88s");

    // Entering the view: revealed within 2 s, then fully visible.
    await head.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await expect(head).toHaveAttribute("data-revealed", "", { timeout: 2_000 });
    await expect.poll(() => cssOf(head, "opacity"), { timeout: 4_000 }).toBe("1");

    // Away and back: still revealed, never hidden again.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);
    expect(await head.getAttribute("data-revealed"), "revealed once, stays revealed while off screen").toBe("");
    expect(await cssOf(head, "opacity")).toBe("1");
    await head.evaluate((el) => el.scrollIntoView({ block: "center" }));
    await page.waitForTimeout(500);
    expect(await head.getAttribute("data-revealed")).toBe("");
    expect(await cssOf(head, "opacity")).toBe("1");
  });

  test("hero on load: photo, headline and bar delay 0.2 s, 0.6 s, 1 s; nav 0.5 s; all reach opacity 1", async ({ page }) => {
    await page.goto("/");
    await motionReady(page);
    const expected = [
      { kind: "photo", delay: "0.2s", duration: "1.6s" },
      { kind: "nav", delay: "0.5s", duration: "1s" },
      { kind: "headline", delay: "0.6s", duration: "0.9s" },
      { kind: "bar", delay: "1s", duration: "0.9s" },
    ];
    for (const { kind, delay, duration } of expected) {
      const el = page.locator(`[data-reveal="${kind}"]`).first();
      await expect(el, `${kind} is a load reveal`).toHaveAttribute("data-reveal-on", "load");
      expect(firstOf(await cssOf(el, "transition-delay")), `${kind} delay`).toBe(delay);
      expect(firstOf(await cssOf(el, "transition-duration")), `${kind} duration`).toBe(duration);
    }
    for (const { kind } of expected) {
      await expect.poll(() => cssOf(page.locator(`[data-reveal="${kind}"]`).first(), "opacity"), { timeout: 6_000, message: kind }).toBe("1");
    }
  });

  test("A9 Welcome photos follow the scroll (en and ar)", async ({ page }) => {
    for (const locale of ["en", "ar"] as Locale[]) {
      await page.goto(localePath(locale, "/"));
      await motionReady(page);
      const photo = page.locator('#welcome img[data-scroll="drop"]').first();
      await expect(photo).toHaveCount(1);
      // The photo's top in the document when untransformed.
      const layout = await photo.evaluate((el) => {
        const applied = parseFloat((el as HTMLElement).style.translate.split(" ")[1] ?? "0") || 0;
        return { docTop: el.getBoundingClientRect().top + window.scrollY - applied, height: (el as HTMLElement).offsetHeight };
      });
      const vh = await page.evaluate(() => window.innerHeight);
      const read = async (layoutTopInViewport: number) => {
        await page.evaluate((y) => window.scrollTo(0, y), Math.round(layout.docTop - layoutTopInViewport));
        await page.waitForTimeout(400);
        return page.evaluate(() => {
          const el = document.querySelector('#welcome img[data-scroll="drop"]') as HTMLElement;
          const applied = parseFloat(el.style.translate.split(" ")[1] ?? "0") || 0;
          return { applied, layoutTop: el.getBoundingClientRect().top - applied };
        });
      };
      for (const at of [vh * 0.85, vh * 0.65]) {
        const got = await read(at);
        const want = dropOffset(vh, got.layoutTop, layout.height);
        expect(Math.abs(got.applied - want), `${locale}: inline translate ${got.applied} vs formula ${want} at layoutTop ${got.layoutTop}`).toBeLessThanOrEqual(2);
        expect(got.applied, `${locale}: still above its place`).toBeLessThan(0);
      }
      const home = await read(vh * 0.4);
      expect(Math.abs(home.applied), `${locale}: in place near mid-screen`).toBeLessThanOrEqual(1);

      // The mirrored side: photo 1 sits 73.6 % from the inline start (the right in Arabic reads from the right).
      const side = await page.evaluate(() => {
        const section = document.querySelector("#welcome")!.getBoundingClientRect();
        const el = document.querySelector('#welcome img[data-scroll="drop"]')!.getBoundingClientRect();
        return { left: el.left - section.left, right: section.right - el.right, width: section.width };
      });
      const inset = side.width * 0.736;
      expect(Math.abs((locale === "ar" ? side.right : side.left) - inset), `${locale}: inline-start inset of photo 1`).toBeLessThanOrEqual(2);
    }
  });

  test("A10 hero fades with the scroll", async ({ page }) => {
    await page.goto("/");
    await motionReady(page);
    const layer = page.locator('[data-scroll="fade"]').first();
    const height = await layer.evaluate((el) => (el as HTMLElement).offsetHeight);
    for (const [factor, tolerance] of [
      [1, 0.05],
      [1.5, 0],
    ] as const) {
      await page.evaluate((y) => window.scrollTo(0, y), Math.round(height * factor));
      await page.waitForTimeout(400);
      const { y, opacity } = await page.evaluate(() => ({ y: window.scrollY, opacity: parseFloat((document.querySelector('[data-scroll="fade"]') as HTMLElement).style.opacity) }));
      const want = factor === 1.5 ? 0 : fadeOpacity(y, height);
      expect(Math.abs(opacity - want), `scrollY ${y}: opacity ${opacity} vs ${want}`).toBeLessThanOrEqual(tolerance);
    }
  });

  test("A12 hover zoom: a stay card photo 1.05, a story card photo 1.02", async ({ page }) => {
    await page.goto("/");
    await motionReady(page);
    for (const [selector, scale] of [
      ["#stays li a", 1.05],
      ["#stories li a", 1.02],
    ] as const) {
      const card = page.locator(selector).first();
      await card.evaluate((el) => el.scrollIntoView({ block: "center" }));
      await page.waitForTimeout(1_500); // the row's own reveal first
      await card.hover();
      await page.waitForTimeout(500);
      const got = parseFloat(await cssOf(card.locator("img").first(), "scale"));
      expect(got, selector).toBeCloseTo(scale, 2);
    }
  });
});

// ---- the safety reveal -------------------------------------------------------------------------------------------------

test.describe("safety reveal", () => {
  for (const under of KINDS) {
    test(`safety reveal: with the Next chunks blocked, everything shows within about 3 s (en ${under.kind})`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await routeMedia(page);
      await page.route("**/_next/static/chunks/**", (route) => route.abort());
      await page.goto(localePath("en", under.path), { waitUntil: "load" });
      await expect.poll(() => page.evaluate(() => document.documentElement.getAttribute("data-motion")), { timeout: 3_500, intervals: [100] }).toBe("off");
      // data-motion off lifts the hidden state; the blocks fade in over their own durations at most.
      await expect.poll(() => hiddenOrMoved(page), { timeout: 4_000, intervals: [100] }).toEqual([]);
    });
  }
});
