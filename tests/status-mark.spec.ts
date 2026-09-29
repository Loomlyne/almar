import { expect, test } from "@playwright/test";

test("404 status mark is real SVG markup, not [object Object]", async ({ page }) => {
  await page.goto("/no-such-page");
  const src = await page.locator("img.status-mark").getAttribute("src");
  expect(src).not.toBeNull();
  expect(src!.startsWith("data:image/svg+xml")).toBe(true);
  const decoded = decodeURIComponent(src!.split(",").slice(1).join(","));
  expect(decoded).toContain("<svg");
  expect(decoded).not.toContain("[object Object]");
  expect(src).not.toContain("object%20Object");
});
