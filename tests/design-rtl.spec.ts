import { expect, test } from "@playwright/test";

test("Arabic preview sets html dir and keeps the eye on the inline end", async ({
  page,
}) => {
  await page.goto("/design");

  const html = page.locator("html");
  const field = page.getByRole("textbox", { name: "Password", exact: true });
  const eye = page.getByRole("button", { name: /^(Show|Hide) password$/ });

  await expect(eye).toHaveAccessibleName(/^(Show|Hide) password$/);

  const fieldLtr = await field.boundingBox();
  const eyeLtr = await eye.boundingBox();
  expect(fieldLtr).not.toBeNull();
  expect(eyeLtr).not.toBeNull();
  expect(eyeLtr!.x + eyeLtr!.width / 2).toBeGreaterThan(
    fieldLtr!.x + fieldLtr!.width / 2,
  );

  await page.getByRole("button", { name: "AR", exact: true }).click();
  await expect(html).toHaveAttribute("dir", "rtl");
  await expect(html).toHaveAttribute("lang", "ar");

  const fieldRtl = await field.boundingBox();
  const eyeRtl = await eye.boundingBox();
  expect(fieldRtl).not.toBeNull();
  expect(eyeRtl).not.toBeNull();
  expect(eyeRtl!.x + eyeRtl!.width / 2).toBeLessThan(
    fieldRtl!.x + fieldRtl!.width / 2,
  );

  await page.getByRole("button", { name: "EN", exact: true }).click();
  await expect(html).toHaveAttribute("dir", "ltr");
  await expect(html).toHaveAttribute("lang", "en");

  await page.getByRole("button", { name: "ES", exact: true }).click();
  await expect(html).toHaveAttribute("dir", "ltr");
  await expect(html).toHaveAttribute("lang", "es");
});
