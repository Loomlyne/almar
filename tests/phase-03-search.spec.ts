import { expect, test } from "@playwright/test";

test("incomplete hero search stays on /framer", async ({ page }) => {
  await page.goto("/framer");

  const frame = page.frameLocator("#content");
  const form = frame.getByRole("search", { name: "Find a stay" });
  await form.getByRole("button", { name: "Search", exact: true }).click();

  await expect(frame.getByText("Choose a destination and dates to search.")).toBeVisible();
  await expect(page).toHaveURL(/\/framer$/);
  await expect(page).not.toHaveURL(/\/booking\/trip/);
});
