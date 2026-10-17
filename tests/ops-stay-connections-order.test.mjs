// 03.2-07, owner 2026-10-17 (.planning/decisions/2026-10-17-stay-connections-order.md): a stay's connected experiences
// and services get Move up / Move down. The kit's pure move (components/ops/connect-order.ts), the editor's grouping by
// kind, and the order the stay save sends (the server numbers each kind's ids from 0 in that order).
import test from "node:test";
import assert from "node:assert/strict";
import { canMove, moveConnected } from "../components/ops/connect-order.ts";
import { emptyStayForm, groupByKind, stayPayload } from "../app/dashboard/(ops)/catalog/stays/stay-forms.ts";

const KIND = { e1: "experience", e2: "experience", e3: "experience", v1: "service", v2: "service" };
const kindOf = (id) => KIND[id];
const sameKind = (a, b) => kindOf(a) === kindOf(b);

test("Move up / Move down swap neighbours and are off at the ends", () => {
  assert.deepEqual(moveConnected(["a", "b", "c"], "b", -1), ["b", "a", "c"]);
  assert.deepEqual(moveConnected(["a", "b", "c"], "b", 1), ["a", "c", "b"]);
  assert.equal(canMove(["a", "b", "c"], "a", -1), false);
  assert.equal(canMove(["a", "b", "c"], "c", 1), false);
  assert.equal(canMove(["a", "b", "c"], "x", 1), false);
  const ids = ["a", "b"];
  assert.equal(moveConnected(ids, "a", -1), ids, "a move that cannot happen hands back the same list");
});

test("a row moves only within its kind: the last experience cannot go below the first service", () => {
  const ids = ["e1", "e2", "v1", "v2"];
  assert.equal(canMove(ids, "e2", 1, sameKind), false);
  assert.equal(canMove(ids, "v1", -1, sameKind), false);
  assert.equal(canMove(ids, "e2", -1, sameKind), true);
  assert.deepEqual(moveConnected(ids, "v2", -1, sameKind), ["e1", "e2", "v2", "v1"]);
  assert.deepEqual(moveConnected(ids, "e2", 1, sameKind), ids);
});

test("the editor keeps experiences first, then services, each in its own order", () => {
  assert.deepEqual(groupByKind(["v2", "e3", "v1", "e1"], kindOf), ["e3", "e1", "v2", "v1"]);
});

test("Save sends each kind's ids in the order shown, so the server stores positions 0, 1, 2 in that order", () => {
  const saved = { ...emptyStayForm(), connected: ["e1", "e2", "e3", "v1", "v2"] };
  saved.facts = { ...saved.facts, destinationId: "d1", slug: "stay-one" };
  saved.english = { ...saved.english, title: "[Stay]" };
  let connected = saved.connected;
  connected = moveConnected(connected, "e3", -1, sameKind);
  connected = moveConnected(connected, "e3", -1, sameKind);
  connected = moveConnected(connected, "v2", -1, sameKind);
  const form = { ...saved, connected: [...connected] };
  const body = stayPayload(form, saved, { id: "s1", publish: false, live: {}, kindOf });
  assert.deepEqual(body.item.connections, { experience_ids: ["e3", "e1", "e2"], service_ids: ["v2", "v1"] });
  // Same order as saved: the join set is left out, so nothing is rewritten.
  const unchanged = stayPayload(saved, saved, { id: "s1", publish: false, live: {}, kindOf });
  assert.equal("connections" in unchanged.item, false);
});
