import { expect, test } from "@playwright/test";

// Plan 02-04 on the dev server: x-almar-host stands in for the ops host (ignored in production).
test.use({ extraHTTPHeaders: { "x-almar-host": "dashboard.almarprivatejourney.com" } });

test("ops host / is the ops sign-in: Sign in, no New here line, no WhatsApp, no marketing page", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle(/^Sign in/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await expect(page.getByText(/New here\?/)).toHaveCount(0);
  await expect(page.getByRole("link", { name: "WhatsApp", exact: true })).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText(/dashboard/i);
  expect(await page.content()).not.toContain('name="generator" content="Framer');
});

test("a guest email stays in the field with the cannot-be-used line", async ({ page }) => {
  await page.goto("/");
  const field = page.getByRole("textbox");
  await field.fill("guest@example.com");
  await page.getByRole("button", { name: "Access with magic link" }).click();
  await expect(page.getByText("This email cannot be used here.")).toBeVisible();
  await expect(field).toHaveValue("guest@example.com");
  await expect(field).toHaveAttribute("aria-invalid", "true");
});

test("a section without the owner session lands on the ops sign-in, and /dashboard never shows", async ({ page }) => {
  await page.goto("/dashboard/bookings");
  expect(new URL(page.url()).pathname).toBe("/sign-in");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Sign in");
  await page.goto("/catalog/stays");
  expect(new URL(page.url()).pathname).toBe("/sign-in");
});

test("a public page path on the ops host is the branded 404, not the marketing page", async ({ page }) => {
  const response = await page.goto("/private-stays");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
});

test("TOUCHWORD redeem without a token creates no session and goes to the ops sign-in", async ({ page }) => {
  await page.goto("/auth/handoff?token=nope");
  expect(new URL(page.url()).pathname).toBe("/sign-in");
});
