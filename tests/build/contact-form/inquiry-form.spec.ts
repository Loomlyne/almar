import { expect, test, type Locator, type Page, type Route } from "@playwright/test";
import { contactLinks } from "../../../components/pages/contact/contact-links";
import { HONEYPOT_FIELDS, INQUIRY_ADDRESS, INQUIRY_LIMITS, JOURNEY_TYPES, type JourneyType } from "../../../lib/contact-inquiry";
import { CONTACT_PAGE_COPY } from "../../../lib/copy/contact-page";
import { getContactDetails } from "../../../lib/data/contact";
import { localePath, type Locale } from "../../../lib/locale-path";
import { DIVIDER, LOCALES, MD, WIDTHS, box, open, stubExternal, style, token, watch } from "../slice3-pages";

// Plan 03.3-26 Task 3: every state of the Contact inquiry form, reached by a click, in EN, AR and ES at 390, 834 and
// 1440, on the assembled site. Requests to /api/contact are answered by page.route (no email is ever sent); a request
// to api.resend.com or a Framer, catbox or pexels host fails the test. Item 11 is the one real POST: a filled
// honeypot on the local runtime runner answers 400 JSON, proof that the build serves the route.
//   node scripts/assemble-cloudflare.mjs
//   PW_PORT=<free port> npx playwright test -c playwright.build.config.ts tests/build/contact-form --workers=1
// Expected strings come from lib/copy/contact-page.ts and lib/data; never typed here. Every selector is scoped to
// #inquiry or to the Start link (plan 27's footer newsletter adds another email input).

const PATH = "/contact";
const LG = 1024;

test.setTimeout(150_000);

type Posted = { method: string; type: string; body: URLSearchParams };
type Reply = (route: Route) => Promise<void>;

const json = (status: number, body: unknown): Reply => (route) =>
  route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });

/** Records every POST to /api/contact and answers it with `reply` (200 {"ok":true} until changed). */
async function contactRoute(page: Page) {
  const posts: Posted[] = [];
  const state = { reply: json(200, { ok: true }) };
  await page.route("**/api/contact", async (route) => {
    const r = route.request();
    posts.push({ method: r.method(), type: r.headers()["content-type"] ?? "", body: new URLSearchParams(r.postData() ?? "") });
    await state.reply(route);
  });
  return {
    posts,
    set(reply: Reply) {
      state.reply = reply;
    },
  };
}

/** watch() plus a refusal of any call to Resend, and the external click targets stubbed. */
async function guard(page: Page) {
  const watched = await watch(page);
  await stubExternal(page);
  await page.context().route(/api\.resend\.com/, (route) => {
    watched.problems.push(`request to Resend: ${route.request().url()}`);
    return route.abort();
  });
  return watched;
}

/** Problems other than the browser's own line for a request that answered an error status or was aborted. */
const realProblems = (problems: string[]) => problems.filter((p) => !/Failed to load resource/.test(p));

async function mount(page: Page, locale: Locale, hash = "") {
  await open(page, localePath(locale, PATH) + hash);
  await page.locator("#inquiry form").waitFor();
}

const q = {
  box: (page: Page) => page.locator("#inquiry"),
  form: (page: Page) => page.locator("#inquiry form"),
  name: (page: Page) => page.locator("#inquiry #inquiry-name"),
  phone: (page: Page) => page.locator("#inquiry #inquiry-phone"),
  email: (page: Page) => page.locator("#inquiry #inquiry-email"),
  type: (page: Page) => page.locator("#inquiry #inquiry-type"),
  details: (page: Page) => page.locator("#inquiry #inquiry-details"),
  submit: (page: Page) => page.locator('#inquiry button[type="submit"]'),
  start: (page: Page) => page.locator('a[href="#inquiry"]'),
  alert: (page: Page) => page.locator("#inquiry [role=alert]"),
  status: (page: Page) => page.locator("#inquiry [role=status]"),
  confidence: (page: Page) => page.locator('section[aria-labelledby="contact-confidence-heading"]'),
};

async function chooseType(page: Page, locale: Locale, value: JourneyType) {
  await q.type(page).click();
  await page.getByRole("option", { name: CONTACT_PAGE_COPY[locale].form.journeyTypes[value], exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
}

const VALID = { name: "Ana Prueba", phone: "+57 300 123 4567", email: "ana@example.org", type: "Full Journey" as JourneyType, details: "Ten days, two adults." };

async function fillValid(page: Page, locale: Locale) {
  await q.name(page).fill(VALID.name);
  await q.phone(page).fill(VALID.phone);
  await q.email(page).fill(VALID.email);
  await chooseType(page, locale, VALID.type);
  await q.details(page).fill(VALID.details);
}

/** Text a sighted visitor reads: the element's text without its visually hidden parts. */
const shownText = (l: Locator) =>
  l.evaluate((el) => {
    const clone = el.cloneNode(true) as HTMLElement;
    clone.querySelectorAll(".sr-only").forEach((n) => n.remove());
    return clone.textContent ?? "";
  });

const failedLine = (locale: Locale) => {
  const f = CONTACT_PAGE_COPY[locale].form;
  return f.failed.replace("{email}", INQUIRY_ADDRESS).replace("{whatsapp}", f.whatsappWord);
};

const topInView = (l: Locator) =>
  l.evaluate((el) => {
    const top = el.getBoundingClientRect().top;
    return top >= -1 && top < window.innerHeight;
  });

const atRest = (l: Locator) =>
  l.evaluate((el) => {
    const s = getComputedStyle(el);
    return s.opacity === "1" && s.transform === "none" && (s.translate === "none" || s.translate === "0px");
  });

for (const locale of LOCALES) {
  const copy = CONTACT_PAGE_COPY[locale];
  const f = copy.form;
  for (const { width, height } of WIDTHS) {
    const where = `${locale} ${width}`;

    test.describe(`Contact form built ${where}`, () => {
      test.use({ viewport: { width, height }, reducedMotion: "reduce" });

      test(`1 JavaScript off: no box, no form, no Start link, no Message on WhatsApp; the details work; Travel With Confidence in place (${where})`, async ({ browser }) => {
        const links = contactLinks(await getContactDetails(locale));
        const off = await browser.newContext({ javaScriptEnabled: false, reducedMotion: "no-preference", viewport: { width, height } });
        try {
          const p = await off.newPage();
          await p.goto(localePath(locale, PATH), { waitUntil: "load" });
          await expect(p.locator("#inquiry")).toHaveCount(0);
          await expect(p.locator("main form")).toHaveCount(0);
          await expect(p.locator('a[href="#inquiry"]')).toHaveCount(0);
          await expect(p.getByText(copy.whatsappCta, { exact: true })).toHaveCount(0);
          await expect(p.getByText(copy.startInquiry, { exact: true })).toHaveCount(0);
          for (const href of [links.mailto, links.tel, links.whatsapp]) await expect(p.locator(`main a[href="${href}"]`), href).toHaveCount(1);
          const c = q.confidence(p);
          for (const el of [c.locator("h2"), c.getByText(copy.confidence.body)]) {
            await expect(el).toBeVisible();
            expect(await style(el, "opacity")).toBe("1");
            expect(await style(el, "transform")).toBe("none");
          }
        } finally {
          await off.close();
        }
      });

      test(`2 rendered: hidden heading names the form, labels in order, the Select, required, direction (${where})`, async ({ page }) => {
        const watched = await guard(page);
        const links = contactLinks(await getContactDetails(locale));
        await mount(page, locale);
        const heading = q.box(page).locator("h2");
        await expect(heading).toHaveText(f.heading);
        const hb = await box(heading);
        expect(hb.width).toBeLessThanOrEqual(1);
        expect(hb.height).toBeLessThanOrEqual(1);
        await expect(q.form(page)).toHaveAccessibleName(f.heading);

        const labels = await q.form(page).locator("label").evaluateAll((ls) => ls.map((l) => (l.textContent ?? "").replace(/\s*\*$/, "")));
        expect(labels).toEqual([f.name, f.phone, f.email, f.journeyType, f.details]);

        const wa = page.locator('#inquiry a[href^="https://wa.me/"]');
        await expect(wa).toHaveCount(1);
        await expect(wa).toHaveAttribute("href", links.whatsappMessage);
        await expect(wa).toHaveAttribute("target", "_blank");
        await expect(wa).toHaveAccessibleName(`${copy.whatsappCta} ${copy.newTab}`);
        await expect(page.locator("[data-contact-columns] > *").first().locator('a[href^="https://wa.me/971563883302?text="]')).toHaveCount(0);

        await expect(q.type(page)).toHaveAttribute("role", "combobox");
        await q.type(page).click();
        expect(await page.getByRole("option").allTextContents()).toEqual(JOURNEY_TYPES.map((t) => f.journeyTypes[t]));
        await page.keyboard.press("Escape");
        await expect(page.getByRole("listbox")).toHaveCount(0);

        for (const el of [q.name(page), q.email(page), q.details(page)]) await expect(el).toHaveAttribute("required", "");
        await expect(q.type(page)).toHaveAttribute("aria-required", "true");
        await expect(q.phone(page)).not.toHaveAttribute("required", /.*/);
        await expect(q.phone(page)).toHaveAttribute("type", "tel");
        await expect(q.email(page)).toHaveAttribute("type", "email");
        if (locale === "ar") {
          await expect(q.phone(page)).toHaveAttribute("dir", "ltr");
          await expect(q.email(page)).toHaveAttribute("dir", "ltr");
        }
        expect(await style(q.form(page), "direction")).toBe(locale === "ar" ? "rtl" : "ltr");
        expect(watched.problems).toEqual([]);
      });

      test(`3 Start Your Inquiry reaches the box; a direct #inquiry load does too (${where})`, async ({ page }) => {
        const watched = await guard(page);
        await mount(page, locale);
        const start = q.start(page);
        await expect(start).toHaveCount(1);
        await expect(start).toHaveText(copy.startInquiry);
        await start.click();
        await expect.poll(() => page.url()).toMatch(/#inquiry$/);
        await expect.poll(() => topInView(q.box(page)), { timeout: 3_000 }).toBe(true);

        await page.goto("about:blank");
        await mount(page, locale, "#inquiry");
        await expect.poll(() => topInView(q.box(page)), { timeout: 3_000 }).toBe(true);
        expect(watched.problems).toEqual([]);
      });

      test(`4 empty submit: no request, four messages wired to their controls, focus on the name (${where})`, async ({ page }) => {
        const watched = await guard(page);
        const api = await contactRoute(page);
        await mount(page, locale);
        await q.submit(page).click();
        const want: [Locator, string, string][] = [
          [q.name(page), "inquiry-name", f.errors.nameRequired],
          [q.email(page), "inquiry-email", f.errors.emailRequired],
          [q.type(page), "inquiry-type", f.errors.journeyTypeRequired],
          [q.details(page), "inquiry-details", f.errors.detailsRequired],
        ];
        for (const [control, id, text] of want) {
          await expect(page.locator(`#${id}-message`), id).toHaveText(text);
          await expect(control, id).toHaveAttribute("aria-invalid", "true");
          await expect(control, id).toHaveAttribute("aria-describedby", `${id}-message`);
        }
        await expect(page.locator("#inquiry-phone-message")).toHaveCount(0);
        await expect(q.name(page)).toBeFocused();
        expect(api.posts).toEqual([]);
        await expect(q.alert(page)).toHaveCount(0);
        expect(watched.problems).toEqual([]);
      });

      test(`5 bad values: the two invalid messages, no request; the textarea's cap (${where})`, async ({ page }) => {
        const watched = await guard(page);
        const api = await contactRoute(page);
        await mount(page, locale);
        await fillValid(page, locale);
        await q.email(page).fill("a@b");
        await q.phone(page).fill("call me");
        await q.submit(page).click();
        await expect(page.locator("#inquiry-phone-message")).toHaveText(f.errors.phoneInvalid);
        await expect(page.locator("#inquiry-email-message")).toHaveText(f.errors.emailInvalid);
        for (const id of ["inquiry-name", "inquiry-type", "inquiry-details"]) await expect(page.locator(`#${id}-message`)).toHaveCount(0);
        await expect(q.phone(page)).toBeFocused();
        await expect(q.details(page)).toHaveAttribute("maxlength", String(INQUIRY_LIMITS.details));
        await expect(q.name(page)).toHaveAttribute("maxlength", String(INQUIRY_LIMITS.name));
        await expect(q.email(page)).toHaveAttribute("maxlength", String(INQUIRY_LIMITS.email));
        await expect(q.phone(page)).toHaveAttribute("maxlength", String(INQUIRY_LIMITS.phone));
        expect(api.posts).toEqual([]);
        expect(watched.problems).toEqual([]);
      });

      test(`6 sent: busy while waiting, one urlencoded POST with the English type and every trap, then the sent line (${where})`, async ({ page }) => {
        const watched = await guard(page);
        const api = await contactRoute(page);
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        api.set(async (route) => {
          await gate;
          await json(200, { ok: true })(route);
        });
        await mount(page, locale);
        await fillValid(page, locale);
        await q.submit(page).click();
        await expect(q.submit(page)).toHaveAttribute("aria-busy", "true");
        await expect(q.submit(page)).toBeDisabled();
        await expect(q.submit(page)).toHaveText(f.sending);
        // A second try while it waits sends nothing (the button is disabled; Enter in a field is ignored too).
        await q.name(page).press("Enter");
        await page.waitForTimeout(200);
        expect(api.posts).toHaveLength(1);
        release();

        await expect(q.status(page)).toHaveText(f.sent);
        await expect(q.status(page)).toBeFocused();
        await expect(q.form(page)).toHaveCount(0);
        await expect(q.box(page).locator("a, button, input, textarea")).toHaveCount(0);
        expect(api.posts).toHaveLength(1);
        const [post] = api.posts;
        expect(post.method).toBe("POST");
        expect(post.type).toMatch(/^application\/x-www-form-urlencoded/);
        expect(post.body.get("Name")).toBe(VALID.name);
        expect(post.body.get("Phone")).toBe(VALID.phone);
        expect(post.body.get("Email")).toBe(VALID.email);
        expect(post.body.get("Journey Type")).toBe(VALID.type);
        expect(post.body.get("Journey Details")).toBe(VALID.details);
        expect(post.body.get("Locale")).toBe(locale);
        for (const trap of HONEYPOT_FIELDS) expect(post.body.get(trap), trap).toBe("");
        expect([...post.body.keys()].sort()).toEqual(["Email", "Journey Details", "Journey Type", "Locale", "Name", "Phone", ...HONEYPOT_FIELDS].sort());
        expect(watched.problems).toEqual([]);
      });

      test(`7 failed (502, 503, 400, abort): the alert with its two links, values kept; then a retry sends (${where})`, async ({ page }) => {
        const watched = await guard(page);
        const links = contactLinks(await getContactDetails(locale));
        const api = await contactRoute(page);
        await mount(page, locale);
        await fillValid(page, locale);
        const failures: Reply[] = [json(502, { ok: false }), json(503, { ok: false }), json(400, { ok: false }), (route) => route.abort()];
        for (const [i, failure] of failures.entries()) {
          api.set(failure);
          await q.submit(page).click();
          await expect.poll(() => api.posts.length).toBe(i + 1);
          const alert = q.alert(page);
          await expect(alert, `failure ${i}`).toHaveCount(1);
          expect(await shownText(alert)).toBe(failedLine(locale));
          await expect(alert.locator("a")).toHaveCount(2);
          await expect(alert.locator("a").nth(0)).toHaveAttribute("href", links.mailto);
          expect(links.mailto).toBe(`mailto:${INQUIRY_ADDRESS}`);
          await expect(alert.locator("a").nth(1)).toHaveAttribute("href", links.whatsappMessage);
          await expect(alert.locator("a").nth(1)).toHaveAttribute("target", "_blank");
          expect((await alert.locator("a").nth(1).getAttribute("rel")) ?? "").toContain("noopener");
          await expect(q.name(page)).toHaveValue(VALID.name);
          await expect(q.phone(page)).toHaveValue(VALID.phone);
          await expect(q.email(page)).toHaveValue(VALID.email);
          await expect(q.details(page)).toHaveValue(VALID.details);
          await expect(q.type(page)).toContainText(f.journeyTypes[VALID.type]);
          await expect(q.submit(page)).toHaveText(f.submit);
          await expect(q.submit(page)).toBeEnabled();
          await expect(page.locator("#inquiry .field-error")).toHaveCount(0);
        }
        api.set(json(200, { ok: true }));
        await q.submit(page).click();
        await expect(q.status(page)).toHaveText(f.sent);
        await expect(q.alert(page)).toHaveCount(0);
        expect(api.posts).toHaveLength(failures.length + 1);
        expect(realProblems(watched.problems)).toEqual([]);
      });

      test(`8 server field errors: only the email message, no alert (${where})`, async ({ page }) => {
        const watched = await guard(page);
        const api = await contactRoute(page);
        api.set(json(400, { ok: false, errors: { email: "invalid" } }));
        await mount(page, locale);
        await fillValid(page, locale);
        await q.submit(page).click();
        await expect(page.locator("#inquiry-email-message")).toHaveText(f.errors.emailInvalid);
        await expect(q.email(page)).toHaveAttribute("aria-invalid", "true");
        await expect(q.email(page)).toBeFocused();
        await expect(page.locator("#inquiry .field-error")).toHaveCount(1);
        await expect(q.alert(page)).toHaveCount(0);
        expect(api.posts).toHaveLength(1);
        expect(realProblems(watched.problems)).toEqual([]);
      });

      test(`9 honeypots: out of the accessibility tree and the tab order (${where})`, async ({ page }) => {
        const watched = await guard(page);
        await mount(page, locale);
        await expect(q.box(page).getByRole("textbox")).toHaveCount(4);
        await expect(q.box(page).getByRole("combobox")).toHaveCount(1);
        for (const trap of HONEYPOT_FIELDS) {
          const input = q.form(page).locator(`input[name="${trap}"]`);
          await expect(input, trap).toHaveCount(1);
          await expect(input, trap).toHaveAttribute("tabindex", "-1");
          await expect(input, trap).toHaveAttribute("autocomplete", "one-time-code");
          await expect(input, trap).toHaveValue("");
        }
        await expect(q.form(page).locator('[aria-hidden="true"].sr-only input')).toHaveCount(HONEYPOT_FIELDS.length);
        await q.name(page).focus();
        const order: string[] = [];
        for (let i = 0; i < 5; i++) {
          await page.keyboard.press("Tab");
          order.push(await page.evaluate(() => {
            const el = document.activeElement as HTMLElement | null;
            return el?.id || (el?.getAttribute("type") === "submit" ? "submit" : `${el?.tagName}:${el?.getAttribute("name")}`);
          }));
        }
        expect(order).toEqual(["inquiry-phone", "inquiry-email", "inquiry-type", "inquiry-details", "submit"]);
        expect(watched.problems).toEqual([]);
      });

      test(`10 look: square, the teal frame, outlined buttons, rows and widths, the divider after Travel With Confidence (${where})`, async ({ page }) => {
        const watched = await guard(page);
        await mount(page, locale);
        if (width === 390) {
          expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
        }
        const submit = q.submit(page);
        const wa = page.locator('#inquiry a[href^="https://wa.me/"]');
        const start = q.start(page);
        for (const el of [q.name(page), q.phone(page), q.email(page), q.details(page), q.type(page), q.box(page), submit, wa, start]) {
          expect(await style(el, "border-top-left-radius")).toBe("0px");
        }
        const teal = await token(page, "teal");
        expect(await style(q.box(page), "border-top-width")).toBe("1px");
        expect(await style(q.box(page), "border-top-style")).toBe("solid");
        expect(await style(q.box(page), "border-top-color")).toBe(teal);
        const solid = await style(submit, "background-color");
        for (const outlined of [wa, start]) {
          expect(await style(outlined, "border-top-width")).toBe("1px");
          expect(await style(outlined, "border-top-color")).toBe(await token(page, "gold"));
          expect(await style(outlined, "background-color")).not.toBe(solid);
        }
        expect(await style(q.confidence(page).locator("h2"), "text-align")).toBe("center");

        const [n, p, e, t, d, form] = await Promise.all([q.name(page), q.phone(page), q.email(page), q.type(page), q.details(page), q.form(page)].map(box));
        if (width >= MD) expect(Math.abs(n.y - p.y)).toBeLessThanOrEqual(1);
        else expect(p.y).toBeGreaterThanOrEqual(n.y + n.height - 1);
        for (const full of [e, t, d]) expect(Math.abs(full.width - form.width)).toBeLessThanOrEqual(1);
        const sb = await box(submit);
        const wb = await box(wa);
        // Both sit below the textarea, side by side from 768 px. The row wraps where the two labels do not fit: at 390,
        // and in Spanish at 1440 (measured 2026-10-14: 497 px of buttons and gap in a 492 px box; flagged in the SUMMARY).
        expect(sb.y).toBeGreaterThan(d.y + d.height - 1);
        expect(wb.y).toBeGreaterThanOrEqual(sb.y - 1);
        if (width >= MD && !(locale === "es" && width >= LG)) expect(Math.abs(sb.y - wb.y)).toBeLessThanOrEqual(1);

        const c = await box(q.confidence(page));
        const dividers = page.locator(DIVIDER);
        const after = await dividers.evaluateAll((els, bottom) => els.filter((el) => el.getBoundingClientRect().top + window.scrollY >= bottom - 1).length, c.y + c.height + (await page.evaluate(() => window.scrollY)));
        expect(after, "a divider follows Travel With Confidence").toBeGreaterThanOrEqual(1);
        expect(watched.problems).toEqual([]);
      });
    });
  }

  for (const width of [390, 1440]) {
    const height = WIDTHS.find((w) => w.width === width)!.height;
    test(`12 motion ${locale} ${width}: still under reduced motion; with motion the heading block and Start play once and end in place`, async ({ browser }) => {
      const still = await browser.newContext({ reducedMotion: "reduce", viewport: { width, height } });
      try {
        const page = await still.newPage();
        await guard(page);
        await mount(page, locale);
        await q.box(page).scrollIntoViewIfNeeded();
        for (const el of [q.box(page), ...(await q.box(page).locator("[data-reveal='button']").all())]) expect(await atRest(el)).toBe(true);
        await q.start(page).scrollIntoViewIfNeeded();
        expect(await atRest(q.start(page).locator("xpath=.."))).toBe(true);
        await expect(q.box(page).locator("[data-reveal='button']")).toHaveCount(2);
      } finally {
        await still.close();
      }

      const live = await browser.newContext({ reducedMotion: "no-preference", viewport: { width, height } });
      try {
        const page = await live.newPage();
        const watched = await guard(page);
        await mount(page, locale);
        const headingBlock = page.locator("#contact-confidence-heading").locator("xpath=ancestor::*[@data-reveal][1]");
        await headingBlock.evaluate((el) => el.scrollIntoView({ block: "center" }));
        await page.waitForTimeout(1500);
        expect(await atRest(headingBlock)).toBe(true);
        expect(await atRest(q.start(page).locator("xpath=.."))).toBe(true);
        expect(await q.start(page).locator("xpath=..").getAttribute("data-reveal")).toBe("button");
        // Played once: back at the top and down again, nothing is hidden.
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        expect(await atRest(headingBlock)).toBe(true);
        expect(watched.problems).toEqual([]);
      } finally {
        await live.close();
      }
    });
  }
}

test("11 the route is served: a real POST with a filled honeypot answers 400 JSON {\"ok\":false}, never 404 or 405", async ({ request, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const res = await request.post("/api/contact", {
    headers: { origin, "content-type": "application/x-www-form-urlencoded" },
    data: new URLSearchParams({
      website: "bot",
      Name: "Route Probe",
      Email: "probe@example.org",
      "Journey Type": "Experiences",
      "Journey Details": "Served?",
      Locale: "en",
    }).toString(),
    maxRedirects: 0,
  });
  expect(res.status()).toBe(400);
  expect(res.headers()["content-type"] ?? "").toMatch(/^application\/json/);
  expect(res.headers()["cache-control"]).toBe("no-store");
  expect(await res.text()).toBe('{"ok":false}');
});
