import { execFileSync } from "node:child_process";
import { expect, type Page } from "@playwright/test";
import { localePath, type Locale } from "../../../lib/locale-path";
import { routeMedia, type MediaRoute } from "../../helpers/media-route";

// Shared by the three stay-detail specs (plan 03.3-06). Not a spec itself: the build config matches *.spec.ts only.

export const LOCALES: Locale[] = ["en", "ar", "es"];

export const WIDTHS = [
  { width: 390, height: 844 },
  { width: 834, height: 1194 },
  { width: 1440, height: 900 },
] as const;

/**
 * The published slugs, from the data layer's own getStaySlugs(). A spec file cannot await at the top level and
 * the function is async, so a child process runs it once and the slugs come back as JSON. Never a folder
 * listing and never typed by hand.
 */
function readSlugs(): string[] {
  const script =
    'import { loadTs } from "./tests/helpers/load-ts.mjs";' +
    'const m = await loadTs("lib/data/stays.ts");' +
    "process.stdout.write(JSON.stringify(await m.getStaySlugs()));";
  const out = execFileSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  return JSON.parse(out) as string[];
}
export const SLUGS = readSlugs();

/** The three stays the behaviour specs run on: the localised one, a Medellin one, and the range-guests one. */
export const FOCUS = ["getsemani-colonial-house", "santa-fe-farm-antioquia", "private-island-estate-cartagena"] as const;

export const stayUrl = (locale: Locale, slug: string) => localePath(locale, `/private-stays/${slug}`);

/** The Playwright clock every behaviour test uses: the sample blocked dates (Oct-Dec 2026) stay in the future. */
export const FIXED_NOW = "2026-10-03T09:00:00+04:00";

export type Collected = { problems: string[]; media: MediaRoute; hosts: Set<string> };

const BAD_HOSTS = /(^|\.)(framerusercontent\.com|framer\.com|files\.catbox\.moe|videos\.pexels\.com)$/;

/**
 * Call before page.goto: answers the media host, records console errors, page errors and hydration messages,
 * and records every request host so a test can assert that no forbidden host was asked.
 */
export async function watch(page: Page): Promise<Collected> {
  const media = await routeMedia(page);
  const problems: string[] = [];
  const hosts = new Set<string>();
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" || /hydrat|recoverable error|did not match/i.test(text)) {
      problems.push(`console ${message.type()}: ${text}`);
    }
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("request", (request) => {
    const host = new URL(request.url()).hostname;
    hosts.add(host);
    if (BAD_HOSTS.test(host)) problems.push(`request to ${host}: ${request.url()}`);
  });
  return { problems, media, hosts };
}

/** Loaded and hydrated: the first client button has its React props. Network idle is capped, then a short settle. */
export async function openStay(page: Page, locale: Locale, slug: string, query = ""): Promise<void> {
  const response = await page.goto(stayUrl(locale, slug) + query, { waitUntil: "domcontentloaded" });
  expect(response?.status(), `${locale} ${slug} status`).toBe(200);
  await page.waitForFunction(
    () => {
      const button = document.querySelector("main button");
      return !!button && Object.keys(button).some((key) => key.startsWith("__reactProps"));
    },
    undefined,
    { timeout: 30_000 },
  );
  await page.waitForLoadState("networkidle", { timeout: 10_000 }).catch(() => undefined);
  await page.waitForTimeout(400);
}
