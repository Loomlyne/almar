import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page, type Route } from "@playwright/test";
import { OPS_STAY_TABS_COPY } from "../lib/copy/ops-stay-tabs";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { VIEWPORTS, settle, type Viewport } from "./journey/matrix";

// Plan 03.2-15: the stay editor's Rates, Availability and Access cards inside the kit EditPage (option B). For now only
// the pictures for the owner's signature (behaviour tests come after the signature, Task 2). Every /api/ops/* request
// the cards make is answered here by a page.route fixture: bracket values only, never a rate, an address or a code.
// Written only when asked: STAY_TABS_PICTURES=1 writes into the planning folder, =<folder> writes there.
// Before each shot every drawn text node must be a real string (memory: picture-mock-text-gate), and the visible
// properties a reviewer judges are asserted in the DOM.

type Locale = "en" | "ar" | "es";
const LOCALES: Locale[] = ["en", "ar", "es"];
const STAY_ID = "00000000-0000-4000-8000-000000000015";
const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-stay-tabs&s=${state}&l=${locale}`;
const alerts = (page: Page) => page.locator('[role="alert"]:not([id="__next-route-announcer__"])');

/** Placeholders shown where the owner's own values go. */
const BRACKET: Record<Locale, { price: string; reason: string; address: string; wifi: string; password: string; door: string; notes: string; newName: string }> = {
  en: { price: "[PRICE]", reason: "[Reason]", address: "[Address]", wifi: "[Wi-Fi name]", password: "[Wi-Fi password]", door: "[Door code]", notes: "[Notes]", newName: "[New name]" },
  ar: { price: "[السعر]", reason: "[السبب]", address: "[العنوان]", wifi: "[اسم شبكة Wi-Fi]", password: "[كلمة المرور]", door: "[رمز الباب]", notes: "[ملاحظات]", newName: "[اسم جديد]" },
  es: { price: "[PRECIO]", reason: "[Motivo]", address: "[Dirección]", wifi: "[Nombre del Wi-Fi]", password: "[Contraseña]", door: "[Código]", notes: "[Notas]", newName: "[Nombre nuevo]" },
};

/** This month in Dubai, as the Availability card shows it on open. */
function thisMonth(): { y: string; m: string; name: string } {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dubai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const [y, m] = today.split("-") as [string, string];
  const name = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(new Date(`${y}-${m}-15T00:00:00Z`));
  return { y, m, name };
}
const day = (n: number) => {
  const { y, m } = thisMonth();
  return `${y}-${m}-${String(n).padStart(2, "0")}`;
};

type Fixture = { base: boolean; ranges: boolean; overlap?: boolean };

const ranges = (price: string) => [
  { id: "range-a", first_night: "2026-12-18", last_night: "2027-01-04", nights: 18, nightly_rate_aed: price },
  { id: "range-b", first_night: "2027-01-05", last_night: "2027-01-11", nights: 7, nightly_rate_aed: price },
  { id: "range-c", first_night: "2027-02-12", last_night: "2027-02-18", nights: 7, nightly_rate_aed: price },
];

const reply = (route: Route, status: number, json: unknown) =>
  route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(json) });

async function mockApi(page: Page, locale: Locale, fixture: Fixture) {
  const b = BRACKET[locale];
  await page.route(/\/api\/ops\/stay-rates(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON() as { action: string };
      if (body.action === "save_range" && fixture.overlap) {
        return reply(route, 409, { ok: false, error: { code: "rate_overlap", field: "range", locale: null, detail: { conflict_id: "range-c" } } });
      }
      return reply(route, 200, { ok: true, stay_id: STAY_ID, base_nightly_rate_aed: b.price, affects_site: false });
    }
    const url = new URL(request.url());
    const view: Record<string, unknown> = {
      ok: true,
      stay_id: STAY_ID,
      base_nightly_rate_aed: fixture.base ? b.price : null,
      ranges: fixture.ranges ? ranges(b.price) : [],
    };
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    if (from && to) {
      // One row per night in [from, to): the first two from a range, the rest from the base rate.
      const nights: unknown[] = [];
      for (let at = new Date(`${from}T00:00:00Z`), n = 0; at.toISOString().slice(0, 10) < to; at = new Date(at.getTime() + 86_400_000), n += 1) {
        nights.push({ night: at.toISOString().slice(0, 10), nightly_rate_aed: b.price, source: n < 2 ? "range" : "base" });
      }
      view.nights = nights;
    }
    return reply(route, 200, view);
  });
  await page.route(/\/api\/ops\/blocks(\?.*)?$/, (route) =>
    reply(route, 200, {
      ok: true,
      blocks: [
        { id: "block-1", scope: "stay", destination_id: null, stay_id: STAY_ID, starts_on: day(5), ends_on: day(8), reason: b.reason, created_at: "2026-10-01T00:00:00Z" },
        { id: "block-2", scope: "destination", destination_id: "d1", stay_id: null, starts_on: day(15), ends_on: day(15), reason: null, created_at: "2026-10-01T00:00:00Z" },
        { id: "block-3", scope: "all", destination_id: null, stay_id: null, starts_on: day(24), ends_on: day(26), reason: b.reason, created_at: "2026-10-01T00:00:00Z" },
      ],
    }),
  );
  await page.route(/\/api\/ops\/stay-access(\?.*)?$/, (route) =>
    reply(route, 200, {
      ok: true,
      stay_id: STAY_ID,
      access: { address: b.address, wifi_name: b.wifi, wifi_password: b.password, door_code: b.door, notes: b.notes, updated_at: "2026-10-01T00:00:00Z" },
    }),
  );
}

/** Every text node is a non-empty string with no "[object", "undefined" or "NaN"; no `{token}` is left unfilled. */
async function expectRealText(page: Page) {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => (node.parentElement?.closest("script, style, noscript") ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent ?? "";
      if (/\[object|\bundefined\b|\bNaN\b|\{[a-z]+\}/.test(text)) out.push(text.trim().slice(0, 80));
    }
    for (const element of Array.from(document.querySelectorAll("[aria-label], [title], input[placeholder], img[alt]"))) {
      for (const name of ["aria-label", "title", "placeholder", "alt"]) {
        const value = element.getAttribute(name);
        if (value !== null && (value.trim() === "" || /\[object|\bundefined\b|\bNaN\b/.test(value))) out.push(`${name}="${value}"`);
      }
    }
    return out;
  });
  expect(bad, "every label is a real string").toEqual([]);
}

/** What a reviewer judges, checked in the DOM: boxed inputs, no gold on any button, nothing wider than the page. */
async function expectVisibleProperties(page: Page) {
  const found = await page.evaluate(() => {
    const out: string[] = [];
    const editor = document.querySelector("[data-edit-page]") ?? document.body;
    for (const input of Array.from(editor.querySelectorAll<HTMLElement>("input:not([type=hidden]), textarea"))) {
      const style = getComputedStyle(input);
      if (style.display === "none" || style.visibility === "hidden" || input.offsetParent === null) continue;
      if (parseFloat(style.borderTopWidth) < 1 || parseFloat(style.borderBottomWidth) < 1) out.push(`no border: ${input.id}`);
    }
    // The gold token (tokens.json) may be a 1px line, never on a button (owner, 2026-10-13).
    const gold = getComputedStyle(document.documentElement).getPropertyValue("--color-gold").trim();
    const probe = document.createElement("span");
    probe.style.color = gold;
    document.body.append(probe);
    const goldRgb = getComputedStyle(probe).color;
    probe.remove();
    for (const button of Array.from(editor.querySelectorAll<HTMLElement>("button"))) {
      const style = getComputedStyle(button);
      if (style.backgroundColor === goldRgb || style.borderTopColor === goldRgb || style.color === goldRgb) out.push(`gold button: ${button.textContent?.trim()}`);
    }
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push(`page scrolls sideways: ${document.documentElement.scrollWidth} > ${window.innerWidth}`);
    return out;
  });
  expect(found, "visible properties").toEqual([]);
}

const TO = process.env.STAY_TABS_PICTURES;
const FOLDER = TO && TO !== "1" && isAbsolute(TO) ? TO : join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-15");

type Shot = { state: string; fixture: Fixture; viewports: Viewport[]; locales: Locale[] };
const ALL: Viewport[] = ["phone", "tablet", "desktop"];
const SHOTS: Shot[] = [
  { state: "rates", fixture: { base: true, ranges: true }, viewports: ALL, locales: LOCALES },
  { state: "rates-empty", fixture: { base: false, ranges: false }, viewports: ALL, locales: LOCALES },
  { state: "rates-overlap", fixture: { base: true, ranges: true, overlap: true }, viewports: ALL, locales: LOCALES },
  { state: "rates-check", fixture: { base: true, ranges: true }, viewports: ALL, locales: LOCALES },
  { state: "availability", fixture: { base: true, ranges: true }, viewports: ALL, locales: LOCALES },
  { state: "access", fixture: { base: true, ranges: true }, viewports: ALL, locales: LOCALES },
  { state: "two-saves", fixture: { base: false, ranges: false }, viewports: ALL, locales: LOCALES },
  { state: "new-stay", fixture: { base: false, ranges: false }, viewports: ["phone", "desktop"], locales: ["en"] },
];

/** The card a state is about, scrolled to the top of a phone picture's story (full-page shots show all of it anyway). */
const card = (page: Page, title: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

test.describe("pictures", () => {
  test.skip(!TO, "set STAY_TABS_PICTURES=1 (or a folder) to shoot the pictures");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (TO) mkdirSync(FOLDER, { recursive: true });

  for (const shot of SHOTS) {
    for (const viewport of shot.viewports) {
      for (const locale of shot.locales) {
        const width = VIEWPORTS[viewport].width;
        test(`${shot.state} ${width} ${locale}`, async ({ page }) => {
          const copy = OPS_STAY_TABS_COPY[locale];
          const kit = OPS_KIT_COPY[locale];
          const b = BRACKET[locale];
          await mockApi(page, locale, shot.fixture);
          await page.setViewportSize(VIEWPORTS[viewport]);
          await page.goto(harnessUrl(shot.state, locale));
          await settle(page);
          await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
          await page.waitForFunction((l) => document.documentElement.lang === l, locale);

          if (shot.state === "new-stay") {
            await expect(page.getByRole("heading", { name: copy.rates.title, exact: true })).toHaveCount(0);
            await expect(page.getByRole("heading", { name: copy.access.title, exact: true })).toHaveCount(0);
          } else {
            const rates = card(page, copy.rates.title);
            await expect(rates.getByLabel(copy.rates.baseLabel)).toBeVisible();
            await expect(card(page, copy.access.title).getByLabel(copy.access.address)).toBeVisible();
            await expect(card(page, copy.availability.title).locator("[data-month-grid] td[data-blocked]").first()).toBeVisible();
          }

          if (shot.state === "rates" && viewport !== "phone") {
            // Does the ranges table fit the side column? Reported, so the picture message can say where Rates sits.
            const fit = await card(page, copy.rates.title)
              .locator("div.overflow-x-auto")
              .first()
              .evaluate((box) => ({ scroll: box.scrollWidth, client: box.clientWidth, card: box.closest("section")?.clientWidth ?? 0 }));
            console.log(`RATES-FIT ${width} ${locale} table=${fit.scroll} box=${fit.client} card=${fit.card}`);
          }

          if (shot.state === "rates-empty") {
            await expect(page.getByText(copy.rates.noRate, { exact: true })).toBeVisible();
            await expect(page.getByText(copy.rates.noRanges, { exact: true })).toBeVisible();
          }

          if (shot.state === "rates-overlap") {
            // The owner's path: open a range, press Save range; the server answers 409 rate_overlap on range-c. The rate
            // field gets a well-formed amount only for the request and shows the bracket again before the picture.
            const rates = card(page, copy.rates.title);
            // The list is a table from 768 and cards below; both are in the page, CSS shows one.
            await rates.locator("button:visible", { hasText: "05/01/2027" }).first().click();
            const rate = rates.getByLabel(copy.rates.perNight, { exact: true });
            await rate.fill("1");
            await rates.getByRole("button", { name: copy.rates.saveRange, exact: true }).click();
            await expect(alerts(page).filter({ hasText: copy.rates.overlap })).toBeVisible();
            await expect(rates.locator("[data-overlap]:visible").first()).toBeVisible();
            await rate.fill(b.price);
          }

          if (shot.state === "rates-check") {
            const { y, name } = thisMonth();
            const rates = card(page, copy.rates.title);
            await rates.getByLabel(copy.rates.dates, { exact: true }).click();
            await page.getByRole("gridcell", { name: new RegExp(`\\b20 ${name} ${y}\\b`) }).click();
            await page.getByRole("gridcell", { name: new RegExp(`\\b24 ${name} ${y}\\b`) }).click();
            // The second pick closes the calendar (no Escape: Escape closes the editor page).
            await rates.getByRole("button", { name: copy.rates.check, exact: true }).click();
            await expect(rates.locator("[data-check-table] tbody tr")).toHaveCount(5);
            await expect(rates.locator("[data-check-table]")).toContainText(copy.rates.source.range);
            await expect(rates.locator("[data-check-table]")).toContainText(copy.rates.source.base);
          }

          if (shot.state === "access") {
            const access = card(page, copy.access.title);
            await expect(access.getByLabel(copy.access.wifiPassword, { exact: true })).toHaveAttribute("type", "password");
            await expect(access.getByLabel(copy.access.doorCode, { exact: true })).toHaveAttribute("type", "password");
            await expect(access.getByText(copy.access.guestLine, { exact: true })).toBeVisible();
          }

          if (shot.state === "two-saves") {
            // Both kinds of Save at once: the page's (the English name changed) and a card's (the base price typed).
            await page.locator("#stay-name").fill(b.newName);
            const rates = card(page, copy.rates.title);
            await rates.getByLabel(copy.rates.baseLabel).fill(b.price);
            await expect(page.getByRole("button", { name: kit.save, exact: true }).first()).toBeEnabled();
            await expect(rates.getByRole("button", { name: copy.rates.savePrice, exact: true })).toBeEnabled();
          }

          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          await expectRealText(page);
          await expectVisibleProperties(page);
          await page.screenshot({ path: join(FOLDER, `${shot.state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});
