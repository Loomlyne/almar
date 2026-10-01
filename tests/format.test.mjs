import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatAmountLatn, formatDate, westernDigits } from "../lib/format.ts";

test("dates are DD/MM/YYYY", () => {
  assert.equal(formatDate(23, 9, 2026), "23/09/2026");
  assert.equal(formatDate(1, 1, 2027), "01/01/2027");
});

test("the calendar reads weeks en-GB and starts on Monday", () => {
  const calendar = readFileSync("components/ui/calendar.tsx", "utf8");
  assert.match(calendar, /getDayOfWeek\([^)]*"en-GB"\)/);
  const labels = calendar.match(/\["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"\]/);
  assert.ok(labels, "week labels run Mo to Su");
  assert.equal(/\["Su", "Mo"/.test(calendar), false);
});

test("Arabic-Indic and Persian digits become Western digits; other text is kept", () => {
  assert.equal(westernDigits("٠١٢٣٤٥٦٧٨٩"), "0123456789");
  assert.equal(westernDigits("۰۱۲۳۴۵۶۷۸۹"), "0123456789");
  assert.equal(westernDigits("+٩٧١ ٥٦"), "+971 56");
  assert.equal(westernDigits("abc 12"), "abc 12");
});

test("amounts keep Western numerals", () => {
  assert.equal(/[٠-٩]/.test(formatAmountLatn("AED", 1250)), false);
});
