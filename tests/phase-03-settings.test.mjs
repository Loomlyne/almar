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

test("settings and profile pages have no page gate (02-04), stay server components, and delegate to client screens", () => {
  const settingsPage = readFileSync(SETTINGS_PAGE, "utf8");
  assert.equal(settingsPage.includes('"use client"'), false);
  assert.equal(/NODE_ENV|notFound\(\)/.test(settingsPage), false);
  assert.match(settingsPage, /from ["']\.\/settings-screen["']/);

  const profilePage = readFileSync(PROFILE_PAGE, "utf8");
  assert.equal(profilePage.includes('"use client"'), false);
  assert.equal(/NODE_ENV|notFound\(\)/.test(profilePage), false);
  assert.match(profilePage, /from ["']\.\/profile-screen["']/);
});

// 02-06 wired the screen: the 03-plan placeholder (Brand/Money/Email/Maintenance, a dead Save) is gone.
test("settings groups follow the signed pictures (02-06): brand colours, type, money, maintenance, logo, language", () => {
  const text = readFileSync(SETTINGS_SCREEN, "utf8");
  const order = ["copy.brandColors", "copy.type", "copy.money", "copy.maintenance", "copy.logo", "copy.langCurrency"];
  const indexes = order.map((key) => {
    const index = text.indexOf(`>{${key}}</GroupTitle>`);
    assert.notEqual(index, -1, `missing group heading: ${key}`);
    return index;
  });
  for (let i = 1; i < indexes.length; i += 1) {
    assert.ok(indexes[i] > indexes[i - 1], `${order[i]} must come after ${order[i - 1]}`);
  }
});

test("FX rate is read-only text from the API, or the not-available line; never an input or a hard-coded rate", () => {
  const text = readFileSync(SETTINGS_SCREEN, "utf8");
  assert.match(text, /copy\.fxNone/);
  for (const rate of ["3.6725", "0.8614"]) assert.equal(text.includes(rate), false, rate);
  assert.doesNotMatch(text, /<Field[^>]*label=\{copy\.fx\}/);
  assert.doesNotMatch(text, /<input[^>]*name="(fx-rate|rate)"/);
});

test("maintenance is one checkbox saved through the owner API, not a radio and not its own fetch", () => {
  const text = readFileSync(SETTINGS_SCREEN, "utf8");
  assert.match(text, /<Checkbox\s+label=\{copy\.maintenanceOn\}/);
  assert.equal(/type=["']radio["']/.test(text), false);
  assert.equal(/\bfetch\(/.test(text), false);
  assert.match(text, /opsSend<[^>]*>\("\/api\/ops\/settings"/);
});

test("settings has no radius control; Save is live only through canSave and says when it saved", () => {
  const text = readFileSync(SETTINGS_SCREEN, "utf8");
  assert.equal(/radius/i.test(text), false);
  assert.equal(text.includes("onClick={() => undefined}"), false);
  assert.match(text, /disabled=\{!enabled\}/);
  assert.match(text, /canSave\(form, saved\)/);
  assert.match(text, /copy\.saved/);
  assert.equal(text.includes("toast"), false);
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
