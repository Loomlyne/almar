// Plan 02-06: the Settings form's Save rules (D-128, D-131, D-166, D-168) and the body it sends.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const f = await loadTs("lib/settings/form.ts");
const v = await loadTs("lib/settings/validate.ts");

const SAVED = {
  colors: { teal: "#1f3b40", charcoal: "#262626", gold: "#d4ba8a", ivory: "#fffaf0", white: "#ffffff" },
  titleFace: "Questa",
  bodyFace: "Lato",
  vat: "5.00",
  deposit: "30.00",
  maintenance: false,
  logo: null,
  locale: "en",
  currency: "AED",
};
const LOGO = { id: "11111111-1111-4111-8111-111111111111", url: "https://media.almarprivatejourney.com/brand/l.png", bytes: null, contentType: "image/png" };

test("Save stays disabled until something changes", () => {
  assert.equal(f.canSave(SAVED, SAVED), false);
  assert.equal(f.canSave({ ...SAVED, vat: " 5.00 " }, SAVED), false);
  assert.equal(f.canSave({ ...SAVED, maintenance: true }, SAVED), true);
  assert.equal(f.canSave({ ...SAVED, currency: "EUR" }, SAVED), true);
});

test("a failing contrast blocks Save and is shown under the colour she changed", () => {
  const form = { ...SAVED, colors: { ...SAVED.colors, teal: "#9fb8bb" } };
  assert.deepEqual(f.contrastErrors(form, SAVED), ["teal"]);
  assert.equal(f.canSave(form, SAVED), false);
  assert.equal(f.canSave({ ...SAVED, colors: { ...SAVED.colors, gold: "#fffaf0" } }, SAVED), true, "gold is lines only");
});

test("percents: two places, empty allowed, 0 allowed, over 100 refused", () => {
  for (const ok of ["", "0", "5", "5.0", "5.00", "100", "30.5"]) assert.equal(f.percentError(ok), null, ok);
  for (const bad of ["5.125", "5,00", "abc", "-1", "1e2", "٥"]) assert.equal(f.percentError(bad), "twoDecimals", bad);
  assert.equal(f.percentError("100.01"), "percentRange");
  assert.equal(f.canSave({ ...SAVED, vat: "5.125" }, SAVED), false);
  assert.equal(f.canSave({ ...SAVED, vat: "" }, SAVED), true);
  assert.equal(f.percentText("5"), "5.00");
  assert.equal(f.percentText(null), "");
});

test("a cleared saved logo keeps Save disabled until a replacement is chosen; a wrong type is refused", () => {
  const withLogo = { ...SAVED, logo: LOGO };
  assert.equal(f.canSave({ ...withLogo, logo: null }, withLogo), false);
  assert.equal(f.canSave({ ...withLogo, logo: { ...LOGO, id: "22222222-2222-4222-8222-222222222222" } }, withLogo), true);
  assert.equal(f.canSave({ ...SAVED, logo: { ...LOGO, contentType: "image/svg+xml" } }, SAVED), false);
  assert.equal(f.canSave({ ...SAVED, logo: { ...LOGO, bytes: 1024 * 1024 + 1 } }, SAVED), false);
  assert.equal(f.canSave({ ...SAVED, logo: LOGO }, SAVED), true);
});

test("the body Save sends passes the server's parser exactly", () => {
  const body = f.saveBody({ ...SAVED, vat: "7.5", deposit: "", logo: LOGO, maintenance: true });
  const parsed = v.parseSettingsSave(body);
  assert.equal(parsed.vat_percent, "7.50");
  assert.equal(parsed.deposit_percent, null);
  assert.equal(parsed.logo_media_id, LOGO.id);
  assert.equal(parsed.maintenance, true);
});

test("the screen talks to /api/ops/settings only, and has no rate input, no radius and no gold fill", () => {
  const src = readFileSync("app/dashboard/(ops)/settings/settings-screen.tsx", "utf8");
  assert.match(src, /"\/api\/ops\/settings"/);
  assert.doesNotMatch(src, /3\.6725|0\.8614|"5\.00"|"30\.00"/, "no FX number and no VAT/deposit value in code");
  assert.doesNotMatch(src, /bg-gold|radius/);
  assert.doesNotMatch(src, /fetch\(/, "network only through components/ops/ops-client.ts");
});
