import { expect, test } from "@playwright/test";

test("tab reaches the eye, a button, and a checkbox with a visible focus ring", async ({
  page,
}) => {
  await page.goto("/design");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  const targets = {
    eye: page.getByRole("button", { name: /^(Show|Hide) password$/ }),
    button: page.getByRole("button", { name: "Continue", exact: true }),
    checkbox: page.getByRole("checkbox", { name: "Remember me", exact: true }),
  };
  const seen = new Set<string>();

  for (let step = 0; step < 40 && seen.size < 3; step += 1) {
    await page.keyboard.press("Tab");
    for (const [key, locator] of Object.entries(targets)) {
      if ((await locator.count()) !== 1) continue;
      const focused = await locator.evaluate((el) => el === document.activeElement);
      if (!focused) continue;
      const outlineStyle = await locator.evaluate(
        (el) => getComputedStyle(el).outlineStyle,
      );
      expect(outlineStyle).not.toBe("none");
      const name = await locator.evaluate((el) => {
        const labelled = el.getAttribute("aria-label");
        return labelled || (el.textContent ?? "").trim();
      });
      if (key === "eye") {
        expect(name).toMatch(/^(Show|Hide) password$/);
      }
      seen.add(key);
    }
  }

  expect([...seen].sort()).toEqual(["button", "checkbox", "eye"]);
});

test("date field error sits under the label", async ({ page }) => {
  await page.goto("/design");
  const field = page.getByRole("textbox", { name: "Date", exact: true });
  await expect(field).toHaveAttribute("aria-invalid", "true");
  const describedBy = await field.getAttribute("aria-describedby");
  expect(describedBy).toBeTruthy();
  const error = page.locator(`[id="${describedBy}"]`);
  await expect(error).toHaveText("Enter a date as DD/MM/YYYY.");
  const label = page.locator("label").filter({ hasText: "Date" });
  const labelBox = await label.boundingBox();
  const errorBox = await error.boundingBox();
  expect(labelBox).not.toBeNull();
  expect(errorBox).not.toBeNull();
  expect(errorBox!.y).toBeGreaterThan(labelBox!.y);
});
