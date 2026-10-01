import { expect, test } from "@playwright/test";

test("New booking opens one sidebar and does not shrink the bookings table", async ({ page }) => {
  await page.goto("/dashboard/bookings");

  // A modal dialog sets aria-hidden on the page behind it, so a role query would stop
  // matching the table once the sidebar opens. Locate it by tag instead.
  const table = page.locator("table");
  const before = await table.boundingBox();
  expect(before).not.toBeNull();

  await page.getByRole("button", { name: "New booking", exact: true }).click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAccessibleName(/New booking/);

  const after = await table.boundingBox();
  expect(after).not.toBeNull();
  expect(after!.width).toBe(before!.width);
});
