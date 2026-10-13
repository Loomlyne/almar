// Plan 02-06 (controller item 3): how far a saved Teal reaches the assembled public pages. A measurement, not a test.
// For every page in out/ it loads the page in Chromium twice: as built, then with the same <style id="almar-brand">
// the publish rebuild writes (lib/site-settings.ts brandStyle) for a non-default Teal. It counts the elements whose
// computed colour, background, border, outline, fill, stroke or text-decoration colour is the design Teal, and how many
// of those take the saved Teal. An <img> of an SVG keeps the colours baked into its file: those are counted apart.
//
//   node scripts/assemble-cloudflare.mjs --target=local
//   node tests/build/measure-brand-reach.mjs [--port 8799] > measurement.md
//
// Serves out/ itself (a minimal static server: /x -> x.html or x/index.html) on 127.0.0.1; one browser, one page at a
// time. Writes a Markdown table to stdout.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const OUT = path.join(root, "out");
const portArg = process.argv.indexOf("--port");
const PORT = portArg > 0 ? Number(process.argv[portArg + 1]) : 8799;
const SAVED = "#7a1f3b";
const DESIGN_RGB = "rgb(31, 59, 64)";
const SAVED_RGB = "rgb(122, 31, 59)";
const STYLE = `:root{--color-teal:${SAVED};--color-teal-hover:color-mix(in srgb,${SAVED} 92%,#262626);--color-teal-press:color-mix(in srgb,${SAVED} 84%,#262626)}`;
const TYPES = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".woff": "font/woff", ".ttf": "font/ttf", ".webp": "image/webp", ".png": "image/png", ".jpg": "image/jpeg", ".json": "application/json", ".ico": "image/x-icon" };

function pages(dir, base = "") {
  const list = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = path.posix.join(base, entry.name);
    if (entry.isDirectory()) {
      if (["_next", "brand", "cdn-cgi"].includes(entry.name)) continue;
      list.push(...pages(path.join(dir, entry.name), rel));
    } else if (entry.name.endsWith(".html")) list.push(rel);
  }
  return list.sort();
}

function urlFor(file) {
  if (file === "index.html") return "/";
  if (file.endsWith("/index.html")) return `/${file.slice(0, -"index.html".length)}`;
  return `/${file.slice(0, -".html".length)}`;
}

function resolveFile(urlPath) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  const candidates = [clean, `${clean}.html`, path.posix.join(clean, "index.html")];
  for (const c of candidates) {
    const full = path.join(OUT, c);
    if (full.startsWith(OUT) && fs.existsSync(full) && fs.statSync(full).isFile()) return full;
  }
  return null;
}

const server = http.createServer((req, res) => {
  const file = resolveFile(req.url ?? "/");
  if (!file) {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

const PROPS = ["color", "background-color", "border-top-color", "border-right-color", "border-bottom-color", "border-left-color", "outline-color", "fill", "stroke", "text-decoration-color"];

function snapshot(props) {
  const all = [...document.querySelectorAll("*")];
  return all.map((el, i) => {
    const cs = getComputedStyle(el);
    const values = {};
    for (const p of props) values[p] = cs.getPropertyValue(p);
    const cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 2).join(".") : "";
    return { i, tag: el.tagName.toLowerCase(), cls, values };
  });
}

await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const rows = [];
try {
  for (const file of pages(OUT)) {
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${PORT}${urlFor(file)}`, { waitUntil: "load" });
    // Colour transitions (transition-colors) would be caught mid-way: switch them off before either snapshot.
    await page.addStyleTag({ content: "*,*::before,*::after{transition:none!important;animation:none!important}" });
    // The brand style element exists, empty, before the first snapshot: the element list (paired by index) is the same
    // in both snapshots.
    await page.addStyleTag({ content: "/* brand */" });
    await page.waitForTimeout(200);
    const before = await page.evaluate(snapshot, PROPS);
    const images = await page.evaluate(() => [...document.images].filter((img) => /\.svg(\?|$)/i.test(img.src)).length);
    await page.evaluate((css) => {
      const styles = document.head.querySelectorAll("style");
      styles[styles.length - 1].textContent = css;
    }, STYLE);
    await page.waitForTimeout(300);
    const after = await page.evaluate(snapshot, PROPS);
    let teal = 0;
    let follow = 0;
    const stuck = new Map();
    for (const el of before) {
      const props = PROPS.filter((p) => el.values[p].includes(DESIGN_RGB));
      if (props.length === 0) continue;
      teal += 1;
      const now = after[el.i];
      const moved = now && props.every((p) => !now.values[p].includes(DESIGN_RGB) && now.values[p].includes(SAVED_RGB));
      if (moved) follow += 1;
      else {
        const label = `${el.tag}${el.cls ? `.${el.cls}` : ""}`;
        stuck.set(label, (stuck.get(label) ?? 0) + 1);
      }
    }
    rows.push({ url: urlFor(file), teal, follow, stuck: teal - follow, images, examples: [...stuck.entries()].slice(0, 3).map(([k, v]) => `${k} x${v}`).join("; ") });
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

const total = rows.reduce((a, r) => ({ teal: a.teal + r.teal, follow: a.follow + r.follow, stuck: a.stuck + r.stuck, images: a.images + r.images }), { teal: 0, follow: 0, stuck: 0, images: 0 });
console.log(`Saved Teal ${SAVED} over the design Teal #1f3b40, ${rows.length} pages in out/.\n`);
console.log("| Page | Teal elements | Take the saved Teal | Stay design Teal | SVG images (colour baked in, not measured) | Examples that stay |");
console.log("|---|---:|---:|---:|---:|---|");
for (const r of rows) console.log(`| \`${r.url}\` | ${r.teal} | ${r.follow} | ${r.stuck} | ${r.images} | ${r.examples || "-"} |`);
console.log(`| **All** | **${total.teal}** | **${total.follow}** | **${total.stuck}** | **${total.images}** | |`);
