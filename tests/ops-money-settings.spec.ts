import { expect, test, type Page } from "@playwright/test";
import { OPS_MONEY_COPY } from "../lib/copy/ops-money";

// Plan 04-09 Task 3: the Money Settings section is presentational. The picture scenes and the shoot were replaced by
// the signed HTML page (owner, 2026-10-25: no test, no shoot), so this spec holds the copy walk. The page-level
// asserts (exactly one button named exactly "Save", the section's own button named "Save bank transfer", bite check
// B12) are in tests/ops-settings.spec.ts. Task 8 adds the behaviour block below (mocked /api/ops/*; written, not run).

type Walk = Record<string, unknown>;

function leaves(value: unknown, path: string, out: [string, unknown][]): void {
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Walk)) leaves(child, path ? `${path}.${key}` : key, out);
  } else {
    out.push([path, value]);
  }
}

test("copy: same keys in en, ar and es at every depth, every leaf a non-empty string", () => {
  const base: [string, unknown][] = [];
  leaves(OPS_MONEY_COPY.en, "", base);
  const keys = base.map(([path]) => path).sort();
  for (const locale of ["en", "ar", "es"] as const) {
    const out: [string, unknown][] = [];
    leaves(OPS_MONEY_COPY[locale], "", out);
    expect(out.map(([path]) => path).sort(), `${locale} keys`).toEqual(keys);
    for (const [path, value] of out) {
      expect(typeof value, `${locale}.${path}`).toBe("string");
      expect((value as string).trim(), `${locale}.${path} empty`).not.toBe("");
      expect(value as string, `${locale}.${path}`).not.toMatch(/\[object|undefined|NaN/);
    }
  }
});

test("copy: the section's own button is never the bare word Save, and the confirm says no email is sent", () => {
  for (const locale of ["en", "ar", "es"] as const) {
    const copy = OPS_MONEY_COPY[locale];
    expect(copy.save).not.toBe("Save");
    expect(copy.confirm.noEmailNote.trim()).not.toBe("");
  }
});

// ------------------------------------------------------------------------------------------------------------
// Behaviour (Task 8): the real page at /dashboard/settings with /api/ops/settings, /api/ops/money, /api/ops/translate
// and /api/ops/site-status answered by page.route. Bodies are asserted from the log. Bracket text and the documentation
// IBAN / BIC only.
// ------------------------------------------------------------------------------------------------------------

type Locale = "en" | "ar" | "es";
type Bank = { account_name: string | null; bank_name: string | null; iban: string | null; swift: string | null; bank_address: string | null; note_en: string | null; note_ar: string | null; note_es: string | null };
type Money = { transfer_window_minutes: number | null; balance_due_days: number | null; bank: Bank; bank_complete: boolean; updated_at: string | null; updated_by: string | null };

const IBAN = "AE07 0331 2345 6789 0123 456";
const IBAN_WRONG = "AE07 0331 2345 6789 0123 457";
const BIC = "TESTAEAAXXX";
const EMPTY_BANK: Bank = { account_name: null, bank_name: null, iban: null, swift: null, bank_address: null, note_en: null, note_ar: null, note_es: null };
const EMPTY: Money = { transfer_window_minutes: null, balance_due_days: null, bank: EMPTY_BANK, bank_complete: false, updated_at: null, updated_by: null };
const FILLED: Money = {
  transfer_window_minutes: 2880,
  balance_due_days: 30,
  bank: { account_name: "[Account name]", bank_name: "[Bank]", iban: IBAN.replace(/ /g, ""), swift: BIC, bank_address: "[Bank address]", note_en: "[Note]", note_ar: "[ملاحظة]", note_es: "[Nota]" },
  bank_complete: true,
  updated_at: "2026-10-20T10:00:00.000Z",
  updated_by: null,
};
const SETTINGS = {
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

type Log = { money: unknown[]; translate: { target: string; fields: Record<string, string> }[] };

async function openMoney(
  page: Page,
  locale: Locale,
  start: Money,
  options: { moneyPost?: { status: number; body: unknown }; translateStatus?: number } = {},
): Promise<Log> {
  const log: Log = { money: [], translate: [] };
  let current = start;
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: page.url() === "about:blank" ? "http://127.0.0.1" : page.url() }]);
  await page.route("**/api/ops/site-status", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, site: { state: "up_to_date", requested_seq: 5, live_seq: 5, requested_at: "2026-10-13T10:02:00.000Z", built_at: "2026-10-13T10:05:00.000Z", last_hook_at: "2026-10-13T10:02:00.000Z", last_hook_result: "ok" } }) }),
  );
  await page.route(/\/api\/ops\/settings$/, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, settings: SETTINGS }) }));
  await page.route(/\/api\/ops\/translate$/, async (route) => {
    const body = route.request().postDataJSON() as { target: string; fields: Record<string, string> };
    log.translate.push(body);
    if (options.translateStatus && options.translateStatus !== 200) {
      await route.fulfill({ status: options.translateStatus, contentType: "application/json", body: JSON.stringify({ ok: false, error: { code: "translate_failed", field: null, locale: null, detail: null } }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, target: body.target, fields: { bank_note: body.target === "ar" ? "[ملاحظة جديدة]" : "[Nota nueva]" } }) });
  });
  await page.route(/\/api\/ops\/money$/, async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, money: current, terms_final: false }) });
      return;
    }
    const body = route.request().postDataJSON() as { transfer_window_minutes?: number | null; balance_due_days?: number | null; bank?: Partial<Bank> };
    log.money.push(body);
    if (options.moneyPost) {
      await route.fulfill({ status: options.moneyPost.status, contentType: "application/json", body: JSON.stringify(options.moneyPost.body) });
      return;
    }
    current = {
      ...current,
      transfer_window_minutes: body.transfer_window_minutes !== undefined ? body.transfer_window_minutes : current.transfer_window_minutes,
      balance_due_days: body.balance_due_days !== undefined ? body.balance_due_days : current.balance_due_days,
      bank: body.bank ? { ...current.bank, ...body.bank } : current.bank,
      updated_at: "2026-10-25T12:00:00.000Z",
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, money: current }) });
  });
  await page.goto("/dashboard/settings");
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.locator("[data-money-section]")).toBeVisible({ timeout: 30_000 });
  return log;
}

test.describe.configure({ mode: "parallel" });

for (const [locale, width] of [["en", 390], ["en", 1440], ["ar", 390], ["ar", 1440], ["es", 834]] as const) {
  test(`shows the saved values and no sideways scroll: ${locale} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openMoney(page, locale, FILLED);
    const copy = OPS_MONEY_COPY[locale];
    const section = page.locator("[data-money-section]");
    await expect(section.getByLabel(copy.balanceDue)).toHaveValue("30");
    await expect(section.getByLabel(copy.window)).toHaveValue("2");
    await expect(section.getByLabel(copy.accountName)).toHaveValue("[Account name]");
    await expect(section.getByLabel(copy.iban, { exact: true })).toHaveValue(IBAN.replace(/ /g, ""));
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}

test("empty values show empty fields and the readiness list says Not set", async ({ page }) => {
  const copy = OPS_MONEY_COPY.en;
  await openMoney(page, "en", EMPTY);
  const section = page.locator("[data-money-section]");
  await expect(section.getByLabel(copy.window)).toHaveValue("");
  await expect(section.getByLabel(copy.accountName)).toHaveValue("");
  await expect(section.getByText(copy.readiness.notSet)).toHaveCount(3);
});

test("a wrong IBAN digit, a 9-character BIC, a 30-minute window and 400 days keep the section Save off", async ({ page }) => {
  const copy = OPS_MONEY_COPY.en;
  await openMoney(page, "en", { ...FILLED, transfer_window_minutes: 30 });
  const section = page.locator("[data-money-section]");
  const save = section.getByRole("button", { name: copy.save, exact: true });
  await expect(section.getByText(copy.errors.windowRange)).toBeVisible();
  await expect(save).toBeDisabled();
  await section.getByLabel(copy.window).fill("2");
  await expect(section.getByText(copy.errors.windowRange)).toHaveCount(0);
  await section.getByLabel(copy.iban, { exact: true }).fill(IBAN_WRONG);
  await expect(section.getByText(copy.errors.checksum)).toBeVisible();
  await expect(save).toBeDisabled();
  await section.getByLabel(copy.iban, { exact: true }).fill(IBAN);
  await section.getByLabel(copy.swift).fill("TESTAEAAX");
  await expect(section.getByText(copy.errors.shape)).toBeVisible();
  await expect(save).toBeDisabled();
  await section.getByLabel(copy.swift).fill(BIC);
  await section.getByLabel(copy.balanceDue).fill("400");
  await expect(section.getByText(copy.errors.daysRange)).toBeVisible();
  await expect(save).toBeDisabled();
  // The page's bottom Save is its own button and is not affected.
  await expect(page.getByRole("button", { name: "Save", exact: true })).toHaveCount(1);
});

test("Save with only the balance days changed posts that one key and nothing else, with no confirm and no translate call", async ({ page }) => {
  const copy = OPS_MONEY_COPY.en;
  const log = await openMoney(page, "en", FILLED);
  const section = page.locator("[data-money-section]");
  await section.getByLabel(copy.balanceDue).fill("21");
  await section.getByRole("button", { name: copy.save, exact: true }).click();
  await expect(section.getByText(copy.saved)).toBeVisible();
  expect(log.money).toEqual([{ balance_due_days: 21 }]);
  expect(log.translate).toEqual([]);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a bank change opens the confirm with the account name and the IBAN in groups of four; only Save details posts", async ({ page }) => {
  const copy = OPS_MONEY_COPY.en;
  const log = await openMoney(page, "en", FILLED);
  const section = page.locator("[data-money-section]");
  await section.getByLabel(copy.accountName).fill("[Account name 2]");
  await section.getByRole("button", { name: copy.save, exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("[Account name 2]");
  await expect(dialog).toContainText(IBAN);
  expect(log.money).toEqual([]);
  await dialog.getByRole("button", { name: copy.confirm.back }).click();
  await expect(dialog).toHaveCount(0);
  expect(log.money).toEqual([]);
  await section.getByRole("button", { name: copy.save, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: copy.confirm.save }).click();
  await expect(section.getByText(copy.saved)).toBeVisible();
  expect(log.money).toHaveLength(1);
  expect((log.money[0] as { bank: Bank }).bank.account_name).toBe("[Account name 2]");
});

test("a changed English note asks the translator once per target with the note only, then posts the three lines", async ({ page }) => {
  const copy = OPS_MONEY_COPY.en;
  const log = await openMoney(page, "en", FILLED);
  const section = page.locator("[data-money-section]");
  await section.getByLabel(copy.note, { exact: true }).fill("[New note]");
  await section.getByRole("button", { name: copy.save, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: copy.confirm.save }).click();
  await expect(section.getByText(copy.saved)).toBeVisible();
  expect(log.translate.map((one) => one.target).sort()).toEqual(["ar", "es"]);
  for (const one of log.translate) expect(one.fields).toEqual({ bank_note: "[New note]" });
  const sent = JSON.stringify(log.translate);
  for (const secret of ["[Account name]", "[Bank]", "AE07", "TESTAEAAXXX", "[Bank address]"]) expect(sent).not.toContain(secret);
  const bank = (log.money[0] as { bank: Bank }).bank;
  expect(bank.note_en).toBe("[New note]");
  expect(bank.note_ar).toBe("[ملاحظة جديدة]");
  expect(bank.note_es).toBe("[Nota nueva]");
  await expect(section.getByText(copy.translations.updated)).toBeVisible();
});

test("a failed translation posts without note_ar and note_es and says they were not updated", async ({ page }) => {
  const copy = OPS_MONEY_COPY.en;
  const log = await openMoney(page, "en", FILLED, { translateStatus: 503 });
  const section = page.locator("[data-money-section]");
  await section.getByLabel(copy.note, { exact: true }).fill("[New note]");
  await section.getByRole("button", { name: copy.save, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: copy.confirm.save }).click();
  await expect(section.getByText(copy.translations.notUpdated)).toBeVisible();
  const bank = (log.money[0] as { bank: Record<string, unknown> }).bank;
  expect(bank.note_en).toBe("[New note]");
  expect("note_ar" in bank).toBe(false);
  expect("note_es" in bank).toBe(false);
});

test("an Arabic note typed under Edit translations is kept, not sent to the translator, and posted", async ({ page }) => {
  const copy = OPS_MONEY_COPY.en;
  const log = await openMoney(page, "en", FILLED);
  const section = page.locator("[data-money-section]");
  await section.getByLabel(copy.note, { exact: true }).fill("[New note]");
  await section.getByRole("button", { name: copy.editTranslations }).click();
  await section.getByLabel(`${copy.note} · ${copy.arabic}`).fill("[ملاحظة بخط اليد]");
  await section.getByRole("button", { name: copy.save, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: copy.confirm.save }).click();
  await expect(section.getByText(copy.saved)).toBeVisible();
  expect(log.translate.map((one) => one.target)).toEqual(["es"]);
  expect((log.money[0] as { bank: Bank }).bank.note_ar).toBe("[ملاحظة بخط اليد]");
});

test("a refused save keeps the form and says why with the field's sentence", async ({ page }) => {
  const copy = OPS_MONEY_COPY.en;
  await openMoney(page, "en", FILLED, {
    moneyPost: { status: 400, body: { ok: false, error: { code: "invalid", field: "bank.iban", locale: null, detail: null } } },
  });
  const section = page.locator("[data-money-section]");
  await section.getByLabel(copy.balanceDue).fill("21");
  await section.getByRole("button", { name: copy.save, exact: true }).click();
  await expect(section.getByText(copy.saveFailed)).toBeVisible();
  await expect(section.getByLabel(copy.balanceDue)).toHaveValue("21");
});

test("a link click with unsaved money changes asks Leave / Stay like the rest of the page", async ({ page }) => {
  const copy = OPS_MONEY_COPY.en;
  await page.setViewportSize({ width: 1440, height: 900 });
  await openMoney(page, "en", FILLED);
  await page.locator("[data-money-section]").getByLabel(copy.balanceDue).fill("21");
  await page.getByRole("link", { name: "Profile" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/settings$/);
});
