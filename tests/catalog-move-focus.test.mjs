// Review round 3 of PR #18: after a catalog reorder, focus goes back to the moved row only when it was lost, never
// away from a control the owner Tabbed to while the order was on its way (catalog/move-focus.ts).
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { focusWasLost } = await loadTs("app/dashboard/(ops)/catalog/move-focus.ts");

const body = { isConnected: true };
const node = (isConnected = true) => ({ isConnected });

test("focusWasLost: nothing focused is lost", () => {
  assert.equal(focusWasLost(null, body), true);
});

test("focusWasLost: focus on the page body is lost", () => {
  assert.equal(focusWasLost(body, body), true);
});

test("focusWasLost: a focused node the list replaced (no longer in the document) is lost", () => {
  assert.equal(focusWasLost(node(false), body), true);
});

test("focusWasLost: a control the owner Tabbed to (another row, a filter, the nav) is not lost", () => {
  assert.equal(focusWasLost(node(true), body), false);
});
