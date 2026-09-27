import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const BOOKER = "components/specimens/hero-booker.tsx";

const DESTINATIONS = ["Cartagena", "Medellín", "Bogotá", "San Andrés", "Cocora Valley"];
const QUERY_KEYS = ["where", "check-in", "check-out", "adults", "children", "infants"];

test("booker source names the five destinations and six query keys", () => {
  const text = readFileSync(BOOKER, "utf8");
  for (const name of DESTINATIONS) {
    assert.equal(text.includes(name), true, name);
  }
  for (const key of QUERY_KEYS) {
    assert.match(text, new RegExp(`name="${key}"`));
  }
  assert.match(text, /Search is a preview on this page\./);
});
