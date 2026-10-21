import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Owner standing rule: a password field's show/hide eye sits on the PHYSICAL right, Arabic (RTL) included.
// Logical utilities (inset-e-*, pe-*) flip under dir="rtl" and put it on the left.
const text = readFileSync("components/ui/field.tsx", "utf8");
const block = text.slice(text.indexOf("function PasswordControl"), text.indexOf("function EyeIcon"));

test("password eye is pinned to the physical right in every direction", () => {
  assert.ok(block.length > 0, "PasswordControl not found");
  // ltr: inline-end is the right; rtl: inline-start is the right. A bare logical side would flip.
  assert.match(block, /className="absolute top-1\/2 ltr:inset-e-1 rtl:inset-s-1 /, "eye button: ltr end, rtl start");
  assert.match(block, /cn\(INPUT, "ltr:pe-12 rtl:ps-12"\)/, "input reserves the right side for the eye in both directions");
  const bareSide = block.match(/(?<![:\w-])(?:inset-[se]|p[se]|start|end)-[\w/]+/g) ?? [];
  assert.deepEqual(bareSide, [], "no direction-less side utility in PasswordControl");
});
