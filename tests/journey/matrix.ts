import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Scene matrix (D-32). The state list of every component is read from the keys of the
 * `scenes` export in tests/journey/scenes/<component>.tsx, so the matrix cannot drift from
 * the scenes. The scene modules are read as text, not imported: they pull in components
 * that import .svg files, which the Playwright (Node) loader cannot parse. A state that
 * the harness does not know renders `harness-unknown`, which `settle` rejects. Only the widths
 * are declared here, from the UI-SPEC state matrix: phone-only components (sheet, entry,
 * docked row, cart dock, phone rail) and 768-up-only components (hero bar, rail cart)
 * skip the widths where they do not exist.
 */
export type Viewport = "phone" | "tablet" | "desktop";
export type Locale = "en" | "ar" | "es";

export const VIEWPORTS: Record<Viewport, { width: number; height: number }> = {
  phone: { width: 390, height: 844 },
  tablet: { width: 834, height: 1194 },
  desktop: { width: 1440, height: 900 },
};
export const LOCALES: Locale[] = ["en", "ar", "es"];

export type MatrixEntry = {
  /** Scene file name, also the `c` query value. */
  component: string;
  /** State names, read from the scene module. */
  states: string[];
  viewports: (state: string) => Viewport[];
};

const ALL: Viewport[] = ["phone", "tablet", "desktop"];
const UP: Viewport[] = ["tablet", "desktop"];
const PHONE: Viewport[] = ["phone"];

/** Keys of `export const scenes: Scenes = { ... }`, top level only (two-space indent). */
export function sceneStates(component: string): string[] {
  const src = readFileSync(join(__dirname, "scenes", `${component}.tsx`), "utf8");
  const at = src.indexOf("export const scenes");
  if (at < 0) throw new Error(`${component}: no scenes export`);
  const keys: string[] = [];
  for (const m of src.slice(at).matchAll(/^ {2}"?([a-z0-9-]+)"?: /gm)) keys.push(m[1]);
  if (keys.length === 0) throw new Error(`${component}: no scene states found`);
  return keys;
}

const entry = (component: string, viewports: (state: string) => Viewport[]): MatrixEntry => ({
  component,
  states: sceneStates(component),
  viewports,
});

export const matrix: MatrixEntry[] = [
  entry("date-range-panel", (s) =>
    s === "one-month" ? PHONE : s === "past-days" ? ALL : UP,
  ),
  entry("destination-menu", () => ALL),
  entry("guest-panel", () => ALL),
  entry("journey-segment", () => UP),
  entry("journey-bar", (s) => (s === "tablet-open-when" ? ["tablet"] : UP)),
  entry("journey-sheet", () => PHONE),
  entry("step-rail", (s) => (s.startsWith("phone-") ? PHONE : UP)),
  entry("add-on-row", (s) => (s === "phone-row" ? PHONE : UP)),
  entry("inclusions-list", () => ALL),
  entry("journey-cart", (s) => (s.startsWith("phone-") ? PHONE : UP)),
  entry("team-section", () => ALL),
];

export type Scene = {
  component: string;
  state: string;
  locale: Locale;
  viewport: Viewport;
  url: string;
  /** Baseline name relative to tests/: journey/__screenshots__/<scene>-<state>-<locale>-<width>.png */
  image: string;
};

export function scenesOf(locales: Locale[] = LOCALES): Scene[] {
  const out: Scene[] = [];
  for (const m of matrix) {
    for (const state of m.states) {
      for (const viewport of m.viewports(state)) {
        for (const locale of locales) {
          out.push({
            component: m.component,
            state,
            locale,
            viewport,
            url: `/__harness?c=${m.component}&s=${state}&l=${locale}`,
            image: `journey/__screenshots__/${m.component}-${state}-${locale}-${VIEWPORTS[viewport].width}.png`,
          });
        }
      }
    }
  }
  return out;
}

/**
 * States whose contract is "renders nothing" (UI-SPEC state matrix: TeamSection and
 * InclusionsList empty). They have no picture; the visual spec asserts they stay empty.
 */
export const RENDERS_NOTHING = new Set(["team-section/none", "inclusions-list/empty"]);

/** Wait until the scene is really mounted (blank-page guard, part 1). */
export async function settle(page: import("@playwright/test").Page) {
  const mounted = () => {
    const r = document.getElementById("harness-root");
    return (
      !!r &&
      getComputedStyle(r).visibility === "visible" &&
      r.children.length > 0 &&
      !r.querySelector("[data-testid=harness-unknown]")
    );
  };
  try {
    await page.waitForFunction(mounted, undefined, { timeout: 25_000 });
  } catch {
    // The dev server sometimes serves a page that never hydrates right after a recompile.
    await page.reload();
    await page.waitForFunction(mounted, undefined, { timeout: 40_000 });
  }
  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  // Let finite entrance animations (sheet slide-in, panel fade) reach their end state, so the
  // rectangle measured for the capture is the resting one.
  await page.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
        .map((a) => a.finished.catch(() => undefined)),
    ).then(() => undefined),
  );
}
