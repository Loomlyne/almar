import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const COPY = "lib/copy/dashboard.ts";
const LOCALE = "lib/set-document-locale.ts";
const CSS = "app/dashboard/dashboard.module.css";
const ENTRY = "app/dashboard/page.tsx";

test("dashboard copy exports en, ar, and es with locked strings", () => {
  const text = readFileSync(COPY, "utf8");
  assert.match(text, /export const DASHBOARD_COPY/);
  for (const locale of ["en", "ar", "es"]) {
    assert.match(text, new RegExp(`${locale}:\\s*\\{`));
  }
  assert.match(text, /close:\s*"Close"/);
  assert.match(text, /close:\s*"إغلاق"/);
  assert.match(text, /close:\s*"Cerrar"/);
  assert.match(text, /newBooking:\s*"New booking"/);
  assert.match(text, /newBooking:\s*"حجز جديد"/);
  assert.match(text, /newBooking:\s*"Nueva reserva"/);
  assert.match(text, /noBookingsYet:\s*"No bookings yet"/);
  assert.match(text, /noBookingsYet:\s*"لا حجوزات بعد"/);
  assert.match(text, /noBookingsYet:\s*"Aún no hay reservas"/);
  assert.equal(text.includes("touchword"), false);
  assert.match(text, /"AED"/);
  assert.match(text, /"USD"/);
  assert.match(text, /"EUR"/);
});

test("locale setter sets dir rtl only for ar", () => {
  const text = readFileSync(LOCALE, "utf8");
  assert.match(text, /export function setDocumentLocale/);
  assert.match(text, /root\.dir = locale === "ar" \? "rtl" : "ltr"/);
  assert.match(text, /notoNaskh/);
  assert.match(text, /notoSans/);
  assert.equal(text.includes('dir = "rtl"'), false);
  assert.doesNotMatch(text, /locale === "en"[\s\S]{0,40}rtl/);
  assert.doesNotMatch(text, /locale === "es"[\s\S]{0,40}rtl/);
});

test("shell is utility-styled: no module css, no Framer logo URL, logos from brand/", () => {
  assert.equal(existsSync(CSS), false, "dashboard.module.css must be deleted");
  const layout = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  assert.equal(/styles\.|module\.css/.test(layout), false);
  assert.equal(layout.includes("framerusercontent"), false);
  assert.equal(layout.includes("encodeURIComponent"), false);
  assert.match(layout, /brand\/Logo Typography\/Stacked_Charcoal\.svg/);
  assert.match(layout, /charcoalLogo\.src/);
});

test("ops sign-in entry is titled Sign in and renders the ops variant of board 6a", () => {
  // Plan 02-04: the entry is the ops sign-in; its visible strings come from the sign-in screen.
  const text = readFileSync(ENTRY, "utf8");
  assert.equal(text.includes("use client"), false);
  assert.match(text, /title:\s*"Sign in"/);
  assert.match(text, /variant="ops"/);
  assert.match(text, /action=\{opsSignIn\}/);
  assert.match(text, /if \(!opsHost && process\.env\.NODE_ENV === "production"\) notFound\(\);/);
  const screen = readFileSync("app/login/sign-in-screen.tsx", "utf8");
  assert.equal(/>[^<{]*dashboard/i.test(screen), false, "no visible dashboard text");
  assert.match(screen, /variant === "ops" \? copy\.signIn : copy\.auth\.heading/);
  assert.match(screen, /variant === "public" \? <WhatsApp \/> : null/);
});

test("ops rail lists the eight labels and the interior mark", () => {
  const text = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  for (const label of ["Home", "Bookings", "Customers", "Calendar", "Catalog", "Content", "Settings", "Profile"]) {
    assert.equal(text.includes(label), true, label);
  }
  // Plan 02-04: the interior mark is the Dashboard copy, uppercased by CSS on Latin only.
  assert.match(text, /uppercase tracking-kicker xl:inline ar:normal-case/);
  assert.match(text, /\{copy\.dashboardName\}/);
  // Sign out and Logout-all exist only in ops mode, from the copy catalog.
  assert.match(text, /mode === "ops" \? \(\s*<div className="mt-4 flex flex-col gap-4/);
  assert.equal(text.includes(">Sign out<"), false);
  assert.equal(text.includes("maria@"), false);
  assert.equal(/<tr[\s>]/.test(text), false);
  // Plan 03.2-12 removed the dead <Sidebar open={false}> and its import (pinned below).
});

test("ops rail keeps every route and the Catalog group is a disclosure", () => {
  const text = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  for (const href of [
    "/dashboard/home", "/dashboard/bookings", "/dashboard/customers", "/dashboard/calendar",
    "/dashboard/catalog/destinations", "/dashboard/catalog/stays", "/dashboard/catalog/experiences", "/dashboard/catalog/packages",
    "/dashboard/content/pages", "/dashboard/content/blog", "/dashboard/content/team", "/dashboard/content/legal",
    "/dashboard/content/media", "/dashboard/content/navigation",
    "/dashboard/settings", "/dashboard/profile",
  ]) {
    assert.equal(text.includes(`"${href}"`), true, href);
  }
  assert.match(text, /aria-expanded=\{catalogOpen\}/);
  assert.match(text, /aria-controls=\{subId\}/);
  assert.match(text, /aria-current=\{current \? "page" : undefined\}/);
  assert.match(text, /bg-teal-tint text-teal/);
  assert.match(text, /data-density="dense"/);
  assert.match(text, /xl:w-sidebar/);
});

test("sidebar is a Radix dialog with title and Close, docked with end-0 and no JS inset", () => {
  const sidebar = "components/ui/sidebar.tsx";
  const text = readFileSync(sidebar, "utf8");
  assert.match(text, /from "radix-ui"/);
  assert.match(text, /Dialog\.Title/);
  assert.match(text, /Dialog\.Close/);
  assert.match(text, /Close/);
  assert.match(text, /\bend-0\b/);
  assert.match(text, /bg-ink\/40/);
  assert.match(text, /z-70/);
  assert.equal(text.includes("dockEnd"), false);
  assert.equal(/module\.css|styles\./.test(text), false);
  assert.equal(text.includes("innerHTML"), false);
  assert.equal(text.includes("KitDialog"), false);
});

test("Content rail: Pages, Blog, Team, Legal, Media, Navigation and footer in canvas order; four Soon chips; none on Packages, Team or Media", () => {
  const text = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  const content = text.slice(text.indexOf('key: "content"'), text.indexOf('key: "settings"'));
  const rows = [...content.matchAll(/\{ key: "([a-z]+)", label: "[^"]+", href: "([^"]+)"(, soon: true)? \}/g)].map((m) => ({ key: m[1], href: m[2], soon: Boolean(m[3]) }));
  assert.deepEqual(rows.map((r) => r.key), ["pages", "blog", "team", "legal", "media", "navigation"]);
  assert.deepEqual(rows.filter((r) => r.soon).map((r) => r.key), ["pages", "blog", "legal", "navigation"]);
  assert.equal(text.slice(text.indexOf('key: "catalog"'), text.indexOf('key: "content"')).includes("soon: true"), false, "Packages carries no chip");
  // The chip and the accessible name ", soon" come from lib/copy/ops-content.ts, not from the shared dashboard copy.
  assert.match(text, /OPS_CONTENT_COPY\[locale\]/);
  assert.match(text, /content\.soonNamed\.replace\("\{label\}", railLabel\(item\.key\)\)/);
  assert.match(text, /<SoonChip>\{content\.soon\}<\/SoonChip>/);
  assert.match(text, /key === "navigation" \? content\.rail\.navigation/);
});

test("ops host rail hrefs drop /dashboard for the two new entries", () => {
  const text = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  assert.match(text, /mode === "ops" \? href\.replace\(\/\^\\\/dashboard\/, ""\) \|\| "\/" : href/);
  for (const href of ["/dashboard/content/media", "/dashboard/content/navigation"]) {
    assert.equal(href.replace(/^\/dashboard/, "") || "/", href.slice("/dashboard".length));
  }
});

test("shell: no dead Sidebar, the drawer clears the header, and the ops shell renders a live page instead of Not ready", () => {
  const text = readFileSync("app/dashboard/(ops)/ops-shell.tsx", "utf8");
  assert.equal(text.includes("open={false}"), false);
  assert.equal(text.includes("<Sidebar"), false);
  assert.equal(/ui\/sidebar/.test(text), false);
  // The header is about 78px (70px logo plus padding); the drawer starts 80px down (it was 64px, under the header).
  assert.match(text, /overscroll-contain border-e-0 bg-ivory pt-20/);
  assert.match(text, /mode === "ops" && !children \?/);
  assert.match(text, /copy\.notReady/);
});
