import { expect, test } from "@playwright/test";

test("WhatsApp is present on the four public guest screens", async ({
  page,
}) => {
  // /bookings and /account need a session since 02-02: the harness renders them with a fixture guest.
  for (const path of ["/login", "/__harness?c=guest-account&s=bookings&l=en", "/__harness?c=guest-account&s=hub&l=en", "/booking/trip"]) {
    await page.goto(path);
    const link = page.getByRole("link", { name: "WhatsApp", exact: true });
    await expect(link).toHaveAttribute("href", "https://wa.me/971563883302");
  }
});
