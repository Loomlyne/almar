import { expect, test } from "@playwright/test";
import { mockBookingsApi } from "./helpers/ops-bookings-api";

test("the list renders and no New booking control exists", async ({ page }) => {
  // Site status, destinations and the list are answered, so no unmocked 403 sends the page to /sign-in.
  await mockBookingsApi(page);
  await page.goto("/dashboard/bookings");

  await expect(page.locator("[data-bookings-list]")).toBeVisible();
  await expect(page.locator("[data-bookings-list]").getByText("ALMAR-AB2CDE").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /New booking/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /New booking/ })).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
