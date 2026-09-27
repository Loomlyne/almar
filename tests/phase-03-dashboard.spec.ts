import { expect, test } from "@playwright/test";

test("New booking opens one sidebar and does not shrink the bookings table", async ({ page }) => {
  await page.goto("/dashboard/bookings");

  const table = page.getByRole("table");
  const before = await table.boundingBox();
  expect(before).not.toBeNull();

  await page.getByRole("button", { name: "New booking", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName(/New booking/);

  const after = await table.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBe(before!.width);
});
