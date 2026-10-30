import { expect, test, type Page, type Route } from "@playwright/test";
import { HONEYPOT_FIELDS } from "../lib/contact-inquiry";
import { SITE_FOOTER_COPY } from "../lib/copy/site-footer";
import { SITE_REQUESTS_COPY, SITE_REQUESTS_LINKS } from "../lib/copy/site-requests";

// Plan 06-05 Task 4: Plan with us, List with us, the consultation on Contact and the links, on the real pages with /api/requests
// and /api/consult/* answered here. No database, no mail. Written, NOT run (owner rule 2026-10-21).

const reply = (route: Route, status: number, json: unknown) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(json) });

const fieldOf = (page: Page, label: string) => page.getByLabel(label, { exact: false }).first();

async function fillPlan(page: Page, l: "en" | "ar" | "es" = "en") {
  const p = SITE_REQUESTS_COPY[l].plan;
  await fieldOf(page, p.name).fill("Ana");
  await fieldOf(page, p.email).fill("ana@example.com");
}

test.describe("Plan with us", () => {
  test("sent: the post carries Kind and Locale, the line replaces the form, nothing asks for payment", async ({ page }) => {
    const p = SITE_REQUESTS_COPY.en.plan;
    let sent = "";
    await page.route("**/api/requests", (route) => {
      sent = route.request().postData() ?? "";
      return reply(route, 200, { ok: true, emailed: true });
    });
    await page.goto("/en/plan-with-us");
    await expect(page.getByRole("heading", { level: 1, name: p.title })).toBeVisible();
    await expect(page.getByText(p.noPay)).toBeVisible();
    await fillPlan(page);
    await page.getByRole("button", { name: p.send, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(p.sent);
    await expect(page.getByRole("button", { name: p.send, exact: true })).toHaveCount(0);
    const body = new URLSearchParams(sent);
    expect(body.get("Kind")).toBe("plan");
    expect(body.get("Locale")).toBe("en");
    expect(body.get("Name")).toBe("Ana");
  });

  test("errors: a bad email and an end before the start, each on its field; the first takes focus; no post", async ({ page }) => {
    const p = SITE_REQUESTS_COPY.en.plan;
    let posts = 0;
    await page.route("**/api/requests", (route) => {
      posts += 1;
      return reply(route, 200, { ok: true });
    });
    await page.goto("/en/plan-with-us");
    await fieldOf(page, p.from).fill("2026-12-12");
    await fieldOf(page, p.to).fill("2026-12-05");
    await fieldOf(page, p.email).fill("guest@");
    await page.getByRole("button", { name: p.send, exact: true }).click();
    await expect(page.getByText(p.err.dates)).toBeVisible();
    await expect(page.getByText(p.err.name)).toBeVisible();
    await expect(page.getByText(p.err.emailBad)).toBeVisible();
    await expect(fieldOf(page, p.to)).toBeFocused();
    expect(posts).toBe(0);
  });

  test("failed: the line names the inbox and WhatsApp; the words stay", async ({ page }) => {
    const p = SITE_REQUESTS_COPY.en.plan;
    await page.route("**/api/requests", (route) => reply(route, 503, { ok: false }));
    await page.goto("/en/plan-with-us");
    await fillPlan(page);
    await page.getByRole("button", { name: p.send, exact: true }).click();
    await expect(page.getByRole("alert")).toContainText("inquiries@almarprivatejourney.com");
    await expect(page.getByRole("alert")).toContainText(SITE_REQUESTS_COPY.en.whatsappWord);
    await expect(fieldOf(page, p.name)).toHaveValue("Ana");
  });

  test("the 11 traps are there, empty and out of the tab order; no radio control", async ({ page }) => {
    await page.goto("/en/plan-with-us");
    await expect(page.getByRole("button", { name: SITE_REQUESTS_COPY.en.plan.send, exact: true })).toBeVisible();
    for (const trap of HONEYPOT_FIELDS) {
      const input = page.locator(`form[aria-label] input[name="${trap}"]`).first();
      await expect(input).toHaveValue("");
      await expect(input).toHaveAttribute("tabindex", "-1");
    }
    await expect(page.locator('input[type="radio"]')).toHaveCount(0);
  });

  test("Arabic at 390 reads right to left", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/ar/plan-with-us");
    await expect(page.getByRole("heading", { level: 1, name: SITE_REQUESTS_COPY.ar.plan.title })).toBeVisible();
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  });
});

test.describe("List with us", () => {
  test("sent, errors, failed", async ({ page }) => {
    const p = SITE_REQUESTS_COPY.en.list;
    let status = 503;
    await page.route("**/api/requests", (route) => reply(route, status, status === 200 ? { ok: true, emailed: true } : { ok: false }));
    await page.goto("/en/list-with-us");
    await page.getByRole("button", { name: p.send, exact: true }).click();
    for (const line of [p.err.name, p.err.email, p.err.propType, p.err.city, p.err.message]) await expect(page.getByText(line)).toBeVisible();
    await fieldOf(page, p.name).fill("Ana");
    await fieldOf(page, p.email).fill("ana@example.com");
    await fieldOf(page, p.propType).fill("Villa");
    await fieldOf(page, p.city).fill("Cartagena");
    await fieldOf(page, p.message).fill("Four rooms");
    await page.getByRole("button", { name: p.send, exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "inquiries@almarprivatejourney.com" })).toBeVisible();
    status = 200;
    await page.getByRole("button", { name: p.send, exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(p.sent);
  });
});

test.describe("the consultation on Contact", () => {
  const c = SITE_REQUESTS_COPY.en.c;
  const slotLater = (days: number, hour: number) => {
    const at = new Date(Date.now() + days * 86400000);
    at.setUTCHours(hour, 0, 0, 0);
    return at.toISOString();
  };

  test("closed: the line and WhatsApp, no calendar, no number", async ({ page }) => {
    await page.route("**/api/consult/slots**", (route) => reply(route, 200, { ok: true, open: false, slots: [], time_zone: "Asia/Dubai" }));
    await page.goto("/en/contact");
    const section = page.locator("#consultation");
    await expect(section.getByRole("status")).toHaveText(c.closed);
    await expect(section.getByRole("link", { name: /WhatsApp/ })).toBeVisible();
    await expect(section.getByRole("button", { name: c.next })).toHaveCount(0);
  });

  async function chooseSlot(page: Page) {
    const section = page.locator("#consultation");
    await section.locator('button[aria-pressed]:not([disabled])').first().click();
    await section.locator('button[aria-pressed][aria-label*="time"]').first().click();
    return section;
  }

  test("taken: the line, fresh slots, the choice cleared", async ({ page }) => {
    const start = slotLater(2, 10);
    let slots = [start, slotLater(2, 11)];
    await page.route("**/api/consult/slots**", (route) => reply(route, 200, { ok: true, open: true, slots, time_zone: "Asia/Dubai" }));
    await page.route("**/api/consult/book", (route) => {
      slots = [slots[1]!];
      return reply(route, 409, { ok: false, reason: "slot_taken" });
    });
    await page.goto("/en/contact");
    const section = await chooseSlot(page);
    await section.getByLabel(c.name, { exact: false }).fill("Ana");
    await section.getByLabel(c.email, { exact: false }).fill("ana@example.com");
    await section.getByLabel(c.phone, { exact: false }).fill("+34 600 000 000");
    await section.getByRole("button", { name: c.book }).click();
    await expect(section.getByRole("alert")).toHaveText(c.taken);
    await expect(section.getByRole("button", { name: c.book })).toHaveCount(0);
  });

  test("booked: the post carries the slot and the zone; the line and, on a failed mail, the second line", async ({ page }) => {
    let sent = "";
    const start = slotLater(2, 10);
    await page.route("**/api/consult/slots**", (route) => reply(route, 200, { ok: true, open: true, slots: [start], time_zone: "Asia/Dubai" }));
    await page.route("**/api/consult/book", (route) => {
      sent = route.request().postData() ?? "";
      return reply(route, 200, { ok: true, slot_start: start, emailed: false });
    });
    await page.goto("/en/contact");
    const section = await chooseSlot(page);
    await section.getByLabel(c.name, { exact: false }).fill("Ana");
    await section.getByLabel(c.email, { exact: false }).fill("ana@example.com");
    await section.getByLabel(c.phone, { exact: false }).fill("+34 600 000 000");
    await section.getByRole("button", { name: c.book }).click();
    await expect(section.getByRole("status")).toContainText("+34 600 000 000");
    await expect(section.getByRole("alert")).toHaveText(c.emailFailed);
    const body = new URLSearchParams(sent);
    expect(body.get("Slot")).toBe(start);
    expect(body.get("Time Zone")).toBeTruthy();
  });
});

test.describe("the links, as signed", () => {
  test("List with us is in the footer of the public pages and nowhere else on them", async ({ page }) => {
    for (const path of ["/en/", "/en/about", "/en/contact", "/en/plan-with-us", "/en/private-stays"]) {
      await page.goto(path);
      const links = page.getByRole("link", { name: SITE_FOOTER_COPY.en.listWithUs, exact: true });
      await expect(links, path).toHaveCount(1);
      await expect(page.locator("footer").getByRole("link", { name: SITE_FOOTER_COPY.en.listWithUs, exact: true }), path).toHaveAttribute("href", "/en/list-with-us");
    }
  });

  test("the home Begin section: Request Consultation goes to the call, Plan with us to its page", async ({ page }) => {
    await page.goto("/es/");
    const begin = page.locator("#begin");
    await expect(begin.getByRole("link", { name: SITE_REQUESTS_LINKS.es.planBtn })).toHaveAttribute("href", "/es/plan-with-us");
    await expect(begin.locator('a[href="/es/contact#consultation"]')).toHaveCount(1);
  });

  test("Contact carries the Plan with us line", async ({ page }) => {
    await page.goto("/en/contact");
    await expect(page.getByText(SITE_REQUESTS_LINKS.en.planLine)).toBeVisible();
    await expect(page.locator("main").getByRole("link", { name: SITE_REQUESTS_LINKS.en.planBtn })).toHaveAttribute("href", "/en/plan-with-us");
  });
});
