import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const COPY = "lib/dashboard-copy.ts";
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

test("shell css docks to the end side without a physical right property", () => {
  if (!existsSync(CSS)) return;
  const text = readFileSync(CSS, "utf8");
  assert.match(text, /inset-inline-end/);
  assert.equal(/\bright\b/.test(text), false, "physical right");
});

test("sign-in entry does not contain the text dashboard", () => {
  if (!existsSync(ENTRY)) return;
  const text = readFileSync(ENTRY, "utf8");
  assert.equal(/dashboard/i.test(text), false);
  assert.match(text, /title:\s*"Sign in"/);
  assert.match(text, /NODE_ENV/);
  assert.match(text, /notFound\(\)/);
});
