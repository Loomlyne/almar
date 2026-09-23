import { expect, test } from "@playwright/test";

test("video is muted, pauses off-screen, and stays under reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/design");

  const video = page.locator("video");
  await expect(video).toHaveCount(1);
  await expect(video).toHaveJSProperty("muted", true);
  await expect(video).toHaveAttribute("playsinline", "");

  await video.evaluate((node) => {
    const media = node as HTMLVideoElement;
    return media.play().catch(() => undefined);
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect(video).toHaveJSProperty("paused", true);

  const control = page.getByRole("button", { name: /^(Pause|Play) video$/ });
  await expect(control).toBeVisible();
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
});
