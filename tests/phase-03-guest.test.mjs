import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

const GUEST_COPY = "lib/copy/guest.ts";
const NAV = "components/ui/nav.tsx";
const TRIP_SCREEN = "app/booking/trip/trip-screen.tsx";
const LOGIN_PAGE = "app/[locale]/login/page.tsx";
const SIGN_IN_SCREEN = "app/[locale]/login/sign-in-screen.tsx";
const BOOKINGS_PAGE = "app/[locale]/bookings/page.tsx";
const BOOKINGS_SCREEN = "app/[locale]/bookings/bookings-screen.tsx";
const ACCOUNT_PAGE = "app/[locale]/account/page.tsx";
const ACCOUNT_SCREEN = "app/[locale]/account/account-screen.tsx";

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

test("sign-in screen has the magic-link button and sends through the server action only", () => {
  const text = readFileSync(SIGN_IN_SCREEN, "utf8");
  assert.match(text, /copy\.accessWithMagicLink/);
  assert.match(text, /requestSignIn/);
  assert.equal(text.includes("fetch("), false);
  assert.equal(text.includes('type="password"'), false);
});

test("bookings screen shows the empty line and Start a trip", () => {
  if (!existsSync(BOOKINGS_SCREEN)) return;
  const text = readFileSync(BOOKINGS_SCREEN, "utf8");
  assert.match(text, /GUEST_COPY/);
  assert.match(text, /copy\.noBookingsYet/);
  assert.match(text, /copy\.startATrip/);
  assert.match(text, /href=\{localePath\(locale, "\/"\)\}/);
});

test("account hub: Save is wired to saveProfile, preferences save, no password input", () => {
  const text = readFileSync(ACCOUNT_SCREEN, "utf8");
  assert.match(text, /saveProfile/);
  assert.match(text, /savePreferences/);
  assert.match(text, /hub\.save\b/);
  assert.match(text, /hub\.firstName/);
  assert.match(text, /hub\.lastName/);
  assert.match(text, /hub\.phoneOptional/);
  assert.equal(text.includes('type="password"'), false);
  assert.equal(/name="email"/.test(text), false, "email is shown as text, not a field");
});

test("the trip screen wears PublicFrame, which points Login at /<locale>/login; the SiteNav default is unchanged", () => {
  // Plan 04-03: the trip page is a public page in the site's frame (Q-06). The frame owns the Login item since job 21
  // (/<locale>/login, or Account from the sign-in hint); the screen passes no loginHref and renders no SiteNav itself.
  const trip = readFileSync(TRIP_SCREEN, "utf8");
  assert.match(trip, /<PublicFrame\b/);
  assert.equal(trip.includes("loginHref"), false);
  assert.equal(trip.includes("<SiteNav"), false);
  assert.match(readFileSync("components/site/public-frame.tsx", "utf8"), /loginHref: localePath\(locale, signedIn \? "\/account" : "\/login"\)/);
  const nav = readFileSync(NAV, "utf8");
  assert.match(nav, /loginHref = "#log-in"/);
});

test("SiteNav shows the account menu only from a session, never a hardcoded flag", () => {
  const nav = readFileSync(NAV, "utf8");
  assert.equal(nav.includes("signedIn"), false);
  assert.match(nav, /account\?: NavAccount \| null/);
  for (const path of [TRIP_SCREEN, SIGN_IN_SCREEN, BOOKINGS_SCREEN, ACCOUNT_SCREEN]) {
    const text = readFileSync(path, "utf8");
    assert.equal(/account=\{\s*\{/.test(text), false, `${path} hardcodes an account`);
  }
  for (const path of [BOOKINGS_PAGE, ACCOUNT_PAGE]) {
    assert.match(readFileSync(path, "utf8"), /readSessionProfile\(\)/, `${path} reads the session`);
  }
});

test("TOUCHWORD lives only in the account menu, in capitals, behind opsHref, in a new tab", () => {
  const menu = readFileSync("components/ui/account-menu.tsx", "utf8");
  assert.match(menu, />\s*TOUCHWORD\s*</);
  assert.match(menu, /opsHref && opsHandoffOpen\(process\.env\.NODE_ENV\) \?/);
  assert.match(menu, /target="_blank"/);
  assert.match(menu, /rel="noopener noreferrer"/);
  for (const path of PUBLIC_SOURCE_FILES) {
    assert.equal(/touchword/i.test(readFileSync(path, "utf8")), false, `${path} mentions TOUCHWORD`);
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
  // The footer now splits the address at "@" to place the <wbr />; the owner's text stays verbatim.
  assert.match(footer, /"inquiries@almarprivatejourney\.com"/);
  assert.match(footer, /\+971 56 388 3302/);
});

test("sign-in option A (owner, 2026-10-19): kicker per host, gold rule, full-width field, link note in en, ar, es", async () => {
  const { GUEST_COPY: copy } = await import("../lib/copy/guest.ts");
  for (const locale of ["en", "ar", "es"]) {
    for (const key of ["kickerPublic", "kickerOps", "linkNote"]) {
      assert.equal(typeof copy[locale].auth[key], "string", `${locale}.auth.${key}`);
      assert.ok(copy[locale].auth[key].trim().length > 0, `${locale}.auth.${key}`);
    }
  }
  assert.equal(copy.en.auth.linkNote, "The link works once, for one hour.");
  const screen = readFileSync(SIGN_IN_SCREEN, "utf8");
  assert.match(screen, /variant === "ops" \? copy\.auth\.kickerOps : copy\.auth\.kickerPublic/);
  assert.match(screen, /<span className="block w-10 border-t border-gold" aria-hidden="true" \/>/);
  assert.match(screen, /error=\{emailError\}\s+className="max-w-none"/);
  assert.match(screen, /\{copy\.auth\.linkNote\}/);
  assert.equal(/bg-gold|text-gold|fill-gold/.test(screen), false, "gold is a line only");
});
