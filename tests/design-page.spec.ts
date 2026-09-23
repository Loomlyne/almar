import { expect, test } from "@playwright/test";

const MATRIX = ["Link", "Button", "Input", "Password", "Checkbox", "Radio"] as const;
const STATES = ["Hover", "Focus", "Disabled", "Loading", "Error", "Empty"] as const;

test("core controls and their state rows are on /design", async ({ page }) => {
  await page.goto("/design");

  await expect(page.getByRole("link", { name: "Back", exact: true })).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Button", exact: true }).getByRole("button", { name: "Continue", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Input", exact: true }).getByRole("textbox", { name: "Email", exact: true }),
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

test("01-06 controls", async ({ page }) => {
  await page.goto("/design");

  await expect(page.getByRole("combobox", { name: "Where", exact: true }).first()).toBeVisible();
  await expect(page.getByText("No options to show", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Date range", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "When", exact: true }).first()).toBeVisible();
  await expect(page.getByText("Adults", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Children", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Infants", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Open modal", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show toast", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Chip", exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Mark", exact: true })).toBeVisible();

  const rows = ["Select", "Stepper", "Modal", "Toast", "Card", "Icons"] as const;
  const states = ["Hover", "Focus", "Disabled", "Loading", "Error", "Empty"] as const;
  for (const name of rows) {
    const section = page.getByRole("region", { name, exact: true });
    await expect(section).toBeVisible();
    for (const state of states) {
      await expect(section.getByText(state, { exact: true })).toBeVisible();
    }
    await expect(section.getByText("N/A", { exact: true }).first()).toBeVisible();
  }

  const dates = page.getByRole("region", { name: "Date range", exact: true });
  await expect(dates.getByText("day darkens", { exact: true })).toBeVisible();
  await expect(dates.getByText("teal ring on the day", { exact: true })).toBeVisible();
  await expect(dates.getByText("unpickable muted", { exact: true })).toBeVisible();
  await expect(dates.getByText("N/A", { exact: true }).first()).toBeVisible();
  await expect(dates.getByText("no range yet", { exact: true })).toBeVisible();
});

test("footer state rows", async ({ page }) => {
  await page.goto("/design");

  const footer = page.getByRole("contentinfo");
  await expect(footer.getByText("Enter an email as name@example.com.", { exact: true })).toBeVisible();
  await expect(footer.getByLabel("Email", { exact: true })).toHaveValue("");
  await expect(footer.getByPlaceholder("name@example.com")).toHaveValue("");

  const nav = page.getByRole("region", { name: "Nav", exact: true });
  for (const state of ["Disabled", "Loading", "Error", "Empty"]) {
    await expect(nav.getByText(state, { exact: true })).toBeVisible();
  }
  await expect(nav.getByText("N/A", { exact: true }).first()).toBeVisible();
  await expect(nav.getByText("link hover", { exact: true })).toBeVisible();
});

test("specimen state rows", async ({ page }) => {
  await page.goto("/design");

  const empty = page.getByRole("region", { name: "Empty stays", exact: true });
  await expect(empty.getByRole("heading", { name: "No stays for these dates", exact: true })).toBeVisible();
  await expect(empty.getByRole("button", { name: "Change dates", exact: true })).toHaveCount(1);

  const review = page.getByRole("region", { name: "Review", exact: true });
  await expect(review.getByRole("button", { name: "Pay", exact: true })).toBeVisible();
  await expect(review.getByRole("button", { name: "Try again", exact: true })).toHaveCount(0);

  const failed = page.getByRole("region", { name: "Payment failed", exact: true });
  await expect(failed.getByText("The payment did not go through.", { exact: true })).toBeVisible();
  await expect(failed.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(failed.getByRole("button", { name: "Pay", exact: true })).toHaveCount(0);

  await expect(page.getByText("Stay card skeleton", { exact: true })).toBeVisible();
  await expect(page.getByText("Add-on skeleton", { exact: true })).toBeVisible();
  await expect(page.getByText("Price skeleton lines", { exact: true })).toBeVisible();

  const breakdown = page.getByRole("button", { name: "Show breakdown", exact: true });
  await breakdown.focus();
  const outline = await breakdown.evaluate((node) => getComputedStyle(node).outlineStyle);
  expect(outline).not.toBe("none");
});
