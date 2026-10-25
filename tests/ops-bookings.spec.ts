import { expect, test } from "@playwright/test";
import { OPS_BOOKINGS_COPY } from "../lib/copy/ops-bookings";

// Plan 04-09 Task 2: the bookings list, detail and dialogs are presentational components. The picture scenes and the
// shoot were replaced by the signed HTML page (owner, 2026-10-25: no test, no shoot), so this spec holds the copy walk
// only. It is written and not run in this job.

type Walk = Record<string, unknown>;

function leaves(value: unknown, path: string, out: [string, unknown][]): void {
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Walk)) leaves(child, path ? `${path}.${key}` : key, out);
  } else {
    out.push([path, value]);
  }
}

function keysOf(value: unknown): string[] {
  const out: [string, unknown][] = [];
  leaves(value, "", out);
  return out.map(([path]) => path).sort();
}

test("copy: same keys in en, ar and es at every depth, every leaf a non-empty string", () => {
  const keys = keysOf(OPS_BOOKINGS_COPY.en);
  for (const locale of ["en", "ar", "es"] as const) {
    expect(keysOf(OPS_BOOKINGS_COPY[locale]), `${locale} keys`).toEqual(keys);
    const out: [string, unknown][] = [];
    leaves(OPS_BOOKINGS_COPY[locale], "", out);
    for (const [path, value] of out) {
      expect(typeof value, `${locale}.${path}`).toBe("string");
      expect((value as string).trim(), `${locale}.${path} empty`).not.toBe("");
      expect(value as string, `${locale}.${path}`).not.toMatch(/\[object|undefined|NaN/);
    }
  }
});

test("copy: the signature's added detail strings exist in all three languages", () => {
  for (const locale of ["en", "ar", "es"] as const) {
    const detail = OPS_BOOKINGS_COPY[locale].detail;
    for (const key of ["adults", "children", "infants", "language", "quantity"] as const) {
      expect(detail[key].trim(), `${locale}.detail.${key}`).not.toBe("");
    }
    expect(Object.keys(detail.travellerKinds).sort()).toEqual(["adult", "child", "infant"]);
    expect(Object.keys(detail.lineUnit).sort()).toEqual(["night", "person", "trip"]);
  }
});
