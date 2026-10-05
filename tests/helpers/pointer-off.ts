import { expect, type Page } from "@playwright/test";

/**
 * Moves the pointer to a point that is not inside any `[aria-roledescription="carousel"]`, asserts that it is, then
 * blurs the active element (reconcile S2-24, S2-26). A slider holds while hovered or focused, so every test calls this
 * right after `goto` and after every click on Pause, Play or a dot, before it waits for the slider to move.
 *
 * The hero is full height, so no fixed coordinate is safe: candidates are tried in order (the top-left of the
 * on-image header, a sibling of the hero; then the bottom-left, bottom-right and top-right corners of the viewport).
 */
export async function pointerOff(page: Page): Promise<{ x: number; y: number }> {
  const size = page.viewportSize() ?? { width: 1280, height: 720 };
  const candidates = [
    { x: 4, y: 4 },
    { x: 4, y: size.height - 4 },
    { x: size.width - 4, y: size.height - 4 },
    { x: size.width - 4, y: 4 },
  ];
  for (const { x, y } of candidates) {
    const outside = await page.evaluate(
      ([px, py]) => document.elementFromPoint(px, py)?.closest('[aria-roledescription="carousel"]') == null,
      [x, y],
    );
    if (!outside) continue;
    await page.mouse.move(x, y);
    const still = await page.evaluate(
      ([px, py]) => document.elementFromPoint(px, py)?.closest('[aria-roledescription="carousel"]') == null,
      [x, y],
    );
    expect(still, `pointer at ${x},${y} is outside every carousel`).toBe(true);
    await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
    return { x, y };
  }
  throw new Error("pointerOff: no point of the viewport lies outside every carousel");
}
