import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Source guards for the slice 2 primitives (plan 03.3-11). Hex colours, bracketed values and spacing steps stay
// the job of tests/design-tokens.test.mjs, which scans components/ui.

const read = (name) => readFileSync(`components/ui/${name}`, "utf8");

test("nav compares locale-stripped paths", () => {
  const text = read("nav.tsx");
  assert.match(text, /import \{ stripLocale \} from "..\/..\/lib\/locale-path"/);
  assert.equal(text.includes("href === currentPath"), false);
  assert.ok((text.match(/stripLocale\(/g) ?? []).length >= 2);
});

test("MediaCard's button form opens a dialog once", () => {
  assert.equal((read("card.tsx").match(/aria-haspopup="dialog"/g) ?? []).length, 1);
});

test("Dialog detail keeps the scrim, the layer and the focus return", () => {
  const text = read("dialog.tsx");
  for (const part of ["onCloseAutoFocus", "max-w-calendar", "h-dock", "bg-ink/40", "z-70"]) {
    assert.ok(text.includes(part), `dialog.tsx lacks ${part}`);
  }
});

test("Chip removable form", () => {
  const text = read("chip.tsx");
  assert.ok(text.includes("aria-label={removeLabel}"));
  assert.ok(text.includes("bg-teal-tint"));
});

test("CheckboxGroup is a fieldset with a legend and no radio", () => {
  const text = read("checkbox-group.tsx");
  assert.ok(text.includes("<fieldset") && text.includes("<legend"));
  assert.equal(/radio/i.test(text), false);
});

test("CountBadge shows Western digits in a bdi", () => {
  const text = read("count-badge.tsx");
  assert.ok(text.includes("<bdi>") && text.includes("tabular-nums"));
  assert.equal(text.includes("toLocaleString"), false);
  assert.equal(text.includes("Intl."), false);
});
