import { expect, test } from "@playwright/test";
import { OPS_MONEY_COPY } from "../lib/copy/ops-money";

// Plan 04-09 Task 3: the Money Settings section is presentational. The picture scenes and the shoot were replaced by
// the signed HTML page (owner, 2026-10-25: no test, no shoot), so this spec holds the copy walk. The page-level
// asserts (exactly one button named exactly "Save", the section's own button named "Save bank transfer", bite check
// B12) are in tests/ops-settings.spec.ts. Written and not run in this job.

type Walk = Record<string, unknown>;

function leaves(value: unknown, path: string, out: [string, unknown][]): void {
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value as Walk)) leaves(child, path ? `${path}.${key}` : key, out);
  } else {
    out.push([path, value]);
  }
}

test("copy: same keys in en, ar and es at every depth, every leaf a non-empty string", () => {
  const base: [string, unknown][] = [];
  leaves(OPS_MONEY_COPY.en, "", base);
  const keys = base.map(([path]) => path).sort();
  for (const locale of ["en", "ar", "es"] as const) {
    const out: [string, unknown][] = [];
    leaves(OPS_MONEY_COPY[locale], "", out);
    expect(out.map(([path]) => path).sort(), `${locale} keys`).toEqual(keys);
    for (const [path, value] of out) {
      expect(typeof value, `${locale}.${path}`).toBe("string");
      expect((value as string).trim(), `${locale}.${path} empty`).not.toBe("");
      expect(value as string, `${locale}.${path}`).not.toMatch(/\[object|undefined|NaN/);
    }
  }
});

test("copy: the section's own button is never the bare word Save, and the confirm says no email is sent", () => {
  for (const locale of ["en", "ar", "es"] as const) {
    const copy = OPS_MONEY_COPY[locale];
    expect(copy.save).not.toBe("Save");
    expect(copy.confirm.noEmailNote.trim()).not.toBe("");
  }
});
