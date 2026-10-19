// Follow-up 2: the editor page's Back guard (components/ops/back-guard.ts) against a fake tab whose history runs a
// traversal later, as a browser does (history.back() returns at once; its popstate comes in a later task). The browser
// proof of the same cases (dev strict mode and the build, a navigation right after Save) is tests/ops-kit.spec.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { createBackGuards, trapOf, TRAP_KEY } = await loadTs("components/ops/back-guard.ts");

const LIST = "https://almar.test/dashboard/content/media";
const PREV = "https://almar.test/dashboard";
const OTHER = "https://almar.test/dashboard/catalog";

/** One browser tab: entries, the current one, traversals queued until `flush()`, and the steps the page asked for. */
function fakeTab(urls = [PREV, LIST], { cap = 50 } = {}) {
  const entries = urls.map((url) => ({ url, state: { __NA: true } }));
  let index = entries.length - 1;
  const listeners = [];
  const pending = [];
  const steps = [];
  let clock = 0;
  const go = (delta) => pending.push(delta);
  const tab = {
    history: {
      get state() {
        return entries[index].state;
      },
      get length() {
        return entries.length;
      },
      pushState(state, _title, url) {
        entries.splice(index + 1);
        entries.push({ url: url ?? entries[index].url, state: structuredClone(state) });
        if (entries.length > cap) entries.shift();
        index = entries.length - 1;
      },
      back() {
        steps.push("back");
        go(-1);
      },
    },
    location: {
      get href() {
        return entries[index].url;
      },
    },
    addEventListener(type, listener) {
      if (type === "popstate") listeners.push(listener);
    },
    now: () => clock,
    tick(ms) {
      clock += ms;
    },
    /** The owner's Back and Forward buttons (not the page's own steps). */
    userBack: () => go(-1),
    userForward: () => go(1),
    /** A link followed or a page.goto: a new entry at once (the forward entries go). */
    navigate(url) {
      entries.splice(index + 1);
      entries.push({ url, state: { __NA: true } });
      index = entries.length - 1;
    },
    /** A reload: a new document, so no listener of the old one is left. */
    reload() {
      listeners.length = 0;
      pending.length = 0;
    },
    /** Run every queued traversal, each firing popstate (a listener may queue more). */
    flush() {
      let guard = 0;
      while (pending.length > 0) {
        assert.ok((guard += 1) < 50, "traversals do not loop");
        const to = index + pending.shift();
        if (to < 0 || to >= entries.length) continue;
        index = to;
        for (const listener of [...listeners]) listener({ state: entries[index].state });
      }
    },
    get index() {
      return index;
    },
    entries,
    steps,
  };
  return tab;
}

const guardsFor = (tab) => createBackGuards(tab, tab.now);

test("the guard entry is flagged on history.state, keeping the router's own keys", () => {
  const tab = fakeTab();
  const id = guardsFor(tab).arm();
  assert.equal(tab.entries.length, 3);
  assert.equal(tab.entries[2].url, LIST);
  assert.equal(tab.entries[2].state.__NA, true, "Next's __NA is kept, so its router still handles the entry");
  assert.equal(trapOf(tab.entries[2].state), id);
  assert.equal(trapOf(tab.entries[1].state), null, "the page's own entry is not flagged");
  assert.equal(typeof TRAP_KEY, "string");
});

test("strict mode's double effect (arm, release, arm) adds one entry and takes no step: nothing to ask", () => {
  const tab = fakeTab();
  const guards = guardsFor(tab);
  const first = guards.arm();
  guards.release(first);
  const second = guards.arm();
  tab.flush();
  assert.equal(second, first, "the second arm stands on the same entry");
  assert.equal(tab.entries.length, 3, "one extra entry, not two");
  assert.deepEqual(tab.steps, [], "no history.back() whose popstate would reach the second guard");
  assert.equal(tab.index, 2);
});

test("strict mode's double mount as EditPage runs it (loaded, arm, release, loaded, arm): no step, so nothing is asked", () => {
  // Run (b) 2026-10-17: the second loaded() found the entry this page had just pushed, took it for a reload's spare
  // and stepped back; EditPage's popstate listener then asked "Discard changes?" at once.
  const tab = fakeTab();
  const guards = guardsFor(tab);
  guards.loaded();
  const first = guards.arm();
  guards.release(first);
  guards.loaded();
  const second = guards.arm();
  tab.flush();
  assert.equal(second, first);
  assert.deepEqual(tab.steps, [], "no history.back(): no popstate reaches the page");
  assert.equal(tab.index, 2);
});

test("Save closes the page, then a navigation starts at once: it is neither undone nor aborted", () => {
  const tab = fakeTab();
  const guards = guardsFor(tab);
  const id = guards.arm();
  guards.release(id); // saved: the page closes
  tab.navigate(OTHER); // page.goto right away
  tab.flush();
  assert.deepEqual(tab.steps, [], "no step at close");
  assert.equal(tab.location.href, OTHER, "the new page stays");
});

test("after Save, one Back leaves the page (the spare entry and its page count as one)", () => {
  const tab = fakeTab();
  const guards = guardsFor(tab);
  guards.release(guards.arm());
  tab.userBack();
  tab.flush();
  assert.equal(tab.location.href, PREV);
  assert.equal(tab.index, 0);
});

test("Back from a later page onto the spare entry lands on the list once; the next Back goes on normally", () => {
  const tab = fakeTab();
  const guards = guardsFor(tab);
  guards.release(guards.arm());
  tab.navigate(OTHER);
  tab.userBack();
  tab.flush();
  assert.equal(tab.index, 1, "stepped off the spare entry onto the list's own entry");
  assert.equal(tab.location.href, LIST);
  tab.tick(2000);
  tab.userBack();
  tab.flush();
  assert.equal(tab.index, 0, "one more Back reaches the page before, not further");
});

test("a reload with unsaved changes steps off the guard entry; Forward after it steps off again", () => {
  const tab = fakeTab();
  guardsFor(tab).arm();
  tab.reload();
  const after = guardsFor(tab);
  after.loaded();
  tab.flush();
  assert.equal(tab.index, 1, "the load on the guard entry stepped back once");
  tab.tick(2000);
  tab.userForward();
  tab.flush();
  assert.equal(tab.index, 1, "Forward onto the spare entry is stepped off (same document)");
  // Forward that loads the entry afresh (the browser dropped the document): the new load finds the flag.
  tab.reload();
  tab.tick(2000);
  tab.userForward();
  tab.flush();
  assert.equal(tab.index, 2);
  guardsFor(tab).loaded();
  tab.flush();
  assert.equal(tab.index, 1, "a fresh load on the spare entry steps back off it");
});

test("strict mode's double mount runs loaded() twice: one step, not two", () => {
  const tab = fakeTab();
  guardsFor(tab).arm();
  tab.reload();
  const after = guardsFor(tab);
  after.loaded();
  after.loaded();
  tab.flush();
  assert.deepEqual(tab.steps, ["back"]);
  assert.equal(tab.index, 1);
});

test("the flag alone decides: a load at the history cap, on the same address and length, without it takes no step", () => {
  const tab = fakeTab([LIST, LIST, LIST], { cap: 3 });
  const guards = guardsFor(tab);
  guards.release(guards.arm()); // the oldest entry falls off; length stays 3
  assert.equal(tab.entries.length, 3);
  tab.reload();
  tab.entries[tab.index].state = { __NA: true }; // a location.replace on the same address
  guardsFor(tab).loaded();
  tab.flush();
  assert.deepEqual(tab.steps, [], "an entry that is not a guard entry is never stepped off");
});

test("while the guard is owned the watcher stays out: Back lands on the page for the question, a confirmed link's step is the page's", () => {
  const tab = fakeTab();
  const guards = guardsFor(tab);
  guards.arm();
  tab.userBack();
  tab.flush();
  assert.equal(tab.index, 1, "Back from the owned entry stops on the page (the page asks)");
  assert.deepEqual(tab.steps, []);
  guards.arm(); // Keep editing: the entry goes back on
  assert.equal(tab.entries.length, 3);
  tab.history.back(); // Discard on a rail link: the page takes the entry away itself
  tab.flush();
  assert.deepEqual(tab.steps, ["back"], "no second step from the watcher");
  assert.equal(tab.index, 1);
});

test("edit-page.tsx guards through back-guard.ts: no address-and-length mark, no step in the guard's cleanup", () => {
  const source = readFileSync("components/ops/edit-page.tsx", "utf8");
  assert.match(source, /from "\.\/back-guard"/);
  assert.equal(/sessionStorage|history\.length/.test(source), false);
  const cleanup = source.slice(source.indexOf("return () => {\n      document.removeEventListener(\"click\", onClick, true);"));
  const body = cleanup.slice(0, cleanup.indexOf("}, [open, dirty]);"));
  assert.match(body, /guards\.release\(trap\)/);
  assert.equal(/history\.back\(\)/.test(body), false, "closing or saving takes no history step");
});
