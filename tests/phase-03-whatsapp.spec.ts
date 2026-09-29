import { expect, test } from "@playwright/test";

test("WhatsApp is present on the four public guest screens", async ({
  page,
}) => {
  for (const path of ["/login", "/bookings", "/account", "/booking/trip"]) {
    await page.goto(path);
    const link = page.getByRole("link", { name: "WhatsApp", exact: true });
    await expect(link).toHaveAttribute("href", "https://wa.me/971563883302");
  }
});
