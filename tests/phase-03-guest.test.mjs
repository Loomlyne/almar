import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const GUEST_COPY = "lib/copy/guest.ts";
const NAV = "components/ui/nav.tsx";
const TRIP_SCREEN = "app/booking/trip/trip-screen.tsx";
const LOGIN_PAGE = "app/login/page.tsx";
const SIGN_IN_SCREEN = "app/login/sign-in-screen.tsx";
const BOOKINGS_PAGE = "app/bookings/page.tsx";
const BOOKINGS_SCREEN = "app/bookings/bookings-screen.tsx";
const ACCOUNT_PAGE = "app/account/page.tsx";
const ACCOUNT_SCREEN = "app/account/account-screen.tsx";

const PUBLIC_SOURCE_FILES = [
  NAV,
  TRIP_SCREEN,
  LOGIN_PAGE,
  SIGN_IN_SCREEN,
  BOOKINGS_PAGE,
  BOOKINGS_SCREEN,
  ACCOUNT_PAGE,
  ACCOUNT_SCREEN,
  GUEST_COPY,
];

test("lib/copy/guest.ts has en, ar, and es with the locked strings", () => {
  const text = readFileSync(GUEST_COPY, "utf8");
  assert.match(text, /export const GUEST_COPY/);
  for (const locale of ["en", "ar", "es"]) {
    assert.match(text, new RegExp(`${locale}:\\s*\\{`));
  }
  assert.match(text, /accessWithMagicLink:\s*"Access with magic link"/);
  assert.match(text, /startATrip:\s*"Start a trip"/);
  assert.match(text, /noBookingsYet:\s*"No bookings yet"/);
  assert.match(text, /enterEmail:\s*"Enter an email address\."/);
  assert.match(text, /login:\s*"دخول"/);
  assert.match(text, /bookings:\s*"الحجوزات"/);
  assert.match(text, /account:\s*"الحساب"/);
  assert.match(text, /signOut:\s*"تسجيل الخروج"/);
  assert.match(text, /noBookingsYet:\s*"لا حجوزات بعد"/);
  assert.match(text, /startATrip:\s*"ابدأ رحلة"/);
  assert.match(text, /login:\s*"Entrar"/);
  assert.match(text, /bookings:\s*"Reservas"/);
  assert.match(text, /account:\s*"Cuenta"/);
  assert.match(text, /signOut:\s*"Cerrar sesión"/);
  assert.match(text, /noBookingsYet:\s*"Aún no hay reservas"/);
  assert.match(text, /startATrip:\s*"Empezar un viaje"/);
});

test("no written file contains touchword or a password field", () => {
  for (const path of PUBLIC_SOURCE_FILES) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    assert.equal(text.includes("touchword"), false, `${path} contains touchword`);
    assert.equal(text.includes('type="password"'), false, `${path} contains a password field`);
  }
});

test("public guest screen sources do not say dashboard", () => {
  for (const path of PUBLIC_SOURCE_FILES) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    assert.equal(/dashboard/i.test(text), false, `${path} mentions dashboard`);
  }
});

test("sign-in screen has the magic-link button and does not send", () => {
  if (!existsSync(SIGN_IN_SCREEN)) return;
  const text = readFileSync(SIGN_IN_SCREEN, "utf8");
  assert.match(text, /Access with magic link/);
  assert.equal(text.includes("fetch("), false);
  assert.equal(text.includes('type="password"'), false);
});

test("bookings screen shows the empty line and Start a trip", () => {
  if (!existsSync(BOOKINGS_SCREEN)) return;
  const text = readFileSync(BOOKINGS_SCREEN, "utf8");
  assert.match(text, /No bookings yet/);
  assert.match(text, /Start a trip/);
  assert.match(text, /href="\/"/);
});

test("account screen has no Save button and no password input", () => {
  if (!existsSync(ACCOUNT_SCREEN)) return;
  const text = readFileSync(ACCOUNT_SCREEN, "utf8");
  assert.equal(/>\s*Save\s*</.test(text), false);
  assert.equal(text.includes('type="password"'), false);
  assert.match(text, /Name/);
  assert.match(text, /Phone/);
  assert.match(text, /Language/);
});

test("the trip screen points Login at /login; the SiteNav default is unchanged", () => {
  const trip = readFileSync(TRIP_SCREEN, "utf8");
  assert.match(trip, /loginHref="\/login"/);
  const nav = readFileSync(NAV, "utf8");
  assert.match(nav, /loginHref = "#log-in"/);
});

test("SiteNav signedIn defaults false and no call site passes true", () => {
  const nav = readFileSync(NAV, "utf8");
  assert.match(nav, /signedIn = false/);
  for (const path of [TRIP_SCREEN, SIGN_IN_SCREEN, BOOKINGS_SCREEN, ACCOUNT_SCREEN]) {
    if (!existsSync(path)) continue;
    const text = readFileSync(path, "utf8");
    assert.equal(/signedIn(\s*=\s*\{?\s*)true/.test(text), false, `${path} sets signedIn true`);
  }
});

test("nav takes its logos from brand/ and uses LocaleSelect, not NavDrop or Framer URLs", () => {
  const nav = readFileSync(NAV, "utf8");
  assert.match(nav, /Stacked_Charcoal\.svg/);
  assert.match(nav, /Poly_White\.svg/);
  assert.equal(nav.includes("framerusercontent.com"), false);
  assert.equal(nav.includes("encodeURIComponent"), false);
  assert.equal(nav.includes("NavDrop"), false);
  assert.match(nav, /LocaleSelect/);
  const footer = readFileSync("components/ui/footer.tsx", "utf8");
  assert.equal(footer.includes("framerusercontent.com"), false);
  assert.match(footer, /inquiries@<wbr \/>almarprivatejourney\.com/);
  assert.match(footer, /\+971 56 388 3302/);
});
