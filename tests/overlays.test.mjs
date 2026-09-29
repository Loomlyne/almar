import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";

const DIR = "components/ui";
const files = readdirSync(DIR).filter((name) => name.endsWith(".tsx"));
const read = (name) => readFileSync(`${DIR}/${name}`, "utf8");

test("no arbitrary z-layers, color-mix or var() padding in components/ui", () => {
  for (const name of files) {
    const text = read(name);
    assert.equal(/z-\[/.test(text), false, `${name} uses z-[..]`);
    assert.equal(text.includes("color-mix"), false, `${name} uses color-mix`);
    assert.equal(/p-\[var/.test(text), false, `${name} uses p-[var(..)]`);
  }
});

test("dialogs sit on z-70, scrim is bg-ink/40, toast z-50, WhatsApp z-60", () => {
  for (const name of ["dialog.tsx", "confirm-dialog.tsx"]) {
    const text = read(name);
    assert.match(text, /bg-ink\/40/, `${name} scrim`);
    assert.match(text, /z-70/, `${name} layer`);
  }
  assert.match(read("toast.tsx"), /z-50/);
  assert.match(read("whatsapp.tsx"), /z-60/);
});

test("close controls are a teal glyph, never a gold fill, with a 44px hit area", () => {
  for (const name of ["dialog.tsx", "toast.tsx"]) {
    const text = read(name);
    assert.equal(text.includes("bg-gold"), false, `${name} has a gold fill`);
    assert.match(text, /size-control[^"]*text-teal/, `${name} close control`);
  }
});

test("dialog.tsx has no hard-coded button strings and keeps the locked-dismiss handlers", () => {
  const text = read("dialog.tsx");
  assert.equal(/["'>]Continue["'<]/.test(text), false);
  assert.equal(/["'>]Cancel["'<]/.test(text), false);
  assert.match(text, /onEscapeKeyDown=\{block\}/);
  assert.match(text, /onPointerDownOutside=\{block\}/);
  assert.match(text, /onInteractOutside=\{block\}/);
  assert.match(text, /dismiss === "confirm"/);
  const confirm = read("confirm-dialog.tsx");
  assert.match(confirm, /onEscapeKeyDown=\{preventDismiss\}/);
});

test("specimen-only exports are gone from the app", () => {
  for (const name of ["select.tsx", "date-field.tsx"]) {
    assert.equal(readdirSync(DIR).includes(name), false, `${name} should be deleted`);
  }
  assert.equal(read("toast.tsx").includes("ShowToast"), false);
  assert.equal(read("calendar.tsx").includes("DateRangeField"), false);
});

test("calendar days: teal arrive and leave, tint nights, no gold", () => {
  const text = read("calendar.tsx");
  assert.match(text, /selected && "bg-teal text-ivory"/);
  assert.match(text, /bg-teal-tint/);
  assert.equal(/gold/.test(text), false);
  assert.equal(text.includes("calendar-day"), false);
});

test("WhatsApp keeps the exact wa.me link", () => {
  assert.match(read("whatsapp.tsx"), /https:\/\/wa\.me\/971563883302/);
});
