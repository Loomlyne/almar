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
/** The stored Arabic and Spanish of the Notes (the AI's earlier fill), placeholders only. */
const NOTES_AR = "[الملاحظات بالعربية]";
const NOTES_ES = "[Notas en español]";
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

type Fixture = { base: boolean; ranges: boolean; overlap?: boolean; translate?: "ok" | "fail" };

const ranges = (price: string) => [
  { id: "range-a", first_night: "2026-12-18", last_night: "2027-01-04", nights: 18, nightly_rate_aed: price },
  { id: "range-b", first_night: "2027-01-05", last_night: "2027-01-11", nights: 7, nightly_rate_aed: price },
  { id: "range-c", first_night: "2027-02-12", last_night: "2027-02-18", nights: 7, nightly_rate_aed: price },
];

const reply = (route: Route, status: number, json: unknown) =>
  route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(json) });

type Calls = { gets: URL[]; posts: { path: string; body: unknown }[] };

async function mockApi(page: Page, locale: Locale, fixture: Fixture): Promise<Calls> {
  const b = BRACKET[locale];
  const calls: Calls = { gets: [], posts: [] };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!url.pathname.startsWith("/api/ops/") || url.pathname === "/api/ops/translate") return;
    if (request.method() === "GET") calls.gets.push(url);
    else calls.posts.push({ path: url.pathname, body: request.postDataJSON() });
  });
  await page.route(/\/api\/ops\/stay-rates(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === "POST") {
      const body = request.postDataJSON() as { action: string };
      if (body.action === "save_range" && fixture.overlap) {
        return reply(route, 409, { ok: false, error: { code: "rate_overlap", field: "range", locale: null, detail: { conflict_id: "range-b" } } });
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
      access: { address: b.address, wifi_name: b.wifi, wifi_password: b.password, door_code: b.door, notes: b.notes, notes_ar: NOTES_AR, notes_es: NOTES_ES, updated_at: "2026-10-01T00:00:00Z" },
    }),
  );
  // The translate route (contract 5.11): "[AR] <English>" / "[ES] <English>", or 502 translate_failed. No Workers AI.
  await page.route("**/api/ops/translate", (route) => {
    const body = route.request().postDataJSON() as { target: string; fields: Record<string, string> };
    if (fixture.translate === "fail") return reply(route, 502, { ok: false, error: { code: "translate_failed", field: null, locale: null, detail: null } });
    const tag = `[${body.target.toUpperCase()}]`;
    return reply(route, 200, { ok: true, target: body.target, fields: Object.fromEntries(Object.entries(body.fields).map(([k, v]) => [k, `${tag} ${v}`])) });
  });
  return calls;
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
    // The dashboard's sticky top bar sits at the top of the page at capture.
    const bar = document.querySelector("header");
    if (bar && Math.round(bar.getBoundingClientRect().top) !== 0) out.push(`top bar at ${bar.getBoundingClientRect().top}`);
    // A password field's eye never covers its text box (in either direction): the eye stays out of the content box.
    for (const input of Array.from(editor.querySelectorAll<HTMLInputElement>(".is-password input"))) {
      const eye = input.parentElement?.querySelector("button");
      if (!eye || input.offsetParent === null) continue;
      const box = input.getBoundingClientRect();
      const style = getComputedStyle(input);
      const left = box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft);
      const right = box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight);
      const e = eye.getBoundingClientRect();
      if (e.left < right && e.right > left) out.push(`eye over text: ${input.id} (${document.documentElement.dir || "ltr"})`);
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
  { state: "access-translations", fixture: { base: true, ranges: true }, viewports: ALL, locales: LOCALES },
  { state: "access-ai-failed", fixture: { base: true, ranges: true, translate: "fail" }, viewports: ALL, locales: LOCALES },
  { state: "two-saves", fixture: { base: false, ranges: false }, viewports: ALL, locales: LOCALES },
  { state: "new-stay", fixture: { base: false, ranges: false }, viewports: ["phone", "desktop"], locales: ["en"] },
];

/** The card a state is about, scrolled to the top of a phone picture's story (full-page shots show all of it anyway). */
const card = (page: Page, title: string) => page.locator("section").filter({ has: page.getByRole("heading", { name: title, exact: true }) });

/**
 * The Access card's Edit translations control is the kit's (controller review 2026-10-15 05:00): the same classes as
 * the Text card's control and a chevron. Open, the Arabic and Spanish Notes boxes are as wide as the English Notes box.
 */
async function expectKitTranslations(page: Page, locale: Locale, open: boolean) {
  const copy = OPS_STAY_TABS_COPY[locale];
  const kit = OPS_KIT_COPY[locale];
  const toggle = open ? kit.editor.hideTranslations : kit.editor.editTranslations;
  const access = card(page, copy.access.title);
  const mine = access.getByRole("button", { name: toggle, exact: true });
  const text = page
    .locator("section")
    .filter({ hasNot: page.getByRole("heading", { name: copy.access.title, exact: true }) })
    .getByRole("button", { name: kit.editor.editTranslations, exact: true });
  await expect(text).toHaveCount(1);
  expect(await mine.getAttribute("class"), "the Access control has the Text card's classes").toBe(await text.getAttribute("class"));
  await expect(mine.locator("svg"), "the Access control has the chevron").toHaveCount(1);
  if (!open) return;
  const notes = await access.getByLabel(copy.access.notes, { exact: true }).boundingBox();
  for (const target of ["ar", "es"] as const) {
    const box = await access.getByLabel(`${copy.access.notes} · ${kit.languages[target]}`, { exact: true }).boundingBox();
    expect(Math.abs(box!.width - notes!.width), `Notes · ${target} is as wide as Notes`).toBeLessThanOrEqual(1);
  }
}

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
            // The owner's path: Add range, pick 05/01/2027 to 11/01/2027 (7 nights, the same length as the stored
            // 05/01 to 11/01 range), Save range; the server answers 409 rate_overlap on that stored range (range-b).
            // The rate field gets a well-formed amount only for the request and shows the bracket again before the picture.
            const rates = card(page, copy.rates.title);
            await rates.getByRole("button", { name: copy.rates.addRange, exact: true }).click();
            const form = rates.locator("[data-range-form]");
            await form.getByLabel(copy.rates.dates, { exact: true }).click();
            const calendar = page.getByRole("dialog");
            for (let n = 0; n < 24 && !(await calendar.getByText("January 2027", { exact: true }).isVisible()); n += 1) {
              await calendar.getByRole("button", { name: "Next month" }).click();
            }
            await calendar.getByRole("gridcell", { name: /\b5 January 2027\b/ }).click();
            await calendar.getByRole("gridcell", { name: /\b11 January 2027\b/ }).click();
            const rate = form.getByLabel(copy.rates.perNight, { exact: true });
            await rate.fill("1");
            await form.getByRole("button", { name: copy.rates.saveRange, exact: true }).click();
            await expect(alerts(page).filter({ hasText: copy.rates.overlap })).toBeVisible();
            // The row sentence is on the row it clashes with, outside that row's open link.
            const marked = rates.locator(":is(tr, li):visible").filter({ has: page.locator("[data-overlap]") });
            await expect(marked).toHaveCount(1);
            await expect(marked).toContainText("05/01/2027");
            await expect(rates.locator("button [data-overlap]")).toHaveCount(0);
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
            await expectKitTranslations(page, locale, false);
          }

          if (shot.state === "access-translations") {
            // Edit translations open under the English Notes: the Arabic and Spanish the AI filled, editable.
            const access = card(page, copy.access.title);
            await access.getByRole("button", { name: kit.editor.editTranslations, exact: true }).click();
            await expect(access.getByLabel(`${copy.access.notes} · ${kit.languages.ar}`, { exact: true })).toHaveValue(NOTES_AR);
            await expect(access.getByLabel(`${copy.access.notes} · ${kit.languages.es}`, { exact: true })).toHaveValue(NOTES_ES);
            await expectKitTranslations(page, locale, true);
          }

          if (shot.state === "access-ai-failed") {
            // The English Notes changed and saved; the AI did not answer, so the card's own line says what happened.
            const access = card(page, copy.access.title);
            await access.getByLabel(copy.access.notes, { exact: true }).fill("[New notes]");
            await access.getByRole("button", { name: copy.access.saveAccess, exact: true }).click();
            await expect(alerts(page).filter({ hasText: copy.access.translationFailed })).toBeVisible();
            await expect(access.getByRole("button", { name: copy.access.saveAccess, exact: true })).toBeEnabled();
            await expectKitTranslations(page, locale, false);
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
          // A click can leave the page scrolled; the full-page shot must start at the top with the bar at the top.
          await page.evaluate(() => window.scrollTo(0, 0));
          await page.waitForFunction(() => window.scrollY === 0);
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

// ---- behaviour -------------------------------------------------------------------------------------------------------
// The cards against contract-shaped fixtures, request bodies asserted. Amounts typed here are test input for a request
// body, never drawn in a picture.

async function openEditor(page: Page, state: string, viewport: Viewport, locale: Locale, fixture: Fixture) {
  const calls = await mockApi(page, locale, fixture);
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(harnessUrl(state, locale));
  await settle(page);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
  await expect(card(page, OPS_STAY_TABS_COPY[locale].rates.title).getByLabel(OPS_STAY_TABS_COPY[locale].rates.baseLabel)).toBeVisible();
  return calls;
}

const posted = (calls: Calls, path: string) => calls.posts.filter((call) => call.path === path).map((call) => call.body);

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  for (const viewport of ["phone", "desktop"] as const) {
    for (const locale of ["en", "ar"] as const) {
      const at = `${VIEWPORTS[viewport].width} ${locale}`;

      test(`rates: Save price sends set_base with the typed amount as a 2-decimal string; a comma is refused before any request (${at})`, async ({ page }) => {
        const copy = OPS_STAY_TABS_COPY[locale];
        const calls = await openEditor(page, "rates-empty", viewport, locale, { base: false, ranges: false });
        const rates = card(page, copy.rates.title);
        await rates.getByLabel(copy.rates.baseLabel).fill("12,5");
        await rates.getByRole("button", { name: copy.rates.savePrice, exact: true }).click();
        await expect(rates.getByText(copy.rates.moneyError, { exact: true })).toBeVisible();
        expect(posted(calls, "/api/ops/stay-rates")).toEqual([]);
        await rates.getByLabel(copy.rates.baseLabel).fill("12.5");
        await rates.getByRole("button", { name: copy.rates.savePrice, exact: true }).click();
        await expect.poll(() => posted(calls, "/api/ops/stay-rates")).toEqual([{ action: "set_base", stay_id: STAY_ID, base_nightly_rate_aed: "12.50" }]);
      });

      test(`rates: emptying the price sends null (the stay stops being bookable) (${at})`, async ({ page }) => {
        const copy = OPS_STAY_TABS_COPY[locale];
        const calls = await openEditor(page, "rates", viewport, locale, { base: true, ranges: true });
        const rates = card(page, copy.rates.title);
        await rates.getByLabel(copy.rates.baseLabel).fill("");
        await rates.getByRole("button", { name: copy.rates.savePrice, exact: true }).click();
        await expect.poll(() => posted(calls, "/api/ops/stay-rates")).toEqual([{ action: "set_base", stay_id: STAY_ID, base_nightly_rate_aed: null }]);
      });

      test(`rates: a range opened and saved sends save_range with its id; Delete asks first, then sends delete_range (${at})`, async ({ page }) => {
        const copy = OPS_STAY_TABS_COPY[locale];
        const kit = OPS_KIT_COPY[locale];
        const calls = await openEditor(page, "rates", viewport, locale, { base: true, ranges: true });
        const rates = card(page, copy.rates.title);
        await rates.locator("button:visible", { hasText: "05/01/2027" }).first().click();
        const form = rates.locator("[data-range-form]");
        await form.getByLabel(copy.rates.perNight, { exact: true }).fill("7");
        await form.getByRole("button", { name: copy.rates.saveRange, exact: true }).click();
        await expect.poll(() => posted(calls, "/api/ops/stay-rates")).toEqual([
          { action: "save_range", stay_id: STAY_ID, range: { id: "range-b", first_night: "2027-01-05", last_night: "2027-01-11", nightly_rate_aed: "7.00" } },
        ]);
        await rates.locator("button:visible", { hasText: "18/12/2026" }).first().click();
        await form.getByRole("button", { name: kit.delete, exact: true }).click();
        const dialog = page.getByRole("alertdialog").or(page.getByRole("dialog"));
        await expect(dialog.getByText(copy.rates.deleteRangeTitle, { exact: true })).toBeVisible();
        await dialog.getByRole("button", { name: kit.delete, exact: true }).click();
        await expect.poll(() => posted(calls, "/api/ops/stay-rates").at(-1)).toEqual({ action: "delete_range", id: "range-a" });
      });

      test(`rates: a 409 rate_overlap marks the clashing row and keeps what was typed (${at})`, async ({ page }) => {
        const copy = OPS_STAY_TABS_COPY[locale];
        await openEditor(page, "rates", viewport, locale, { base: true, ranges: true, overlap: true });
        const rates = card(page, copy.rates.title);
        await rates.locator("button:visible", { hasText: "18/12/2026" }).first().click();
        const form = rates.locator("[data-range-form]");
        await form.getByLabel(copy.rates.perNight, { exact: true }).fill("9.5");
        await form.getByRole("button", { name: copy.rates.saveRange, exact: true }).click();
        await expect(alerts(page).filter({ hasText: copy.rates.overlap })).toBeVisible();
        await expect(rates.locator(":is(tr, li):visible").filter({ has: page.locator("[data-overlap]") })).toContainText("05/01/2027");
        await expect(form.getByLabel(copy.rates.perNight, { exact: true })).toHaveValue("9.5");
      });

      test(`availability: this month's blocks are asked for this stay; next month asks again; the link opens the Calendar's block form (${at})`, async ({ page }) => {
        const copy = OPS_STAY_TABS_COPY[locale];
        const calls = await openEditor(page, "availability", viewport, locale, { base: true, ranges: true });
        const { y, m } = thisMonth();
        const blocks = () => calls.gets.filter((url) => url.pathname === "/api/ops/blocks");
        await expect.poll(() => blocks().length).toBeGreaterThan(0);
        const first = blocks()[0]!;
        expect(first.searchParams.get("stay_id")).toBe(STAY_ID);
        expect(first.searchParams.get("from")).toBe(`${y}-${m}-01`);
        const availability = card(page, copy.availability.title);
        await expect(availability.locator("td[data-blocked]")).toHaveCount(4 + 1 + 3);
        // Every request so far is for this month (next dev mounts twice in strict mode, so there may be two).
        const before = blocks().length;
        expect(blocks().every((url) => url.searchParams.get("from") === `${y}-${m}-01`)).toBe(true);
        await availability.getByRole("button", { name: copy.availability.nextMonth, exact: true }).click();
        await expect.poll(() => blocks().length).toBeGreaterThan(before);
        expect(blocks().at(-1)!.searchParams.get("from")).not.toBe(`${y}-${m}-01`);
        // The harness is not under /dashboard, so the link is the ops host's /calendar.
        await expect(availability.getByRole("link", { name: copy.availability.blockDates, exact: true })).toHaveAttribute(
          "href",
          `/calendar?block=stay&stay_id=${STAY_ID}`,
        );
      });

      test(`access: password and door code are hidden with the eye; Save sends exactly the five fields with blanks as null; over 2,000 characters is refused before any request (${at})`, async ({ page }) => {
        const copy = OPS_STAY_TABS_COPY[locale];
        const calls = await openEditor(page, "access", viewport, locale, { base: true, ranges: true });
        const access = card(page, copy.access.title);
        const password = access.getByLabel(copy.access.wifiPassword, { exact: true });
        await expect(password).toHaveAttribute("type", "password");
        await access.getByRole("button", { name: "Show password" }).first().click();
        await expect(password).toHaveAttribute("type", "text");
        await access.getByLabel(copy.access.notes, { exact: true }).fill("x".repeat(2001));
        await access.getByRole("button", { name: copy.access.saveAccess, exact: true }).click();
        await expect(access.getByText(copy.access.tooLong, { exact: true })).toBeVisible();
        expect(posted(calls, "/api/ops/stay-access")).toEqual([]);
        await access.getByLabel(copy.access.notes, { exact: true }).fill("   ");
        await access.getByLabel(copy.access.doorCode, { exact: true }).fill(" 12 ");
        await access.getByRole("button", { name: copy.access.saveAccess, exact: true }).click();
        const b = BRACKET[locale];
        await expect.poll(() => posted(calls, "/api/ops/stay-access")).toEqual([
          // The English Notes emptied: their Arabic and Spanish (of the old English) are emptied too, as on the kit page.
          { action: "save", stay_id: STAY_ID, access: { address: b.address, wifi_name: b.wifi, wifi_password: b.password, door_code: " 12 ", notes: null, notes_ar: null, notes_es: null } },
        ]);
        expect(calls.gets.every((url) => !url.search.includes(b.password))).toBe(true);
      });

      test(`access: a changed English note is translated by the kit's route and saved with its Arabic and Spanish (${at})`, async ({ page }) => {
        const copy = OPS_STAY_TABS_COPY[locale];
        const kit = OPS_KIT_COPY[locale];
        const calls = await openEditor(page, "access", viewport, locale, { base: true, ranges: true, translate: "ok" });
        const access = card(page, copy.access.title);
        await access.getByLabel(copy.access.notes, { exact: true }).fill("[New note]");
        await access.getByRole("button", { name: copy.access.saveAccess, exact: true }).click();
        await expect(access.getByText(kit.editor.translationsUpdated, { exact: true })).toBeVisible();
        const body = posted(calls, "/api/ops/stay-access")[0] as { access: Record<string, unknown> };
        expect(body.access.notes).toBe("[New note]");
        expect(body.access.notes_ar).toBe("[AR] [New note]");
        expect(body.access.notes_es).toBe("[ES] [New note]");
        await expectKitTranslations(page, locale, false);
        await access.getByRole("button", { name: kit.editor.editTranslations, exact: true }).click();
        await expect(access.getByLabel(`${copy.access.notes} · ${kit.languages.ar}`, { exact: true })).toHaveValue("[AR] [New note]");
        await expectKitTranslations(page, locale, true);
      });

      test(`access: when the AI fails, the English and the other fields save, Arabic and Spanish stay, and the card says why (${at})`, async ({ page }) => {
        const copy = OPS_STAY_TABS_COPY[locale];
        const kit = OPS_KIT_COPY[locale];
        const calls = await openEditor(page, "access", viewport, locale, { base: true, ranges: true, translate: "fail" });
        const access = card(page, copy.access.title);
        await access.getByLabel(copy.access.notes, { exact: true }).fill("[New note]");
        await access.getByRole("button", { name: copy.access.saveAccess, exact: true }).click();
        // The card's own line (no Publish on this card), never the kit's.
        await expect(alerts(page).filter({ hasText: copy.access.translationFailed })).toBeVisible();
        await expect(alerts(page).filter({ hasText: kit.editor.translationFailed })).toHaveCount(0);
        const body = posted(calls, "/api/ops/stay-access")[0] as { access: Record<string, unknown> };
        expect(body.access.notes).toBe("[New note]");
        expect("notes_ar" in body.access).toBe(false);
        expect("notes_es" in body.access).toBe(false);
        await access.getByRole("button", { name: kit.editor.editTranslations, exact: true }).click();
        await expect(access.getByLabel(`${copy.access.notes} · ${kit.languages.ar}`, { exact: true })).toHaveValue(NOTES_AR);
        // Save stays pressable with nothing else changed, and the next Save asks the AI again (now answering).
        await page.route("**/api/ops/translate", (route) => {
          const sent = route.request().postDataJSON() as { target: string; fields: Record<string, string> };
          const tag = `[${sent.target.toUpperCase()}]`;
          return reply(route, 200, { ok: true, target: sent.target, fields: Object.fromEntries(Object.entries(sent.fields).map(([k, v]) => [k, `${tag} ${v}`])) });
        });
        const saveAccess = access.getByRole("button", { name: copy.access.saveAccess, exact: true });
        await expect(saveAccess).toBeEnabled();
        await saveAccess.click();
        await expect(access.getByText(kit.editor.translationsUpdated, { exact: true })).toBeVisible();
        await expect(alerts(page).filter({ hasText: copy.access.translationFailed })).toHaveCount(0);
        const second = posted(calls, "/api/ops/stay-access")[1] as { access: Record<string, unknown> };
        expect(second.access.notes_ar).toBe("[AR] [New note]");
        expect(second.access.notes_es).toBe("[ES] [New note]");
        await expect(saveAccess).toBeDisabled();
      });

      test(`dirty: typing in a card makes the page ask "Discard changes?" before leaving (${at})`, async ({ page }) => {
        const copy = OPS_STAY_TABS_COPY[locale];
        const kit = OPS_KIT_COPY[locale];
        await openEditor(page, "access", viewport, locale, { base: true, ranges: true });
        await card(page, copy.access.title).getByLabel(copy.access.address, { exact: true }).fill("[Other address]");
        // The card tells the page after its render; wait for the page's own "Unsaved changes" before trying to leave.
        await expect(page.getByRole("status").filter({ hasText: kit.editor.unsaved })).toBeVisible();
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog", { name: kit.discardTitle })).toBeVisible();
      });
    }
  }
});
