// The motion vocabulary's constants and its two scroll formulas (11-DESIGN section 3). Pure: no imports.

/**
 * The pre-paint boot script: a static, content-hashed file in public/assets/js (the site caches /assets/* for a
 * year, immutable, so a changed script must be a new name). When the script changes, rename the file to its new
 * sha256 prefix and edit this line; tests/motion.test.mjs fails until both agree.
 */
export const MOTION_BOOT_SRC = "/assets/js/motion-boot.69c70650.js";

/** How long the page waits for the controller before it shows everything anyway (the boot script holds the same number). */
export const MOTION_SAFETY_MS = 3000;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** A hero photo's opacity while the page scrolls: 1 until half the hero has scrolled away, 0 at 1.5 heights. */
export function fadeOpacity(scrollY: number, height: number): number {
  if (height <= 0) return 1;
  return clamp01(1 - (scrollY - height / 2) / height);
}

/**
 * The vertical offset in px of a photo that slides into place as it rises. `layoutTop` is the photo's untransformed top
 * in the viewport. At the bottom edge it sits one photo height up (-height); once it reaches mid-screen it is home (0).
 */
export function dropOffset(viewportHeight: number, layoutTop: number, height: number): number {
  if (viewportHeight <= 0) return 0;
  const progress = clamp01((viewportHeight - layoutTop) / (viewportHeight / 2));
  // Rounded to 0.01 px (no float noise in the inline style); + 0 turns -0 into 0.
  return Math.round(-height * (1 - progress) * 100) / 100 + 0;
}
