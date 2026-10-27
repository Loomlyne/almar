import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type FrameLocator, type Page } from "@playwright/test";
import { BOOKING_EMAIL_COPY, OWNER_EMAIL_COPY } from "../lib/copy/booking-email";
import { formatAed } from "../lib/money/format";
import { formatIban } from "../lib/booking/bank";
import { FIXTURE_IBAN, FIXTURE_REF, requestJobFixture } from "./helpers/booking-view-fixtures";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// Plan 04-05 Task 1: the booking emails on their harness scene (tests/journey/scenes/booking-emails.tsx), each the real
// renderer's html in a sandboxed iframe. Two blocks: a copy test (runs everywhere), and the pictures (only when
// BOOKING_EMAILS_PICTURES is set). Nothing here sends a mail or calls a route.

type Locale = "en" | "ar" | "es";

const LOCALES: Locale[] = ["en", "ar", "es"];
const harnessUrl = (state: string, locale: string) => `/__harness?c=booking-emails&s=${state}&l=${locale}`;
const OWNER_STATES = new Set(["request-owner", "payment-owner", "payment-owner-deadline", "withdrawn-owner"]);
/** The neutral receipt (E-10) drops the intro and the total: its body carries no reference (the subject does). */
const NO_REFERENCE_IN_BODY = new Set(["receipt-after-expiry"]);
const TEAL = "rgb(31, 59, 64)";
const IBAN_SHOWN = formatIban(FIXTURE_IBAN);

// ---- copy ---------------------------------------------------------------------------------------------------------

function leaves(value: unknown, path = ""): [string, unknown][] {
  if (typeof value === "string") return [[path, value]];
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) => leaves(v, path ? `${path}.${k}` : k));
  }
  return [[path, value]];
}

function keyTree(value: unknown): unknown {
  if (typeof value === "string") return "s";
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.other === "string") return "plural";
    return Object.fromEntries(Object.keys(record).sort().map((k) => [k, keyTree(record[k])]));
  }
  return typeof value;
}

test("copy: the guest email words have the same keys in en, ar and es; every label a clean non-empty string", () => {
  const en = keyTree(BOOKING_EMAIL_COPY.en);
  for (const locale of LOCALES) {
    expect(keyTree(BOOKING_EMAIL_COPY[locale]), `${locale} keys`).toEqual(en);
    for (const [path, value] of leaves(BOOKING_EMAIL_COPY[locale])) {
      expect(typeof value, `${locale}.${path}`).toBe("string");
      expect((value as string).trim(), `${locale}.${path} empty`).not.toBe("");
      expect(value as string, `${locale}.${path}`).not.toMatch(/\[object|undefined|NaN/);
    }
  }
  for (const [path, value] of leaves(OWNER_EMAIL_COPY)) {
    expect(typeof value, `owner.${path}`).toBe("string");
    expect((value as string).trim(), `owner.${path} empty`).not.toBe("");
    expect(value as string, `owner.${path}`).not.toMatch(/\[object|undefined|NaN/);
  }
});

// ---- pictures -----------------------------------------------------------------------------------------------------
// Full-page PNGs (page.screenshot, not toHaveScreenshot: no baseline under tests/). Every state x 390/834/1440 x en/ar/es.
// BOOKING_EMAILS_PICTURES=1 writes into test-results/04-05-pictures/ (outside tests/ and .planning while next dev runs:
// a write there recompiles dev mid-capture); an absolute folder writes there. After the server stops, the controller
// copies the PNGs into .planning/phases/04-book-and-pay/pictures/04-05/ and checks each is above 10 KB.

const PICTURES_DEFAULT = join(__dirname, "..", "test-results", "04-05-pictures");
const PICTURES_TO = process.env.BOOKING_EMAILS_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : PICTURES_DEFAULT;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];

async function openScene(page: Page, state: string, viewport: Viewport, locale: Locale): Promise<FrameLocator> {
  await page.setViewportSize(VIEWPORTS[viewport]);
  // The dev server can answer 500 once while webpack rewrites a manifest: load the scene again.
  const first = await page.goto(harnessUrl(state, locale));
  if (!first || first.status() >= 500) await page.goto(harnessUrl(state, locale));
  await settle(page);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
  // The frame has loaded and the scene has set its height from the document.
  await expect(page.locator("iframe[data-email][data-height]")).toHaveCount(1, { timeout: 30_000 });
  return page.frameLocator("iframe[data-email]");
}

test.describe("pictures", () => {
  test.skip(!PICTURES_TO, "set BOOKING_EMAILS_PICTURES=1 (or an absolute folder) to shoot the pictures");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("booking-emails")) {
    for (const viewport of WIDTHS) {
      for (const locale of LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          const frame = await openScene(page, state, viewport, locale);
          const iframe = page.locator("iframe[data-email]");
          const html = frame.locator("html");
          const body = (await frame.locator("body").innerText()) ?? "";
          const source = await html.evaluate((el) => el.outerHTML);
          const c = BOOKING_EMAIL_COPY[locale];
          const owner = OWNER_STATES.has(state);

          // The reference: always in the subject (the frame title), in the body except the neutral receipt.
          await expect(iframe).toHaveAttribute("title", new RegExp(FIXTURE_REF));
          if (!NO_REFERENCE_IN_BODY.has(state)) expect(body, "reference in the body").toContain(FIXTURE_REF);

          if (owner) {
            // E-11 = A: the English notice, left to right, whatever the booking's language.
            await expect(html).toHaveAttribute("lang", "en");
            await expect(html).toHaveAttribute("dir", "ltr");
            expect(body, "no IBAN in an owner notice").not.toContain(IBAN_SHOWN);
            expect(source, "no IBAN in an owner notice").not.toContain(FIXTURE_IBAN);
            expect(source, "no link token in an owner notice").not.toMatch(/[?&](amp;)?t=/);
          } else {
            await expect(html).toHaveAttribute("lang", locale);
            await expect(html).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
          }

          if (state === "withdrawn-owner") {
            expect(body).toContain(OWNER_EMAIL_COPY.withdrawn.line);
            const links = await frame.locator("a[href]").evaluateAll((els) => els.map((el) => el.getAttribute("href") ?? ""));
            expect(links.some((href) => href.endsWith("/bookings/detail?ref=ALMAR-TEST22")), "dashboard link").toBe(true);
          }
          if (state === "request-received") {
            const transfer = requestJobFixture(locale, { plan: "deposit" }).view.transfer;
            expect(body).toContain(IBAN_SHOWN);
            if (transfer) expect(body).toContain(formatAed(transfer.amountFils));
            expect(body).toContain(c.transfer.reply);
            expect(body).toContain(c.transfer.fees);
          }
          if (state === "request-received-test") {
            expect(body).toContain(c.testBanner);
            await expect(iframe).toHaveAttribute("title", /^\[TEST\] /);
          }
          if (state === "receipt-written-off") {
            expect(body).toContain(c.paymentReceipt.acceptedAsPaid);
            expect(body).toContain(c.paymentReceipt.nothingMoreDue);
          }
          if (state === "receipt-overpaid") expect(body).toContain(c.paymentReceipt.overpaid);
          if (state === "receipt-after-expiry") {
            expect(body).toContain(c.paymentReceipt.moneyOnClosed.split("{amount}")[0].trim());
            expect(body).not.toContain(IBAN_SHOWN);
            expect(body).not.toContain(c.paymentReceipt.nothingMoreDue);
          }

          // The button: a square Teal fill (every state has one except the receipt without a booking link).
          const button = frame.locator('a[style*="background"]');
          if (state === "receipt-no-link") {
            await expect(button).toHaveCount(0);
            expect(body).toContain(c.paymentReceipt.noLink);
          } else {
            await expect(button).toHaveCount(1);
            const look = await button.evaluate((el) => {
              const s = getComputedStyle(el);
              return { background: s.backgroundColor, radius: s.borderTopLeftRadius };
            });
            expect(look.background, "Teal fill").toBe(TEAL);
            expect(look.radius, "square corners").toBe("0px");
          }

          // The picture must show strings, never an object, undefined or NaN printed by mistake.
          expect(body, "no [object] in the email").not.toMatch(/\[object|undefined|NaN/);
          const outer = (await page.locator("body").innerText()) ?? "";
          expect(outer, "no [object] in the scene").not.toMatch(/\[object|undefined|NaN/);

          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await page.waitForTimeout(300);
          await page.screenshot({ path: join(PICTURES, `${state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});
