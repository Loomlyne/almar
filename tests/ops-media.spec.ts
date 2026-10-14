import { mkdirSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { crc32, deflateSync } from "node:zlib";
import { expect, test, type Page, type Route } from "@playwright/test";
import { DASHBOARD_COPY } from "../lib/copy/dashboard";
import { OPS_KIT_COPY } from "../lib/copy/ops-kit";
import { OPS_MEDIA_COPY } from "../lib/copy/ops-media";
import { VIEWPORTS, sceneStates, settle, type Viewport } from "./journey/matrix";

// The photo field, the picker, the upload form and the Media library: the pictures (signed 2026-10-11, behind
// OPS_MEDIA_PICTURES) and the behaviour. Every /api/ops/media call is answered by a page.route fixture below: no real
// bucket, no database. The behaviour runs on the harness scene (tests/journey/scenes/ops-media.tsx) and on the real page
// /dashboard/content/media, which next dev renders in the preview shell without a session.

type Locale = "en" | "ar";

const harnessUrl = (state: string, locale: string) => `/__harness?c=ops-media&s=${state}&l=${locale}`;
/** The page's alerts (Next's own route announcer is an empty role=alert too). */
const alerts = (page: Page) => page.locator('[role="alert"]:not([id="__next-route-announcer__"])');

async function openScene(page: Page, state: string, viewport: Viewport, locale: Locale) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.goto(harnessUrl(state, locale));
  await settle(page);
  // The dev server's own indicator can sit over the page corner.
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.waitForFunction((l) => document.documentElement.lang === l, locale);
}

// ---- pictures -----------------------------------------------------------------------------------------------------
// Full-page PNGs for the owner's signature, written outside tests/ (page.screenshot, not toHaveScreenshot), so no
// baseline is committed under tests/. 9 states x 3 widths x 2 languages. The block runs only when asked:
// OPS_MEDIA_PICTURES=1 writes into the planning folder, OPS_MEDIA_PICTURES=<folder> writes there.

const SIGNED_PICTURES = join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "03.2-09");
const PICTURES_TO = process.env.OPS_MEDIA_PICTURES;
const PICTURES = PICTURES_TO && isAbsolute(PICTURES_TO) ? PICTURES_TO : SIGNED_PICTURES;
const WIDTHS: Viewport[] = ["phone", "tablet", "desktop"];
const PICTURE_LOCALES = ["en", "ar"] as const;

test.describe("pictures", () => {
  test.skip(!PICTURES_TO, "set OPS_MEDIA_PICTURES=1 (or a folder) to shoot the pictures");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (PICTURES_TO) mkdirSync(PICTURES, { recursive: true });

  // library-live is the connected screen for the behaviour block below; the editor states are kit panel B's pictures.
  for (const state of sceneStates("ops-media").filter((one) => !["library-live", "library-editor", "library-failed"].includes(one))) {
    for (const viewport of WIDTHS) {
      for (const locale of PICTURE_LOCALES) {
        const width = VIEWPORTS[viewport].width;
        test(`${state} ${width} ${locale}`, async ({ page }) => {
          await openScene(page, state, viewport, locale);
          // A panel focuses its first control on open; the ring is real but is not what the picture is for.
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          // Photos below the fold are lazy in the page; a full-page picture needs them loaded.
          await page.evaluate(() => Array.from(document.images).forEach((image) => (image.loading = "eager")));
          // The photos come from the media host: wait until every visible one has loaded before the shot.
          await page
            .waitForFunction(() => Array.from(document.images).every((image) => image.complete), undefined, { timeout: 15_000 })
            .catch(() => undefined);
          await page.waitForTimeout(400);
          await page.screenshot({ path: join(PICTURES, `${state}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});

// ---- kit panel B pictures ----------------------------------------------------------------------------------------
// The Media editor on the kit's new page (option B, signed 2026-10-14) for the controller: the editor in EN, AR and ES at
// 390, 834 and 1440, Edit translations open at 390 and 1440, and the failure state (the AI did not finish) at 390 and
// 1440. Written outside tests/ only when asked: KIT_B_PICTURES=1 writes into the planning folder, =<folder> writes there.
// Before each shot every drawn text node must be a real string (memory: picture-mock-text-gate).

const KIT_B_TO = process.env.KIT_B_PICTURES;
const KIT_B_FOLDER = KIT_B_TO && isAbsolute(KIT_B_TO) ? KIT_B_TO : join(__dirname, "..", ".planning", "phases", "03.2-real-catalog-and-team-inserted", "pictures", "kit-panel-b");
const KIT_B_SHOTS: { state: "library-editor" | "library-failed"; frame: "main" | "translations" | "failed"; viewports: Viewport[] }[] = [
  { state: "library-editor", frame: "main", viewports: ["phone", "tablet", "desktop"] },
  { state: "library-editor", frame: "translations", viewports: ["phone", "desktop"] },
  { state: "library-failed", frame: "failed", viewports: ["phone", "desktop"] },
];

/** Every text node is a non-empty string with no "[object", "undefined" or "NaN"; no `{token}` is left unfilled. */
async function expectRealText(page: Page) {
  const bad = await page.evaluate(() => {
    const out: string[] = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
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

test.describe("kit panel B pictures", () => {
  test.skip(!KIT_B_TO, "set KIT_B_PICTURES=1 (or a folder) to shoot the kit panel B pictures");
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);
  if (KIT_B_TO) mkdirSync(KIT_B_FOLDER, { recursive: true });

  for (const shot of KIT_B_SHOTS) {
    for (const viewport of shot.viewports) {
      for (const locale of ["en", "ar", "es"] as const) {
        const width = VIEWPORTS[viewport].width;
        test(`media-${shot.frame} ${width} ${locale}`, async ({ page }) => {
          await page.setViewportSize(VIEWPORTS[viewport]);
          await page.goto(harnessUrl(shot.state, locale));
          await settle(page);
          await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
          await page.waitForFunction((l) => document.documentElement.lang === l, locale);
          const kit = OPS_KIT_COPY[locale];
          if (shot.frame === "translations") {
            await page.getByRole("button", { name: kit.editor.editTranslations, exact: true }).click();
          }
          if (shot.frame === "failed") {
            // The owner's own path: change the English, press Save; the scene's AI answers 502.
            await page.locator("#media-alt-en").fill("[New alt text]");
            await page.getByRole("button", { name: kit.save, exact: true }).click();
            await expect(alerts(page)).toHaveText(kit.editor.translationFailed);
          }
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
          await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
          await page
            .waitForFunction(() => Array.from(document.images).every((image) => image.complete), undefined, { timeout: 15_000 })
            .catch(() => undefined);
          await page.waitForTimeout(400);
          await expectRealText(page);
          await page.screenshot({ path: join(KIT_B_FOLDER, `media-${shot.frame}-${width}-${locale}.png`), fullPage: true });
        });
      }
    }
  }
});

// ---- behaviour ----------------------------------------------------------------------------------------------------
// At 390 and 1440, in English and Arabic.

type Locale3 = "en" | "ar";
const COMBOS: { viewport: Viewport; locale: Locale3 }[] = [
  { viewport: "phone", locale: "en" },
  { viewport: "phone", locale: "ar" },
  { viewport: "desktop", locale: "en" },
  { viewport: "desktop", locale: "ar" },
];

const PHOTO = "/assets/img/01b7e3d407f3fb73.webp";
const row = (n: number, key: string, altEn: string, extra: Record<string, unknown> = {}) => ({
  id: `00000000-0000-4000-8000-00000000000${n}`,
  key,
  url: PHOTO,
  width: 1920,
  height: 1280,
  alt_en: altEn,
  content_type: "image/webp",
  source: "import",
  alt: { en: altEn, ar: n === 1 ? "[AR old]" : null, es: null },
  alt_status: { en: "published", ar: n === 1 ? "draft" : "missing", es: "missing" },
  used_by: 0,
  ...extra,
});
const ITEMS = [
  row(1, "test/pool-dusk.webp", "Pool at dusk"),
  // Only an uploaded photo can be deleted (ops_delete_media refuses imports).
  row(2, "test/old-town.webp", "Old town street", { source: "upload" }),
  row(3, "test/coffee-farm.webp", "Coffee farm", { source: "upload" }),
  row(4, "test/beach-walk.webp", "Beach walk"),
  row(5, "test/market-day.webp", "Market day"),
];
const PAGE = 3;
const UPLOADED_ID = "00000000-0000-4000-8000-0000000000aa";

type Api = {
  gets: URL[];
  puts: { headers: Record<string, string>; bytes: number }[];
  posts: Record<string, unknown>[];
  translations: { target: string; fields: Record<string, string> }[];
};

const failure = (status: number, code: string) => ({ status, json: { ok: false, error: { code, field: null, locale: null, detail: null } } });

/** Answers /api/ops/media from fixtures (a page of 3, search over key and English alt) and records every call. */
async function mockApi(page: Page, opts: { delete?: { status: number; json: unknown }; translate?: "ok" | "fail" } = {}): Promise<Api> {
  const api: Api = { gets: [], puts: [], posts: [], translations: [] };
  const reply = (route: Route, status: number, json: unknown) =>
    route.fulfill({ status, contentType: "application/json", headers: { "cache-control": "no-store" }, body: JSON.stringify(json) });
  // The translate route (contract 5.11): "[AR] <English>" / "[ES] <English>", or 502 translate_failed. No Workers AI.
  await page.route("**/api/ops/translate", async (route) => {
    const body = route.request().postDataJSON() as { target: string; fields: Record<string, string> };
    api.translations.push(body);
    if (opts.translate === "fail") return reply(route, 502, failure(502, "translate_failed").json);
    const tag = `[${body.target.toUpperCase()}]`;
    return reply(route, 200, { ok: true, target: body.target, fields: Object.fromEntries(Object.entries(body.fields).map(([k, v]) => [k, `${tag} ${v}`])) });
  });
  await page.route(/\/api\/ops\/media(\?.*)?$/, async (route) => {
    const request = route.request();
    if (request.method() === "GET") {
      const url = new URL(request.url());
      api.gets.push(url);
      const q = (url.searchParams.get("q") ?? "").toLowerCase();
      const after = url.searchParams.get("after");
      const all = ITEMS.filter((item) => q === "" || `${item.key} ${item.alt_en}`.toLowerCase().includes(q));
      const start = after ? all.findIndex((item) => item.key === after) + 1 : 0;
      const items = all.slice(start, start + PAGE);
      return reply(route, 200, { ok: true, items, next: start + PAGE < all.length ? items[items.length - 1]!.key : null });
    }
    if (request.method() === "PUT") {
      api.puts.push({ headers: request.headers(), bytes: request.postDataBuffer()?.length ?? 0 });
      return reply(route, 200, { ok: true, id: UPLOADED_ID, key: "uploads/0123456789abcdef0123456789abcdef.webp", url: PHOTO, created: true });
    }
    const body = request.postDataJSON() as Record<string, unknown>;
    api.posts.push(body);
    if (body.action === "delete") {
      const out = opts.delete ?? { status: 200, json: { ok: true, id: body.id, affects_site: false } };
      return reply(route, out.status, out.json);
    }
    return reply(route, 200, { ok: true, id: body.id, affects_site: true });
  });
  return api;
}

/** A tiny real PNG: the browser decodes and re-encodes it before sending. */
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

/**
 * A real 3000x2000 PNG of about 18 MB (one flat colour, stored without compression): over the 10 MB limit as picked,
 * about a kilobyte once the browser scales it to 2560 px and re-encodes it (job 03.2-09b, review finding 2).
 */
function bigPng(width = 3000, height = 2000): Buffer {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])), 0);
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8); // 8-bit RGB, no interlace
  const row = Buffer.alloc(1 + width * 3, 0x9a); // a sand colour
  row[0] = 0; // filter: none
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw, { level: 0 })), chunk("IEND", Buffer.alloc(0))]);
}

async function openRealPage(page: Page, viewport: Viewport, locale: Locale3, baseURL: string | undefined) {
  await page.setViewportSize(VIEWPORTS[viewport]);
  await page.context().addCookies([{ name: "almar-locale", value: locale, url: baseURL ?? "http://127.0.0.1:3010" }]);
  await page.goto("/dashboard/content/media");
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await expect(page.getByRole("heading", { level: 1, name: OPS_MEDIA_COPY[locale].media })).toBeVisible({ timeout: 20_000 });
}


test.describe("behaviour", () => {
  test.describe.configure({ mode: "parallel" });
  test.setTimeout(120_000);

  for (const { viewport, locale } of COMBOS) {
    const width = VIEWPORTS[viewport].width;
    const copy = OPS_MEDIA_COPY[locale];
    const at = `${width} ${locale}`;
    const dialog = (page: Page) => page.getByRole("dialog").last();
    // The photo cards of the picker's grid (a button each when one photo is chosen).
    const cards = (page: Page) => dialog(page).getByRole("list", { name: copy.media }).getByRole("button");

    test.describe(at, () => {
      test(`field: Choose photo opens the library, Load more asks after the last key, Choose returns the photo (${at})`, async ({ page }) => {
        const api = await mockApi(page);
        await openScene(page, "field-empty", viewport, locale);
        expect(api.gets, "nothing is requested while the picker is closed").toHaveLength(0);
        await page.locator("#media-hero").click();
        const picker = dialog(page);
        await expect(cards(page)).toHaveCount(PAGE);
        expect(api.gets[0]!.searchParams.has("q")).toBe(false);
        await picker.getByRole("button", { name: copy.loadMore, exact: true }).click();
        await expect(cards(page)).toHaveCount(ITEMS.length);
        expect(api.gets.at(-1)!.searchParams.get("after")).toBe(ITEMS[PAGE - 1]!.key);
        await expect(picker.getByRole("button", { name: copy.loadMore, exact: true })).toHaveCount(0);
        await expect(picker.getByRole("button", { name: copy.choose, exact: true })).toBeDisabled();
        await picker.getByRole("button", { name: new RegExp("old-town") }).click();
        await expect(cards(page).and(page.locator("[aria-pressed=true]"))).toHaveCount(1);
        await picker.getByRole("button", { name: copy.choose, exact: true }).click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByText("old-town.webp")).toBeVisible();
        await expect(page.locator("#media-hero")).toHaveText(copy.changePhoto);
        await page.getByRole("button", { name: copy.removePhoto, exact: true }).click();
        await expect(page.locator("#media-hero")).toHaveText(copy.choosePhoto);
      });

      test(`picker: Search asks after 250 ms of no typing, once (${at})`, async ({ page }) => {
        const api = await mockApi(page);
        await openScene(page, "field-empty", viewport, locale);
        await page.locator("#media-hero").click();
        const picker = dialog(page);
        await expect(cards(page)).toHaveCount(PAGE);
        const before = api.gets.length;
        await picker.getByRole("searchbox").or(picker.getByLabel(copy.search)).first().pressSequentially("pool", { delay: 40 });
        await expect.poll(() => api.gets.length, { timeout: 5000 }).toBe(before + 1);
        await page.waitForTimeout(600);
        expect(api.gets.length, "typing four letters is one request").toBe(before + 1);
        expect(api.gets.at(-1)!.searchParams.get("q")).toBe("pool");
        await expect(cards(page)).toHaveCount(1);
        await picker.getByLabel(copy.search).fill("zzzz");
        await expect(picker.getByText(copy.noMatch)).toBeVisible();
      });

      test(`upload: disabled until a file and English alt text, one PUT with the headers, the new photo is chosen (${at})`, async ({ page }) => {
        const api = await mockApi(page);
        await openScene(page, "field-empty", viewport, locale);
        await page.locator("#media-hero").click();
        const picker = dialog(page);
        const chooser = page.waitForEvent("filechooser");
        await picker.getByRole("button", { name: copy.uploadPhoto, exact: true }).click();
        await (await chooser).setFiles({ name: "IMG_1.png", mimeType: "image/png", buffer: PNG });
        const send = picker.getByRole("button", { name: copy.upload, exact: true });
        await expect(send).toBeDisabled();
        expect(api.puts).toHaveLength(0);
        await picker.getByLabel(copy.altEnRequired).fill("Pool at dusk, Cartagena");
        await expect(send).toBeEnabled();
        await send.click();
        await expect(picker.getByText(copy.uploaded)).toBeVisible();
        expect(api.puts).toHaveLength(1);
        const put = api.puts[0]!;
        expect(["image/webp", "image/jpeg"]).toContain(put.headers["content-type"]);
        expect(put.headers["x-almar-sha256"]).toMatch(/^[0-9a-f]{64}$/);
        expect(put.headers["x-almar-width"]).toBe("1");
        expect(put.headers["x-almar-height"]).toBe("1");
        expect(decodeURIComponent(put.headers["x-almar-alt-en"]!)).toBe("Pool at dusk, Cartagena");
        expect(put.bytes).toBeGreaterThan(0);
        await picker.getByRole("button", { name: copy.choosePhoto, exact: true }).click();
        await expect(cards(page).and(page.locator("[aria-pressed=true]"))).toHaveCount(1);
        await picker.getByRole("button", { name: copy.choose, exact: true }).click();
        await expect(page.getByText("0123456789abcdef0123456789abcdef.webp")).toBeVisible();
      });

      test(`upload: an 18 MB photo is not refused when picked, it is re-encoded under 10 MB and sent; a HEIC shows the type message (${at})`, async ({ page }) => {
        const api = await mockApi(page);
        await openScene(page, "field-empty", viewport, locale);
        await page.locator("#media-hero").click();
        const picker = dialog(page);
        const chooser = page.waitForEvent("filechooser");
        await picker.getByRole("button", { name: copy.uploadPhoto, exact: true }).click();
        const big = bigPng();
        expect(big.length).toBeGreaterThan(15 * 1024 * 1024);
        await (await chooser).setFiles({ name: "phone.png", mimeType: "image/png", buffer: big });
        await expect(picker.getByRole("alert")).toHaveCount(0);
        await picker.getByLabel(copy.altEnRequired).fill("Anything");
        await picker.getByRole("button", { name: copy.upload, exact: true }).click();
        await expect(picker.getByText(copy.uploaded)).toBeVisible({ timeout: 30_000 });
        expect(api.puts).toHaveLength(1);
        expect(api.puts[0]!.bytes).toBeGreaterThan(0);
        expect(api.puts[0]!.bytes).toBeLessThanOrEqual(10 * 1024 * 1024);
        expect(api.puts[0]!.headers["x-almar-width"]).toBe("2560");
        expect(api.puts[0]!.headers["x-almar-height"]).toBe("1707");
        await picker.getByRole("button", { name: copy.choosePhoto, exact: true }).click();
        const second = page.waitForEvent("filechooser");
        await picker.getByRole("button", { name: copy.uploadPhoto, exact: true }).click();
        await (await second).setFiles({ name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: Buffer.from("heic") });
        await expect(picker.getByRole("alert")).toContainText(copy.wrongType);
        expect(api.puts, "the HEIC sends nothing").toHaveLength(1);
      });

      test(`gallery: Add photos takes several, in order (${at})`, async ({ page }) => {
        await mockApi(page);
        await openScene(page, "gallery", viewport, locale);
        const before = await page.getByRole("list").first().getByRole("listitem").count();
        await page.locator("#media-gallery").click();
        const picker = dialog(page);
        await picker.getByRole("checkbox").nth(0).check();
        await picker.getByRole("checkbox").nth(2).check();
        await picker.getByRole("button", { name: copy.choose, exact: true }).click();
        await expect(page.getByText("pool-dusk.webp")).toBeVisible();
        await expect(page.getByText("coffee-farm.webp")).toBeVisible();
        await expect(page.getByRole("list").first().getByRole("listitem")).toHaveCount(before + 2);
      });

      test(`library page: Save fills the missing Spanish from the English and keeps it a draft; Publish makes both live (${at})`, async ({ page, baseURL }) => {
        const api = await mockApi(page);
        const kit = OPS_KIT_COPY[locale];
        await openRealPage(page, viewport, locale, baseURL);
        await expect(page.getByRole("list", { name: copy.media }).getByRole("listitem")).toHaveCount(PAGE);
        await page.getByRole("button", { name: /pool-dusk/ }).click();
        // The editor page replaces the grid: the file name is the title, the English alt text the one field.
        await expect(page.getByRole("heading", { level: 1 })).toHaveText("pool-dusk.webp");
        await expect(page.getByRole("list", { name: copy.media })).toHaveCount(0);
        await expect(page.locator("#media-alt-en")).toHaveValue("Pool at dusk");
        await expect(page.getByRole("checkbox")).toHaveCount(0);
        await expect(page.getByRole("tablist")).toHaveCount(0);
        // Spanish is missing, so Save has work although nothing was typed; Publish saves first, so it is live too.
        await expect(page.getByRole("button", { name: kit.save, exact: true })).toBeEnabled();
        await page.getByRole("button", { name: kit.save, exact: true }).click();
        await expect.poll(() => api.posts.length).toBe(1);
        expect(api.translations).toEqual([{ target: "es", fields: { alt: "Pool at dusk" } }]);
        expect(api.posts[0]).toEqual({
          action: "save_alt",
          id: ITEMS[0]!.id,
          alt: { en: "Pool at dusk", ar: "[AR old]", es: "[ES] Pool at dusk" },
          status: { ar: "draft", es: "draft" },
        });
        await expect(page.getByRole("status").filter({ hasText: kit.editor.translationsUpdated })).toBeVisible();
        await expect(page.getByRole("button", { name: kit.save, exact: true })).toBeDisabled();
        await page.getByRole("button", { name: kit.publish, exact: true }).click();
        await expect.poll(() => api.posts.length).toBe(2);
        expect(api.posts[1]).toMatchObject({ alt: { en: "Pool at dusk", ar: "[AR old]", es: "[ES] Pool at dusk" }, status: { ar: "published", es: "published" } });
        await expect(page.locator("[data-edit-page]").getByText(kit.published, { exact: true })).toBeVisible();
        await expect(page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true })).toBeDisabled();

        // A changed English on the published photo is translated in both languages and stays live.
        await page.locator("#media-alt-en").fill("Pool at night");
        await page.getByRole("button", { name: kit.saveAndUpdateSite, exact: true }).click();
        await expect.poll(() => api.posts.length).toBe(3);
        expect(api.translations.slice(1).map((one) => one.target).sort()).toEqual(["ar", "es"]);
        expect(api.posts[2]).toEqual({
          action: "save_alt",
          id: ITEMS[0]!.id,
          alt: { en: "Pool at night", ar: "[AR] Pool at night", es: "[ES] Pool at night" },
          status: { ar: "published", es: "published" },
        });
        // Back to the grid: the row that opened the page has focus again.
        await page.getByRole("button", { name: copy.media, exact: true }).click();
        await expect(page.getByRole("list", { name: copy.media })).toBeVisible();
        await expect(page.getByRole("button", { name: /pool-dusk/ })).toBeFocused();
      });

      test(`library page: the AI failing empties the stale translation, saves a draft and holds Publish with the reason (${at})`, async ({ page, baseURL }) => {
        const api = await mockApi(page, { translate: "fail" });
        const kit = OPS_KIT_COPY[locale];
        await openRealPage(page, viewport, locale, baseURL);
        await page.getByRole("button", { name: /pool-dusk/ }).click();
        await page.locator("#media-alt-en").fill("Pool by the sea");
        await page.getByRole("button", { name: kit.save, exact: true }).click();
        await expect(alerts(page)).toHaveText(kit.editor.translationFailed);
        await expect.poll(() => api.posts.length).toBe(1);
        expect(api.posts[0]).toEqual({ action: "save_alt", id: ITEMS[0]!.id, alt: { en: "Pool by the sea", ar: null, es: null }, status: {} });
        await expect(page.getByRole("button", { name: kit.publish, exact: true })).toBeDisabled();
        // Maria types them herself: Edit translations opens Arabic and Spanish.
        await page.getByRole("button", { name: kit.editor.editTranslations, exact: true }).click();
        await page.getByLabel(`${copy.altText} · AR`, { exact: true }).fill("[AR typed]");
        await page.getByLabel(`${copy.altText} · ES`, { exact: true }).fill("[ES typed]");
        await page.getByRole("button", { name: kit.save, exact: true }).click();
        await expect.poll(() => api.posts.length).toBe(2);
        expect(api.translations, "nothing left for the AI: no new request").toHaveLength(2);
        expect(api.posts[1]).toMatchObject({ alt: { en: "Pool by the sea", ar: "[AR typed]", es: "[ES typed]" } });
        await expect(alerts(page)).toHaveCount(0);
        await expect(page.getByRole("button", { name: kit.publish, exact: true })).toBeEnabled();
      });

      test(`library page: Delete on an unused photo removes it and says the file stays in storage (${at})`, async ({ page, baseURL }) => {
        const api = await mockApi(page);
        await openRealPage(page, viewport, locale, baseURL);
        // An imported photo is kept by the site pages: Delete stays off and says it is used.
        await page.getByRole("button", { name: /pool-dusk/ }).click();
        await expect(page.getByRole("button", { name: copy.deleteImage, exact: true })).toBeDisabled();
        await expect(page.getByText(copy.usedBlocksDelete).first()).toBeVisible();
        // The editor page replaces the grid: Escape goes back to it (nothing was changed, so it does not ask).
        await page.keyboard.press("Escape");
        await expect(page.getByRole("button", { name: copy.deleteImage, exact: true })).toHaveCount(0);
        await page.getByRole("button", { name: /old-town/ }).click();
        await expect(page.getByText(copy.staysInStorage).first()).toBeVisible();
        await page.getByRole("button", { name: copy.deleteImage, exact: true }).click();
        await dialog(page).getByRole("button", { name: copy.deleteImage, exact: true }).click();
        await expect.poll(() => api.posts.length).toBe(1);
        expect(api.posts[0]).toEqual({ action: "delete", id: ITEMS[1]!.id });
        await expect(page.getByRole("status")).toContainText(copy.staysInStorage);
        await expect(page.locator("li", { hasText: "old-town.webp" })).toHaveCount(0);
        await expect(page.getByRole("list", { name: copy.media }).getByRole("listitem")).toHaveCount(PAGE - 1);
      });

      test(`library page: a 409 in_use shows the used message, keeps the photo and turns Delete off (${at})`, async ({ page, baseURL }) => {
        await mockApi(page, { delete: failure(409, "in_use") });
        await openRealPage(page, viewport, locale, baseURL);
        await page.getByRole("button", { name: /coffee-farm/ }).click();
        await page.getByRole("button", { name: copy.deleteImage, exact: true }).click();
        await dialog(page).getByRole("button", { name: copy.deleteImage, exact: true }).click();
        await expect(page.getByRole("alert").filter({ hasText: copy.usedBlocksDelete })).toBeVisible();
        await expect(page.getByRole("button", { name: copy.deleteImage, exact: true })).toBeDisabled();
        await expect(page.locator("li", { hasText: "coffee-farm.webp" })).toHaveCount(1);
      });

      test(`library page: Upload takes a file and English alt text, then the new photo heads the list (${at})`, async ({ page, baseURL }) => {
        const api = await mockApi(page);
        await openRealPage(page, viewport, locale, baseURL);
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: copy.upload, exact: true }).click();
        await (await chooser).setFiles({ name: "new.png", mimeType: "image/png", buffer: PNG });
        const form = dialog(page);
        await expect(form.getByRole("button", { name: copy.upload, exact: true })).toBeDisabled();
        await form.getByLabel(copy.altEnRequired).fill("Fresh photo");
        await form.getByRole("button", { name: copy.upload, exact: true }).click();
        await expect(form.getByText(copy.uploaded)).toBeVisible();
        expect(api.puts).toHaveLength(1);
        await form.getByRole("button", { name: copy.close, exact: true }).first().click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await expect(page.getByRole("list", { name: copy.media }).getByRole("listitem").first()).toContainText("0123456789abcdef0123456789abcdef.webp");
      });

      test(`library page: the rail's Content group links to Media in this language and marks it current (${at})`, async ({ page, baseURL }) => {
        await mockApi(page);
        await openRealPage(page, viewport, locale, baseURL);
        if (width < 1280) await page.getByRole("button", { name: DASHBOARD_COPY[locale].menu }).click();
        const link = page.getByRole("link", { name: copy.media, exact: true });
        await expect(link).toBeVisible();
        await expect(link).toHaveAttribute("href", "/dashboard/content/media");
        await expect(link).toHaveAttribute("aria-current", "page");
      });

      test(`library page: a photo uploaded then deleted stays gone after a search is typed and cleared (${at})`, async ({ page, baseURL }) => {
        const api = await mockApi(page);
        await openRealPage(page, viewport, locale, baseURL);
        const chooser = page.waitForEvent("filechooser");
        await page.getByRole("button", { name: copy.upload, exact: true }).click();
        await (await chooser).setFiles({ name: "new.png", mimeType: "image/png", buffer: PNG });
        const form = dialog(page);
        await form.getByLabel(copy.altEnRequired).fill("Fresh photo");
        await form.getByRole("button", { name: copy.upload, exact: true }).click();
        await expect(form.getByText(copy.uploaded)).toBeVisible();
        await form.getByRole("button", { name: copy.close, exact: true }).first().click();
        await expect(page.getByRole("dialog")).toHaveCount(0);
        const fresh = page.locator("li", { hasText: "0123456789abcdef0123456789abcdef.webp" });
        await expect(fresh).toHaveCount(1);
        await page.getByRole("button", { name: /0123456789abcdef/ }).click();
        await page.getByRole("button", { name: copy.deleteImage, exact: true }).click();
        await dialog(page).getByRole("button", { name: copy.deleteImage, exact: true }).click();
        await expect.poll(() => api.posts.length).toBe(1);
        expect(api.posts[0]).toEqual({ action: "delete", id: UPLOADED_ID });
        await expect(fresh).toHaveCount(0);
        // The fixture list never holds the upload: only this session's memory could bring it back.
        const search = page.getByLabel(copy.search);
        const gets = api.gets.length;
        await search.fill("pool");
        await expect.poll(() => api.gets.length).toBeGreaterThan(gets);
        await expect(page.locator("li", { hasText: "pool-dusk.webp" })).toHaveCount(1);
        const again = api.gets.length;
        await search.fill("");
        await expect.poll(() => api.gets.length).toBeGreaterThan(again);
        await expect(page.locator("li", { hasText: "old-town.webp" })).toHaveCount(1);
        await expect(fresh).toHaveCount(0);
      });
    });
  }
});
