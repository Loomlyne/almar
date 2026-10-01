import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const SETTINGS_PAGE = "app/dashboard/(ops)/settings/page.tsx";
const SETTINGS_SCREEN = "app/dashboard/(ops)/settings/settings-screen.tsx";
const PROFILE_PAGE = "app/dashboard/(ops)/profile/page.tsx";
const PROFILE_SCREEN = "app/dashboard/(ops)/profile/profile-screen.tsx";
const CONFIRM_DIALOG = "components/ui/confirm-dialog.tsx";
const OPS_LAYOUT = "app/dashboard/(ops)/layout.tsx";
const DIALOG = "components/ui/dialog.tsx";
const SIDEBAR = "components/ui/sidebar.tsx";

test("settings and profile pages gate production, stay server components, and delegate to client screens", () => {
  const settingsPage = readFileSync(SETTINGS_PAGE, "utf8");
  assert.equal(settingsPage.includes('"use client"'), false);
  assert.match(settingsPage, /NODE_ENV/);
  assert.match(settingsPage, /notFound\(\)/);
  assert.match(settingsPage, /from ["']\.\/settings-screen["']/);

  const profilePage = readFileSync(PROFILE_PAGE, "utf8");
  assert.equal(profilePage.includes('"use client"'), false);
  assert.match(profilePage, /NODE_ENV/);
  assert.match(profilePage, /notFound\(\)/);
  assert.match(profilePage, /from ["']\.\/profile-screen["']/);
});

test("settings groups are Brand, Money, Email, Maintenance, in that order", () => {
  const text = readFileSync(SETTINGS_SCREEN, "utf8");
  const order = ["Brand", "Money", "Email", "Maintenance"];
  const indexes = order.map((label) => {
    const index = text.indexOf(`>${label}<`);
    assert.notEqual(index, -1, `missing group heading: ${label}`);
    return index;
  });
  for (let i = 1; i < indexes.length; i += 1) {
    assert.ok(indexes[i] > indexes[i - 1], `${order[i]} must come after ${order[i - 1]}`);
  }
});

test("FX rate is text sourced from lib/fx/rates, not an input, and is never the hardcoded peg", () => {
  const text = readFileSync(SETTINGS_SCREEN, "utf8");
  assert.match(text, /FxRates/);
  assert.match(text, /rates\.aed/);
  assert.match(text, /rates\.eur/);
  assert.equal(text.includes("3.6725"), false);
  // The rate line renders as a <span>/<p>, never through the Field component
  // (Field always renders an <input>), so it cannot be typed into.
  assert.doesNotMatch(text, /<Field[^>]*label="FX rate"/);
  assert.doesNotMatch(text, /<input[^>]*name="(fx-rate|rate)"/);
});

test("maintenance switch defaults off, is a switch (not a radio), and never fetches", () => {
  const text = readFileSync(SETTINGS_SCREEN, "utf8");
  assert.match(text, /<Switch label="Maintenance"/);
  assert.equal(text.includes('useState(false)'), true);
  assert.equal(text.includes("fetch("), false);
  assert.equal(/type=["']radio["']/.test(text), false);
});

test("settings has no radius control and does not say it saved", () => {
  const text = readFileSync(SETTINGS_SCREEN, "utf8");
  assert.equal(/radius/i.test(text), false);
  assert.match(text, /<Button onClick=\{\(\) => undefined\}>\{copy\.save\}<\/Button>/);
  assert.equal(text.includes("toast"), false);
  assert.equal(text.includes("Saved"), false);
});

test("settings has no password field", () => {
  const text = readFileSync(SETTINGS_SCREEN, "utf8");
  assert.equal(text.includes('type="password"'), false);
});

test("confirm dialog prevents scrim click and Escape from dismissing", () => {
  const text = readFileSync(CONFIRM_DIALOG, "utf8");
  assert.match(text, /onEscapeKeyDown=\{preventDismiss\}/);
  assert.match(text, /onPointerDownOutside=\{preventDismiss\}/);
  assert.match(text, /onInteractOutside=\{preventDismiss\}/);
  assert.match(text, /event\.preventDefault\(\)/);
  assert.match(text, /Stay signed in/);
  assert.equal(text.includes("KitDialog"), false);
  assert.equal(text.includes('from "./dialog"'), false);
});

test("profile shows name, email, a square photo, and both confirms with the locked labels", () => {
  const text = readFileSync(PROFILE_SCREEN, "utf8");
  assert.match(text, /label="Name"/);
  assert.match(text, /label="Email"/);
  assert.match(text, /monogram\.src/);
  assert.equal(text.includes("framerusercontent"), false);
  assert.match(text, /alt=""/);
  assert.match(text, /from ["'].*confirm-dialog["']/);
  assert.match(text, /copy\.signOut\b/);
  assert.match(text, /copy\.logoutAll\b/);
  assert.match(text, /copy\.signOutOfThisSite/);
  assert.match(text, /copy\.signOutEverywhere/);
  assert.match(text, /copy\.staySignedIn/);
  assert.equal(text.includes('type="password"'), false);
  assert.equal(/variant="danger"/.test(text), true);
});

test("Sign out is absent from the dashboard shell layout", () => {
  const text = readFileSync(OPS_LAYOUT, "utf8");
  assert.equal(text.includes("Sign out"), false);
  assert.equal(text.includes("Logout-all"), false);
});

test("dialog.tsx keeps its locked-dismiss handlers and sidebar.tsx keeps its close control", () => {
  const dialog = readFileSync(DIALOG, "utf8");
  assert.match(dialog, /export function Dialog\b/);
  assert.equal(dialog.includes("KitDialog"), false);
  assert.match(dialog, /onEscapeKeyDown=\{block\}/);
  assert.match(dialog, /onPointerDownOutside=\{block\}/);
  assert.match(dialog, /onInteractOutside=\{block\}/);
  const sidebar = readFileSync(SIDEBAR, "utf8");
  assert.match(sidebar, /Close/);
  assert.match(sidebar, /\bend-0\b/);
});
