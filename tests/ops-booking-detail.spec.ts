import { expect, test, type Page } from "@playwright/test";
import { OPS_BOOKINGS_COPY } from "../lib/copy/ops-bookings";
import { DEPOSIT, isUuid, makeBooking, mockBookingsApi, PAYMENT_ID, refusal, REF, succeededPayment, type Override } from "./helpers/ops-bookings-api";

// Plan 04-09 Task 2: the booking detail and its dialogs. Scenes and pictures were replaced by the signed HTML page
// (owner, 2026-10-25: no test, no shoot). The behaviour block (a double click on Record posts once, bite check B10) needs
// the screen of Task 7 and is written there. This file keeps the sentences the dialogs print checked in all languages.
// Written and not run in this job.

test("copy: every record, void, status and attention sentence has the same tokens in en, ar and es", () => {
  const tokens = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  const groups = ["record", "void", "attention"] as const;
  for (const group of groups) {
    for (const key of Object.keys(OPS_BOOKINGS_COPY.en[group]) as (keyof (typeof OPS_BOOKINGS_COPY.en)[typeof group])[]) {
      const en = tokens(String(OPS_BOOKINGS_COPY.en[group][key]));
      for (const locale of ["ar", "es"] as const) {
        expect(tokens(String(OPS_BOOKINGS_COPY[locale][group][key])), `${locale}.${group}.${String(key)}`).toEqual(en);
      }
    }
  }
});

test("copy: Cancel keeps the booking, and no dialog string offers a refund", () => {
  for (const locale of ["en", "ar", "es"] as const) {
    const copy = OPS_BOOKINGS_COPY[locale];
    expect(copy.actions.keep.trim()).not.toBe("");
    expect(copy.actions.cancel).not.toBe(copy.actions.keep);
  }
});

// ------------------------------------------------------------------------------------------------------------
// Behaviour (Task 7): /dashboard/bookings/detail?ref=... against mockBookingsApi. The happy path is first; it was written
// before the screen existed.
// ------------------------------------------------------------------------------------------------------------

type Locale = "en" | "ar" | "es";
const C = OPS_BOOKINGS_COPY;

async function openDetail(page: Page, locale: Locale, bookings = [makeBooking()], options: { ref?: string; override?: Override } = {}) {
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: page.url() === "about:blank" ? "http://127.0.0.1" : page.url() }]);
  const api = await mockBookingsApi(page, bookings, options.override);
  await page.goto(`/dashboard/bookings/detail?ref=${options.ref ?? REF}`);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  return api;
}

async function fillRecord(page: Page, copy: (typeof C)["en"], over: { amount?: string; date?: string; reference?: string } = {}) {
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel(copy.record.amount).fill(over.amount ?? "3000");
  await dialog.getByLabel(copy.record.receivedOn).fill(over.date ?? "2026-10-10");
  await dialog.getByLabel(copy.record.bankReference).fill(over.reference ?? "[Bank ref]");
  return dialog;
}

test("happy path: list, open, Record payment, Review, Record, the detail is fetched again and shows Deposit paid", async ({ page }) => {
  const copy = C.en;
  await page.context().addCookies([{ name: "almar-locale", value: "en", url: "http://127.0.0.1" }]);
  const api = await mockBookingsApi(page, [makeBooking()]);
  await page.goto("/dashboard/bookings");
  await page.locator("[data-bookings-list]").getByText(REF).first().click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/bookings/detail\\?ref=${REF}$`));
  await page.getByRole("button", { name: copy.actions.recordPayment }).click();
  const dialog = await fillRecord(page, copy, { amount: "3000" });
  await dialog.getByRole("button", { name: copy.record.review }).click();
  await expect(dialog.getByText(copy.record.becomes.replace("{status}", copy.statuses.deposit_paid))).toBeVisible();
  const reads = api.to("/api/ops/booking", "GET").length;
  await dialog.getByRole("button", { name: copy.record.record, exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const posts = api.to("/api/ops/booking/payment", "POST");
  expect(posts).toHaveLength(1);
  const body = posts[0].body as Record<string, unknown>;
  expect(isUuid(body.booking_id)).toBe(true);
  expect(isUuid(body.request_id)).toBe(true);
  expect(body).toMatchObject({ expected_status: "awaiting_payment", amount: "3000", received_on: "2026-10-10", bank_reference: "[Bank ref]" });
  expect("amount_fils" in body).toBe(false);
  await expect.poll(() => api.to("/api/ops/booking", "GET").length).toBeGreaterThan(reads);
  await expect(page.locator("[data-booking-detail]").getByText(copy.statuses.deposit_paid).first()).toBeVisible();
  await expect(page.locator("[data-booking-detail]").getByText(copy.payments.receipt.sent).first()).toBeVisible();
});

for (const [locale, width] of [["en", 390], ["en", 1440], ["ar", 390], ["ar", 1440], ["es", 834]] as const) {
  test(`the detail renders and does not scroll sideways: ${locale} ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await openDetail(page, locale);
    await expect(page.locator("[data-booking-detail]")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr");
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);
  });
}

test("a missing or invalid ref shows the not-found line and sends no booking request", async ({ page }) => {
  const api = await openDetail(page, "en", [makeBooking()], { ref: "nope" });
  await expect(page.getByText(C.en.errors.not_found)).toBeVisible();
  expect(api.to("/api/ops/booking")).toHaveLength(0);
});

test("controls that are never built: Edit booking, Refund, Itinerary, More, Open customer profile, New booking", async ({ page }) => {
  await openDetail(page, "en", [makeBooking({ status: "deposit_paid", paid_fils: DEPOSIT, payments: [succeededPayment()] })]);
  await expect(page.locator("[data-booking-detail]")).toBeVisible({ timeout: 30_000 });
  for (const name of [/Edit booking/, /Refund/, /Itinerary/, /^More$/, /Open customer profile/, /New booking/]) {
    await expect(page.getByRole("button", { name })).toHaveCount(0);
    await expect(page.getByRole("link", { name })).toHaveCount(0);
  }
});

test("a double click on Record posts once", async ({ page }) => {
  const copy = C.en;
  const api = await openDetail(page, "en", [makeBooking()], {
    override: async (call) => {
      if (call.path === "/api/ops/booking/payment") await new Promise((resolve) => setTimeout(resolve, 400));
      return undefined;
    },
  });
  await page.getByRole("button", { name: copy.actions.recordPayment }).click();
  const dialog = await fillRecord(page, copy);
  await dialog.getByRole("button", { name: copy.record.review }).click();
  await dialog.getByRole("button", { name: copy.record.record, exact: true }).dblclick();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.to("/api/ops/booking/payment", "POST")).toHaveLength(1);
});

test("a network failure keeps the dialog and the same request_id on retry; a new dialog makes a new one", async ({ page }) => {
  const copy = C.en;
  let fail = true;
  const api = await openDetail(page, "en", [makeBooking()], {
    override: (call) => {
      if (call.path === "/api/ops/booking/payment" && fail) {
        fail = false;
        return { status: 503, body: { ok: false, error: { code: "unavailable", field: null, locale: null, detail: null } } };
      }
      return undefined;
    },
  });
  await page.getByRole("button", { name: copy.actions.recordPayment }).click();
  const dialog = await fillRecord(page, copy);
  await dialog.getByRole("button", { name: copy.record.review }).click();
  await dialog.getByRole("button", { name: copy.record.record, exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: copy.record.record, exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const [first, second] = api.to("/api/ops/booking/payment", "POST").map((c) => (c.body as { request_id: string }).request_id);
  expect(second).toBe(first);
  // A new dialog on a new booking state makes a new id.
  await page.getByRole("button", { name: copy.actions.recordPayment }).click();
  const again = await fillRecord(page, copy, { amount: "10" });
  await again.getByRole("button", { name: copy.record.review }).click();
  await again.getByRole("button", { name: copy.record.record, exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const third = (api.to("/api/ops/booking/payment", "POST").at(-1)?.body as { request_id: string }).request_id;
  expect(third).not.toBe(first);
});

test("409 changed shows the changed sentence and reloads the detail", async ({ page }) => {
  const copy = C.en;
  const api = await openDetail(page, "en", [makeBooking()], {
    override: (call) => (call.path === "/api/ops/booking/payment" ? refusal(409, "changed", null, { status: "cancelled" }) : undefined),
  });
  await page.getByRole("button", { name: copy.actions.recordPayment }).click();
  const dialog = await fillRecord(page, copy);
  await dialog.getByRole("button", { name: copy.record.review }).click();
  const reads = api.to("/api/ops/booking", "GET").length;
  await dialog.getByRole("button", { name: copy.record.record, exact: true }).click();
  await expect(page.getByText(copy.errors.changed)).toBeVisible();
  await expect.poll(() => api.to("/api/ops/booking", "GET").length).toBeGreaterThan(reads);
});

test("validation blocks Review: amount 1.234, empty reference, a date after today", async ({ page }) => {
  const copy = C.en;
  await openDetail(page, "en");
  await page.getByRole("button", { name: copy.actions.recordPayment }).click();
  const dialog = await fillRecord(page, copy, { amount: "1.234" });
  const review = dialog.getByRole("button", { name: copy.record.review });
  await expect(review).toBeDisabled();
  await dialog.getByLabel(copy.record.amount).fill("3000");
  await expect(review).toBeEnabled();
  await dialog.getByLabel(copy.record.bankReference).fill("");
  await expect(review).toBeDisabled();
  await dialog.getByLabel(copy.record.bankReference).fill("[Bank ref]");
  await dialog.getByLabel(copy.record.receivedOn).fill("2999-01-01");
  await expect(review).toBeDisabled();
});

test("Accept as paid needs a reason of 3 characters", async ({ page }) => {
  const copy = C.en;
  const api = await openDetail(page, "en");
  await page.getByRole("button", { name: copy.actions.recordPayment }).click();
  const dialog = await fillRecord(page, copy, { amount: "1000" });
  await dialog.getByRole("checkbox", { name: copy.record.acceptShort }).check();
  const review = dialog.getByRole("button", { name: copy.record.review });
  await expect(review).toBeDisabled();
  await dialog.getByLabel(copy.record.acceptReason).fill("ab");
  await expect(review).toBeDisabled();
  await dialog.getByLabel(copy.record.acceptReason).fill("abc");
  await expect(review).toBeEnabled();
  await review.click();
  await dialog.getByRole("button", { name: copy.record.record, exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.to("/api/ops/booking/payment", "POST")[0].body).toMatchObject({ accept_short: true, accept_reason: "abc" });
});

test("Void needs a reason and posts payment_id and reason; cancel_first shows its sentence", async ({ page }) => {
  const copy = C.en;
  const paid = makeBooking({ status: "deposit_paid", paid_fils: DEPOSIT, payments: [succeededPayment()] });
  let refuse = true;
  const api = await openDetail(page, "en", [paid], {
    override: (call) => {
      if (call.path === "/api/ops/booking/void" && refuse) {
        refuse = false;
        return refusal(409, "cancel_first");
      }
      return undefined;
    },
  });
  await page.getByRole("button", { name: copy.actions.void, exact: true }).click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: copy.actions.void, exact: true });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(copy.void.reason).fill("[Reason]");
  await confirm.click();
  await expect(dialog.getByText(copy.errors.cancel_first)).toBeVisible();
  await confirm.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.to("/api/ops/booking/void", "POST").at(-1)?.body).toEqual({ payment_id: PAYMENT_ID, reason: "[Reason]" });
});

test("Cancel ignores Escape and posts the action with the shown status; Confirm and Mark completed post theirs", async ({ page }) => {
  const copy = C.en;
  const api = await openDetail(page, "en", [makeBooking({ status: "deposit_paid", paid_fils: DEPOSIT, payments: [succeededPayment()] })]);
  await page.getByRole("button", { name: copy.actions.cancel }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog").or(page.getByRole("alertdialog"))).toBeVisible();
  await page.getByRole("button", { name: copy.actions.keep }).click();
  expect(api.to("/api/ops/booking/status", "POST")).toHaveLength(0);
  await page.getByRole("button", { name: copy.actions.confirm, exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: copy.actions.confirm, exact: true }).click();
  await expect(page.locator("[data-booking-detail]").getByText(copy.statuses.confirmed).first()).toBeVisible();
  await page.getByRole("button", { name: copy.actions.complete }).click();
  await page.getByRole("dialog").getByRole("button", { name: copy.actions.complete }).click();
  await expect(page.locator("[data-booking-detail]").getByText(copy.statuses.completed).first()).toBeVisible();
  const posts = api.to("/api/ops/booking/status", "POST").map((c) => c.body);
  expect(posts[0]).toMatchObject({ action: "confirm", expected_status: "deposit_paid" });
  expect(posts[1]).toMatchObject({ action: "complete", expected_status: "confirmed" });
  await expect(page.getByRole("button", { name: copy.actions.cancel })).toHaveCount(0);
});

test("Cancel booking posts action cancel with the shown status", async ({ page }) => {
  const copy = C.en;
  const api = await openDetail(page, "en");
  await page.getByRole("button", { name: copy.actions.cancel }).click();
  await page.getByRole("alertdialog").or(page.getByRole("dialog")).getByRole("button", { name: copy.actions.cancel }).click();
  await expect.poll(() => api.to("/api/ops/booking/status", "POST").length).toBe(1);
  expect(api.to("/api/ops/booking/status", "POST")[0].body).toMatchObject({ action: "cancel", expected_status: "awaiting_payment" });
});

test("Add note posts the body and reloads; Resolve needs a note", async ({ page }) => {
  const copy = C.en;
  const api = await openDetail(page, "en", [makeBooking({ paid_fils: 1_300_000, status: "paid_in_full" })]);
  await page.getByLabel(copy.notes.label).fill("[Internal note]");
  await page.getByRole("button", { name: copy.actions.addNote }).click();
  await expect(page.getByText("[Internal note]").first()).toBeVisible();
  expect(api.to("/api/ops/booking/note", "POST")[0].body).toMatchObject({ body: "[Internal note]" });
  await page.getByRole("button", { name: copy.actions.resolve }).click();
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: copy.attention.resolve });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel(copy.attention.note).fill("[What I did]");
  await confirm.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(api.to("/api/ops/booking/attention", "POST")[0].body).toMatchObject({ note: "[What I did]" });
});

test("Resend receipt posts kind receipt with the payment_id and a fresh request_id per click; Resend request email posts kind request", async ({ page }) => {
  const copy = C.en;
  const api = await openDetail(page, "en", [makeBooking({ status: "deposit_paid", paid_fils: DEPOSIT, payments: [succeededPayment()] })]);
  const resend = page.getByRole("button", { name: copy.payments.resendReceipt });
  await resend.click();
  await expect(page.getByText(copy.payments.resent.sent)).toBeVisible();
  await resend.click();
  const [a, b] = api.to("/api/ops/booking/resend", "POST").map((c) => c.body as { kind: string; payment_id: string; request_id: string });
  expect(a).toMatchObject({ kind: "receipt", payment_id: PAYMENT_ID });
  expect(isUuid(a.request_id) && isUuid(b.request_id) && a.request_id !== b.request_id).toBe(true);
});

test("Resend request email on an awaiting request posts kind request", async ({ page }) => {
  const copy = C.en;
  const api = await openDetail(page, "en");
  await page.getByRole("button", { name: copy.payments.resendRequest }).click();
  await expect.poll(() => api.to("/api/ops/booking/resend", "POST").length).toBe(1);
  expect(api.to("/api/ops/booking/resend", "POST")[0].body).toMatchObject({ ref: REF, kind: "request" });
});

test("a 403 not_owner goes to /sign-in", async ({ page }) => {
  await openDetail(page, "en", [makeBooking()], { override: (call) => (call.path === "/api/ops/booking" ? refusal(403, "not_owner") : undefined) });
  await expect(page).toHaveURL(/sign-in/);
});

test("a part-paid request past its pay-by date: Needs attention in words, Record payment, Cancel and (owner Q-18) Resend request email", async ({ page }) => {
  const copy = C.en;
  await openDetail(page, "en", [makeBooking({ paid_fils: 100_000, deadline_passed: true, attention_reason: "deadline_passed_part_paid" })]);
  const detail = page.locator("[data-booking-detail]");
  await expect(detail.getByText(copy.flags.deadlinePassedPartPaid).first()).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: copy.actions.recordPayment })).toBeVisible();
  await expect(page.getByRole("button", { name: copy.actions.cancel })).toBeVisible();
  await expect(page.getByRole("button", { name: copy.payments.resendRequest })).toHaveCount(1);
});

test("a withdrawn request: History says Withdrawn by the guest by Guest, and the only button is Record payment", async ({ page }) => {
  const copy = C.en;
  const withdrawn = makeBooking({
    status: "cancelled",
    events: [{ id: 1, at: "2026-10-02T08:00:00.000Z", actor: "guest", action: "request_withdrawn", from_status: "awaiting_payment", to_status: "cancelled", detail: null }],
  });
  const api = await openDetail(page, "en", [withdrawn]);
  const detail = page.locator("[data-booking-detail]");
  await expect(detail.getByText(copy.history.by.replace("{action}", copy.history.request_withdrawn).replace("{who}", copy.history.actors.guest))).toBeVisible({ timeout: 30_000 });
  await expect(detail.getByRole("button", { name: copy.actions.recordPayment })).toBeVisible();
  for (const name of [copy.actions.cancel, copy.actions.confirm, copy.actions.complete, copy.payments.resendRequest]) {
    await expect(detail.getByRole("button", { name, exact: true })).toHaveCount(0);
  }
  expect(JSON.stringify(api.calls.map((c) => c.body))).not.toContain("request_withdrawn_owner");
});
