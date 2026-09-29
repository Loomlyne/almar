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
  const layout = readFileSync("app/dashboard/(ops)/layout.tsx", "utf8");
  assert.equal(/styles\.|module\.css/.test(layout), false);
  assert.equal(layout.includes("framerusercontent"), false);
  assert.equal(layout.includes("encodeURIComponent"), false);
  assert.match(layout, /brand\/Logo Typography\/Stacked_Charcoal\.svg/);
  assert.match(layout, /charcoalLogo\.src/);
});

test("sign-in entry does not contain the text dashboard", () => {
  if (!existsSync(ENTRY)) return;
  const text = readFileSync(ENTRY, "utf8");
  assert.equal(/dashboard/i.test(text), false);
  assert.equal(text.includes("use client"), false);
  assert.match(text, /title:\s*"Sign in"/);
  assert.match(text, /<h1>Sign in<\/h1>/);
  assert.match(text, /NODE_ENV/);
  assert.match(text, /notFound\(\)/);
});

test("ops rail lists the eight labels and the interior mark", () => {
  const layout = "app/dashboard/(ops)/layout.tsx";
  if (!existsSync(layout)) return;
  const text = readFileSync(layout, "utf8");
  for (const label of ["Home", "Bookings", "Customers", "Calendar", "Catalog", "Content", "Settings", "Profile", "DASHBOARD"]) {
    assert.equal(text.includes(label), true, label);
  }
  assert.equal(text.includes("Sign out"), false);
  assert.equal(text.includes("Logout-all"), false);
  assert.equal(text.includes("maria@"), false);
  assert.equal(/<tr[\s>]/.test(text), false);
  assert.match(text, /from ["'].*sidebar["']/);
});

test("ops rail keeps every route and the Catalog group is a disclosure", () => {
  const text = readFileSync("app/dashboard/(ops)/layout.tsx", "utf8");
  for (const href of [
    "/dashboard/home", "/dashboard/bookings", "/dashboard/customers", "/dashboard/calendar",
    "/dashboard/catalog/destinations", "/dashboard/catalog/stays", "/dashboard/catalog/experiences", "/dashboard/catalog/packages",
    "/dashboard/content/pages", "/dashboard/content/blog", "/dashboard/content/team", "/dashboard/content/legal",
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
