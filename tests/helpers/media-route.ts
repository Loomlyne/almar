// Serves the slice-1 images to Playwright before the R2 bucket exists (plan 03.3-07, design 10.1).
//
// The pages render `${MEDIA_BASE_URL}/<key>` and, until the controller's flip commit, that host is
// https://media-pending.invalid, which can never resolve. routeMedia(page) answers every request to it:
//   - a key in the manifest whose file is in media-staging/  -> 200, the file, image/webp
//   - a key in the manifest that is not cached (clean clone) -> 200, an SVG of the manifest width x height
//                                                              (an outline and the key as text, test-only)
//   - a key not in the manifest                              -> 404, and the key is pushed onto `missing`
// After the flip the same rule applies to the real host, so tests stay offline.
//
// A spec that renders images calls `await routeMedia(page)` before `page.goto` and asserts `missing` is empty.
import fs from "node:fs";
import path from "node:path";
import type { Page } from "@playwright/test";
import { MEDIA_BASE_URL } from "../../lib/data/media";

type ManifestEntry = { key: string; width: number; height: number };

export type MediaRoute = {
  /** Keys requested that the manifest does not know (answered 404). */
  missing: string[];
  /** Keys answered with a real file from media-staging/. */
  served: string[];
  /** Keys answered with the sized SVG stand-in because no file is cached. */
  standIn: string[];
};

function loadManifest(): Map<string, ManifestEntry> {
  const file = path.join(process.cwd(), "lib", "data", "media-manifest.json");
  const rows = JSON.parse(fs.readFileSync(file, "utf8")) as ManifestEntry[];
  return new Map(rows.map((r) => [r.key, r]));
}

function standInSvg(entry: ManifestEntry): string {
  const { key, width, height } = entry;
  const size = Math.max(12, Math.min(48, Math.round(width / 24)));
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">` +
    `<rect x="0.5" y="0.5" width="${width - 1}" height="${height - 1}" fill="#ece8e1" stroke="#262626" stroke-opacity="0.35"/>` +
    `<text x="${width / 2}" y="${height / 2}" font-family="sans-serif" font-size="${size}" fill="#262626" text-anchor="middle">${key}</text>` +
    `</svg>`
  );
}

export async function routeMedia(page: Page): Promise<MediaRoute> {
  const manifest = loadManifest();
  const result: MediaRoute = { missing: [], served: [], standIn: [] };
  await page.route(`${MEDIA_BASE_URL}/**`, async (route) => {
    const key = decodeURIComponent(new URL(route.request().url()).pathname.slice(1));
    const entry = manifest.get(key); // only a manifest key ever reaches the file system
    if (!entry) {
      result.missing.push(key);
      await route.fulfill({ status: 404, contentType: "text/plain", body: `not in the media manifest: ${key}` });
      return;
    }
    const file = path.join(process.cwd(), "media-staging", ...key.split("/"));
    if (fs.existsSync(file)) {
      result.served.push(key);
      await route.fulfill({ status: 200, contentType: "image/webp", body: fs.readFileSync(file) });
      return;
    }
    result.standIn.push(key);
    await route.fulfill({ status: 200, contentType: "image/svg+xml", body: standInSvg(entry) });
  });
  return result;
}
