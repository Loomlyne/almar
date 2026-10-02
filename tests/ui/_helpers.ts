import { expect, type Page } from "@playwright/test";
import { LOCALES, VIEWPORTS, settle, type Locale, type Viewport } from "../journey/matrix";

export { LOCALES, VIEWPORTS };
export type { Locale, Viewport };

export const WIDTHS = Object.keys(VIEWPORTS) as Viewport[];

/** Open one scene of one harness component at a width, in a locale, and wait until it is mounted. */
export async function open(page: Page, component: string, state: string, locale: Locale, viewport: Viewport) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(`/__harness?c=${component}&s=${state}&l=${locale}`);
  await settle(page);
}

/** The computed rgb() string of a colour token, so a style test never hand-types a colour. */
export async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--color-${n})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

export const style = (loc: ReturnType<Page["locator"]>, prop: string) =>
  loc.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

export { expect };
