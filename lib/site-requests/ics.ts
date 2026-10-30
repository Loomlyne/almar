// One consultation as an RFC 5545 calendar file (plan 06-05, T-06-05-02). Pure. CRLF line ends, lines folded at 75 octets on
// a character boundary, text escaped (backslash, semicolon, comma, new line), every time in UTC. No attendee and no RSVP:
// the file only puts the call in the calendar; a guest cancels by replying to the email (F-04).

const ORGANIZER = "inquiries@almarprivatejourney.com"; // INQUIRY_ADDRESS; this file stays import-free (tests/site-requests-ics.test.mjs pins the two).
const BYTES = new TextEncoder();

function icsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n?|\n/g, "\\n")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "");
}

function icsTime(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

/** At most 75 octets a line, a continuation starting with one space (which counts); a character is never split. */
function fold(line: string): string {
  if (BYTES.encode(line).length <= 75) return line;
  const parts: string[] = [];
  let part = "";
  let size = 0;
  for (const char of line) {
    const width = BYTES.encode(char).length;
    if (size + width > 75) {
      parts.push(part);
      part = " ";
      size = 1;
    }
    part += char;
    size += width;
  }
  parts.push(part);
  return parts.join("\r\n");
}

export function consultationIcs({
  bookingId,
  start,
  minutes = 30,
  summary,
  description,
  now,
}: {
  bookingId: string;
  /** ISO UTC. */
  start: string;
  minutes?: number;
  summary: string;
  description: string;
  now: Date;
}): string {
  const at = new Date(start).getTime();
  if (Number.isNaN(at)) throw new Error("consultationIcs: start is not a date");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//ALMAR Private Journey//Consultation//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${bookingId}@almarprivatejourney.com`,
    `DTSTAMP:${icsTime(now.getTime())}`,
    `DTSTART:${icsTime(at)}`,
    `DTEND:${icsTime(at + minutes * 60000)}`,
    `SUMMARY:${icsText(summary)}`,
    `DESCRIPTION:${icsText(description)}`,
    `ORGANIZER:mailto:${ORGANIZER}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(fold).join("\r\n")}\r\n`;
}
