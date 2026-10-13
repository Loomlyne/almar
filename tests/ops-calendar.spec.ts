import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { OPS_CALENDAR_COPY, overlapLine } from "../lib/copy/ops-calendar";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// The Calendar and its Block dates form on their harness scene (tests/journey/scenes/ops-calendar.tsx). The API is
// never called: the scene holds its own state on bracket data and today is fixed at 2026-10-14.

type Locale = "en" | "ar" | "es";

const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-calendar&s=${state}&l=${locale}`;

async function openScene(page: Page, state: string, viewport: Viewport, locale: Locale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(harnessUrl(state, locale));
  await settle(page);
  // The dev server's own indicator can sit over the page corner.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

// ---- every label is a string --------------------------------------------------------------------------------------
// 03.2-12 shipped "[object Object]" as a label because a duplicate key replaced a string with an object. Two gates:
// the copy file itself (every leaf is a real string), and the drawn page (no text node, label or placeholder says
// [object, undefined or NaN, and every button has a name). Both run for every picture.

const BAD_TEXT = /\[object|undefined|NaN/;

function leaves(value: unknown, path: string, out: { path: string; value: unknown }[] = []) {
  if (Array.isArray(value)) value.forEach((one, at) => leaves(one, `${path}[${at}]`, out));
  else if (value !== null && typeof value === "object") {
    for (const [key, one] of Object.entries(value)) leaves(one, `${path}.${key}`, out);
  } else out.push({ path, value });
  return out;
}

test("copy: every Calendar label is a non-empty string in EN, AR and ES", () => {
  for (const locale of ["en", "ar", "es"] as const) {
    const copy = OPS_CALENDAR_COPY[locale];
    expect(copy.weekdays, `${locale} weekdays`).toHaveLength(7);
    expect(typeof copy.overlap.other, `${locale} overlap.other`).toBe("string");
    for (const { path, value } of leaves(copy, locale)) {
      expect(typeof value, path).toBe("string");
      expect((value as string).trim().length, `${path} is empty`).toBeGreaterThan(0);
      expect(BAD_TEXT.test(value as string), `${path} says ${value}`).toBe(false);
    }
    // Dashboard Spanish speaks usted (owner, 2026-10-14): no tú imperative or verb form.
    if (locale === "es") {
      const spanish = leaves(copy, "es").map((one) => one.value as string).join("\n");
      expect(spanish, "informal Spanish").not.toMatch(/\b(Elige|Elimínalo|vuelve|Revisa|Confirma)\b/);
    }
    // The overlap sentence names its number, in every plural form the language can ask for.
    for (const n of [1, 2, 3, 11, 100]) expect(overlapLine(locale, n), `${locale} overlap ${n}`).toMatch(/\d|حجز(ان| واحد)/);
  }
});

async function assertDrawnText(page: Page) {
  const problems = await page.evaluate((badSource) => {
    const bad = new RegExp(badSource);
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? "").trim();
      // Next's own flight data sits in <script> tags; only what a person can read counts.
      if (text && bad.test(text) && !node.parentElement?.closest("nextjs-portal, script, style, noscript")) found.push(`text: ${text}`);
    }
    for (const element of document.querySelectorAll("[aria-label], [placeholder], [title]")) {
      if (element.closest("nextjs-portal")) continue;
      for (const name of ["aria-label", "placeholder", "title"]) {
        const value = element.getAttribute(name);
        if (value !== null && (value.trim() === "" || bad.test(value))) found.push(`${name}: "${value}"`);
      }
    }
    for (const button of document.querySelectorAll("button")) {
      if (button.closest("nextjs-portal")) continue;
      if (!(button.textContent ?? "").trim() && !button.getAttribute("aria-label")) found.push("a button with no name");
    }
    return found;
  }, BAD_TEXT.source);
  expect(problems, "drawn text").toEqual([]);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(overflow.scroll, "page scrollWidth").toBeLessThanOrEqual(overflow.client);
}

/** What each state has to show, said from the copy, so a picture cannot be a blank or the wrong screen. */
async function expectState(page: Page, state: string, locale: Locale) {
  const copy = OPS_CALENDAR_COPY[locale];
  const blockedDays = page.getByRole("button", { name: new RegExp(`, ${copy.blockedDay}$`) });
  // includeHidden: an open panel hides the page behind it from the accessibility tree, but it is still drawn.
  await expect(page.getByRole("heading", { level: 1, name: copy.title, includeHidden: true })).toBeVisible();
  await expect(page.locator('input[type="radio"], [role="radio"]')).toHaveCount(0);
  // The dead booking form is gone: nothing on the page says New booking, Guest or Status.
  await expect(page.getByText(/new booking|nueva reserva|حجز جديد/i)).toHaveCount(0);

  if (state === "month") {
    // Past day 10 and 11, then 19 to 24 and 27.
    await expect(blockedDays).toHaveCount(9);
    await expect(page.getByRole("heading", { level: 2, name: copy.blockedDates })).toBeVisible();
    await expect(page.getByRole("button", { name: copy.blockDates, exact: true })).toBeVisible();
    // One Delete per block of the month.
    await expect(page.getByRole("button", { name: new RegExp(`^${copy.deleteNamed.split("{")[0].trim()}`) })).toHaveCount(6);
  }
  if (state === "month-filtered") {
    // The stay's own day, its destination's two, the all-scope five (past 10 and 11, 19 to 21).
    await expect(blockedDays).toHaveCount(8);
  }
  if (state === "empty") {
    await expect(blockedDays).toHaveCount(0);
    await expect(page.getByText(copy.noBlocks)).toBeVisible();
  }
  if (state === "after-overlap") {
    await expect(page.getByRole("status").filter({ hasText: overlapLine(locale, 2) })).toBeVisible();
  }
  if (state.startsWith("form-")) {
    await expect(page.getByRole("dialog").getByText(copy.blockedNote)).toBeVisible();
    const cards = page.getByRole("dialog").getByRole("button", { pressed: true });
    await expect(cards.first()).toBeVisible();
    await expect(page.getByRole("dialog").getByText(copy.whatToBlock)).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: copy.block, exact: true })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(copy.reasonOptional)).toBeVisible();
  }
  if (state.startsWith("form-")) {
    // Below 768 the form is a full-screen sheet; from 768 it docks to the inline end (the right in English and Spanish,
    // the left in Arabic) and does not scroll sideways.
    const box = await page.getByRole("dialog").evaluate((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, wide: element.scrollWidth - element.clientWidth };
    });
    const viewport = page.viewportSize()!;
    expect(box.wide, "form scrolls sideways").toBeLessThanOrEqual(0);
    if (viewport.width < 768) {
      expect([box.left, box.right, box.top, box.bottom]).toEqual([0, viewport.width, 0, viewport.height]);
    } else if (locale === "ar") {
      expect(box.left).toBe(0);
      expect(box.right).toBeLessThan(viewport.width);
    } else {
      expect(box.right).toBe(viewport.width);
      expect(box.left).toBeGreaterThan(0);
    }
  }
  if (state === "form-stay-prefilled") {
    await expect(page.getByRole("dialog").getByRole("button", { name: copy.oneStay, pressed: true })).toBeVisible();
    await expect(page.getByRole("dialog").getByText(copy.stays, { exact: true })).toBeVisible();
  }
  if (state === "form-one-day") {
    await expect(page.getByRole("dialog").getByText("30/10/2026", { exact: true })).toBeVisible();
  }
}

// ---- pictures -----------------------------------------------------------------------------------------------------
// Full-page PNGs for the owner's signature, written outside tests/ (page.screenshot, not toHaveScreenshot), so no
// baseline is committed under tests/. 4 states x 3 widths x 3 languages (3 more are held). They run only when asked, so a full
// Playwright run never rewrites a signed picture: OPS_CALENDAR_PICTURES=1 writes into the planning folder,
// OPS_CALENDAR_PICTURES=<absolute folder> writes there.

const PLANNING_PICTURES = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-13");
const PICTURES_TO = process.env.OPS_CALENDAR_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : PLANNING_PICTURES;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const PICTURE_LOCALES: Locale[] = ["en", "ar", "es"];
/** States drawn inside the shared edit panel, which is being redesigned: not shot until the chosen option arrives. */
const HELD = new Set(["form-everything", "form-stay-prefilled", "form-one-day"]);

test.describe("pictures", () => {
  test.skip(!PICTURES_TO, "set OPS_CALENDAR_PICTURES=1 (or a folder) to shoot the pictures");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("ops-calendar")) {
    // The form pictures wait for the owner's choice of the new edit panel (controller, 2026-10-14).
    if (HELD.has(state) && !process.env.OPS_CALENDAR_HELD) continue;
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await openScene(page, state, viewport, locale);
          await expectState(page, state, locale);
          await assertDrawnText(page);
          await expectNoSidewaysScroll(page);
          expect(await page.evaluate(() => document.documentElement.dir)).toBe(locale === "ar" ? "rtl" : "ltr");
          // The panel focuses its first control on open; the ring is real but is not what the picture is for.
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          // Network idle is capped (a bare wait times out on a cold dev server), then a short settle.
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          await page.screenshot({ path: join(PICTURES, `${state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});
