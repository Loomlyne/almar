import { expect, test } from "@playwright/test";

test("WhatsApp opens the locked number on /framer and is absent on /design", async ({
  page,
}) => {
  await page.goto("/framer");

  const link = page.getByRole("link", { name: "WhatsApp", exact: true });
  await expect(link).toHaveAttribute("href", "https://wa.me/971563883302");

  await page.goto("/design");
  await expect(
    page.getByRole("link", { name: "WhatsApp", exact: true }),
  ).toHaveCount(0);
});

test("WhatsApp is present on the four public guest screens", async ({
  page,
}) => {
  for (const path of ["/login", "/bookings", "/account", "/booking/trip"]) {
    await page.goto(path);
    const link = page.getByRole("link", { name: "WhatsApp", exact: true });
    await expect(link).toHaveAttribute("href", "https://wa.me/971563883302");
  }
});
