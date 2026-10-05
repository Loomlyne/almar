import { expect, test, type Page } from "@playwright/test";

// Plan 02-24: the Continue page (harness scene auth-continue) at 390/834/1440, EN and AR.
// Assertions only; the layout is the shared frame the /login screenshots already cover.

const HEADING = { en: "One more step", ar: "خطوة أخيرة" } as const;
const LINE = { en: "Continue to sign in to ALMAR.", ar: "تابع لتسجيل الدخول إلى ALMAR." } as const;
const WHY = {
  en: "This link was opened in a different browser. To protect your account, type the email you used.",
  ar: "فُتح هذا الرابط في متصفح آخر. لحماية حسابك، اكتب البريد الإلكتروني الذي استخدمته.",
} as const;
const WRONG = { en: "This email does not match the link.", ar: "هذا البريد الإلكتروني لا يطابق الرابط." } as const;
const EMAIL_LABEL = { en: "Email", ar: "البريد الإلكتروني" } as const;
const BUTTON = { en: "Continue", ar: "متابعة" } as const;

async function open(page: Page, state: string, locale: "en" | "ar") {
  await page.goto(`/__harness?c=auth-continue&s=${state}&l=${locale}`);
  await page.waitForLoadState("networkidle");
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
}

for (const width of [390, 834, 1440]) {
  for (const locale of ["en", "ar"] as const) {
    test.describe(`${width}px ${locale}`, () => {
      test.use({ viewport: { width, height: 900 } });

      test("signed: heading, masked email in an LTR bdi, form with hidden token_hash and type", async ({ page }) => {
        await open(page, "signed", locale);
        await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING[locale]);
        const email = page.locator("main bdi[dir=ltr]", { hasText: "l•••@gmail.com" });
        await expect(email).toBeVisible();
        const form = page.locator("main form");
        await expect(form.locator('input[type=hidden][name=token_hash]')).toHaveValue("harness-token");
        await expect(form.locator('input[type=hidden][name=type]')).toHaveValue("magiclink");
        const button = form.getByRole("button", { name: BUTTON[locale] });
        await expect(button).toBeVisible();
        await expect(button).toHaveAttribute("type", "submit");
        await expect(form.getByRole("link").last()).toHaveAttribute("href", "/login");
      });

      test("no-email: the plain line and no email", async ({ page }) => {
        await open(page, "no-email", locale);
        await expect(page.getByRole("heading", { level: 1 })).toHaveText(HEADING[locale]);
        await expect(page.locator("main form p")).toHaveText(LINE[locale]);
        await expect(page.locator("main bdi[dir=ltr]")).toHaveCount(0);
        await expect(page.getByRole("button", { name: BUTTON[locale] })).toBeVisible();
        await expect(page.locator("main form input[name=email]")).toHaveCount(0);
      });

      test("signed: unchanged, no email field and no why line", async ({ page }) => {
        await open(page, "signed", locale);
        await expect(page.locator("main form input[name=email]")).toHaveCount(0);
        await expect(page.getByText(WHY[locale])).toHaveCount(0);
        await expect(page.locator("main form p")).toHaveCount(1);
      });

      test("email-ask: masked line, muted why line, LTR email field, no error", async ({ page }) => {
        await open(page, "email-ask", locale);
        await expect(page.locator("main bdi[dir=ltr]", { hasText: "l•••@gmail.com" })).toBeVisible();
        await expect(page.getByText(WHY[locale])).toBeVisible();
        const field = page.getByLabel(EMAIL_LABEL[locale]);
        await expect(field).toBeVisible();
        await expect(field).toHaveAttribute("name", "email");
        await expect(field).toHaveAttribute("type", "email");
        await expect(field).toHaveAttribute("dir", "ltr");
        await expect(field).toHaveAttribute("placeholder", "name@example.com");
        await expect(field).toHaveValue("");
        await expect(page.getByText(WRONG[locale])).toHaveCount(0);
        await expect(page.locator("main form").getByRole("button", { name: BUTTON[locale] })).toBeVisible();
        await expect(page.locator("main form").getByRole("link").last()).toHaveAttribute("href", "/login");
        await expect(page.locator('main form input[type=hidden][name=token_hash]')).toHaveValue("harness-token");
      });

      test("email-wrong: the error line sits under the field, the typed email stays", async ({ page }) => {
        await open(page, "email-wrong", locale);
        const field = page.getByLabel(EMAIL_LABEL[locale]);
        await expect(field).toHaveValue("lina@example.com");
        await expect(field).toHaveAttribute("dir", "ltr");
        await expect(field).toHaveAttribute("aria-invalid", "true");
        const error = page.getByText(WRONG[locale]);
        await expect(error).toBeVisible();
        const f = (await field.boundingBox())!;
        const e = (await error.boundingBox())!;
        expect(e.y).toBeGreaterThanOrEqual(f.y + f.height - 1);
        await expect(page.getByText(WHY[locale])).toBeVisible();
      });
    });
  }
}

// Plan 02-26 third review: the form's action is the server action itself, so it posts without JavaScript.
// The harness scenes mount on the client after hydration, so this uses the real server-rendered page. With no
// Supabase here the action does not complete (the response is not a success); the proof is the POST to the page.
test.describe("no JavaScript", () => {
  test.use({ javaScriptEnabled: false });

  test("the real /auth/confirm page posts the Continue form to the server action", async ({ page }) => {
    await page.goto(`/auth/confirm?token_hash=${"a".repeat(40)}&type=magiclink`);
    const form = page.locator("main form");
    await expect(form.getByRole("button", { name: BUTTON.en })).toBeVisible();
    // A server action form carries React's hidden action fields; a client function action renders none.
    await expect(form.locator('input[type=hidden][name^="$ACTION_"]').first()).toBeAttached();
    const posted = page.waitForResponse((response) => response.request().method() === "POST");
    await form.getByRole("button", { name: BUTTON.en }).click();
    const response = await posted;
    expect(response.url()).toContain("/auth/confirm");
    expect(response.status()).toBeLessThan(500);
    // No Supabase here: the action fails closed to the expired sign-in.
    await expect(page).toHaveURL(/\/login\?expired=1$/);
  });
});

// The same real page with JavaScript: the server action is reached (no Origin: null 500) and fails closed.
test("the real /auth/confirm page with JavaScript posts Continue and fails closed without Supabase", async ({ page }) => {
  await page.goto(`/auth/confirm?token_hash=${"a".repeat(40)}&type=magiclink`);
  const form = page.locator("main form");
  const posted = page.waitForResponse((response) => response.request().method() === "POST");
  await form.getByRole("button", { name: BUTTON.en }).click();
  const response = await posted;
  expect(response.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/login\?expired=1$/);
});
