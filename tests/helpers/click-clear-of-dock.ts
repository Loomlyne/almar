import { expect, type Locator } from "@playwright/test";

/**
 * Click a link that may sit at the bottom edge of the screen.
 *
 * A stay page pins an 88 px dock over the bottom of the viewport, and the page keeps growing for a moment after the
 * load event (the Arabic fonts reflow it). A link that Playwright scrolled to the bottom edge is then pushed behind
 * the dock. Playwright counts a link inside the viewport as "in view", never scrolls it clear, and retries the same
 * position until the test times out: measured on /ar/private-stays/<slug> with JavaScript off, about 1 click in 15,
 * with the click log "<span> from the fixed dock subtree intercepts pointer events". It is an interaction between a
 * pinned bar and the tool, not a defect a visitor meets by scrolling (the footer clears the dock at the end of the
 * page); the product-side remedy, scroll-padding-bottom on the root, is proposed in HANDOVER.md.
 *
 * Bring the link to the middle of the screen on every attempt, as a visitor's scroll would, and click it. Measured
 * with this helper: 0 failures in 60 clicks on the same page, at most 2 attempts.
 */
export async function clickClearOfDock(link: Locator, options: { timeout?: number } = {}): Promise<void> {
  await expect(async () => {
    await link.evaluate((element) => element.scrollIntoView({ block: "center" }));
    await link.click({ timeout: 2_000 });
  }).toPass({ timeout: options.timeout ?? 20_000 });
}
