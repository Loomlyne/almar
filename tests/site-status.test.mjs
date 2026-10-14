// Plan 03.2-05 Task 2: the status rules (contract §6, research §1.3). Pure.
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { computeSiteStatus, siteStatusTime, formatSiteTime, isHookError, UPDATING_LIMIT_MINUTES } = await loadTs("lib/ops/site-status.ts");

const NOW = new Date("2026-10-13T10:30:00.000Z");
const ago = (minutes) => new Date(NOW.getTime() - minutes * 60_000).toISOString();
const state = (over = {}) => ({ requested_seq: 5, requested_at: ago(3), last_hook_at: ago(3), last_hook_result: "ok", ...over });

test("the limit is 28 minutes (20 min build timeout + settle + deploy margin)", () => {
  assert.equal(UPDATING_LIMIT_MINUTES, 28);
});

test("live 5, requested 5: up to date, time = built_at", () => {
  const site = computeSiteStatus(state(), { seq: 5, built_at: "2026-10-13T10:05:00.000Z" }, NOW);
  assert.equal(site.state, "up_to_date");
  assert.equal(site.live_seq, 5);
  assert.equal(siteStatusTime(site), "2026-10-13T10:05:00.000Z");
});

test("live ahead of the request (a later build) is up to date too", () => {
  assert.equal(computeSiteStatus(state(), { seq: 6, built_at: null }, NOW).state, "up_to_date");
});

test("live 4, requested 5 three minutes ago, hook ok: updating, time = requested_at", () => {
  const site = computeSiteStatus(state(), { seq: 4, built_at: ago(60) }, NOW);
  assert.equal(site.state, "updating");
  assert.equal(siteStatusTime(site), ago(3));
});

test("already_exists counts as a started build", () => {
  assert.equal(computeSiteStatus(state({ last_hook_result: "already_exists" }), { seq: 4, built_at: null }, NOW).state, "updating");
});

test("requested 29 minutes ago and still behind: failed, time = requested_at + 28 min", () => {
  const site = computeSiteStatus(state({ requested_at: ago(29) }), { seq: 4, built_at: null }, NOW);
  assert.equal(site.state, "failed");
  assert.equal(siteStatusTime(site), ago(1));
  assert.equal(computeSiteStatus(state({ requested_at: ago(27.9) }), { seq: 4, built_at: null }, NOW).state, "updating");
});

test("a hook result starting with 'error' fails at once, time = last_hook_at", () => {
  for (const result of ["error", "error:no_hook", "error:503", "error:network"]) {
    const site = computeSiteStatus(state({ last_hook_result: result, last_hook_at: ago(1) }), { seq: 4, built_at: null }, NOW);
    assert.equal(site.state, "failed", result);
    assert.equal(siteStatusTime(site), ago(1));
  }
  assert.equal(isHookError("errors"), false);
  assert.equal(isHookError("ok"), false);
  assert.equal(isHookError(null), false);
});

test("a failed hook does not matter once the live site has caught up", () => {
  assert.equal(computeSiteStatus(state({ last_hook_result: "error:503" }), { seq: 5, built_at: null }, NOW).state, "up_to_date");
});

test("live unreadable (null): unavailable with no time, fresh or old request, behind or not (PR #13 finding 2)", () => {
  for (const over of [{}, { requested_at: ago(40) }, { requested_seq: 0, requested_at: null, last_hook_at: null, last_hook_result: null }]) {
    const site = computeSiteStatus(state(over), null, NOW);
    assert.equal(site.state, "unavailable", JSON.stringify(over));
    assert.equal(site.built_at, null);
    assert.equal(siteStatusTime(site), null);
  }
});

test("live unreadable but the hook call itself failed: still failed (that build never started)", () => {
  const site = computeSiteStatus(state({ last_hook_result: "error:503", last_hook_at: ago(1) }), null, NOW);
  assert.equal(site.state, "failed");
  assert.equal(siteStatusTime(site), ago(1));
});

test("live 404 (seq 0) with a request: updating, then failed", () => {
  assert.equal(computeSiteStatus(state({ requested_seq: 1 }), { seq: 0, built_at: null }, NOW).state, "updating");
  assert.equal(computeSiteStatus(state({ requested_seq: 1, requested_at: ago(40) }), { seq: 0, built_at: null }, NOW).state, "failed");
});

test("the reply carries every SiteStatus field of contract §6", () => {
  const site = computeSiteStatus(state(), { seq: 4, built_at: "2026-10-13T09:00:00.000Z" }, NOW);
  assert.deepEqual(Object.keys(site).sort(), ["built_at", "last_hook_at", "last_hook_result", "live_seq", "requested_at", "requested_seq", "state"]);
});

test("time is 24-hour UAE time with Western digits", () => {
  assert.equal(formatSiteTime("2026-10-13T10:05:00.000Z"), "14:05");
  assert.equal(formatSiteTime("2026-10-13T20:30:00.000Z"), "00:30");
  assert.equal(formatSiteTime(null), null);
  assert.equal(formatSiteTime("not a date"), null);
});
