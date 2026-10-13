import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { OPS_TRANSLATE_COPY, type OpsTranslateLocale } from "../lib/copy/ops-translate";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// The Translate button (plan 03.2-10) on its harness scenes (tests/journey/scenes/ops-translate.tsx for the pictures,
// ops-translate-live.tsx for the wired button). Workers AI is never called: every POST /api/ops/translate is answered
// here by page.route with a fixture, and a request that is not answered fails the test.

const harnessUrl = (scene: string, state: string, locale: string) => `/__harness?c=${scene}&s=${state}&l=${locale}`;

async function openScene(page: Page, state: string, viewport: Viewport, locale: OpsTranslateLocale, scene = "ops-translate") {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(harnessUrl(scene, state, locale));
  await settle(page);
  // The dev server's own indicator can sit over the page corner.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

// ---- pictures -----------------------------------------------------------------------------------------------------
// Full-page PNGs for the owner's signature, written outside tests/ (page.screenshot, not toHaveScreenshot), so no
// baseline is committed under tests/. 8 states x 3 widths x 3 languages (EN, AR and the ES the owner's rule asks for).
// The owner signed them (2026-10-11, 03.2-10-NOTES.md), so the block runs only when asked, as tests/ops-kit.spec.ts:
// OPS_TRANSLATE_PICTURES=1 writes into the planning folder, OPS_TRANSLATE_PICTURES=<absolute folder> writes there.
// OPS_TRANSLATE_PICTURE_LOCALES=es (comma list) shoots only those languages, so a copy change in one language
// re-shoots only its files.

const PLANNING_PICTURES = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-10");
const PICTURES_TO = process.env.OPS_TRANSLATE_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : PLANNING_PICTURES;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const ALL_PICTURE_LOCALES: OpsTranslateLocale[] = ["en", "ar", "es"];
const ONLY = process.env.OPS_TRANSLATE_PICTURE_LOCALES?.split(",").map((l) => l.trim());
const PICTURE_LOCALES = ONLY ? ALL_PICTURE_LOCALES.filter((l) => ONLY.includes(l)) : ALL_PICTURE_LOCALES;

/** The line each state must show, so a picture never captures the wrong state. */
function expectedLine(state: string, locale: OpsTranslateLocale): string {
  const copy = OPS_TRANSLATE_COPY[locale];
  switch (state) {
    case "disabled-no-english":
      return copy.needEnglish;
    case "confirm":
      return copy.confirmTitle;
    case "busy":
      return copy.busy;
    case "done":
      return copy.done;
    case "partial":
      return copy.partialArabicOnly;
    case "limit":
      return copy.limit;
    case "failed":
      return copy.failed;
    default:
      return copy.action;
  }
}

test.describe("pictures", () => {
  test.skip(!PICTURES_TO, "the pictures are signed; set OPS_TRANSLATE_PICTURES=1 (or a folder) to shoot them again");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("ops-translate")) {
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await openScene(page, state, viewport, locale);
          await expect(page.getByText(expectedLine(state, locale), { exact: true }).first()).toBeVisible({ timeout: 10_000 });
          await expect(page.locator('input[type="radio"], [role="radio"]')).toHaveCount(0);
          if (state === "disabled-no-english") {
            await expect(page.getByRole("button", { name: OPS_TRANSLATE_COPY[locale].action, exact: true })).toBeDisabled();
          }
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

// ---- behaviour ----------------------------------------------------------------------------------------------------
// The wired button against fixtures for POST /api/ops/translate: 200 per target, 502 translate_failed, 429
// translate_limit (contract 5.11), and a request that never answers (45 s client abort), at 390 and 1440, EN and AR. The scene logs every onDrafts call as
// "<target>:<field names>" in a hidden output.

type Answer = 200 | 502 | 429 | 503;
type Plan = { ar: Answer; es: Answer };

const SOURCE_KEYS = ["name", "short_line", "summary"];

/** Answers each target's POST with its fixture; `hold` keeps every answer back until it resolves. */
async function answerTranslate(page: Page, plan: Plan, hold?: Promise<void>) {
  const bodies: { target: string; fields: Record<string, unknown> }[] = [];
  await page.route("**/api/ops/translate", async (route: Route) => {
    const request = route.request();
    if (request.method() !== "POST") return route.abort();
    const body = request.postDataJSON() as { target: "ar" | "es"; fields: Record<string, string> };
    bodies.push(body);
    if (hold) await hold;
    const status = plan[body.target];
    const json =
      status === 200
        ? { ok: true, target: body.target, fields: Object.fromEntries(Object.keys(body.fields).map((k) => [k, `[${body.target} ${k}]`])) }
        : { ok: false, error: { code: status === 429 ? "translate_limit" : status === 503 ? "translate_busy" : "translate_failed", field: null, locale: null, detail: null } };
    await route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(json) });
  });
  return bodies;
}

const logOf = async (page: Page) => ((await page.getByTestId("ops-translate-log").textContent()) ?? "").split(" | ").filter(Boolean);
const statusLine = (page: Page) => page.locator('[role="status"][aria-live="polite"]').filter({ hasText: /\S/ });

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(90_000);

  for (const viewport of ["phone", "desktop"] as const) {
    for (const locale of ["en", "ar"] as const) {
      const width = VIEWPORTS[viewport].width;
      const copy = OPS_TRANSLATE_COPY[locale];
      const button = (page: Page) => page.getByRole("button", { name: new RegExp(`^(${copy.action}|${copy.busy})$`) });

      test(`no English: disabled with the reason, no request (${width} ${locale})`, async ({ page }) => {
        const bodies = await answerTranslate(page, { ar: 200, es: 200 });
        await openScene(page, "disabled-no-english", viewport, locale);
        await expect(page.getByRole("button", { name: copy.action, exact: true })).toBeDisabled();
        await expect(page.getByText(copy.needEnglish, { exact: true })).toBeVisible();
        expect(bodies).toHaveLength(0);
      });

      test(`both 200: busy, then done, onDrafts twice (${width} ${locale})`, async ({ page }) => {
        let release = () => undefined as void;
        const hold = new Promise<void>((resolve) => (release = resolve));
        const bodies = await answerTranslate(page, { ar: 200, es: 200 }, hold);
        await openScene(page, "live", viewport, locale, "ops-translate-live");
        await button(page).click();
        // While both requests are out the button is busy and off.
        await expect(page.getByRole("button", { name: copy.busy, exact: true })).toBeDisabled();
        await expect.poll(() => bodies.length).toBe(2);
        release();
        await expect(statusLine(page)).toHaveText(copy.done);
        expect(bodies.map((b) => b.target).sort()).toEqual(["ar", "es"]);
        for (const b of bodies) expect(Object.keys(b.fields).sort()).toEqual(SOURCE_KEYS);
        expect((await logOf(page)).sort()).toEqual(["ar:name,short_line,summary", "es:name,short_line,summary"]);
        await expect(page.getByRole("button", { name: copy.action, exact: true })).toBeEnabled();
      });

      test(`es 502: onDrafts once for ar, the partial line (${width} ${locale})`, async ({ page }) => {
        await answerTranslate(page, { ar: 200, es: 502 });
        await openScene(page, "live", viewport, locale, "ops-translate-live");
        await button(page).click();
        await expect(statusLine(page)).toHaveText(copy.partialArabicOnly);
        expect(await logOf(page)).toEqual(["ar:name,short_line,summary"]);
      });

      test(`ar 502: onDrafts once for es, the partial line (${width} ${locale})`, async ({ page }) => {
        await answerTranslate(page, { ar: 502, es: 200 });
        await openScene(page, "live", viewport, locale, "ops-translate-live");
        await button(page).click();
        await expect(statusLine(page)).toHaveText(copy.partialSpanishOnly);
        expect(await logOf(page)).toEqual(["es:name,short_line,summary"]);
      });

      test(`both 502: the failed line, no drafts (${width} ${locale})`, async ({ page }) => {
        await answerTranslate(page, { ar: 502, es: 502 });
        await openScene(page, "live", viewport, locale, "ops-translate-live");
        await button(page).click();
        await expect(statusLine(page)).toHaveText(copy.failed);
        expect(await logOf(page)).toEqual([]);
      });

      // The daily limit on one target while the other came back (03.2-10b): the line says what was filled and what is limited.
      for (const [plan, line] of [
        [{ ar: 429, es: 200 }, copy.partialSpanishLimit],
        [{ ar: 200, es: 429 }, copy.partialArabicLimit],
        [{ ar: 429, es: 429 }, copy.limit],
        [{ ar: 429, es: 502 }, copy.limit],
      ] as [Plan, string][]) {
        test(`429 (ar ${plan.ar}, es ${plan.es}): ${line === copy.limit ? "the limit line" : "the partial-limit line"} (${width} ${locale})`, async ({ page }) => {
          await answerTranslate(page, plan);
          await openScene(page, "live", viewport, locale, "ops-translate-live");
          await button(page).click();
          await expect(statusLine(page)).toHaveText(line);
          // A target that did come back is still filled as a draft.
          const expected = (["ar", "es"] as const).filter((t) => plan[t] === 200).map((t) => `${t}:name,short_line,summary`);
          expect(await logOf(page)).toEqual(expected);
        });
      }

      // A rate or capacity answer (503 translate_busy): "try again in a minute", never the "resets 04:00" line (03.2-10b, round 3).
      for (const [plan, line] of [
        [{ ar: 503, es: 503 }, copy.retryLater],
        [{ ar: 503, es: 502 }, copy.retryLater],
        [{ ar: 200, es: 503 }, copy.partialArabicOnly],
        [{ ar: 503, es: 200 }, copy.partialSpanishOnly],
        [{ ar: 503, es: 429 }, copy.limit],
      ] as [Plan, string][]) {
        test(`503 busy (ar ${plan.ar}, es ${plan.es}) (${width} ${locale})`, async ({ page }) => {
          await answerTranslate(page, plan);
          await openScene(page, "live", viewport, locale, "ops-translate-live");
          await button(page).click();
          await expect(statusLine(page)).toHaveText(line);
          if (line === copy.retryLater) await expect(page.getByText(copy.limit, { exact: true })).toHaveCount(0);
        });
      }

      test(`a stalled request is given up after 45 s: the failed line, the button is back (${width} ${locale})`, async ({ page }) => {
        // Both requests are taken and never answered.
        const taken: string[] = [];
        await page.route("**/api/ops/translate", async (route) => {
          taken.push(route.request().postDataJSON().target);
          await new Promise(() => undefined);
        });
        await openScene(page, "live", viewport, locale, "ops-translate-live");
        await page.clock.install();
        await button(page).click();
        await expect(page.getByRole("button", { name: copy.busy, exact: true })).toBeDisabled();
        await expect.poll(() => taken.length).toBe(2);
        await page.clock.fastForward(44_000);
        await expect(page.getByRole("button", { name: copy.busy, exact: true })).toBeDisabled();
        await page.clock.fastForward(2_000);
        await expect(statusLine(page)).toHaveText(copy.failed);
        expect(await logOf(page)).toEqual([]);
        await expect(page.getByRole("button", { name: copy.action, exact: true })).toBeEnabled();
      });

      test(`English changed during the request: the answers are dropped, onDrafts never called (${width} ${locale})`, async ({ page }) => {
        let release = () => undefined as void;
        const hold = new Promise<void>((resolve) => (release = resolve));
        const bodies = await answerTranslate(page, { ar: 200, es: 200 }, hold);
        await openScene(page, "live", viewport, locale, "ops-translate-live");
        await button(page).click();
        await expect.poll(() => bodies.length).toBe(2);
        // The owner edits the English while both requests are out.
        await page.locator("#tr-name").fill("[Name, edited]");
        release();
        await expect(statusLine(page)).toHaveText(copy.failed);
        expect(await logOf(page)).toEqual([]);
        await expect(page.getByRole("button", { name: copy.action, exact: true })).toBeEnabled();
      });

      test(`AR or ES already filled: the replace question first, Keep sends nothing (${width} ${locale})`, async ({ page }) => {
        const bodies = await answerTranslate(page, { ar: 200, es: 200 });
        await openScene(page, "live-existing", viewport, locale, "ops-translate-live");
        await button(page).click();
        // The edit panel is a dialog too: the replace question is the one with its title.
        const dialog = page.getByRole("dialog").filter({ hasText: copy.confirmTitle });
        await expect(dialog.getByText(copy.confirmTitle, { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: copy.keep, exact: true }).click();
        await expect(dialog).toHaveCount(0);
        expect(bodies).toHaveLength(0);
        await button(page).click();
        await dialog.getByRole("button", { name: copy.replace, exact: true }).click();
        await expect(dialog).toHaveCount(0);
        await expect(statusLine(page)).toHaveText(copy.done);
        expect(bodies).toHaveLength(2);
        expect(await logOf(page)).toHaveLength(2);
      });
    }
  }
});
