// Plan 06-05 Task 3: the consultation's times for a person. Written, not run (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { loadTs } from "./helpers/load-ts.mjs";

const { groupSlots, dubaiLabel, isTimeZone } = await loadTs("lib/site-requests/slots.ts");

test("isTimeZone: what Intl accepts", () => {
  assert.equal(isTimeZone("Europe/Madrid"), true);
  assert.equal(isTimeZone("Mars/Olympus"), false);
  assert.equal(isTimeZone(""), false);
});

test("dubaiLabel: 24-hour, Latin digits in Arabic too", () => {
  assert.equal(dubaiLabel("2026-11-03T10:00:00.000Z", "en"), "14:00");
  assert.equal(dubaiLabel("2026-11-03T10:00:00.000Z", "ar"), "14:00");
});

test("groupSlots: by the guest's local day, each slot with her time and Dubai's", () => {
  const days = groupSlots(["2026-11-03T10:00:00.000Z", "2026-11-03T10:30:00.000Z", "2026-11-03T23:30:00.000Z"], "Europe/Madrid", "es");
  assert.deepEqual(days, [
    {
      day: "2026-11-03",
      slots: [
        { start: "2026-11-03T10:00:00.000Z", local: "11:00", dubai: "14:00" },
        { start: "2026-11-03T10:30:00.000Z", local: "11:30", dubai: "14:30" },
      ],
    },
    { day: "2026-11-04", slots: [{ start: "2026-11-03T23:30:00.000Z", local: "00:30", dubai: "03:30" }] },
  ]);
});

test("groupSlots: a guest in Dubai has no second label", () => {
  assert.equal(groupSlots(["2026-11-03T10:00:00.000Z"], "Asia/Dubai", "en")[0].slots[0].dubai, null);
});
