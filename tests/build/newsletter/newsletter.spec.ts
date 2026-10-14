import fs from "node:fs";
import { expect, test, type Page, type Request, type Route } from "@playwright/test";
import { SITE_FOOTER_COPY } from "../../../lib/copy/site-footer";
import { isLive } from "../../../lib/data/posts";
import { MEDIA_BASE_URL } from "../../../lib/data/media";
import { LOCALES, PUBLIC_PAGES, localePath, type Locale } from "../../../lib/locale-path";
import { NEWSLETTER_HONEYPOT_FIELDS } from "../../../lib/newsletter";
import { clickClearOfDock } from "../../helpers/click-clear-of-dock";
import { FOCUS } from "../stay-detail/_helpers";
import { open, style, token, watch } from "../slice3-pages";

// Plan 03.3-27 Task 4: the footer newsletter on the ASSEMBLED site, on every React document. Documents are computed
// from PUBLIC_PAGES x LOCALES (R-13), never listed. `**/newsletter` is always answered by page.route: no request ever
// reaches the real handler or Resend. Strings come from SITE_FOOTER_COPY[locale].newsletter, never typed here.
//   node scripts/assemble-cloudflare.mjs
//   PW_PORT=<free port> npx playwright test -c playwright.build.config.ts tests/build/newsletter --workers=1

/** The first live post (published, date reached), as lib/data/posts.ts decides. */
function firstPostSlug(): string {
  const rows = JSON.parse(fs.readFileSync("lib/data/fixtures/posts.json", "utf8")) as Array<{ slug: string; is_published: boolean; published_at: string }>;
  const live = rows.filter((row) => isLive(row));
  if (live.length === 0) throw new Error("no live post in lib/data/fixtures/posts.json");
  return live[0].slug;
}

const SAMPLE_PARAMS: Record<string, () => string> = { "[stay]": () => FOCUS[0], "[post]": firstPostSlug };

type Doc = { locale: Locale; pattern: string; url: string };

function documents(): Doc[] {
  const out: Doc[] = [];
  for (const pattern of PUBLIC_PAGES) {
    const path = pattern
      .split("/")
      .map((segment) => {
        if (!/^\[.+\]$/.test(segment)) return segment;
        const sample = SAMPLE_PARAMS[segment];
        if (!sample) throw new Error(`newsletter spec: no SAMPLE_PARAMS entry for ${segment} in ${pattern}`);
        return sample();
      })
      .join("/");
    for (const locale of LOCALES) out.push({ locale, pattern, url: localePath(locale, path || "/") });
  }
  return out;
}

const DOCS = documents();
const byLocale = (locale: Locale) => DOCS.filter((d) => d.locale === locale);

const footer = (page: Page) => page.locator("footer");
const form = (page: Page) => footer(page).locator("form");
const box = (page: Page) => page.locator("#footer-newsletter-email");
const submit = (page: Page) => form(page).locator('button[type="submit"]');
const line = (page: Page) => footer(page).getByRole("alert");
/** The toast card in the footer's fixed region, not its sr-only live line. */
const card = (page: Page) => page.locator("div.pointer-events-none.fixed.bottom-16 > div.pointer-events-auto");

type Sent = { method: string; url: string; fields: Array<[string, string]>; contentType: string };

/** The multipart fields of a request body, in order (names and plain values; the footer sends no file). */
function multipartFields(request: Request): Array<[string, string]> {
  const body = request.postDataBuffer()?.toString("utf8") ?? "";
  return [...body.matchAll(/Content-Disposition: form-data; name="([^"]+)"\r\n\r\n([\s\S]*?)\r\n--/g)].map((m) => [m[1], m[2]]);
}

/** Route /newsletter with `answer`, record every request to it, and every request of the page. */
async function stubNewsletter(page: Page, answer: (route: Route, sent: Sent) => Promise<void>) {
  const sent: Sent[] = [];
  const all: string[] = [];
  page.on("request", (r) => all.push(r.url()));
  await page.route("**/newsletter", async (route) => {
    const request = route.request();
    const item = { method: request.method(), url: request.url(), fields: multipartFields(request), contentType: request.headers()["content-type"] ?? "" };
    sent.push(item);
    await answer(route, item);
  });
  return { sent, all };
}

const ok = (route: Route) => route.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });

async function openWithNewsletter(page: Page, url: string) {
  await open(page, url);
  await expect(form(page), `${url}: the newsletter form after hydration`).toHaveCount(1);
}

/** Fill the box and press the button; with `expectPost`, wait until the post has left (so a check reads its answer). */
async function submitAddress(page: Page, address: string, expectPost = true) {
  await box(page).fill(address);
  const posted = expectPost ? page.waitForRequest((r) => new URL(r.url()).pathname === "/newsletter") : null;
  await clickClearOfDock(submit(page));
  if (posted) await posted;
  await expect(submit(page)).not.toHaveAttribute("aria-busy", /.*/);
}

/** Every request during a submit is this site's or the media host's (T-3.3-27-04). */
function foreignRequests(all: string[], origin: string): string[] {
  const media = new URL(MEDIA_BASE_URL).origin;
  return all.filter((u) => !u.startsWith("data:") && new URL(u).origin !== origin && new URL(u).origin !== media);
}

test.setTimeout(240_000);

test("the computed documents cover every PUBLIC_PAGES pattern in three languages", () => {
  expect(DOCS.length).toBe(PUBLIC_PAGES.length * 3);
  expect(new Set(DOCS.map((d) => d.url)).size).toBe(DOCS.length);
});

for (const locale of LOCALES) {
  const copy = SITE_FOOTER_COPY[locale].newsletter;

  test.describe(`newsletter ${locale}`, () => {
    test(`1 JavaScript off: no form in the served HTML or the page, no box, no Join button (${locale})`, async ({ page, browser }) => {
      await watch(page);
      for (const doc of byLocale(locale)) {
        const html = await (await page.request.get(doc.url, { maxRedirects: 0 })).text();
        expect(html.includes("<form"), `${doc.url}: <form in the served HTML`).toBe(false);
        expect(html.includes("footer-newsletter-email"), `${doc.url}: the box in the served HTML`).toBe(false);
      }
      const context = await browser.newContext({ javaScriptEnabled: false });
      const off = await context.newPage();
      await watch(off);
      for (const doc of byLocale(locale)) {
        await off.goto(doc.url, { waitUntil: "load" });
        await expect(off.locator("footer").getByRole("textbox"), doc.url).toHaveCount(0);
        await expect(off.locator("footer form"), doc.url).toHaveCount(0);
        await expect(off.getByRole("button", { name: copy.subscribe, exact: true }), doc.url).toHaveCount(0);
      }
      await context.close();
    });

    test(`2 success on every document at 1440: one same-origin multipart POST, the toast, the box emptied (${locale})`, async ({ page, baseURL }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      const watched = await watch(page);
      const { sent, all } = await stubNewsletter(page, ok);
      const origin = new URL(baseURL!).origin;
      for (const doc of byLocale(locale)) {
        await openWithNewsletter(page, doc.url);
        await expect(footer(page).getByText(copy.title, { exact: true }), doc.url).toBeVisible();
        await expect(footer(page).getByText(copy.description, { exact: true }), doc.url).toBeVisible();
        await expect(footer(page).getByRole("textbox", { name: copy.email, exact: true }), doc.url).toBeVisible();
        const before = sent.length;
        const during = all.length;
        const address = `guest+${locale}@example.com`;
        await submitAddress(page, address);
        await expect(card(page), doc.url).toContainText(copy.success);
        await expect(card(page).getByRole("button", { name: copy.dismiss, exact: true }), doc.url).toBeVisible();
        await expect(box(page), doc.url).toHaveValue("");
        await expect(line(page), doc.url).toHaveCount(0);
        expect(sent.length - before, `${doc.url}: one request`).toBe(1);
        const one = sent[sent.length - 1];
        expect(one.method).toBe("POST");
        expect(new URL(one.url).origin, doc.url).toBe(origin);
        expect(new URL(one.url).pathname).toBe("/newsletter");
        expect(one.contentType).toMatch(/^multipart\/form-data; boundary=/);
        expect(one.fields, doc.url).toEqual([["Email", address], ...NEWSLETTER_HONEYPOT_FIELDS.map((f) => [f, ""] as [string, string])]);
        expect(foreignRequests(all.slice(during), origin), `${doc.url}: another host`).toEqual([]);
      }
      expect(watched.problems).toEqual([]);
    });

    for (const { width, height } of [{ width: 390, height: 844 }, { width: 834, height: 1194 }]) {
      test(`3 widths and look at ${width}: the end column, square, gold only as the button's line, no overflow (${locale})`, async ({ page }) => {
        await page.setViewportSize({ width, height });
        await watch(page);
        const { sent } = await stubNewsletter(page, ok);
        await openWithNewsletter(page, byLocale(locale)[0].url);
        const gold = await token(page, "gold");
        for (const doc of byLocale(locale)) {
          await openWithNewsletter(page, doc.url);
          const f = footer(page);
          expect(await f.evaluate((el) => el.scrollWidth <= el.clientWidth), `${doc.url}: footer overflow`).toBe(true);
          expect(await style(box(page), "border-top-left-radius"), doc.url).toBe("0px");
          expect(await style(submit(page), "border-top-left-radius"), doc.url).toBe("0px");
          expect(await style(submit(page), "border-top-color"), doc.url).toBe(gold);
          expect(await style(submit(page), "background-color"), doc.url).not.toBe(gold);
          const contact = (await f.locator("address").boundingBox())!;
          const news = (await form(page).boundingBox())!;
          if (width < 768) expect(news.y, `${doc.url}: below the contact column`).toBeGreaterThan(contact.y + contact.height - 1);
          else if (locale === "ar") expect(news.x + news.width, `${doc.url}: the end column (RTL)`).toBeLessThan(contact.x + 1);
          else expect(news.x, `${doc.url}: the end column`).toBeGreaterThan(contact.x + contact.width - 1);
          const before = sent.length;
          await submitAddress(page, `guest+${locale}@example.com`);
          await expect(card(page), doc.url).toContainText(copy.success);
          expect(sent.length - before).toBe(1);
          if (width === 390 && doc.pattern === "/private-stays/[stay]") {
            // The pinned dock: the toast card is on top where it is drawn.
            const inside = await card(page).evaluate((el) => {
              const r = el.getBoundingClientRect();
              const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
              return !!hit && el.contains(hit);
            });
            expect(inside, `${doc.url}: the toast is not under the dock`).toBe(true);
          }
        }
      });
    }

    test(`4 every failure branch shows the failed line, keeps the address, shows no success (${locale})`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await watch(page);
      let branch: (route: Route) => Promise<void> = ok;
      await stubNewsletter(page, (route) => branch(route));
      const json = (status: number, body: string) => (route: Route) => route.fulfill({ status, contentType: "application/json", body });
      const branches: Array<[string, (route: Route) => Promise<void>]> = [
        ["400", json(400, '{"ok":false}')],
        ["404", (route) => route.fulfill({ status: 404, contentType: "text/html", body: "<!doctype html><title>404</title>" })],
        ["429", json(429, '{"ok":false}')],
        ["500", json(500, '{"ok":false}')],
        ["502", json(502, '{"ok":false}')],
        ["503", json(503, '{"ok":false}')],
        ["200 without ok", json(200, '{"ok":false}')],
        ["200 html", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><p>page</p>" })],
        ["network", (route) => route.abort("failed")],
      ];
      for (const doc of byLocale(locale)) {
        await openWithNewsletter(page, doc.url);
        const address = `guest+${locale}@example.com`;
        for (const [name, answer] of branches) {
          branch = answer;
          await submitAddress(page, address);
          await expect(line(page), `${doc.url} ${name}`).toHaveText(copy.failed);
          await expect(box(page), `${doc.url} ${name}`).toHaveValue(address);
          await expect(page.getByText(copy.success, { exact: true }), `${doc.url} ${name}`).toHaveCount(0);
          await expect(card(page), `${doc.url} ${name}`).toHaveCount(0);
        }
      }
    });

    test(`5 an invalid address shows the invalid line and sends nothing (${locale})`, async ({ page }) => {
      await watch(page);
      const { sent } = await stubNewsletter(page, ok);
      for (const doc of byLocale(locale)) {
        await openWithNewsletter(page, doc.url);
        await submitAddress(page, "not-an-email", false);
        await expect(line(page), doc.url).toHaveText(copy.invalid);
        await expect(box(page), doc.url).toBeFocused();
      }
      await page.waitForTimeout(300);
      expect(sent).toEqual([]);
    });

    test(`6 honeypot end to end: a filled trap is sent untouched, the handler refuses, the visitor sees the failed line (${locale})`, async ({ page }) => {
      await watch(page);
      const { sent } = await stubNewsletter(page, (route, item) => {
        const tripped = item.fields.some(([name, value]) => name !== "Email" && value.trim() !== "");
        return tripped ? route.fulfill({ status: 400, contentType: "application/json", body: '{"ok":false}' }) : ok(route);
      });
      for (const doc of byLocale(locale)) {
        await openWithNewsletter(page, doc.url);
        await expect(footer(page).getByRole("textbox"), `${doc.url}: the traps are out of the accessibility tree`).toHaveCount(1);
        await footer(page).locator('input[name="website"]').fill("x", { force: true });
        await submitAddress(page, `guest+${locale}@example.com`);
        await expect(line(page), doc.url).toHaveText(copy.failed);
        expect(Object.fromEntries(sent[sent.length - 1].fields).website, doc.url).toBe("x");
      }
    });

    test(`8 reduced motion: the column and the toast show in place; the footer is never left hidden (${locale})`, async ({ browser }) => {
      const context = await browser.newContext({ reducedMotion: "reduce", viewport: { width: 1440, height: 900 } });
      const page = await context.newPage();
      await watch(page);
      await stubNewsletter(page, ok);
      for (const pattern of ["/", "/about", "/private-stays/[stay]"]) {
        const doc = byLocale(locale).find((d) => d.pattern === pattern)!;
        await openWithNewsletter(page, doc.url);
        await form(page).scrollIntoViewIfNeeded();
        expect(await style(footer(page), "opacity"), doc.url).toBe("1");
        expect(await style(form(page), "opacity"), doc.url).toBe("1");
        await submitAddress(page, `guest+${locale}@example.com`);
        await expect(card(page), doc.url).toBeVisible();
        expect(await style(card(page), "opacity"), doc.url).toBe("1");
      }
      await context.close();
    });
  });
}
