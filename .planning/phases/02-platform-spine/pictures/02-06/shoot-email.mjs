// The sign-in email for the owner, rendered by the real lib/email/magic-link.ts: EN/AR/ES at 600 px, with the design
// system's brand and with one saved non-default Teal (#2b4f56). The button is Teal fill, White text (owner, 2026-10-13).
// The ops sign-in email is the same renderer and copy. Run from the repo root:
//   node .planning/phases/02-platform-spine/pictures/02-06/shoot-email.mjs
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { renderMagicLinkEmail } from "../../../../../lib/email/magic-link.ts";
import { GUEST_COPY } from "../../../../../lib/copy/guest.ts";

const dir = path.dirname(fileURLToPath(import.meta.url));
const HREF = "https://almarprivatejourney.com/auth/confirm?token_hash=example";
const SAVED = { teal: "#2b4f56", white: "#ffffff", ivory: "#fffaf0", ink: "#262626", titleFace: "Questa", bodyFace: "Lato", logoUrl: null };
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 600, height: 700 }, deviceScaleFactor: 1 });
const page = await context.newPage();
for (const [name, brand] of [["default", null], ["saved-teal", SAVED]]) {
  for (const locale of ["en", "ar", "es"]) {
    const copy = GUEST_COPY[locale];
    const { html } = renderMagicLinkEmail({ href: HREF, locale, kind: "sign-in", copy: { ...copy.mail, button: copy.accessWithMagicLink }, brand });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: path.join(dir, `email-${name}-${locale}.png`), fullPage: true });
  }
}
await browser.close();
console.log("done");
