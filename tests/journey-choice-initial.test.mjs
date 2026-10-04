import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

// Plan 03.3-31: JourneyChoiceProvider gains initialDestinationId. The restore logic is a pure exported function,
// so this test runs the real code; the file text check proves nothing is stored before the visitor changes a value.

const SOURCE = "components/pages/home/journey-choice.tsx";

async function load() {
  const { build } = await import("esbuild");
  const out = await build({
    stdin: { contents: `export { restoreState, EMPTY_JOURNEY } from "./${SOURCE}";`, resolveDir: process.cwd(), loader: "ts" },
    bundle: true,
    platform: "node",
    format: "cjs",
    write: false,
    jsx: "automatic",
    logLevel: "silent",
  });
  const file = join(mkdtempSync(join(tmpdir(), "almar-jc-")), "mod.cjs");
  writeFileSync(file, out.outputFiles[0].text);
  return createRequire(file)(file);
}

const { restoreState } = await load();
const known = (id) => id === "dest-a" || id === "dest-b";
const stored = (over = {}) => ({
  destination_id: null,
  from: null,
  to: null,
  adults: 1,
  children: 0,
  infants: 0,
  guests_set: false,
  ...over,
});
const text = (d) => (d ? d.toString() : null);

test("no storage: the initial destination alone", () => {
  const s = restoreState(null, "dest-a", known);
  assert.equal(s.value.destinationId, "dest-a");
  assert.equal(s.value.start, null);
  assert.equal(s.guestsSet, false);
  assert.equal(restoreState(null, undefined, known).value.destinationId, null);
});

test("storage with another destination: the initial one stays, dates and guests come from storage", () => {
  const s = restoreState(
    stored({ destination_id: "dest-b", from: "2099-01-10", to: "2099-01-14", adults: 3, guests_set: true }),
    "dest-a",
    known,
  );
  assert.equal(s.value.destinationId, "dest-a");
  assert.equal(text(s.value.start), "2099-01-10");
  assert.equal(text(s.value.end), "2099-01-14");
  assert.equal(s.value.adults, 3);
  assert.equal(s.guestsSet, true);
});

test("storage with dates only keeps the initial destination", () => {
  const s = restoreState(stored({ from: "2099-02-01", to: "2099-02-03" }), "dest-b", known);
  assert.equal(s.value.destinationId, "dest-b");
  assert.equal(text(s.value.start), "2099-02-01");
});

test("an unknown stored id is dropped when there is no initial destination", () => {
  assert.equal(restoreState(stored({ destination_id: "nowhere" }), undefined, known).value.destinationId, null);
  assert.equal(restoreState(stored({ destination_id: "dest-b" }), undefined, known).value.destinationId, "dest-b");
  assert.equal(restoreState(stored({ destination_id: "nowhere" }), "dest-a", known).value.destinationId, "dest-a");
});

test("nothing is written to sessionStorage outside setValue", () => {
  const source = readFileSync(SOURCE, "utf8");
  assert.equal((source.match(/setItem\(/g) ?? []).length, 1, "exactly one setItem");
  const setValueBody = source.slice(source.indexOf("const setValue = useCallback"));
  assert.ok(setValueBody.includes("setItem("), "the one setItem is inside setValue");
  assert.equal(source.slice(0, source.indexOf("const setValue = useCallback")).includes("setItem("), false);
});
