// Part B pictures (2026-10-14, round 2): states-{en,ar,es}-{390,834,1440}.jpg drawn by the REAL components.
// Run from the repo root: python3 <this folder>/mock3_states.py && node <this folder>/shoot_states.mjs
// It copies partb-states.scene.tsx and partb-states.json into tests/journey/scenes, starts ONE dev server with
// ALMAR_HARNESS=1 on a free port, shoots /__harness?c=partb-states&s=sheet, then stops that server by its own PID
// and removes the two copies. Throwaway tooling, not a test.
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import { copyFileSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "../../../..");
const scenes = path.join(root, "tests/journey/scenes");
const copies = [
  [path.join(here, "partb-states.scene.tsx"), path.join(scenes, "partb-states.tsx")],
  [path.join(here, "partb-states.json"), path.join(scenes, "partb-states.json")],
];

const free = (port) =>
  new Promise((resolve) => {
    const s = net.createServer().once("error", () => resolve(false)).once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
let port = 3061;
while (!(await free(port))) port += 1;

for (const [from, to] of copies) copyFileSync(from, to);
const server = spawn("npx", ["next", "dev", "-H", "127.0.0.1", "-p", String(port)], {
  cwd: root,
  env: { ...process.env, ALMAR_HARNESS: "1" },
  stdio: "ignore",
  detached: true,
});
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch();
try {
  for (let i = 0; i < 120; i++) {
    try { if ((await fetch(`${base}/__harness?c=partb-states&s=sheet&l=en`)).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  for (const loc of ["en", "ar", "es"]) {
    for (const width of [390, 834, 1440]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      await page.goto(`${base}/__harness?c=partb-states&s=sheet&l=${loc}`, { timeout: 120_000 });
      await page.locator("#harness-root [data-caption]").first().waitFor({ timeout: 120_000 });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const text = await page.evaluate(() => document.getElementById("harness-root")?.innerText ?? "");
      if (/\[object|undefined|unknown scene|label \w+ is not a string/.test(text)) throw new Error(`${loc} ${width}: bad label`);
      const wide = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
      if (wide) throw new Error(`${loc} ${width}: horizontal overflow`);
      // The controller's five points (2026-10-14), checked in the DOM because the session does not open images.
      const bad = await page.evaluate(() => {
        const out = [];
        const px = (el, p) => parseFloat(getComputedStyle(el)[p]);
        for (const el of document.querySelectorAll("#harness-root input, #harness-root textarea, #harness-root button[role=combobox]")) {
          if (px(el, "borderTopWidth") < 1 || px(el, "borderBottomWidth") < 1) out.push(`no border: ${el.id}`);
        }
        for (const box of document.querySelectorAll("[id^=inquiry-]")) {
          const b = box.getBoundingClientRect();
          const mail = box.querySelector("input[type=email]").getBoundingClientRect();
          const sel = box.querySelector("button[role=combobox]").getBoundingClientRect();
          if (Math.abs(sel.left - mail.left) > 1 || Math.abs(sel.width - mail.width) > 1) out.push(`select not in the field column: ${box.id}`);
          if (sel.left < b.left || sel.right > b.right) out.push(`select outside the box: ${box.id}`);
        }
        const busy = document.querySelector("#inquiry-s4 button[type=submit]");
        if (!busy?.disabled || busy.getAttribute("aria-busy") !== "true" || !busy.querySelector("svg")) out.push("sending cue missing");
        const sent = document.querySelector("[role=status][tabindex='-1']");
        if (!sent || px(sent.parentElement, "borderTopWidth") < 1) out.push("sent line not inside the frame");
        for (const cap of document.querySelectorAll("[data-caption]")) {
          if (cap.closest("[id^=inquiry-], .border-teal")) out.push("caption inside a frame");
        }
        if (document.querySelectorAll("[data-caption]").length !== 13) out.push("caption count");
        return out;
      });
      if (bad.length) throw new Error(`${loc} ${width}: ${bad.join("; ")}`);
      await page.screenshot({ path: path.join(here, `states-${loc}-${width}.jpg`), fullPage: true, type: "jpeg", quality: 80 });
      await page.close();
    }
  }
} finally {
  await browser.close();
  try { process.kill(-server.pid, "SIGTERM"); } catch {}
  for (const [, to] of copies) rmSync(to, { force: true });
}
console.log(`shots ok on port ${port}`);
