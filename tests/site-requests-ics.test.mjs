// Plan 06-05 Task 3: the .ics of one consultation (RFC 5545). Written, not run (owner rule 2026-10-21).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadTs } from "./helpers/load-ts.mjs";

const { consultationIcs } = await loadTs("lib/site-requests/ics.ts");
const { INQUIRY_ADDRESS } = await loadTs("lib/contact-inquiry.ts");

const ics = (over = {}) =>
  consultationIcs({ bookingId: "b-1", start: "2026-11-03T10:30:00.000Z", minutes: 30, summary: "A call", description: "Details", now: new Date("2026-10-30T08:00:00.000Z"), ...over });

test("CRLF line ends, the frame and the fixed lines", () => {
  const text = ics();
  assert.equal(text.replace(/\r\n/g, "").includes("\n"), false);
  assert.ok(text.endsWith("END:VCALENDAR\r\n"));
  for (const line of ["BEGIN:VCALENDAR", "METHOD:PUBLISH", "PRODID:-//ALMAR Private Journey//Consultation//EN", "UID:b-1@almarprivatejourney.com", `ORGANIZER:mailto:${INQUIRY_ADDRESS}`]) {
    assert.ok(text.includes(`${line}\r\n`), line);
  }
  assert.equal(/ATTENDEE|RSVP/.test(text), false);
});

test("UTC times, 30 minutes apart", () => {
  const text = ics();
  assert.ok(text.includes("DTSTART:20261103T103000Z\r\n"));
  assert.ok(text.includes("DTEND:20261103T110000Z\r\n"));
  assert.ok(text.includes("DTSTAMP:20261030T080000Z\r\n"));
});

test("escapes backslash, semicolon, comma and new lines", () => {
  const text = ics({ summary: "a,b;c\\d\ne" }).replace(/\r\n /g, "");
  assert.ok(text.includes("SUMMARY:a\\,b\\;c\\\\d\\ne\r\n"));
});

test("folds at 75 octets, never inside a character", () => {
  const text = ics({ description: "ب".repeat(200) });
  const bytes = new TextEncoder();
  for (const line of text.split("\r\n")) assert.ok(bytes.encode(line).length <= 75, line);
  assert.ok(text.replace(/\r\n /g, "").includes(`DESCRIPTION:${"ب".repeat(200)}`));
  assert.equal(text.includes("�"), false);
});

test("the organizer in the source is the inbox address", () => {
  assert.ok(readFileSync("lib/site-requests/ics.ts", "utf8").includes(`"${INQUIRY_ADDRESS}"`));
});
