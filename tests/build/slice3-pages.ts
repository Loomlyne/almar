import { expect, type Locator, type Page } from "@playwright/test";
import { HOME_COPY } from "../../lib/copy/home";
import { SITE_FOOTER_COPY } from "../../lib/copy/site-footer";
import { getContactDetails } from "../../lib/data/contact";
import { LOCALES, localeDir, localeHrefs, localePath, matchPublicPage, siteHref, type Locale } from "../../lib/locale-path";
import { WIDTHS, watch, type Collected } from "./stay-detail/_helpers";

// Shared by the About and Contact build specs (plan 03.3-25): opening a page on the assembled out/, measuring, and the
// frame checks both pages repeat (wordmark, nav, footer Pages, language, skip link, the new-tab links). Not a spec
// itself: the build config matches *.spec.ts only. Nothing here is typed in English: labels come from lib/copy,
// addresses from lib/locale-path and lib/data.

export { LOCALES, WIDTHS, watch };
export type { Collected };

export const DIR: Record<Locale, "ltr" | "rtl"> = { en: "ltr", ar: "rtl", es: "ltr" };
export const LANGUAGE_NAMES: Record<Locale, string> = { en: "English", ar: "العربية", es: "Español" };
/** The nav is inline from the 72rem container; below it the Menu holds the links and the language select. */
export const NAV_INLINE_FROM = 1152;
/** Tailwind `md`: the second value of every measure pair. */
export const MD = 768;
/** The published WhatsApp float address (also asserted by slice 1). */
export const WHATSAPP_FLOAT = "https://wa.me/971563883302";
/** Job 11's divider: the line and the diamond's own class hook, as the dev specs locate it. */
export const DIVIDER = 'main div[aria-hidden="true"]:has(> span.border-gold)';
export const FOREIGN_HOSTS = /framerusercontent\.com|framer\.com|files\.catbox\.moe|videos\.pexels\.com/;

export const num = (px: string) => Number.parseFloat(px);
export const bare = (path: string) => (path.length > 1 ? path.replace(/\/$/, "") : path);
export const pick = (pair: readonly [number, number], width: number) => (width >= MD ? pair[1] : pair[0]);

export async function box(l: Locator) {
  const b = await l.boundingBox();
  if (!b) throw new Error("no box");
  return b;
}

export const style = (l: Locator, prop: string) => l.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), prop);

/** The computed rgb() string of a colour token, so a style test never types a colour. */
export async function token(page: Page, name: string): Promise<string> {
  return page.evaluate((n) => {
    const probe = document.createElement("span");
    probe.style.color = `var(--color-${n})`;
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);
}

export const rootVar = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

export const htmlAttr = (page: Page, name: string) => page.evaluate((n) => document.documentElement.getAttribute(n), name);
export const motionReady = (page: Page) => page.waitForFunction(() => document.documentElement.hasAttribute("data-motion-ready"));
export const docTop = (l: Locator) => l.evaluate((el) => el.getBoundingClientRect().top + window.scrollY);

export const lines = (l: Locator) =>
  l.evaluate((el) =>
    (el as HTMLElement).innerText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean),
  );

/** Loaded and hydrated: a header button has its React props; network idle is capped at 10 s, then a short settle. */
export async function open(page: Page, url: string): Promise<void> {
  const response = await page.goto(url, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${url} status`).toBe(200);
  await page.waitForFunction(
    () => {
      const button = document.querySelector("header button");
      return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
    },
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(200);
}

/** The served document answered by the build server itself: status, bytes, and no redirect on the way. */
export async function served(page: Page, url: string): Promise<string> {
  const res = await page.request.get(url, { maxRedirects: 0 });
  expect(res.status(), `${url} answers 200 with no redirect`).toBe(200);
  return res.text();
}

export function htmlTag(html: string): string {
  return /<html\b[^>]*>/i.exec(html)?.[0] ?? "";
}
export function tagAttr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i").exec(tag);
  return m ? (m[1] ?? m[2]) : null;
}

/** Every [data-reveal] block in main that is not visible and plain: the list of offenders. */
export function hiddenOrMoved(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("main [data-reveal]")].flatMap((el) => {
      const s = getComputedStyle(el);
      const bad: string[] = [];
      if (s.opacity !== "1") bad.push(`opacity ${s.opacity}`);
      if (s.translate !== "none") bad.push(`translate ${s.translate}`);
      if (s.scale !== "none") bad.push(`scale ${s.scale}`);
      if (s.transform !== "none") bad.push(`transform ${s.transform}`);
      return bad.length ? [`${el.getAttribute("data-reveal")}: ${bad.join(", ")}`] : [];
    }),
  );
}

/** True when the element is not moved or scaled (the engine's individual `translate` property, and `transform`). */
export const atRest = (el: Locator) =>
  el.evaluate((node) => {
    const cs = getComputedStyle(node);
    const zero = (v: string) => v === "none" || v.split(/\s+/).every((part) => parseFloat(part) === 0);
    const t = cs.transform;
    return zero(cs.translate) && (t === "none" || t === "matrix(1, 0, 0, 1, 0, 0)");
  });

export const shift = (el: Locator) =>
  el.evaluate((node) => {
    const v = getComputedStyle(node).translate;
    return v === "none" ? 0 : parseFloat(v.split(/\s+/)[1] ?? v.split(/\s+/)[0]);
  });

export const runningAnimations = (page: Page) =>
  page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running").length);

export async function scrollTo(page: Page, y: number) {
  await page.evaluate((to) => window.scrollTo(0, to), y);
  // The engine writes the offset on the next animation frame.
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => done(null)))));
}

export async function scrollThrough(page: Page) {
  const height = await page.evaluate(() => document.documentElement.scrollHeight);
  const step = await page.evaluate(() => window.innerHeight / 2);
  for (let y = 0; y <= height; y += step) {
    await page.evaluate((to) => window.scrollTo(0, to), y);
    await page.waitForTimeout(80);
  }
}

export async function openMenu(page: Page, locale: Locale, width: number) {
  if (width < NAV_INLINE_FROM) await page.getByRole("button", { name: HOME_COPY[locale].nav.menu }).click();
}

/** Both new-tab targets answer a stub, so a click never leaves the machine. */
export async function stubExternal(page: Page) {
  await page.context().route(/^https:\/\/(wa\.me|www\.instagram\.com|www\.google\.com|koussay\.com)\//, (route) =>
    route.fulfill({ status: 200, contentType: "text/html", body: "<title>stub</title>" }),
  );
}

/** The footer's computed background colour, read on this locale's home page, in the same context. */
export async function homeFooterBackground(page: Page, locale: Locale): Promise<string> {
  await open(page, localePath(locale, "/"));
  return style(page.locator("footer"), "background-color");
}

/** Item "frame": the wordmark, the four nav links, the Footer Pages column. `path` is this page's English path. */
export async function checkFrameLinks(page: Page, locale: Locale, path: string, width: number, watched: Collected) {
  const nav = HOME_COPY[locale].nav;
  const url = localePath(locale, path);
  const four = [
    { key: "destinations", path: "/destinations" },
    { key: "experiences", path: "/experiences" },
    { key: "about", path: "/about" },
    { key: "contact", path: "/contact" },
  ] as const;

  await open(page, url);
  // The wordmark: this language's home (slice 1's default), by href and by click.
  const logo = page.getByRole("link", { name: "ALMAR Private Journeys home" });
  await expect(logo).toHaveAttribute("href", localePath(locale, "/"));

  // The Footer Pages column holds the same four hrefs as the nav.
  const pages = page.getByRole("navigation", { name: SITE_FOOTER_COPY[locale].pages });
  expect(await pages.locator("a").evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(
    four.map((p) => siteHref(locale, p.path)),
  );

  for (const p of four) {
    await open(page, url);
    await openMenu(page, locale, width);
    const link = page.locator("header").getByRole("link", { name: nav[p.key], exact: true });
    await expect(link, `nav ${p.key}`).toHaveCount(1);
    const href = siteHref(locale, p.path);
    await expect(link).toHaveAttribute("href", href);
    // "/destinations" is the same address in English whether or not the page is a React page: ask matchPublicPage.
    const localised = matchPublicPage(p.path) !== null;
    if (!localised) {
      // An English-only Framer page: answered 200 by the build, not navigated (no Framer CDN request is made).
      expect((await page.request.get(href, { maxRedirects: 0 })).status(), `${p.key} ${href}`).toBe(200);
      continue;
    }
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().resourceType() === "document" && bare(new URL(r.url()).pathname) === bare(href)),
      link.click(),
    ]);
    expect(response.status(), href).toBe(200);
    await page.waitForURL((u) => bare(u.pathname) === bare(href));
    const tag = htmlTag(await response.text());
    expect(tagAttr(tag, "lang")).toBe(locale);
    expect(tagAttr(tag, "dir")).toBe(localeDir(locale));
  }

  // The wordmark click.
  await open(page, url);
  await page.getByRole("link", { name: "ALMAR Private Journeys home" }).click();
  await page.waitForURL((u) => bare(u.pathname) === bare(localePath(locale, "/")));
  expect(watched.problems).toEqual([]);
}

/** Item "language": the footer row and the header select, each other language lands 200 with no 3xx. */
export async function checkLanguage(page: Page, locale: Locale, path: string, width: number, watched: Collected) {
  const url = localePath(locale, path);
  const hrefs = localeHrefs(path);
  const statuses: number[] = [];
  page.on("response", (r) => {
    if (r.request().isNavigationRequest() && r.frame() === page.mainFrame()) statuses.push(r.status());
  });

  await open(page, url);
  const row = page.getByRole("navigation", { name: SITE_FOOTER_COPY[locale].language });
  const anchors = row.locator("a");
  expect(await anchors.evaluateAll((as) => as.map((a) => a.getAttribute("href")))).toEqual(LOCALES.map((l) => hrefs[l]));
  expect(await anchors.evaluateAll((as) => as.map((a) => a.getAttribute("hreflang")))).toEqual([...LOCALES]);
  const current = row.locator("a[aria-current]");
  await expect(current).toHaveCount(1);
  await expect(current).toHaveAttribute("hreflang", locale);

  for (const target of LOCALES.filter((l) => l !== locale)) {
    // The footer row.
    await open(page, url);
    const [response] = await Promise.all([
      page.waitForResponse((r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === new URL(hrefs[target], "http://x").pathname),
      page.getByRole("navigation", { name: SITE_FOOTER_COPY[locale].language }).locator(`a[hreflang="${target}"]`).click(),
    ]);
    expect(response.status()).toBe(200);
    const tag = htmlTag(await response.text());
    expect(tagAttr(tag, "lang")).toBe(target);
    expect(tagAttr(tag, "dir")).toBe(localeDir(target));
    expect(new URL(page.url()).pathname).toBe(localePath(target, path));

    // The header select (inside the Menu below 1152 px).
    await open(page, url);
    await openMenu(page, locale, width);
    await page.getByRole("combobox", { name: /^(Language|اللغة|Idioma):/ }).click();
    const expected = localePath(target, path);
    const landed = page.waitForResponse((r) => r.request().isNavigationRequest() && new URL(r.url()).pathname === expected);
    await page.getByRole("option", { name: LANGUAGE_NAMES[target] }).click();
    expect((await landed).status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe(expected);
    expect(await htmlAttr(page, "lang")).toBe(target);
  }
  expect(statuses.filter((s) => s >= 300 && s < 400), "no redirect on any language change").toEqual([]);
  expect(watched.problems).toEqual([]);
}

/** Item "skip link": the first Tab focuses it, Enter moves to #content. */
export async function checkSkipLink(page: Page, locale: Locale, path: string) {
  await open(page, localePath(locale, path));
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus");
  await expect(focused).toHaveText(HOME_COPY[locale].skip);
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("#content");
  await expect(page.locator("main#content")).toHaveCount(1);
}

/**
 * Item "external links": the footer email, phone, Instagram and the WhatsApp float. The two links that open a page do
 * so in a new tab at exactly their address (the host is routed to a stub); mailto and tel are asserted by href, and
 * the page URL does not change after any of them.
 */
export async function checkFooterAndFloat(page: Page, locale: Locale, path: string) {
  const d = await getContactDetails(locale);
  const url = localePath(locale, path);
  await stubExternal(page);
  await open(page, url);
  const footer = page.locator("footer");
  await expect(footer.locator('a[href^="mailto:"]')).toHaveAttribute("href", `mailto:${d.email}`);
  await expect(footer.locator('a[href^="tel:"]')).toHaveAttribute("href", `tel:${d.phone_e164}`);
  const insta = footer.locator(`a[href="${d.instagram_url}"]`);
  await expect(insta).toHaveCount(1);
  await expect(insta).toHaveAttribute("target", "_blank");
  expect((await insta.getAttribute("rel")) ?? "").toContain("noopener");
  const float = page.locator('a[aria-label="WhatsApp"]');
  await expect(float).toHaveCount(1);
  await expect(float).toHaveAttribute("href", WHATSAPP_FLOAT);
  await expect(float).toHaveAttribute("target", "_blank");

  for (const [link, want] of [
    [insta, d.instagram_url],
    [float, WHATSAPP_FLOAT],
  ] as const) {
    const [popup] = await Promise.all([page.context().waitForEvent("page"), link.click()]);
    await popup.waitForURL(want);
    await popup.close();
    expect(new URL(page.url()).pathname).toBe(url.length > 1 ? url.replace(/\/$/, "") : url);
  }
  for (const link of [footer.locator('a[href^="mailto:"]'), footer.locator('a[href^="tel:"]')]) {
    await link.evaluate((el) => el.addEventListener("click", (e) => e.preventDefault(), { once: true }));
    await link.click();
    expect(bare(new URL(page.url()).pathname)).toBe(bare(url));
  }
}
