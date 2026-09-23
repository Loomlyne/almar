import { expect, test } from "@playwright/test";

test("tab reaches the eye, a button, and a checkbox with a visible focus ring", async ({
  page,
}) => {
  await page.goto("/design");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();

  const targets = {
    eye: page.getByRole("region", { name: "Password", exact: true }).getByRole("button", { name: /^(Show|Hide) password$/ }),
    button: page.getByRole("region", { name: "Button", exact: true }).getByRole("button", { name: "Continue", exact: true }),
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

test("tab reaches the modal trigger and an icon uses currentColor", async ({ page }) => {
  await page.goto("/design");
  const trigger = page.getByRole("button", { name: "Open modal", exact: true });
  await expect(trigger).toHaveCount(1);

  for (let step = 0; step < 60; step += 1) {
    await page.keyboard.press("Tab");
    const focused = await trigger.evaluate((el) => el === document.activeElement);
    if (!focused) continue;
    const outlineStyle = await trigger.evaluate((el) => getComputedStyle(el).outlineStyle);
    expect(outlineStyle).not.toBe("none");
    break;
  }
  await expect(trigger).toBeFocused();

  const usesCurrentColor = await page.locator("svg").evaluateAll((nodes) =>
    nodes.some((node) => {
      const markup = node.outerHTML;
      return markup.includes("currentColor");
    }),
  );
  expect(usesCurrentColor).toBe(true);

  const sources = await page.locator("img").evaluateAll((nodes) =>
    nodes.map((node) => node.getAttribute("src") ?? ""),
  );
  for (const src of sources) {
    expect(src.endsWith(".jpg") && src.includes("Icons-")).toBe(false);
  }
});

test("stay alt stays English", async ({ page }) => {
  await page.goto("/design");
  const stay = page.getByRole("img", { name: "Sample stay in Cartagena" });
  await expect(stay.first()).toHaveAttribute("alt", "Sample stay in Cartagena");
  await page.getByRole("button", { name: "AR", exact: true }).first().click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(stay.first()).toHaveAttribute("alt", "Sample stay in Cartagena");
  await expect(page.getByRole("button", { name: /^(Play|Pause) video$/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Save this stay", exact: true })).toBeVisible();
});
