import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import { MEDIA_BASE_URL } from "../lib/data/media";
import { routeMedia } from "./helpers/media-route";

// Plan 03.3-07. Proves the helper plans 04-06 use: images on the media host load in the browser before the R2 bucket
// exists. It needs no harness scene and no React page; it sets its own content. With media-staging/ present the real
// files are served; in a clean clone (no cache) a sized SVG stand-in is served, and the layout numbers are the same.

type Entry = { key: string; width: number; height: number };
const manifest = JSON.parse(fs.readFileSync(path.join(process.cwd(), "lib", "data", "media-manifest.json"), "utf8")) as Entry[];
const byKey = new Map(manifest.map((e) => [e.key, e]));
const cached = (key: string) => fs.existsSync(path.join(process.cwd(), "media-staging", ...key.split("/")));

// One local source, one Framer source, one gallery image.
const KEYS = ["home/hero/poster.webp", "stays/baru-island-private-villa/gallery-2.webp", "stays/getsemani-colonial-house/hero.webp"];
const UNKNOWN = "stays/not-in-the-manifest/hero.webp";

test("routeMedia: three manifest images load, an unknown key is a 404 and is recorded", async ({ page }) => {
  for (const k of KEYS) expect(byKey.has(k), `${k} must be a manifest key`).toBe(true);
  const media = await routeMedia(page);
  const tags = [...KEYS, UNKNOWN].map((k, i) => `<img id="i${i}" alt="" src="${MEDIA_BASE_URL}/${k}">`).join("");
  await page.setContent(`<!doctype html><html><body>${tags}</body></html>`);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));

  const sizes = await page.evaluate(() => [...document.images].map((img) => ({ w: img.naturalWidth, h: img.naturalHeight })));
  for (let i = 0; i < KEYS.length; i++) {
    expect(sizes[i].w, `${KEYS[i]} naturalWidth`).toBeGreaterThan(0);
    expect(sizes[i].w, `${KEYS[i]} naturalWidth equals the manifest width`).toBe(byKey.get(KEYS[i])!.width);
    expect(sizes[i].h, `${KEYS[i]} naturalHeight equals the manifest height`).toBe(byKey.get(KEYS[i])!.height);
  }
  expect(sizes[3].w, "the unknown key does not load").toBe(0);
  expect(media.missing).toEqual([UNKNOWN]);

  // Real files when cached, stand-ins when not; never a mix up of the two lists.
  const hasCache = KEYS.every(cached);
  if (hasCache) {
    expect(media.served.sort()).toEqual([...KEYS].sort());
    expect(media.standIn).toEqual([]);
  } else {
    expect(media.served.length + media.standIn.length).toBe(KEYS.length);
  }
  test.info().annotations.push({ type: "media", description: hasCache ? "served from media-staging/" : "SVG stand-ins (no cache)" });
});

test("routeMedia: the same key asked twice is answered twice and `missing` stays empty for known keys", async ({ page }) => {
  const media = await routeMedia(page);
  await page.setContent(`<!doctype html><body><img id="a" alt="" src="${MEDIA_BASE_URL}/${KEYS[0]}"><img id="b" alt="" src="${MEDIA_BASE_URL}/${KEYS[0]}?again=1"></body>`);
  await page.waitForFunction(() => [...document.images].every((img) => img.complete));
  expect(await page.evaluate(() => [...document.images].every((img) => img.naturalWidth > 0))).toBe(true);
  expect(media.missing).toEqual([]);
});
