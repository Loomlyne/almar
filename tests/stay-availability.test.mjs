// Plan 03.3-40: the availability rule of the one StayFilter. A stay is kept for [from, to) only when none of its
// blocked dates d satisfies from <= d < to (the departure day may be blocked). The server read and the browser
// list use the same function; parseStayQuery keeps from/to only as a pair with from < to.
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const filterMod = await loadTs("lib/data/stay-filter.ts");
const staysMod = await loadTs("lib/data/stays.ts");
const { isFreeBetween, matchesStayFilter, filterStays, parseStayQuery } = filterMod;
const { getStays } = staysMod;

const LOCALES = ["en", "ar", "es"];
const slugs = (list) => list.map((s) => s.slug);

test("isFreeBetween: [from, to) against blocked dates", () => {
  assert.equal(isFreeBetween(["2026-10-14"], "2026-10-12", "2026-10-15"), false, "a blocked night inside the stay");
  assert.equal(isFreeBetween(["2026-10-15"], "2026-10-12", "2026-10-15"), true, "the departure day may be blocked");
  assert.equal(isFreeBetween([], "2026-10-12", "2026-10-15"), true, "nothing blocked");
  assert.equal(isFreeBetween(["2026-10-12"], "2026-10-12", "2026-10-15"), false, "the arrival day blocked");
  assert.equal(isFreeBetween(["2026-10-11"], "2026-10-12", "2026-10-15"), true, "the day before arrival");
});

test("matchesStayFilter applies the dates only when both are set and from < to", () => {
  const base = { destination_slug: "x", destination_name: "X", title: "T", neighborhood: null, max_guests: 4, bedrooms: 2 };
  const blocked = { ...base, blocked_dates: ["2026-10-14"] };
  assert.equal(matchesStayFilter(blocked, { from: "2026-10-12", to: "2026-10-15" }), false);
  assert.equal(matchesStayFilter(blocked, { from: "2026-10-12", to: "2026-10-14" }), true);
  assert.equal(matchesStayFilter(blocked, { from: "2026-10-12" }), true, "from alone is ignored");
  assert.equal(matchesStayFilter(blocked, { to: "2026-10-15" }), true, "to alone is ignored");
  assert.equal(matchesStayFilter(blocked, { from: "2026-10-15", to: "2026-10-12" }), true, "reversed range is ignored");
  assert.equal(matchesStayFilter(base, { from: "2026-10-12", to: "2026-10-15" }), true, "no blocked_dates property is free");
});

const RANGES = [
  { from: "2026-10-12", to: "2026-10-15" },
  { from: "2026-10-14", to: "2026-10-17" },
  { from: "2026-11-10", to: "2026-11-14" },
];

for (const locale of LOCALES) {
  test(`server read and client filter agree on the dates (${locale})`, async () => {
    const all = await getStays(locale);
    let excluded = 0;
    for (const range of RANGES) {
      const server = slugs(await getStays(locale, range));
      const client = slugs(filterStays(all, range));
      assert.deepEqual(client, server, `${locale} ${range.from}..${range.to}`);
      excluded += all.length - server.length;
    }
    assert.ok(excluded > 0, "at least one range excludes at least one stay");
    const jardin = slugs(await getStays(locale, RANGES[1]));
    assert.ok(!jardin.includes("casa-jardin-san-diego"), "casa-jardin-san-diego is blocked 14-16 Oct");
  });
}

test("parseStayQuery keeps from/to only as a pair with from < to", () => {
  const q = (s) => parseStayQuery(new URLSearchParams(s));
  assert.deepEqual(q("from=2026-10-15&to=2026-10-12"), {});
  assert.deepEqual(q("from=2026-10-12"), {});
  assert.deepEqual(q("to=2026-10-12"), {});
  assert.deepEqual(q("from=2026-10-12&to=2026-10-12"), {});
  assert.deepEqual(q("from=2026-10-12&to=2026-10-15"), { from: "2026-10-12", to: "2026-10-15" });
  assert.deepEqual(q("Bad_Slug&guests=-1&from=2026-13-40&to=2026-13-41"), {}, "bad guests and impossible dates still dropped");
  assert.deepEqual(q("destination=Bad_Slug&from=2026-10-12&to=2026-10-15"), { from: "2026-10-12", to: "2026-10-15" }, "bad slug dropped");
  assert.deepEqual(q("destination=cartagena&guests=2&from=2026-10-12&to=2026-10-15"), {
    destination: "cartagena",
    guests: 2,
    from: "2026-10-12",
    to: "2026-10-15",
  });
});
