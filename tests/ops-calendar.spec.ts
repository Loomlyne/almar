import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { OPS_CALENDAR_COPY, overlapLine } from "../lib/copy/ops-calendar";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// The Calendar and its Block dates form on their harness scene (tests/journey/scenes/ops-calendar.tsx). The API is
// never called: the scene holds its own state on bracket data and today is fixed at 2026-10-14.

type Locale = "en" | "ar" | "es";

const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-calendar&s=${state}&l=${locale}`;

async function openScene(page: Page, state: string, viewport: Viewport, locale: Locale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(harnessUrl(state, locale));
  await settle(page);
  // The dev server's own indicator can sit over the page corner.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

// ---- every label is a string --------------------------------------------------------------------------------------
// 03.2-12 shipped "[object Object]" as a label because a duplicate key replaced a string with an object. Two gates:
// the copy file itself (every leaf is a real string), and the drawn page (no text node, label or placeholder says
// [object, undefined or NaN, and every button has a name). Both run for every picture.

const BAD_TEXT = /\[object|undefined|NaN/;

function leaves(value: unknown, path: string, out: { path: string; value: unknown }[] = []) {
  if (Array.isArray(value)) value.forEach((one, at) => leaves(one, `${path}[${at}]`, out));
  else if (value !== null && typeof value === "object") {
    for (const [key, one] of Object.entries(value)) leaves(one, `${path}.${key}`, out);
  } else out.push({ path, value });
  return out;
}

test("copy: every Calendar label is a non-empty string in EN, AR and ES", () => {
  for (const locale of ["en", "ar", "es"] as const) {
    const copy = OPS_CALENDAR_COPY[locale];
    expect(copy.weekdays, `${locale} weekdays`).toHaveLength(7);
    expect(typeof copy.overlap.other, `${locale} overlap.other`).toBe("string");
    for (const { path, value } of leaves(copy, locale)) {
      expect(typeof value, path).toBe("string");
      expect((value as string).trim().length, `${path} is empty`).toBeGreaterThan(0);
      expect(BAD_TEXT.test(value as string), `${path} says ${value}`).toBe(false);
    }
    // Dashboard Spanish speaks usted (owner, 2026-10-14): no tú imperative or verb form.
    if (locale === "es") {
      const spanish = leaves(copy, "es").map((one) => one.value as string).join("\n");
      expect(spanish, "informal Spanish").not.toMatch(/\b(Elige|Elimínalo|vuelve|Revisa|Confirma)\b/);
    }
    // The overlap sentence names its number, in every plural form the language can ask for.
    for (const n of [1, 2, 3, 11, 100]) expect(overlapLine(locale, n), `${locale} overlap ${n}`).toMatch(/\d|حجز(ان| واحد)/);
  }
});

async function assertDrawnText(page: Page) {
  const problems = await page.evaluate((badSource) => {
    const bad = new RegExp(badSource);
    const found: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = (node.textContent ?? "").trim();
      // Next's own flight data sits in <script> tags; only what a person can read counts.
      if (text && bad.test(text) && !node.parentElement?.closest("nextjs-portal, script, style, noscript")) found.push(`text: ${text}`);
    }
    for (const element of document.querySelectorAll("[aria-label], [placeholder], [title]")) {
      if (element.closest("nextjs-portal")) continue;
      for (const name of ["aria-label", "placeholder", "title"]) {
        const value = element.getAttribute(name);
        if (value !== null && (value.trim() === "" || bad.test(value))) found.push(`${name}: "${value}"`);
      }
    }
    for (const button of document.querySelectorAll("button")) {
      if (button.closest("nextjs-portal")) continue;
      if (!(button.textContent ?? "").trim() && !button.getAttribute("aria-label")) found.push("a button with no name");
    }
    return found;
  }, BAD_TEXT.source);
  expect(problems, "drawn text").toEqual([]);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(overflow.scroll, "page scrollWidth").toBeLessThanOrEqual(overflow.client);
}

/** What each state has to show, said from the copy, so a picture cannot be a blank or the wrong screen. */
async function expectState(page: Page, state: string, locale: Locale) {
  const copy = OPS_CALENDAR_COPY[locale];
  const blockedDays = page.getByRole("button", { name: new RegExp(`, ${copy.blockedDay}$`) });
  // The editor page replaces the Calendar: its own title then, with a back link that names the Calendar.
  if (state.startsWith("form-")) {
    await expect(page.getByRole("heading", { level: 1, name: copy.blockDates })).toBeVisible();
    await expect(page.getByRole("button", { name: copy.title, exact: true })).toBeVisible();
  } else {
    await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
  }
  await expect(page.locator('input[type="radio"], [role="radio"]')).toHaveCount(0);
  // The dead booking form is gone: nothing on the page says New booking, Guest or Status.
  await expect(page.getByText(/new booking|nueva reserva|حجز جديد/i)).toHaveCount(0);

  if (state === "month") {
    // Past day 10 and 11, then 19 to 24 and 27.
    await expect(blockedDays).toHaveCount(9);
    await expect(page.getByRole("heading", { level: 2, name: copy.blockedDates })).toBeVisible();
    await expect(page.getByRole("button", { name: copy.blockDates, exact: true })).toBeVisible();
    // One Delete per block of the month.
    await expect(page.getByRole("button", { name: new RegExp(`^${copy.deleteNamed.split("{")[0].trim()}`) })).toHaveCount(6);
  }
  if (state === "month-filtered") {
    // The stay's own day, its destination's two, the all-scope five (past 10 and 11, 19 to 21).
    await expect(blockedDays).toHaveCount(8);
  }
  if (state === "empty") {
    await expect(blockedDays).toHaveCount(0);
    await expect(page.getByText(copy.noBlocks)).toBeVisible();
  }
  if (state === "after-overlap") {
    await expect(page.getByRole("status").filter({ hasText: overlapLine(locale, 2) })).toBeVisible();
  }
  if (state.startsWith("form-")) {
    const kit = OPS_KIT_COPY[locale];
    const editor = page.locator("[data-edit-page]");
    // A full page, not a dialog: no panel, no language tabs, no Translate button, no Draft badge.
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("tab")).toHaveCount(0);
    await expect(editor.getByText(/translate|ترجم|traduc/i)).toHaveCount(0);
    await expect(editor.getByText(copy.blockedNote)).toBeVisible();
    await expect(editor.getByRole("button", { pressed: true }).first()).toBeVisible();
    for (const title of [copy.whatToBlock, copy.dates, copy.reasonOptional]) {
      await expect(editor.getByRole("heading", { level: 2, name: title })).toBeVisible();
      // The card title is said once on screen; the field's own label is visually hidden but still names it.
      const shown = await editor.getByText(title, { exact: true }).evaluateAll((nodes) =>
        nodes.filter((node) => {
          const rect = (node as HTMLElement).getBoundingClientRect();
          return rect.width > 1 && rect.height > 1;
        }).length,
      );
      expect(shown, `"${title}" drawn once`).toBe(1);
    }
    await expect(editor.getByRole("textbox", { name: copy.reasonOptional, exact: true })).toBeVisible();
    await expect(editor.locator('button[id$="-dates"]')).toBeVisible();
    expect(await editor.locator('label[for$="-dates"]').textContent()).toBe(copy.dates);
    // A block has no publish step: Save is the one action, the shared primary button: teal fill, ivory (#fffaf0) text.
    await expect(editor.getByRole("button", { name: kit.publish, exact: true })).toHaveCount(0);
    const save = editor.getByRole("button", { name: kit.save, exact: true });
    await expect(save).toBeVisible();
    const look = await save.evaluate((element) => {
      const style = getComputedStyle(element);
      return { fill: style.backgroundColor, text: style.color, radius: style.borderTopLeftRadius };
    });
    expect(look.fill, "Save fill").toBe("rgb(31, 59, 64)");
    expect(look.text, "Save text").toBe("rgb(255, 250, 240)");
    expect(look.radius, "square corners").toBe("0px");
    // Two columns from 1024 (the reason beside the rest, on the inline end), one below; nothing scrolls sideways.
    const box = async (title: string) =>
      editor.locator("section").filter({ has: page.getByRole("heading", { level: 2, name: title }) }).evaluate((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top };
      });
    const what = await box(copy.whatToBlock);
    const reason = await box(copy.reasonOptional);
    if (page.viewportSize()!.width >= 1024) {
      expect(reason.top, "reason card sits beside").toBe(what.top);
      if (locale === "ar") expect(reason.right).toBeLessThanOrEqual(what.left);
      else expect(reason.left).toBeGreaterThanOrEqual(what.right);
    } else {
      expect(reason.top, "one column").toBeGreaterThan(what.top);
    }
  }
  // Inside the editor page only: the dashboard rail beside it has its own "Stays" link.
  if (state === "form-stay-prefilled") {
    const editor = page.locator("[data-edit-page]");
    await expect(editor.getByRole("button", { name: copy.oneStay, pressed: true })).toBeVisible();
    await expect(editor.getByText(copy.stays, { exact: true })).toBeVisible();
  }
  if (state === "form-one-day") {
    await expect(page.locator("[data-edit-page]").getByText("30/10/2026", { exact: true })).toBeVisible();
  }
}

// ---- pictures -----------------------------------------------------------------------------------------------------
// Full-page PNGs for the owner's signature, written outside tests/ (page.screenshot, not toHaveScreenshot), so no
// baseline is committed under tests/. 7 states x 3 widths x 3 languages. They run only when asked, so a full
// Playwright run never rewrites a signed picture: OPS_CALENDAR_PICTURES=1 writes into the planning folder,
// OPS_CALENDAR_PICTURES=<absolute folder> writes there.

const PLANNING_PICTURES = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-13");
const PICTURES_TO = process.env.OPS_CALENDAR_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : PLANNING_PICTURES;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const PICTURE_LOCALES: Locale[] = ["en", "ar", "es"];
/** The signed grid states: OPS_CALENDAR_ONLY=form shoots only the three form states on the kit editor page. */
const ONLY_FORM = process.env.OPS_CALENDAR_ONLY === "form";

test.describe("pictures", () => {
  test.skip(!PICTURES_TO, "set OPS_CALENDAR_PICTURES=1 (or a folder) to shoot the pictures");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  for (const state of sceneStates("ops-calendar")) {
    if (ONLY_FORM && !state.startsWith("form-")) continue;
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await openScene(page, state, viewport, locale);
          await expectState(page, state, locale);
          await assertDrawnText(page);
          await expectNoSidewaysScroll(page);
          expect(await page.evaluate(() => document.documentElement.dir)).toBe(locale === "ar" ? "rtl" : "ltr");
          // The page focuses its title on open; the ring is real but is not what the picture is for.
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          // Network idle is capped (a bare wait times out on a cold dev server), then a short settle.
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await page.waitForTimeout(400);
          await page.screenshot({ path: join(PICTURES, `${state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});

// ---- behaviour on the real screen ---------------------------------------------------------------------------------
// /dashboard/calendar on `next dev` (no ops host, so the preview shell), every /api/ops/* answered by page.route from a
// small in-memory server that keeps what it was sent. The browser's time zone is Pago Pago (UTC-11) and the clock is
// 2026-10-14 10:00 UTC: it is the 13th there and the 14th in Dubai, so a screen that reads the device day fails.

import type { Route } from "@playwright/test";

const D1 = "11111111-1111-4111-8111-111111111111";
const D2 = "22222222-2222-4222-8222-222222222222";
const S1 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1";
const S2 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2";
const S3 = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3";
const NOW = new Date("2026-10-14T10:00:00Z");

type Fixture = {
  id: string;
  scope: "all" | "destination" | "stay";
  destination_id: string | null;
  stay_id: string | null;
  starts_on: string;
  ends_on: string;
  reason: string | null;
  created_at: string;
};

const fixture = (id: string, scope: Fixture["scope"], target: string | null, from: string, to: string, reason: string | null = null): Fixture => ({
  id,
  scope,
  destination_id: scope === "destination" ? target : null,
  stay_id: scope === "stay" ? target : null,
  starts_on: from,
  ends_on: to,
  reason,
  created_at: "2026-10-01T08:00:00Z",
});

const DESTINATIONS = [
  { id: D1, name_en: "[Destination 1]" },
  { id: D2, name_en: "[Destination 2]" },
];
const STAYS = [
  { id: S1, title_en: "[Stay 1]", destination_id: D1 },
  { id: S2, title_en: "[Stay 2]", destination_id: D1 },
  { id: S3, title_en: "[Stay 3]", destination_id: D2 },
];

/** An in-memory /api/ops/blocks, destinations and stays. `gets` and `posts` are everything the screen sent. */
type MockOptions = {
  overlap?: number;
  /** HTTP status of a refused add (an `invalid` reply, on `addField`). */
  addFails?: number;
  addField?: string | null;
  /** The add request never gets a reply (offline). */
  addOffline?: boolean;
  /** HTTP status of a refused delete (an `unavailable` reply). */
  deleteFails?: number;
  /** One pick list that fails to load. */
  listFails?: "destinations" | "stays";
  /** A month window (`from`) whose GET fails. */
  monthFails?: string;
};

const UNAVAILABLE = { code: "unavailable", field: null, locale: null, detail: null };

async function mockApi(page: Page, options: MockOptions = {}) {
  const state = {
    blocks: [fixture("b1", "all", null, "2026-10-19", "2026-10-21", "[Reason]"), fixture("b2", "stay", S1, "2026-10-23", "2026-10-23")],
    gets: [] as string[],
    posts: [] as Record<string, unknown>[],
    other: [] as string[],
    overlap: options.overlap ?? 0,
    addFails: options.addFails ?? 0,
    addField: options.addField ?? null,
    addOffline: options.addOffline ?? false,
    deleteFails: options.deleteFails ?? 0,
    monthFails: options.monthFails ?? null,
    next: 3,
  };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
  await page.route("**/api/ops/**", async (route) => {
    const url = new URL(route.request().url());
    const method = route.request().method();
    if (url.pathname === "/api/ops/destinations") {
      return options.listFails === "destinations" ? json(route, { ok: false, error: UNAVAILABLE }, 503) : json(route, { ok: true, items: DESTINATIONS });
    }
    if (url.pathname === "/api/ops/stays") {
      return options.listFails === "stays" ? json(route, { ok: false, error: UNAVAILABLE }, 503) : json(route, { ok: true, items: STAYS });
    }
    if (url.pathname !== "/api/ops/blocks") {
      state.other.push(`${method} ${url.pathname}`);
      return json(route, { ok: false, error: { code: "not_found", field: null, locale: null, detail: null } }, 404);
    }
    if (method === "GET") {
      state.gets.push(`${url.search}`);
      const from = url.searchParams.get("from") ?? "";
      const to = url.searchParams.get("to") ?? "";
      const stay = url.searchParams.get("stay_id");
      const destination = url.searchParams.get("destination_id");
      if (state.monthFails === from) return json(route, { ok: false, error: UNAVAILABLE }, 503);
      const homeOf = (id: string) => STAYS.find((one) => one.id === id)?.destination_id;
      const blocks = state.blocks.filter((block) => {
        if (block.ends_on < from || block.starts_on > to) return false;
        if (stay) return block.scope === "all" || block.stay_id === stay || (block.scope === "destination" && block.destination_id === homeOf(stay));
        if (destination) return block.scope === "all" || block.destination_id === destination;
        return true;
      });
      return json(route, { ok: true, blocks });
    }
    const body = route.request().postDataJSON() as { action: string; block?: Record<string, string | null>; id?: string };
    state.posts.push(body);
    if (body.action === "add") {
      if (state.addOffline) return route.abort("internetdisconnected");
      if (state.addFails) return json(route, { ok: false, error: { code: "invalid", field: state.addField, locale: null, detail: null } }, state.addFails);
      const block = body.block!;
      const id = `b${state.next++}`;
      state.blocks.push(fixture(id, block.scope as Fixture["scope"], block.destination_id ?? block.stay_id ?? null, block.starts_on!, block.ends_on!, block.reason));
      state.blocks.sort((a, b) => a.starts_on.localeCompare(b.starts_on));
      return json(route, { ok: true, id, affects_site: true, overlapping_bookings: state.overlap });
    }
    if (state.deleteFails) return json(route, { ok: false, error: UNAVAILABLE }, state.deleteFails);
    state.blocks = state.blocks.filter((block) => block.id !== body.id);
    return json(route, { ok: true, id: body.id, affects_site: true });
  });
  return state;
}

async function openCalendar(page: Page, viewport: Viewport, locale: Locale, search = "") {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.context().addCookies([{ name: "almar-locale", value: locale, domain: "127.0.0.1", path: "/" }]);
  await page.clock.setFixedTime(NOW);
  await page.goto(`/dashboard/calendar${search}`);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  // The Calendar, or the Block dates page when a stay or destination link opens it straight away.
  const copy = OPS_CALENDAR_COPY[locale];
  const either = new RegExp(`^(${copy.title}|${copy.blockDates})$`);
  await expect(page.getByRole("heading", { level: 1, name: either })).toBeVisible({ timeout: 45_000 });
}

const COMBOS: { viewport: Viewport; locale: Locale }[] = [
  { viewport: "phone", locale: "en" },
  { viewport: "phone", locale: "ar" },
  { viewport: "desktop", locale: "en" },
  { viewport: "desktop", locale: "ar" },
];

const dayButton = (page: Page, iso: string, locale: Locale) => {
  const [y, m, d] = iso.split("-");
  void locale;
  return page.getByRole("button", { name: new RegExp(`^${d}/${m}/${y}`) });
};

/** Pick the first and then the last day in the Dates field of the open form. */
async function pickDates(page: Page, first: string, last: string) {
  // A pick list that just closed hands focus back to its button; open the picker only once it has (a person's pace).
  await expect(page.getByRole("listbox")).toHaveCount(0);
  await page.locator("[data-edit-page]").locator('button[id$="-dates"]').click();
  await expect(page.locator(".calendar")).toBeVisible();
  // The picker opens on the month of today (Dubai); walk to the month of a day that is further on.
  for (const day of [first, last]) {
    const cell = page.locator(`[data-date="${dateKey(day)}"]`);
    for (let step = 0; step < 4 && (await cell.count()) === 0; step += 1) await page.locator('.calendar button[aria-label="Next month"]').click();
    await cell.click();
  }
}

/** CalendarPanel's own key: month and day are not padded. */
const dateKey = (iso: string) => {
  const [y, m, d] = iso.split("-");
  return `${y}-${Number(m)}-${Number(d)}`;
};

test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  test.use({ timezoneId: "Pacific/Pago_Pago" });

  for (const { viewport, locale } of COMBOS) {
    const width = VIEWPORTS[viewport].width;
    const copy = OPS_CALENDAR_COPY[locale];
    const at = `${width} ${locale}`;
    const blockedDays = (page: Page) => page.getByRole("button", { name: new RegExp(`, ${copy.blockedDay}$`) });
    const deletes = (page: Page) => page.getByRole("button", { name: new RegExp(`^${copy.deleteNamed.split("{")[0].trim()}`) });
    const kit = OPS_KIT_COPY[locale];
    // Block dates is the kit editor page (signed 2026-10-15): it replaces the Calendar; Save is its one action.
    const editor = (page: Page) => page.locator("[data-edit-page]");
    const saveButton = (page: Page) => editor(page).getByRole("button", { name: kit.save, exact: true });
    const reasonBox = (page: Page) => editor(page).getByRole("textbox", { name: copy.reasonOptional, exact: true });

    test(`the month loads from the API: window, blocked days, list, today is the Dubai day (${at})`, async ({ page }) => {
      const api = await mockApi(page);
      await openCalendar(page, viewport, locale);
      await expect(blockedDays(page)).toHaveCount(4);
      await expect(deletes(page)).toHaveCount(2);
      await expect(page.getByText("[Reason]")).toBeVisible();
      // The first request for blocks is the whole of October, both ends inclusive, with no filter.
      expect(api.gets.some((query) => query === "?from=2026-10-01&to=2026-10-31")).toBe(true);
      // It is the 13th in Pago Pago and the 14th in Dubai: the 14th is today, the 13th is past and cannot be clicked.
      await expect(dayButton(page, "2026-10-14", locale)).toHaveAttribute("aria-current", "date");
      await expect(dayButton(page, "2026-10-14", locale)).toBeEnabled();
      await expect(dayButton(page, "2026-10-13", locale)).toBeDisabled();
      // The dead booking form is gone.
      await expect(page.getByText(/new booking|nueva reserva|حجز جديد/i)).toHaveCount(0);
      expect(api.other).toEqual([]);
    });

    test(`block everything: the dates are picked, the body is exact, the month is fetched again (${at})`, async ({ page }) => {
      const api = await mockApi(page);
      await openCalendar(page, viewport, locale);
      await page.getByRole("button", { name: copy.blockDates, exact: true }).click();
      await expect(editor(page)).toBeVisible();
      await expect(page.getByRole("heading", { level: 1, name: copy.blockDates })).toBeVisible();
      await pickDates(page, "2026-10-27", "2026-10-28");
      await reasonBox(page).fill("  [Owner stay]  ");
      const reads = api.gets.length;
      await saveButton(page).click();
      await expect.poll(() => api.posts.length).toBe(1);
      expect(api.posts[0]).toEqual({
        action: "add",
        block: { scope: "all", starts_on: "2026-10-27", ends_on: "2026-10-28", reason: "[Owner stay]" },
      });
      // Saved: the page closes and the Calendar is back.
      await expect(editor(page)).toHaveCount(0);
      await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
      await expect.poll(() => api.gets.length).toBeGreaterThan(reads);
      await expect(blockedDays(page)).toHaveCount(6);
      await expect(deletes(page)).toHaveCount(3);
      await expect(page.getByRole("status").filter({ hasText: /\d/ })).toHaveCount(0);
    });

    test(`a day click blocks that one day (the same day twice) and a past day cannot be clicked (${at})`, async ({ page }) => {
      const api = await mockApi(page);
      await openCalendar(page, viewport, locale);
      await dayButton(page, "2026-10-25", locale).click();
      await expect(editor(page).locator('button[id$="-dates"]')).toContainText("25/10/2026");
      await saveButton(page).click();
      await expect.poll(() => api.posts.length).toBe(1);
      expect(api.posts[0]).toEqual({ action: "add", block: { scope: "all", starts_on: "2026-10-25", ends_on: "2026-10-25", reason: null } });
      // In the picker, days before the Dubai today are not pickable either.
      await page.getByRole("button", { name: copy.blockDates, exact: true }).click();
      await editor(page).locator('button[id$="-dates"]').click();
      await expect(page.locator(`[data-date="${dateKey("2026-10-13")}"]`)).toBeDisabled();
      await expect(page.locator(`[data-date="${dateKey("2026-10-14")}"]`)).toBeEnabled();
    });

    test(`one destination and one stay send their id and never the other (${at})`, async ({ page }) => {
      const api = await mockApi(page);
      await openCalendar(page, viewport, locale);
      await page.getByRole("button", { name: copy.blockDates, exact: true }).click();
      await editor(page).getByRole("button", { name: copy.oneDestination }).click();
      await editor(page).getByRole("combobox", { name: new RegExp(copy.destinations) }).click();
      await page.getByRole("option", { name: "[Destination 2]" }).click();
      await expect(editor(page).getByRole("combobox", { name: /\[Destination 2\]/ })).toBeFocused();
      await pickDates(page, "2026-11-02", "2026-11-04");
      await saveButton(page).click();
      await expect.poll(() => api.posts.length).toBe(1);
      expect(api.posts[0]).toEqual({ action: "add", block: { scope: "destination", destination_id: D2, starts_on: "2026-11-02", ends_on: "2026-11-04", reason: null } });

      await page.getByRole("button", { name: copy.blockDates, exact: true }).click();
      await editor(page).getByRole("button", { name: copy.oneStay }).click();
      await editor(page).getByRole("combobox", { name: new RegExp(copy.stays) }).click();
      await page.getByRole("option", { name: "[Stay 3]" }).click();
      await expect(editor(page).getByRole("combobox", { name: /\[Stay 3\]/ })).toBeFocused();
      await pickDates(page, "2026-10-30", "2026-10-30");
      await saveButton(page).click();
      await expect.poll(() => api.posts.length).toBe(2);
      expect(api.posts[1]).toEqual({ action: "add", block: { scope: "stay", stay_id: S3, starts_on: "2026-10-30", ends_on: "2026-10-30", reason: null } });
    });

    test(`an incomplete form says what is missing and sends nothing (${at})`, async ({ page }) => {
      const api = await mockApi(page);
      await openCalendar(page, viewport, locale);
      await page.getByRole("button", { name: copy.blockDates, exact: true }).click();
      await saveButton(page).click();
      await expect(editor(page).getByRole("alert")).toHaveText(copy.needDates);
      await editor(page).getByRole("button", { name: copy.oneStay }).click();
      // A change clears the sentence until the next Save.
      await expect(editor(page).getByRole("alert")).toHaveCount(0);
      await saveButton(page).click();
      await expect(editor(page).getByRole("alert")).toHaveText(copy.needStay);
      await expect(editor(page)).toBeVisible();
      expect(api.posts).toEqual([]);
    });

    test(`bookings that overlap are said after Block, with their number; a server refusal keeps the form open (${at})`, async ({ page }) => {
      const api = await mockApi(page, { overlap: 2 });
      await openCalendar(page, viewport, locale);
      await dayButton(page, "2026-10-26", locale).click();
      await saveButton(page).click();
      await expect(page.getByRole("status").filter({ hasText: overlapLine(locale, 2) })).toBeVisible();
      await page.getByRole("status").getByRole("button").click();
      await expect(page.getByRole("status").filter({ hasText: overlapLine(locale, 2) })).toHaveCount(0);

      // A refused field of the block itself reads as the form's generic sentence, never a column name (PR #17 item 7).
      api.addFails = 400;
      api.addField = "block.ends_on";
      await dayButton(page, "2026-10-29", locale).click();
      await saveButton(page).click();
      await expect(editor(page).getByRole("alert")).toHaveText(kit.errors.invalid);
      await expect(editor(page)).toBeVisible();
    });

    test(`Delete asks first; Cancel keeps the block, Delete posts the id and the list is fetched again (${at})`, async ({ page }) => {
      const api = await mockApi(page);
      await openCalendar(page, viewport, locale);
      await deletes(page).first().click();
      await expect(page.getByRole("dialog")).toContainText(copy.deleteTitle);
      await page.getByRole("dialog").getByRole("button", { name: OPS_KIT_COPY[locale].cancel }).click();
      expect(api.posts).toEqual([]);
      await expect(deletes(page)).toHaveCount(2);

      const reads = api.gets.length;
      await deletes(page).first().click();
      await page.getByRole("dialog").getByRole("button", { name: OPS_KIT_COPY[locale].delete, exact: true }).click();
      await expect.poll(() => api.posts.length).toBe(1);
      expect(api.posts[0]).toEqual({ action: "delete", id: "b1" });
      await expect.poll(() => api.gets.length).toBeGreaterThan(reads);
      await expect(deletes(page)).toHaveCount(1);
      await expect(blockedDays(page)).toHaveCount(1);
    });
  }

  test("the filter sends stay_id or destination_id, never both, and the month arrows ask for the next month's own window", async ({ page }) => {
    const api = await mockApi(page);
    await openCalendar(page, "desktop", "en");
    const copy = OPS_CALENDAR_COPY.en;
    const filter = page.getByRole("combobox", { name: /^Show:/ });
    await filter.click();
    await page.getByRole("option", { name: "[Stay 2]" }).click();
    await expect.poll(() => api.gets.at(-1)).toBe(`?from=2026-10-01&to=2026-10-31&stay_id=${S2}`);
    // Stay 2 sees the all-scope block (19 to 21) and none of Stay 1's.
    await expect(page.getByRole("button", { name: /, Blocked$/ })).toHaveCount(3);
    await filter.click();
    await page.getByRole("option", { name: "[Destination 2]" }).click();
    await expect.poll(() => api.gets.at(-1)).toBe(`?from=2026-10-01&to=2026-10-31&destination_id=${D2}`);
    await filter.click();
    await page.getByRole("option", { name: copy.allTargets }).click();
    await expect.poll(() => api.gets.at(-1)).toBe("?from=2026-10-01&to=2026-10-31");
    await page.getByRole("button", { name: copy.nextMonth }).click();
    await expect.poll(() => api.gets.at(-1)).toBe("?from=2026-11-01&to=2026-11-30");
    await page.getByRole("button", { name: copy.nextMonth }).click();
    await expect.poll(() => api.gets.at(-1)).toBe("?from=2026-12-01&to=2026-12-31");
    await expect(page.getByText(copy.noBlocks)).toBeVisible();
  });

  test("the link of a stay page opens the form with that stay; any other query is ignored and nothing of it is sent", async ({ page }) => {
    const api = await mockApi(page);
    const copy = OPS_CALENDAR_COPY.en;
    await openCalendar(page, "phone", "en", `?block=stay&stay_id=${S2}&reason=HACK&starts_on=2026-10-30`);
    const editor = page.locator("[data-edit-page]");
    await expect(editor).toBeVisible();
    await expect(editor.getByRole("button", { name: copy.oneStay, pressed: true })).toBeVisible();
    await expect(editor.getByRole("combobox", { name: /\[Stay 2\]/ })).toBeVisible();
    await expect(editor.getByRole("textbox", { name: copy.reasonOptional, exact: true })).toHaveValue("");
    await pickDates(page, "2026-10-30", "2026-10-30");
    await editor.getByRole("button", { name: OPS_KIT_COPY.en.save, exact: true }).click();
    await expect.poll(() => api.posts.length).toBe(1);
    expect(api.posts[0]).toEqual({ action: "add", block: { scope: "stay", stay_id: S2, starts_on: "2026-10-30", ends_on: "2026-10-30", reason: null } });
    // Saved: the page closes (and drops its Back guard entry) before the next address is opened.
    await expect(editor).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
    await page.waitForLoadState("load");

    // Not a uuid, an unknown id, an unknown kind: no form.
    for (const search of ["?block=stay&stay_id=not-a-uuid", `?block=stay&stay_id=${"9".repeat(8)}-9999-4999-8999-${"9".repeat(12)}`, `?block=all&stay_id=${S1}`]) {
      await page.goto(`/dashboard/calendar${search}`);
      await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible({ timeout: 45_000 });
      await page.waitForTimeout(500);
      await expect(page.locator("[data-edit-page]")).toHaveCount(0);
    }
  });

  test("the link of a destination page opens the form with that destination, in Arabic", async ({ page }) => {
    await mockApi(page);
    await openCalendar(page, "desktop", "ar", `?block=destination&destination_id=${D2}`);
    const editor = page.locator("[data-edit-page]");
    await expect(editor.getByRole("button", { name: OPS_CALENDAR_COPY.ar.oneDestination, pressed: true })).toBeVisible({ timeout: 45_000 });
    await expect(editor.getByRole("combobox", { name: /\[Destination 2\]/ })).toBeVisible();
  });

  test("the Dubai day turns over at 20:00 UTC: 19:59 is the 14th, 20:01 is the 15th (the 14th is then past)", async ({ page }) => {
    await mockApi(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.clock.setFixedTime(new Date("2026-10-14T19:59:00Z"));
    await page.goto("/dashboard/calendar");
    await expect(dayButton(page, "2026-10-14", "en")).toHaveAttribute("aria-current", "date", { timeout: 45_000 });
    await expect(dayButton(page, "2026-10-14", "en")).toBeEnabled();
    await page.clock.setFixedTime(new Date("2026-10-14T20:01:00Z"));
    await page.reload();
    await expect(dayButton(page, "2026-10-15", "en")).toHaveAttribute("aria-current", "date", { timeout: 45_000 });
    await expect(dayButton(page, "2026-10-14", "en")).toBeDisabled();
  });

  test("the form is no wider than the screen and nothing scrolls sideways, in both languages", async ({ page }) => {
    await mockApi(page);
    for (const locale of ["en", "ar"] as const) {
      await openCalendar(page, "phone", locale);
      await page.getByRole("button", { name: OPS_CALENDAR_COPY[locale].blockDates, exact: true }).click();
      await expectNoSidewaysScroll(page);
      // Nothing typed: the back link closes at once.
      await page.locator("[data-edit-page]").getByRole("button", { name: OPS_CALENDAR_COPY[locale].title, exact: true }).click();
      await expect(page.locator("[data-edit-page]")).toHaveCount(0);
    }
  });

  test("with something typed, the back link asks Discard changes?: Keep editing keeps it, Discard closes and sends nothing", async ({ page }) => {
    const api = await mockApi(page);
    const copy = OPS_CALENDAR_COPY.en;
    const kit = OPS_KIT_COPY.en;
    await openCalendar(page, "desktop", "en");
    const opener = page.getByRole("button", { name: copy.blockDates, exact: true });
    await opener.click();
    const editor = page.locator("[data-edit-page]");
    await editor.getByRole("textbox", { name: copy.reasonOptional, exact: true }).fill("[Owner stay]");
    await editor.getByRole("button", { name: copy.title, exact: true }).click();
    await expect(page.getByRole("alertdialog").or(page.getByRole("dialog"))).toContainText(kit.discardTitle);
    await page.getByRole("button", { name: kit.keepEditing }).click();
    await expect(editor.getByRole("textbox", { name: copy.reasonOptional, exact: true })).toHaveValue("[Owner stay]");
    await editor.getByRole("button", { name: copy.title, exact: true }).click();
    await page.getByRole("button", { name: kit.discard, exact: true }).click();
    await expect(editor).toHaveCount(0);
    await expect(page.getByRole("heading", { level: 1, name: copy.title })).toBeVisible();
    // Opened again: the form starts afresh, and focus went back to the button that opened it.
    await expect(opener).toBeFocused();
    await opener.click();
    await expect(editor.getByRole("textbox", { name: copy.reasonOptional, exact: true })).toHaveValue("");
    expect(api.posts).toEqual([]);
  });

  // ---- failures (PR #17) ------------------------------------------------------------------------------------------
  const kit = OPS_KIT_COPY.en;
  const copy = OPS_CALENDAR_COPY.en;
  const deletesOf = (page: Page) => page.getByRole("button", { name: new RegExp(`^${copy.deleteNamed.split("{")[0].trim()}`) });
  // The screen's own alerts: Next's route announcer is an empty role=alert too.
  const pageAlert = (page: Page) => page.locator('[role="alert"]:not(#__next-route-announcer__)');

  test("a refused Delete says so: nothing is fetched again; a month change takes the sentence away (follow-up 9)", async ({ page }) => {
    const api = await mockApi(page, { deleteFails: 503 });
    await openCalendar(page, "desktop", "en");
    await expect(deletesOf(page)).toHaveCount(2);
    const reads = api.gets.length;
    await deletesOf(page).first().click();
    await page.getByRole("dialog").getByRole("button", { name: kit.delete, exact: true }).click();
    await expect.poll(() => api.posts.length).toBe(1);
    await expect(pageAlert(page)).toHaveText(kit.errors.unavailable);
    await page.waitForTimeout(500);
    expect(api.gets.length, "no refetch after a refused delete").toBe(reads);
    await expect(deletesOf(page)).toHaveCount(2);
    // The refusal was about October's block: November does not say it.
    await page.getByRole("button", { name: copy.nextMonth }).click();
    await expect.poll(() => api.gets.at(-1)).toBe("?from=2026-11-01&to=2026-11-30");
    await expect(page.getByText(copy.noBlocks)).toBeVisible();
    await expect(pageAlert(page)).toHaveCount(0);
  });

  test("a refused Delete's sentence goes once a block is added (follow-up 9)", async ({ page }) => {
    const api = await mockApi(page, { deleteFails: 503 });
    await openCalendar(page, "desktop", "en");
    await expect(deletesOf(page)).toHaveCount(2);
    await deletesOf(page).first().click();
    await page.getByRole("dialog").getByRole("button", { name: kit.delete, exact: true }).click();
    await expect(pageAlert(page)).toHaveText(kit.errors.unavailable);
    await dayButton(page, "2026-10-26", "en").click();
    const editor = page.locator("[data-edit-page]");
    await editor.getByRole("button", { name: kit.save, exact: true }).click();
    await expect(editor).toHaveCount(0);
    expect(api.posts.at(-1)).toMatchObject({ action: "add" });
    await expect(deletesOf(page)).toHaveCount(3);
    await expect(pageAlert(page)).toHaveCount(0);
  });

  for (const list of ["destinations", "stays"] as const) {
    test(`a failed ${list} load is said and stays said after the month loads`, async ({ page }) => {
      const api = await mockApi(page, { listFails: list });
      await openCalendar(page, "desktop", "en");
      await expect(pageAlert(page)).toHaveText(kit.errors.unavailable);
      await page.getByRole("button", { name: copy.nextMonth }).click();
      await expect.poll(() => api.gets.at(-1)).toBe("?from=2026-11-01&to=2026-11-30");
      await expect(page.getByText(copy.noBlocks)).toBeVisible();
      await expect(pageAlert(page)).toHaveText(kit.errors.unavailable);
    });
  }

  test("a failed month load draws none of the last month's blocks under the new title, and the next good load clears it", async ({ page }) => {
    const api = await mockApi(page, { monthFails: "2026-11-01" });
    await openCalendar(page, "desktop", "en");
    await expect(deletesOf(page)).toHaveCount(2);
    await page.getByRole("button", { name: copy.nextMonth }).click();
    await expect(pageAlert(page)).toHaveText(kit.errors.unavailable);
    await expect(page.getByText(/November 2026/)).toBeVisible();
    await expect(deletesOf(page)).toHaveCount(0);
    await expect(page.getByText(copy.noBlocks)).toBeVisible();
    await page.getByRole("button", { name: copy.previousMonth }).click();
    await expect.poll(() => api.gets.at(-1)).toBe("?from=2026-10-01&to=2026-10-31");
    await expect(deletesOf(page)).toHaveCount(2);
    await expect(pageAlert(page)).toHaveCount(0);
  });

  test("an add with no connection keeps the form and says so; a change clears the sentence; Save again works", async ({ page }) => {
    const api = await mockApi(page, { addOffline: true });
    await openCalendar(page, "desktop", "en");
    await dayButton(page, "2026-10-26", "en").click();
    const editor = page.locator("[data-edit-page]");
    await editor.getByRole("button", { name: kit.save, exact: true }).click();
    await expect(editor.getByRole("alert")).toHaveText(kit.errors.network);
    await expect(editor).toBeVisible();
    // The refusal is about what was sent: editing the form clears it (PR #17 item 6).
    await editor.getByRole("textbox", { name: copy.reasonOptional, exact: true }).fill("[Owner stay]");
    await expect(editor.getByRole("alert")).toHaveCount(0);
    api.addOffline = false;
    await editor.getByRole("button", { name: kit.save, exact: true }).click();
    await expect(editor).toHaveCount(0);
    expect(api.posts.at(-1)).toEqual({ action: "add", block: { scope: "all", starts_on: "2026-10-26", ends_on: "2026-10-26", reason: "[Owner stay]" } });
  });

  test("the Dubai day is read again when the owner comes back to the tab after 20:00 UTC", async ({ page }) => {
    await mockApi(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.clock.setFixedTime(new Date("2026-10-14T19:59:00Z"));
    await page.goto("/dashboard/calendar");
    await expect(dayButton(page, "2026-10-14", "en")).toHaveAttribute("aria-current", "date", { timeout: 45_000 });
    await page.clock.setFixedTime(new Date("2026-10-14T20:01:00Z"));
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(dayButton(page, "2026-10-15", "en")).toHaveAttribute("aria-current", "date");
    await expect(dayButton(page, "2026-10-14", "en")).toBeDisabled();
  });

  test("the Dubai day is read again when the tab becomes visible again (visibilitychange, no focus event) (follow-up 9)", async ({ page }) => {
    await mockApi(page);
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.clock.setFixedTime(new Date("2026-10-14T19:59:00Z"));
    await page.goto("/dashboard/calendar");
    await expect(dayButton(page, "2026-10-14", "en")).toHaveAttribute("aria-current", "date", { timeout: 45_000 });
    await page.clock.setFixedTime(new Date("2026-10-14T20:01:00Z"));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(dayButton(page, "2026-10-15", "en")).toHaveAttribute("aria-current", "date");
    await expect(dayButton(page, "2026-10-14", "en")).toBeDisabled();
  });

  test("the date picker opens on the month of the chosen first day", async ({ page }) => {
    await mockApi(page);
    await openCalendar(page, "desktop", "en");
    await page.getByRole("button", { name: copy.blockDates, exact: true }).click();
    await pickDates(page, "2026-11-02", "2026-11-04");
    // Picked: the picker has closed. Open it again: November, not today's October.
    await expect(page.locator(".calendar")).toHaveCount(0);
    await page.locator("[data-edit-page]").locator('button[id$="-dates"]').click();
    await expect(page.locator(`[data-date="${dateKey("2026-11-02")}"]`)).toBeVisible();
    await expect(page.locator(`[data-date="${dateKey("2026-10-20")}"]`)).toHaveCount(0);
  });
});
