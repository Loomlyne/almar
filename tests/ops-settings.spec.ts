import { expect, test, type Page, type Route } from "@playwright/test";
import { OPS_SETTINGS_COPY } from "../lib/copy/ops-settings";

// Plan 02-06: the Settings screen on /dashboard/settings (next dev renders it in the preview shell without a session).
// Every /api/ops/settings call is answered by page.route below: no database. The values come from the fixture, so the
// screen shows whatever the row holds (never a hard-coded 5.00 / 30.00 or a typed rate).

type Locale = "en" | "ar" | "es";

const VIEW = {
  colors: { teal: "#1f3b40", charcoal: "#262626", gold: "#d4ba8a", ivory: "#fffaf0", white: "#ffffff" },
  title_face: "Questa",
  body_face: "Lato",
  vat_percent: "4.25",
  deposit_percent: "25.00",
  maintenance: false,
  logo: null,
  locale: "en",
  currency: "AED",
  fx: { aed: 3.67, eur: 0.9, date: "2026-10-13" },
};

async function open(page: Page, locale: Locale, view: Record<string, unknown> = VIEW, onPost?: (body: unknown, route: Route) => Promise<void>) {
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: page.url() === "about:blank" ? "http://127.0.0.1" : page.url() }]);
  // The page also loads the Bank transfer section and the site status line: both answered, so no 403 sends it to sign-in.
  await page.route(/\/api\/ops\/money$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        money: {
          transfer_window_minutes: null,
          balance_due_days: null,
          bank: { account_name: null, bank_name: null, iban: null, swift: null, bank_address: null, note_en: null, note_ar: null, note_es: null },
          bank_complete: false,
          updated_at: null,
          updated_by: null,
        },
        terms_final: false,
      }),
    }),
  );
  await page.route("**/api/ops/site-status", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, site: { state: "up_to_date", requested_seq: 5, live_seq: 5, requested_at: "2026-10-13T10:02:00.000Z", built_at: "2026-10-13T10:05:00.000Z", last_hook_at: "2026-10-13T10:02:00.000Z", last_hook_result: "ok" } }) }),
  );
  await page.route(/\/api\/ops\/settings$/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, settings: view }) });
      return;
    }
    const body = route.request().postDataJSON();
    if (onPost) await onPost(body, route);
    else await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, affects_site: true }) });
  });
  await page.goto("/dashboard/settings");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.getByLabel(OPS_SETTINGS_COPY[locale].vat)).toBeVisible({ timeout: 30_000 });
}

test.describe.configure({ mode: "parallel" });

for (const locale of ["en", "ar", "es"] as const) {
  for (const width of [390, 834, 1440]) {
    test(`renders from the row, no sideways scroll: ${locale} ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await open(page, locale);
      const copy = OPS_SETTINGS_COPY[locale];
      await expect(page.getByLabel(copy.vat)).toHaveValue("4.25");
      await expect(page.getByLabel(copy.deposit)).toHaveValue("25.00");
      await expect(page.getByText("USD/AED 3.67")).toBeVisible();
      await expect(page.getByRole("checkbox", { name: copy.maintenanceOn })).not.toBeChecked();
      await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
    });
  }
}

test("no FX row: a plain line, no input", async ({ page }) => {
  await open(page, "en", { ...VIEW, fx: null });
  await expect(page.getByText(OPS_SETTINGS_COPY.en.fxNone)).toBeVisible();
  await expect(page.locator('input[name*="rate" i]')).toHaveCount(0);
});

test("Save: disabled until a change; contrast and decimals block it; saved line stays until the next edit", async ({ page }) => {
  const copy = OPS_SETTINGS_COPY.en;
  let posted: Record<string, unknown> | null = null;
  await open(page, "en", VIEW, async (body, route) => {
    posted = body as Record<string, unknown>;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, affects_site: true }) });
  });
  const save = page.getByRole("button", { name: "Save", exact: true });
  await expect(save).toBeDisabled();

  await page.getByLabel(copy.colors.teal).fill("#9fb8bb");
  await expect(page.getByText(copy.contrast)).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByLabel(copy.colors.teal).fill("#1f3b40");
  await expect(page.getByText(copy.contrast)).toHaveCount(0);

  await page.getByLabel(copy.vat).fill("5.125");
  await expect(page.getByText(copy.twoDecimals)).toBeVisible();
  await expect(save).toBeDisabled();
  await page.getByLabel(copy.vat).fill("5");

  await page.getByRole("checkbox", { name: copy.maintenanceOn }).check();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(save.locator("..").getByRole("status")).toHaveText(copy.saved);
  await expect(save).toBeDisabled();
  expect(posted).toMatchObject({ maintenance: true, vat_percent: "5", deposit_percent: "25.00", title_face: "Questa", body_face: "Lato" });
  await expect(page.getByLabel(copy.vat)).toHaveValue("5.00");

  await page.getByLabel(copy.deposit).fill("30");
  await expect(page.getByText(copy.saved)).toHaveCount(0);
});

test("a refused save keeps the form and says so; a refused logo shows its line", async ({ page }) => {
  const copy = OPS_SETTINGS_COPY.en;
  await open(page, "en", VIEW, async (_body, route) => {
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ ok: false, error: { code: "invalid", field: "logo_media_id", locale: null, detail: null } }),
    });
  });
  await page.getByRole("checkbox", { name: copy.maintenanceOn }).check();
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(copy.saveFailed)).toBeVisible();
  await expect(page.getByText(copy.logoRefused)).toBeVisible();
  await expect(page.getByRole("checkbox", { name: copy.maintenanceOn })).toBeChecked();
});

test("a saved logo: Remove logo empties the well and Save waits for a replacement", async ({ page }) => {
  const copy = OPS_SETTINGS_COPY.en;
  const logo = { id: "11111111-1111-4111-8111-111111111111", key: "brand/l.png", url: "https://media.almarprivatejourney.com/brand/l.png", width: 512, height: 512, bytes: 2048, content_type: "image/png" };
  await page.route("https://media.almarprivatejourney.com/**", (route) => route.fulfill({ status: 404 }));
  await open(page, "en", { ...VIEW, logo });
  await page.getByRole("button", { name: copy.removeLogo }).click();
  await expect(page.getByRole("button", { name: copy.removeLogo })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Save", exact: true })).toBeDisabled();
});

test("leaving with unsaved changes asks: Stay keeps the page, Leave goes", async ({ page }) => {
  const copy = OPS_SETTINGS_COPY.en;
  await page.setViewportSize({ width: 1440, height: 900 });
  await open(page, "en");
  await page.getByRole("checkbox", { name: copy.maintenanceOn }).check();
  await page.getByRole("link", { name: "Profile" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: copy.stay }).click();
  await expect(page).toHaveURL(/\/dashboard\/settings$/);
  await page.getByRole("link", { name: "Profile" }).click();
  await page.getByRole("dialog").getByRole("button", { name: copy.leave }).click();
  await expect(page).toHaveURL(/\/dashboard\/profile$/);
});

// B12: the Bank transfer section has its own button, so the page's bottom Save is the only button named exactly "Save".
test("exactly one button is named Save; the Bank transfer section's own button is named differently", async ({ page }) => {
  await open(page, "en");
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Save bank transfer", exact: true })).toHaveCount(1);
});
