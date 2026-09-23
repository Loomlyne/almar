import { expect, test } from "@playwright/test";

const MATRIX = ["Link", "Button", "Input", "Password", "Checkbox", "Radio"] as const;
const STATES = ["Hover", "Focus", "Disabled", "Loading", "Error", "Empty"] as const;

test("core controls and their state rows are on /design", async ({ page }) => {
  await page.goto("/design");

  await expect(page.getByRole("link", { name: "Back", exact: true })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Email", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^(Show|Hide) password$/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Remember me", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("radio", { name: "Deposit", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("switch", { name: "Email updates on", exact: true }),
  ).toBeVisible();

  for (const name of MATRIX) {
    const section = page.getByRole("region", { name, exact: true });
    await expect(section).toBeVisible();
    for (const state of STATES) {
      await expect(section.getByText(state, { exact: true })).toBeVisible();
    }
    await expect(section.getByText("N/A", { exact: true }).first()).toBeVisible();
  }

  const switchSection = page.getByRole("region", { name: "Switch", exact: true });
  await expect(switchSection).toBeVisible();
  for (const state of ["On", "Off", "Focus", "Disabled"]) {
    await expect(switchSection.getByText(state, { exact: true })).toBeVisible();
  }
  await expect(switchSection.getByText("N/A", { exact: true }).first()).toBeVisible();
});
